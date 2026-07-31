/**
 * The operations agent (projects).
 *
 * Weekly, plus a nudge whenever a goal is completed (momentum is worth
 * redirecting). It surfaces the projects most likely to slip: a near deadline
 * with progress still low. One recommendation per at-risk project, deduped by
 * project id so it updates in place as the deadline approaches.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { daysBetween } from "./_util";

const persona = AGENTS.find((a) => a.id === "projects")!;

export const projectsAgent = defineAgent({
  id: "projects",
  label: persona.label,
  brief: persona.brief,
  subscriptions: ["GoalCompleted"],
  schedule: "weekly",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];

    const { data } = await supabase
      .from("projects")
      .select("id, name, deadline, progress_percent, status")
      .eq("user_id", ctx.userId)
      .not("deadline", "is", null)
      .limit(200);

    for (const p of ((data as { id: string; name: string; deadline: string; progress_percent: number | null; status: string | null }[]) ?? [])) {
      if (p.status === "completed") continue;
      const d = daysBetween(ctx.now, new Date(p.deadline));
      const progress = Number(p.progress_percent ?? 0);
      if (d < 0) {
        drafts.push({
          kind: "deadline",
          dedupe_key: `deadline-${p.id}`,
          title: `"${p.name}" is past its deadline`,
          body: `Due ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ago at ${progress}% done. Re-date it or push to close.`,
          confidence: 0.85,
          urgency: 80,
          action: { route: "/dashboard/projects" },
        });
      } else if (d <= 7 && progress < 80) {
        drafts.push({
          kind: "deadline",
          dedupe_key: `deadline-${p.id}`,
          title: `"${p.name}" due in ${d} day${d === 1 ? "" : "s"}`,
          body: `Still at ${progress}%. This is the one most likely to slip this week.`,
          confidence: 0.8,
          urgency: 68,
          action: { route: "/dashboard/projects" },
        });
      }
    }

    return drafts;
  },
});
