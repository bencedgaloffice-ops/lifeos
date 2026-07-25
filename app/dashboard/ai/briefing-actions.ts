"use server";

/**
 * Gathers the state a proactive briefing reasons over.
 *
 * The decision logic lives in lib/jarvis/briefing.ts and is pure; this is just
 * the fetch. Everything runs under the user's own client, so RLS scopes it
 * without a single explicit user_id filter.
 */

import { createClient } from "@/lib/supabase/server";
import { buildBriefing, speakBriefing, type Signal } from "@/lib/jarvis/briefing";
import { rankRecipes } from "@/lib/kitchen/chef";
import type { KitchenItem, Recipe, RecipeIngredient } from "@/lib/types";

export type Briefing = { signals: Signal[]; spoken: string };

export async function getBriefing(): Promise<Briefing> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signals: [], spoken: "" };

  const now = new Date();
  const horizon = new Date(now.getTime() + 12 * 86_400_000).toISOString();

  const [
    { data: kitchen },
    { data: shopping },
    { data: prices },
    { data: events },
    { data: shifts },
    { data: goals },
    { data: recipes },
    { data: profile },
  ] = await Promise.all([
    supabase.from("kitchen_items").select("id, name, expires_at, location, quantity"),
    supabase.from("shopping_list_items").select("id, name").eq("checked", false),
    supabase.from("store_prices").select("item_name"),
    supabase
      .from("calendar_events")
      .select("id, title, start_at, all_day")
      .gte("start_at", now.toISOString())
      .lte("start_at", horizon)
      .order("start_at", { ascending: true }),
    supabase
      .from("shifts")
      .select("id, start_at")
      .gte("start_at", now.toISOString())
      .lte("start_at", new Date(now.getTime() + 2 * 86_400_000).toISOString())
      .order("start_at", { ascending: true }),
    supabase.from("goals").select("id, title, target_date, status"),
    supabase.from("recipes").select("*"),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  const allRecipes = (recipes as Recipe[]) ?? [];
  const { data: ingredients } = allRecipes.length
    ? await supabase
        .from("recipe_ingredients")
        .select("*")
        .in("recipe_id", allRecipes.map((r) => r.id))
    : { data: [] };

  const stock = (kitchen as KitchenItem[]) ?? [];

  // Only dishes that need nothing bought are worth suggesting unprompted.
  const cookableNow = rankRecipes(allRecipes, (ingredients as RecipeIngredient[]) ?? [], stock, now)
    .filter((m) => m.cookableNow)
    .slice(0, 4)
    .map((m) => ({
      id: m.recipe.id,
      name: m.recipe.name,
      rescues: m.usesExpiring.map((i) => i.name),
    }));

  const signals = buildBriefing({
    now,
    kitchen: stock.map((i) => ({ id: i.id, name: i.name, expires_at: i.expires_at })),
    shoppingOpen: ((shopping as { id: string; name: string }[]) ?? []),
    pricedItems: new Set(
      ((prices as { item_name: string }[]) ?? []).map((p) => p.item_name.trim().toLowerCase()),
    ),
    events: ((events as { id: string; title: string; start_at: string; all_day: boolean }[]) ?? []),
    shifts: ((shifts as { id: string; start_at: string }[]) ?? []),
    goals: ((goals as { id: string; title: string; target_date: string | null; status: string | null }[]) ?? []),
    cookableNow,
  });

  const name = (profile as { display_name: string | null } | null)?.display_name || "Bence";
  return { signals, spoken: speakBriefing(signals, name, now) };
}
