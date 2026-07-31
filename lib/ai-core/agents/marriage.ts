/**
 * The relationship agent.
 *
 * Weekly, plus whenever a calendar event is created (a new plan might be a date
 * worth protecting). Its job is to make sure a sentimental date is never missed
 * — anniversaries are unforgiving. It only ever surfaces dates it can see on
 * the real calendar; it never invents one. Deduped per event.
 */

import { defineAgent } from "../registry";
import { AGENTS } from "@/lib/jarvis/agents";
import type { RecommendationDraft } from "../types";
import { DAY, daysBetween } from "./_util";

const persona = AGENTS.find((a) => a.id === "marriage")!;

const SENTIMENTAL = /anniversary|évforduló|birthday|szülinap|születésnap|wedding|esküvő|eljegyz|niki/i;

export const marriageAgent = defineAgent({
  id: "marriage",
  label: persona.label,
  brief: persona.brief,
  subscriptions: ["CalendarEventCreated"],
  schedule: "weekly",
  async run(ctx, { supabase }) {
    const drafts: RecommendationDraft[] = [];
    const horizon = new Date(ctx.now.getTime() + 21 * DAY).toISOString();

    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, start_at")
      .eq("user_id", ctx.userId)
      .gte("start_at", ctx.now.toISOString())
      .lte("start_at", horizon)
      .order("start_at", { ascending: true })
      .limit(100);

    for (const e of ((data as { id: string; title: string; start_at: string }[]) ?? [])) {
      if (!SENTIMENTAL.test(e.title)) continue;
      const d = daysBetween(ctx.now, new Date(e.start_at));
      if (d < 0 || d > 21) continue;
      drafts.push({
        kind: "date",
        dedupe_key: `sentimental-${e.id}`,
        title:
          d === 0 ? `${e.title} — that's today` : d === 1 ? `${e.title} is tomorrow` : `${e.title} in ${d} days`,
        body: d <= 7 ? "Worth planning something for Niki now rather than the day before." : "On the horizon — plenty of time to plan.",
        confidence: 0.9,
        urgency: d <= 7 ? 82 : 55,
        action: { route: "/dashboard/calendar" },
      });
    }

    return drafts;
  },
});
