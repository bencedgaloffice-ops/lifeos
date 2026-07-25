"use server";

/**
 * AI-researched grocery prices for the shopping list.
 *
 * See lib/kitchen/research.ts for why this estimates rather than scrapes.
 * Everything written here is flagged `source = 'ai_estimate'` so the rest of
 * the app can tell a guess from a shelf price the user actually saw.
 *
 * Requires ANTHROPIC_API_KEY. Without it every caller returns a clear
 * "not configured" result — the shopping planner keeps working exactly as
 * before on observed prices alone.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { askClaude, isAnthropicConfigured } from "@/lib/jarvis/llm";
import type { Store, ShoppingListItem, StorePrice } from "@/lib/types";
import {
  RESEARCH_SYSTEM,
  RESEARCH_BATCH_LIMIT,
  buildResearchPrompt,
  parseResearch,
  isResearchable,
} from "@/lib/kitchen/research";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type ResearchOutcome = {
  ok: boolean;
  /** Machine-readable so the UI can pick a translated message. */
  reason: "ok" | "not_configured" | "no_stores" | "unresearchable" | "failed" | "no_prices";
  /** Items researched and how many chain prices each produced. */
  results: { item: string; count: number; note: string | null }[];
};

const EMPTY = (reason: ResearchOutcome["reason"]): ResearchOutcome => ({ ok: false, reason, results: [] });

/**
 * Keyless web context. Realistically this almost never returns a price — no
 * public source publishes Hungarian shelf prices as structured data — but it
 * costs nothing, and on the rare hit (a well-known branded product) it makes
 * the estimate materially better. Failure is silent and non-blocking.
 */
async function webContext(item: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(`${item} ár Magyarország`)}&format=json&no_html=1&skip_disambig=1`,
      {
        signal: ctrl.signal,
        headers: { "User-Agent": "LifeOS-Kitchen/1.0 (personal assistant)", Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Answer?: string; AbstractText?: string; Definition?: string };
    const snippet = (data.Answer || data.AbstractText || data.Definition || "").trim();
    return snippet ? snippet.slice(0, 400) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Research one item and replace its previous estimates. Returns how many
 * chain prices were written. Throws nothing — failures come back as counts. */
async function researchOne(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  itemName: string,
  stores: Store[],
): Promise<{ item: string; count: number; note: string | null }> {
  const slugs = stores.map((s) => s.slug);
  const context = await webContext(itemName);
  const raw = await askClaude(RESEARCH_SYSTEM, buildResearchPrompt(itemName, slugs, context), 700);
  const parsed = parseResearch(raw, slugs);
  if (!parsed) return { item: itemName, count: 0, note: null };

  const bySlug = new Map(stores.map((s) => [s.slug, s.id]));
  const rows = parsed.prices
    .map((p) => ({
      user_id: userId,
      store_id: bySlug.get(p.slug)!,
      item_name: itemName,
      unit: parsed.unit,
      price_huf: p.priceHuf,
      source: "ai_estimate" as const,
      confidence: p.confidence,
      note: parsed.note,
    }))
    .filter((r) => r.store_id);

  // Re-researching replaces the old estimates rather than stacking duplicates.
  // Observed prices are never touched.
  await supabase
    .from("store_prices")
    .delete()
    .eq("user_id", userId)
    .eq("source", "ai_estimate")
    .ilike("item_name", itemName);

  if (rows.length) await supabase.from("store_prices").insert(rows);
  return { item: itemName, count: rows.length, note: parsed.note };
}

/** Research a single item — the button next to a list entry with no price. */
export async function researchItemPrices(itemName: string): Promise<ResearchOutcome> {
  const name = itemName.trim();
  if (!isResearchable(name)) return EMPTY("unresearchable");
  if (!isAnthropicConfigured()) return EMPTY("not_configured");

  const { supabase, user } = await requireUser();
  const { data: stores } = await supabase.from("stores").select("*");
  const chains = (stores as Store[]) ?? [];
  if (!chains.length) return EMPTY("no_stores");

  const result = await researchOne(supabase, user.id, name, chains);
  revalidatePath("/dashboard/kitchen");

  if (!result.count) return { ok: false, reason: "no_prices", results: [result] };
  return { ok: true, reason: "ok", results: [result] };
}

/**
 * Research every outstanding list item that has no price yet, so the totals
 * across chains become comparable in one click. Capped at RESEARCH_BATCH_LIMIT
 * items per run and executed in small concurrent batches — one click should
 * never fan out into forty simultaneous model calls.
 */
export async function researchShoppingList(): Promise<ResearchOutcome> {
  if (!isAnthropicConfigured()) return EMPTY("not_configured");

  const { supabase, user } = await requireUser();
  const [{ data: stores }, { data: list }, { data: prices }] = await Promise.all([
    supabase.from("stores").select("*"),
    supabase.from("shopping_list_items").select("*").eq("checked", false),
    supabase.from("store_prices").select("item_name"),
  ]);

  const chains = (stores as Store[]) ?? [];
  if (!chains.length) return EMPTY("no_stores");

  const priced = new Set(
    ((prices as Pick<StorePrice, "item_name">[]) ?? []).map((p) => p.item_name.trim().toLowerCase()),
  );

  const seen = new Set<string>();
  const todo: string[] = [];
  for (const item of ((list as ShoppingListItem[]) ?? [])) {
    const key = item.name.trim().toLowerCase();
    if (priced.has(key) || seen.has(key) || !isResearchable(item.name)) continue;
    seen.add(key);
    todo.push(item.name.trim());
    if (todo.length >= RESEARCH_BATCH_LIMIT) break;
  }

  if (!todo.length) return EMPTY("no_prices");

  const results: ResearchOutcome["results"] = [];
  for (let i = 0; i < todo.length; i += 3) {
    const batch = todo.slice(i, i + 3);
    results.push(...(await Promise.all(batch.map((n) => researchOne(supabase, user.id, n, chains)))));
  }

  revalidatePath("/dashboard/kitchen");
  const total = results.reduce((s, r) => s + r.count, 0);
  return total > 0 ? { ok: true, reason: "ok", results } : { ok: false, reason: "no_prices", results };
}

/**
 * Promote an estimate to a real observation — "yes, that's what it costs".
 * This is how the guesses turn into genuine data over time.
 */
export async function confirmEstimate(priceId: string, actualHuf?: number) {
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {
    source: "observed",
    confidence: null,
    observed_at: new Date().toISOString(),
  };
  if (actualHuf != null && Number.isFinite(actualHuf) && actualHuf > 0) {
    patch.price_huf = Math.round(actualHuf);
  }
  await supabase.from("store_prices").update(patch).eq("id", priceId);
  revalidatePath("/dashboard/kitchen");
}

/** Throw away every AI estimate — a clean slate if they drifted out of date. */
export async function clearEstimates() {
  const { supabase } = await requireUser();
  await supabase.from("store_prices").delete().eq("source", "ai_estimate");
  revalidatePath("/dashboard/kitchen");
}
