/**
 * The home agent (kitchen + shopping).
 *
 * Reacts when food comes in and checks daily for two things: what is about to
 * spoil, and a shopping list that can't be optimised because nothing on it has
 * a price yet. Both are grounded in real rows and both have a clear action, so
 * neither is a vague nudge.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { daysBetween, listPhrase } from "./_util";

const persona = AGENTS.find((a) => a.id === "home")!;

export const homeAgent = defineAgent({
  id: "home",
  label: persona.label,
  brief: persona.brief,
  subscriptions: ["KitchenItemAdded"],
  schedule: "daily",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];

    // Expiring stock: within 3 days and not already long gone.
    const { data: items } = await supabase
      .from("kitchen_items")
      .select("name, expires_at")
      .eq("user_id", ctx.userId)
      .not("expires_at", "is", null)
      .limit(500);

    const expiring = ((items as { name: string; expires_at: string }[]) ?? [])
      .map((i) => ({ name: i.name, d: daysBetween(ctx.now, new Date(i.expires_at)) }))
      .filter((x) => x.d >= -1 && x.d <= 3)
      .sort((a, b) => a.d - b.d);

    if (expiring.length) {
      const urgent = expiring.some((x) => x.d <= 1);
      drafts.push({
        kind: "expiry",
        dedupe_key: "expiring-soon",
        title: `${expiring.length} item${expiring.length > 1 ? "s" : ""} to use up soon`,
        body: `${listPhrase(expiring.map((x) => x.name))} ${expiring.length > 1 ? "are" : "is"} at or near their date. The chef can build a meal around them.`,
        confidence: 0.9,
        urgency: urgent ? 72 : 52,
        action: { route: "/dashboard/kitchen?view=chef" },
      });
    }

    // A shopping list nobody has priced can't be run cheaply.
    const [{ data: shop }, { data: prices }] = await Promise.all([
      supabase.from("shopping_list_items").select("name").eq("user_id", ctx.userId).eq("checked", false),
      supabase.from("store_prices").select("item_name").eq("user_id", ctx.userId),
    ]);
    const priced = new Set(((prices as { item_name: string }[]) ?? []).map((p) => p.item_name.trim().toLowerCase()));
    const unpriced = ((shop as { name: string }[]) ?? []).filter((s) => !priced.has(s.name.trim().toLowerCase()));
    if (unpriced.length >= 4) {
      drafts.push({
        kind: "shopping",
        dedupe_key: "unpriced-list",
        title: `${unpriced.length} list items have no price yet`,
        body: "I can research prices and work out the cheapest single-store run.",
        confidence: 0.7,
        urgency: 48,
        action: { route: "/dashboard/kitchen?view=shopping" },
      });
    }

    return drafts;
  },
});
