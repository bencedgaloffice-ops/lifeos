/**
 * The event log — the serverless-honest "event bus".
 *
 * There is no long-running process on Vercel to hold an in-memory pub/sub, and
 * pretending otherwise would lose events on every cold start. Instead every
 * domain event is appended durably to ai_events, and the heartbeat cron drains
 * what is unprocessed. That trades instant reaction for at-least-once delivery
 * that survives restarts — the right trade for "notice my life changed", where
 * a few minutes' latency is invisible and a dropped event is not.
 *
 * emit() is intentionally fire-and-forget and never throws: recording that an
 * expense happened must never be able to fail the action that added the
 * expense. A lost event degrades the assistant slightly; a thrown one would
 * break the app.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiEvent } from "./types";

/** Append a domain event. Best-effort — logs and swallows on failure. */
export async function emit(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("ai_events").insert({ user_id: userId, type, payload });
  if (error) console.error(`ai_events emit(${type}) failed:`, error.message);
}

/** Unprocessed events for one user, oldest first, capped. The heartbeat reads
 * these, hands them to subscribed agents, then marks them processed. */
export async function drainEvents(supabase: SupabaseClient, userId: string, limit = 100): Promise<AiEvent[]> {
  const { data, error } = await supabase
    .from("ai_events")
    .select("*")
    .eq("user_id", userId)
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("drainEvents failed:", error.message);
    return [];
  }
  return (data as AiEvent[]) ?? [];
}

/** Mark events handled so the next drain skips them. */
export async function markProcessed(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("ai_events")
    .update({ processed_at: new Date().toISOString() })
    .in("id", ids);
  if (error) console.error("markProcessed failed:", error.message);
}
