/**
 * The Executive agent — the orchestrator.
 *
 * It produces no recommendations of its own; it reads what the specialists have
 * produced and decides what deserves to reach the user *now*. Once a day it
 * ranks the open recommendations and, if the single most pressing one clears
 * the bar, raises a notification — but only if an unread one for the same thing
 * isn't already sitting there, so it never nags daily about the same item.
 *
 * This is deliberately restrained: most days it notifies nothing, which is the
 * correct behaviour for something that interrupts a person. The full ranked
 * list still surfaces quietly in the activity feed and the home briefing; the
 * notification is reserved for the one thing worth a tap on the shoulder.
 */

import { defineAgent } from "../registry";
import { listOpenRecommendations, score } from "../recommendations";
import { notify } from "../notifications";
import { rankRecommendations, NOTIFY_THRESHOLD } from "../executive";
import type { SupabaseClient } from "@supabase/supabase-js";

export const executiveAgent = defineAgent({
  id: "executive",
  label: "Executive",
  brief:
    "You are the Executive — the orchestrating core of LifeOS. You see every specialist's findings at once and your job is to reduce, not add: surface the few things that genuinely matter today and let the rest wait. Never manufacture urgency.",
  schedule: "daily",
  async run(ctx, { supabase }) {
    const sb = supabase as SupabaseClient;
    const recs = await listOpenRecommendations(sb, 40, ctx.userId);
    const ranked = rankRecommendations(recs).filter((r) => r.agent !== "executive");
    const top = ranked[0];

    if (top && score(top) >= NOTIFY_THRESHOLD) {
      // Only raise it if the same thing isn't already waiting unread.
      const { data: existing } = await sb
        .from("notifications")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("title", top.title)
        .is("read_at", null)
        .limit(1);
      if (!existing?.length) {
        await notify(sb, ctx.userId, {
          source: "executive",
          title: top.title,
          body: top.body ?? undefined,
          route: top.action?.route,
        });
      }
    }

    // The Executive doesn't add to the recommendation pile — it curates it.
    return [];
  },
});
