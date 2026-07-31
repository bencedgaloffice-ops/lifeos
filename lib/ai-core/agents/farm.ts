/**
 * The farm agent (Somogy land + beekeeping).
 *
 * Monthly cadence, because agriculture moves in seasons, not days. Its one
 * high-value signal is a grant decision window approaching — subsidy timing is
 * unforgiving and easy to miss. Grounded in real grant_applications rows;
 * deduped per application.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { daysBetween } from "./_util";

const persona = AGENTS.find((a) => a.id === "farm")!;

export const farmAgent = defineAgent({
  id: "farm",
  label: persona.label,
  brief: persona.brief,
  schedule: "monthly",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];

    const { data } = await supabase
      .from("grant_applications")
      .select("id, program_name, status, decision_date, submitted_date, amount_requested")
      .eq("user_id", ctx.userId)
      .limit(200);

    for (const g of ((data as {
      id: string;
      program_name: string;
      status: string | null;
      decision_date: string | null;
      submitted_date: string | null;
      amount_requested: number | null;
    }[]) ?? [])) {
      // A submitted application with a decision expected within the month.
      if (g.decision_date && g.status !== "approved" && g.status !== "rejected") {
        const d = daysBetween(ctx.now, new Date(g.decision_date));
        if (d >= 0 && d <= 31) {
          drafts.push({
            kind: "grant",
            dedupe_key: `grant-decision-${g.id}`,
            title: `${g.program_name}: decision expected in ${d} day${d === 1 ? "" : "s"}`,
            body: g.amount_requested
              ? `Requested ${Math.round(Number(g.amount_requested)).toLocaleString("hu-HU")}. Keep an eye out for the notice.`
              : "Keep an eye out for the decision notice.",
            confidence: 0.8,
            urgency: 58,
            action: { route: "/dashboard/business/organizations" },
          });
        }
      }
      // A draft that was never submitted.
      if (g.status === "draft" && !g.submitted_date) {
        drafts.push({
          kind: "grant",
          dedupe_key: `grant-draft-${g.id}`,
          title: `${g.program_name} is still a draft`,
          body: "An unsubmitted grant earns nothing. Worth finishing or dropping it.",
          confidence: 0.7,
          urgency: 50,
          action: { route: "/dashboard/business/organizations" },
        });
      }
    }

    return drafts;
  },
});
