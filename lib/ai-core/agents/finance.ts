/**
 * The finance agent (the "Treasury").
 *
 * Reacts to money moving and reviews the trend weekly. Its recommendations are
 * grounded in real transactions — a month-over-month spend jump and a negative
 * savings month are the two signals worth interrupting someone about; anything
 * subtler is noise. Deterministic on purpose: this runs and is useful even with
 * no model key configured, and the numbers are exact rather than guessed.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { DAY, monthKey } from "./_util";

const persona = AGENTS.find((a) => a.id === "finance")!;

export const financeAgent = defineAgent({
  id: "finance",
  label: persona.label,
  brief: persona.brief,
  subscriptions: ["ExpenseAdded", "IncomeAdded"],
  schedule: "weekly",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];
    const from = new Date(ctx.now.getTime() - 62 * DAY);

    const { data } = await supabase
      .from("transactions")
      .select("amount, direction, occurred_at")
      .eq("user_id", ctx.userId)
      .gte("occurred_at", from.toISOString())
      .limit(3000);

    const rows = ((data as { amount: number; direction: string | null; occurred_at: string }[]) ?? []);
    const thisMonth = monthKey(ctx.now);
    const lastMonth = monthKey(new Date(ctx.now.getFullYear(), ctx.now.getMonth() - 1, 1));

    let spendThis = 0;
    let spendLast = 0;
    let incomeThis = 0;
    for (const r of rows) {
      const m = r.occurred_at.slice(0, 7);
      const isOut = r.direction ? r.direction === "out" : Number(r.amount) < 0;
      const amt = Math.abs(Number(r.amount) || 0);
      if (m === thisMonth) {
        if (isOut) spendThis += amt;
        else incomeThis += amt;
      } else if (m === lastMonth && isOut) {
        spendLast += amt;
      }
    }

    if (spendLast > 0 && spendThis > spendLast * 1.15) {
      const pct = Math.round((spendThis / spendLast - 1) * 100);
      drafts.push({
        kind: "spend",
        dedupe_key: "spend-trend",
        title: `Spending is up ${pct}% this month`,
        body: `About ${fmt(spendThis)} so far this month versus ${fmt(spendLast)} through the same point last month.`,
        confidence: 0.8,
        urgency: pct > 40 ? 76 : 60,
        action: { route: "/dashboard/finance" },
      });
    }

    if (incomeThis > 0 && spendThis > incomeThis) {
      drafts.push({
        kind: "savings",
        dedupe_key: "savings-rate",
        title: "You've spent more than you earned this month",
        body: `Outflow exceeds income by about ${fmt(spendThis - incomeThis)} so far. Worth a look before month end.`,
        confidence: 0.85,
        urgency: 78,
        action: { route: "/dashboard/finance" },
      });
    }

    return drafts;
  },
});

const fmt = (n: number) => Math.round(n).toLocaleString("hu-HU");
