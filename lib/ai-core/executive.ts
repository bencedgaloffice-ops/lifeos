/**
 * The Executive agent's brain — the orchestration logic, kept pure and testable.
 *
 * The specialists each produce recommendations in their own lane. Left alone
 * that becomes a pile: six agents, a dozen open items, no sense of what matters
 * most this morning. The Executive's whole job is reduction — rank everything
 * by confidence × urgency, keep one per lane so a single busy area can't crowd
 * out the rest, and hand back a short ordered list. This is the "CEO" function:
 * not producing more, but deciding what rises to attention.
 *
 * The agent wrapper that runs this on a schedule lives in agents/executive.ts;
 * the ranking is separated here so the briefing and the activity feed can rank
 * identically without importing the agent.
 */

import type { Recommendation } from "./types";
import { score } from "./recommendations";

/**
 * Rank and thin. Sorts by confidence × urgency, then keeps only the strongest
 * item per (agent, kind) lane so the output reads as a briefing, not a backlog.
 */
export function rankRecommendations(recs: Recommendation[]): Recommendation[] {
  const sorted = [...recs].sort((a, b) => score(b) - score(a));
  const seen = new Set<string>();
  const out: Recommendation[] = [];
  for (const r of sorted) {
    const lane = `${r.agent}:${r.kind ?? ""}`;
    if (seen.has(lane)) continue;
    seen.add(lane);
    out.push(r);
  }
  return out;
}

/** The bar a single recommendation must clear (confidence × urgency, 0–100) to
 * be worth pushing as an actual notification rather than just living in the
 * feed. 0.85 × 78 ≈ 66 clears it; 0.65 × 40 = 26 does not. */
export const NOTIFY_THRESHOLD = 55;
