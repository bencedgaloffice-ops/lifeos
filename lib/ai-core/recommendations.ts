/**
 * The recommendation store.
 *
 * Agents produce drafts; this turns them into rows, deduplicating on
 * (user, agent, dedupe_key) so an agent that runs every day overwrites its own
 * standing suggestion instead of stacking a new copy each time. That single
 * rule is what keeps a proactive system from becoming noise: "your insurance
 * expires in 12 days" should update in place as the number ticks down, not
 * appear twelve times.
 *
 * Ranking is confidence × urgency, computed at read time, so the Executive
 * agent and the activity feed agree on what matters most without either owning
 * the formula.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation, RecommendationDraft } from "./types";

/** Persist an agent's drafts, upserting on the dedupe key when present. Drafts
 * without a dedupe key are always inserted (one-off observations). */
export async function saveRecommendations(
  supabase: SupabaseClient,
  userId: string,
  agent: string,
  drafts: RecommendationDraft[],
): Promise<void> {
  if (!drafts.length) return;
  const now = new Date().toISOString();

  const withKey = drafts.filter((d) => d.dedupe_key);
  const withoutKey = drafts.filter((d) => !d.dedupe_key);

  const row = (d: RecommendationDraft) => ({
    user_id: userId,
    agent,
    kind: d.kind ?? null,
    title: d.title,
    body: d.body ?? null,
    confidence: clamp01(d.confidence ?? 0.5),
    urgency: clampInt(d.urgency ?? 50, 0, 100),
    action: d.action ?? null,
    dedupe_key: d.dedupe_key ?? null,
    status: "open" as const,
    updated_at: now,
  });

  if (withKey.length) {
    const { error } = await supabase
      .from("recommendations")
      .upsert(withKey.map(row), { onConflict: "user_id,agent,dedupe_key" });
    if (error) console.error("saveRecommendations upsert failed:", error.message);
  }
  if (withoutKey.length) {
    const { error } = await supabase.from("recommendations").insert(withoutKey.map(row));
    if (error) console.error("saveRecommendations insert failed:", error.message);
  }
}

/** Open recommendations, ranked by confidence × urgency (most pressing first). */
export async function listOpenRecommendations(
  supabase: SupabaseClient,
  limit = 50,
): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listOpenRecommendations failed:", error.message);
    return [];
  }
  return ((data as Recommendation[]) ?? [])
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

export async function setRecommendationStatus(
  supabase: SupabaseClient,
  id: string,
  status: Recommendation["status"],
): Promise<void> {
  const { error } = await supabase
    .from("recommendations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("setRecommendationStatus failed:", error.message);
}

/** Combined priority. Kept here so every reader ranks identically. */
export function score(r: Pick<Recommendation, "confidence" | "urgency">): number {
  return r.confidence * r.urgency;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampInt = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
