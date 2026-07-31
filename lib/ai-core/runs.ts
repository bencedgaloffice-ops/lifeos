/**
 * Observability. Every agent invocation — scheduled, event-driven or chat —
 * leaves a row in agent_runs saying what it was, whether it succeeded, and what
 * it cost. This is what makes "why did the assistant do that" and "which agent
 * is burning tokens" answerable later, rather than a mystery.
 *
 * Best-effort, like everything else in the kernel: a failure to log a run must
 * not fail the run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRunRecord } from "./types";

export async function logRun(supabase: SupabaseClient, userId: string, run: AgentRunRecord): Promise<void> {
  const { error } = await supabase.from("agent_runs").insert({
    user_id: userId,
    agent: run.agent,
    trigger: run.trigger,
    ok: run.ok,
    tokens: run.tokens ?? null,
    ms: run.ms ?? null,
    detail: run.detail ?? null,
  });
  if (error) console.error("logRun failed:", error.message);
}
