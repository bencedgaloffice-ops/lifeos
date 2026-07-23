"use server";

/**
 * Privileged actions Jarvis can perform on the user's behalf.
 *
 * Every function re-verifies the authenticated user server-side — the client's
 * permission level gates the *UI*, but the database is the real boundary (RLS
 * plus this auth check). Each returns a short spoken-confirmation string that
 * the companion reads back, so the voice loop always closes with feedback.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/translations";
import { formatCurrency } from "@/lib/format";
import { isAnthropicConfigured, askClaude } from "@/lib/jarvis/llm";
import { askCompanion } from "./actions";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export type JarvisActionResult = { ok: boolean; message: string };

/** Level 1 — grounded answer from the user's real LifeOS data. */
export async function jarvisAsk(query: string, locale: Locale = "en"): Promise<string> {
  return askCompanion(query, locale);
}

/* ------------------------------------------------------------------ */
/*  Web answers — general knowledge "from online"                      */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "LifeOS-Jarvis/1.0 (personal assistant)", Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Trim a long abstract to a couple of clean sentences. */
function condense(text: string, max = 420): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + "…");
}

/**
 * Level 1 — answer a general-knowledge question from public web sources.
 *
 * Uses two keyless providers: DuckDuckGo's Instant Answer API first (fast,
 * factual snippets), then Wikipedia (search → page summary) as a fallback.
 * Returns null when nothing useful is found, so the caller can fall back to
 * the grounded LifeOS answer. A Google/Bing/OpenAI key could be slotted in
 * here later for broader coverage, but these need no credentials.
 */
export async function jarvisWebAnswer(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  // 1) DuckDuckGo Instant Answer.
  const ddg = (await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
  )) as { Answer?: string; AbstractText?: string; Definition?: string; Heading?: string; AbstractURL?: string } | null;

  if (ddg) {
    const snippet = (ddg.Answer || ddg.AbstractText || ddg.Definition || "").trim();
    if (snippet) {
      const src = ddg.AbstractURL ? " (via DuckDuckGo)" : "";
      return condense(snippet) + src;
    }
  }

  // 2) Wikipedia search → summary.
  const search = (await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=1&origin=*`,
  )) as { query?: { search?: { title?: string }[] } } | null;
  const title = search?.query?.search?.[0]?.title;
  if (title) {
    const summary = (await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    )) as { extract?: string; type?: string } | null;
    if (summary?.extract && summary.type !== "disambiguation") {
      return condense(summary.extract) + " (via Wikipedia)";
    }
  }

  return null;
}

/**
 * Level 1 — "Analyze this BMW X5"-style vehicle questions, grounded in the
 * user's own My Garage data (owned vehicles, the import pipeline, the dream
 * garage wishlist).
 *
 * This is a placeholder heuristic, not a real market-data lookup — there's no
 * external pricing API wired in yet. It exists so the intent, the voice
 * phrasing, and the "Market value / Recommended purchase price / Profit
 * potential" response shape are already correct; swapping in a real
 * valuation source later only touches this one function.
 */
export async function jarvisAnalyzeVehicle(query: string, locale: Locale = "en"): Promise<string> {
  const { supabase, user } = await requireUser();
  const clean = query.trim();
  if (!clean) return locale === "hu" ? "Melyik járművet elemezzem?" : "Which vehicle should I analyze?";

  const { data: profile } = await supabase.from("profiles").select("preferred_currency").eq("id", user.id).maybeSingle();
  const currency = profile?.preferred_currency || "USD";
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const terms = clean.split(/\s+/).filter((t) => t.length > 1);
  const orFilter = terms.map((t) => `brand.ilike.%${t}%,model.ilike.%${t}%`).join(",");

  const [{ data: deals }, { data: vehicles }, { data: dreams }] = await Promise.all([
    supabase.from("garage_import_deals").select("*").or(orFilter).limit(1),
    supabase.from("garage_vehicles").select("*").or(orFilter).limit(1),
    supabase.from("garage_dream_vehicles").select("*").or(orFilter).limit(1),
  ]);

  /** A Claude-informed sentence layered on top of the real LifeOS numbers —
   * general market/negotiation knowledge Jarvis's own data can't provide.
   * Silently omitted if no key is configured or the call fails. */
  async function marketInsight(vehicleLabel: string, situation: string): Promise<string> {
    if (!isAnthropicConfigured()) return "";
    const system =
      locale === "hu"
        ? `Te Jarvis vagy, a LifeOS jármű-elemző asszisztense. A felhasználó saját nyilvántartott számait már megkapta — NE ismételd meg őket. Adj EGY tömör, gyakorlati mondatot piaci kontextussal vagy tanáccsal (pl. jellemző értéktartási trend, gyakori buktató, alkuposzíció) erre a járműre és helyzetre. Ha nincs elég konkrét ismereted, mondd, hogy ez egy általános becslés.`
        : `You are Jarvis, LifeOS's vehicle-analysis assistant. The user already has their own tracked numbers — do NOT repeat them. Give exactly ONE concise, practical sentence of market context or advice (e.g. typical resale trend, common pitfall, negotiating leverage) for this vehicle and situation. If you're not confident, say it's a general estimate.`;
    const answer = await askClaude(system, `${vehicleLabel} — ${situation}`, 120);
    return answer ? ` ${answer}` : "";
  }

  const deal = deals?.[0];
  if (deal) {
    const investment = Number(deal.purchase_price) + Number(deal.transport_cost) + Number(deal.registration_cost) + Number(deal.repair_cost);
    const profit = Number(deal.expected_selling_price) - investment;
    const roi = investment > 0 ? Math.round((profit / investment) * 100) : 0;
    const insight = await marketInsight(`${deal.brand} ${deal.model} (${deal.year ?? "?"})`, `import deal at the "${deal.stage}" stage, ${roi}% projected ROI`);
    if (locale === "hu") {
      return `${deal.brand} ${deal.model} (import): becsült eladási ár ${fc(Number(deal.expected_selling_price))}, teljes befektetés ${fc(investment)}, várható profit ${fc(profit)} (${roi}% ROI). Jelenlegi fázis: ${deal.stage}.${insight}`;
    }
    return `${deal.brand} ${deal.model} in your import pipeline — expected selling price ${fc(Number(deal.expected_selling_price))}, total investment ${fc(investment)}, projected profit ${fc(profit)} (${roi}% ROI). Currently at the "${deal.stage}" stage.${insight}`;
  }

  const vehicle = vehicles?.[0];
  if (vehicle) {
    const value = vehicle.value !== null ? Number(vehicle.value) : null;
    const paid = vehicle.purchase_price !== null ? Number(vehicle.purchase_price) : null;
    const delta = value !== null && paid !== null ? value - paid : null;
    const insight = await marketInsight(`${vehicle.brand} ${vehicle.model} (${vehicle.year ?? "?"})`, "an owned vehicle being tracked in a personal garage");
    if (locale === "hu") {
      return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ""} a garázsodban: becsült érték ${value !== null ? fc(value) : "nincs megadva"}${delta !== null ? `, ${delta >= 0 ? "+" : ""}${fc(delta)} a vételár óta` : ""}.${insight}`;
    }
    return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ""} in My Vehicles — estimated value ${value !== null ? fc(value) : "not set"}${delta !== null ? `, ${delta >= 0 ? "up" : "down"} ${fc(Math.abs(delta))} since purchase` : ""}.${insight}`;
  }

  const dream = dreams?.[0];
  if (dream) {
    const insight = await marketInsight(`${dream.brand} ${dream.model}`, `a dream-garage wishlist entry, priority ${dream.priority_rating}/5`);
    if (locale === "hu") {
      return `${dream.brand} ${dream.model} az álomgarázsban: becsült ár ${dream.estimated_price !== null ? fc(Number(dream.estimated_price)) : "nincs megadva"}, prioritás ${dream.priority_rating}/5.${insight}`;
    }
    return `${dream.brand} ${dream.model} in your Dream Garage — estimated price ${dream.estimated_price !== null ? fc(Number(dream.estimated_price)) : "not set"}, priority ${dream.priority_rating}/5.${insight}`;
  }

  // Nothing tracked in the Garage yet — with a real model configured, give a
  // genuine market-knowledge answer instead of just asking them to add it.
  if (isAnthropicConfigured()) {
    const system =
      locale === "hu"
        ? `Te Jarvis vagy, a LifeOS jármű-elemző asszisztense. A felhasználó egy járműről kérdez, ami még nincs a Garázsában nyilvántartva. Adj rövid (2-3 mondatos), gyakorlatias elemzést: hozzávetőleges piaci érték, javasolt vételi ártartomány, és profitpotenciál import/viszonteladás esetén. Legyél egyértelmű, hogy ez általános piaci becslés, nem a felhasználó saját adatai.`
        : `You are Jarvis, LifeOS's vehicle-analysis assistant. The user is asking about a vehicle that isn't tracked in their Garage yet. Give a short (2-3 sentence), practical analysis: rough market value, a suggested purchase-price range, and profit potential if imported/resold. Be clear this is a general market estimate, not the user's own tracked data.`;
    const answer = await askClaude(system, clean);
    if (answer) return answer;
  }

  return locale === "hu"
    ? `Nincs "${clean}" a Garázsodban. Ha hozzáadod (Saját járművek, Álomgarázs vagy Import), tudok elemzést adni.`
    : `I don't see "${clean}" anywhere in My Garage yet — add it under My Vehicles, Dream Garage, or the import pipeline and I can pull real numbers next time.`;
}

/** Level 2 — add an item to the shopping list. */
export async function jarvisAddShopping(name: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, message: "I didn't catch what to add." };
  await supabase.from("shopping_list_items").insert({ user_id: user.id, name: clean });
  revalidatePath("/dashboard/kitchen");
  return { ok: true, message: `Added ${clean} to your shopping list.` };
}

/** Level 2 — remove a matching shopping-list item. */
export async function jarvisRemoveShopping(name: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, message: "I didn't catch what to remove." };
  const { data: rows } = await supabase
    .from("shopping_list_items")
    .select("id, name")
    .eq("user_id", user.id)
    .ilike("name", `%${clean}%`)
    .limit(1);
  if (!rows?.length) return { ok: false, message: `I couldn't find ${clean} on your list.` };
  await supabase.from("shopping_list_items").delete().eq("id", rows[0].id);
  revalidatePath("/dashboard/kitchen");
  return { ok: true, message: `Removed ${rows[0].name} from your shopping list.` };
}

/** Level 2 — add an item to the kitchen (fridge by default). */
export async function jarvisAddKitchen(name: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, message: "I didn't catch what to add." };
  await supabase.from("kitchen_items").insert({ user_id: user.id, name: clean, location: "fridge" });
  revalidatePath("/dashboard/kitchen");
  return { ok: true, message: `Added ${clean} to your kitchen.` };
}

/** Level 2 — create a goal. */
export async function jarvisCreateGoal(title: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = title.trim();
  if (!clean) return { ok: false, message: "What should the goal be?" };
  await supabase.from("goals").insert({
    user_id: user.id,
    title: clean,
    progress_percent: 0,
    status: "active",
  });
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
  return { ok: true, message: `Created the goal: ${clean}.` };
}

/** Level 2 — create an all-day reminder on today's calendar. */
export async function jarvisCreateReminder(title: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = title.trim();
  if (!clean) return { ok: false, message: "What should I remind you about?" };
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 0);
  await supabase.from("calendar_events").insert({
    user_id: user.id,
    title: clean,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: true,
    source: "manual",
  });
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true, message: `Reminder set: ${clean}.` };
}

/** Level 2 — append a journal entry. */
export async function jarvisAddJournal(text: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = text.trim();
  if (!clean) return { ok: false, message: "What would you like to record?" };
  await supabase.from("journal_entries").insert({
    user_id: user.id,
    body: clean,
    entry_date: new Date().toISOString().slice(0, 10),
  });
  revalidatePath("/dashboard/journal");
  return { ok: true, message: "I've added that to your journal." };
}

/** Level 2 — store something for the companion to remember. */
export async function jarvisRemember(text: string): Promise<JarvisActionResult> {
  const { supabase, user } = await requireUser();
  const clean = text.trim();
  if (!clean) return { ok: false, message: "What should I remember?" };
  await supabase.from("ai_memory").insert({
    user_id: user.id,
    memory_type: "note",
    content: clean,
    importance: 3,
  });
  revalidatePath("/dashboard/ai");
  return { ok: true, message: "I'll remember that." };
}
