/**
 * Running an agent — the one loop both the reactive and scheduled paths share.
 *
 * Given a registered agent and a user, this builds the grounding, calls the
 * agent's run(), persists whatever recommendations it produced (deduped), and
 * records the run for observability. Every agent invocation in LifeOS goes
 * through here, so logging and dedup happen in exactly one place and a
 * throwing agent degrades to a logged failure rather than a 500.
 *
 * It works identically for zero agents and for many: Phase 2 ships it with an
 * empty registry, and Phase 3 lights it up simply by registering agents — no
 * change here or in the heartbeat.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentDefinition, AiEvent, Cadence } from "./types";
import { buildGrounding } from "./context";
import { saveRecommendations } from "./recommendations";
import { logRun } from "./runs";

/** Run one agent for one user and persist the result. Never throws. */
export async function runAgentJob(
  supabase: SupabaseClient,
  userId: string,
  agent: AgentDefinition,
  trigger: "schedule" | "event",
  event?: AiEvent,
): Promise<number> {
  if (typeof agent.run !== "function") return 0;
  const start = Date.now();
  try {
    const { system } = await buildGrounding(supabase, userId, { brief: agent.brief });
    const drafts = await agent.run(
      { userId, now: new Date(), trigger, event, grounding: system },
      { supabase },
    );
    await saveRecommendations(supabase, userId, agent.id, drafts);
    await logRun(supabase, userId, {
      agent: agent.id,
      trigger,
      ok: true,
      ms: Date.now() - start,
      detail: `${drafts.length} recommendation(s)`,
    });
    return drafts.length;
  } catch (err) {
    await logRun(supabase, userId, {
      agent: agent.id,
      trigger,
      ok: false,
      ms: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Which cadences are "due" on a given day, given the heartbeat fires at most
 * daily. Hourly and daily always run; weekly runs on Mondays; monthly on the
 * 1st. If the cron is later bumped to hourly, hourly agents simply run more
 * often — the gating still holds because it is date-based, not interval-based.
 */
export function dueCadences(now: Date): Cadence[] {
  const due: Cadence[] = ["hourly", "daily"];
  if (now.getUTCDay() === 1) due.push("weekly"); // Monday
  if (now.getUTCDate() === 1) due.push("monthly");
  return due;
}
