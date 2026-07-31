/**
 * The health agent (vitals).
 *
 * Weekly, gentle, and honest about gaps. It notices when logging has lapsed —
 * an assistant can't reason about nutrition it can't see — and flags a clear
 * upward weight trend from the real log. It is not a doctor and says so; it
 * never invents a clinical claim.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { DAY } from "./_util";

const persona = AGENTS.find((a) => a.id === "health")!;

export const healthAgent = defineAgent({
  id: "health",
  label: persona.label,
  brief: persona.brief,
  schedule: "weekly",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];
    const weekAgo = new Date(ctx.now.getTime() - 7 * DAY).toISOString();

    const { count } = await supabase
      .from("nutrition_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("logged_at", weekAgo);

    if ((count ?? 0) === 0) {
      drafts.push({
        kind: "nutrition-gap",
        dedupe_key: "nutrition-gap",
        title: "No meals logged this week",
        body: "Even a couple of entries lets me spot patterns in how you're eating. Want to start logging again?",
        confidence: 0.65,
        urgency: 40,
        action: { route: "/dashboard/nutrition" },
      });
    }

    // Weight trend: compare the two most recent readings a week or more apart.
    const { data: weights } = await supabase
      .from("weight_log")
      .select("logged_date, weight_kg")
      .eq("user_id", ctx.userId)
      .order("logged_date", { ascending: false })
      .limit(8);
    const w = ((weights as { logged_date: string; weight_kg: number }[]) ?? []);
    if (w.length >= 2) {
      const latest = w[0];
      const prior = w.find((x) => (new Date(latest.logged_date).getTime() - new Date(x.logged_date).getTime()) >= 6 * DAY);
      if (prior) {
        const delta = Number(latest.weight_kg) - Number(prior.weight_kg);
        if (Math.abs(delta) >= 1.5) {
          drafts.push({
            kind: "weight-trend",
            dedupe_key: "weight-trend",
            title: `Weight ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)} kg recently`,
            body: `From ${prior.weight_kg} kg to ${latest.weight_kg} kg. Just noting the trend — you decide what it means.`,
            confidence: 0.75,
            urgency: 45,
            action: { route: "/dashboard/nutrition" },
          });
        }
      }
    }

    return drafts;
  },
});
