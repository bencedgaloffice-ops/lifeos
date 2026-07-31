/**
 * Small shared helpers for agent run() logic. Pure date arithmetic, no I/O.
 *
 * Every agent query filters by ctx.userId explicitly — the heartbeat runs on a
 * service-role client with RLS off, so an unfiltered read would cross users.
 * These helpers don't touch the DB; they just keep the date maths identical
 * across agents.
 */

export const DAY = 86_400_000;

/** Whole days from `a` to `b`, ignoring time of day. Negative if b is before a. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((new Date(b.toDateString()).getTime() - new Date(a.toDateString()).getTime()) / DAY);
}

/** "YYYY-MM" key for month bucketing. */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Group a name list into a readable phrase: "milk, eggs and 2 more". */
export function listPhrase(names: string[], max = 3): string {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const joined =
    shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0] ?? "";
  return rest > 0 ? `${joined} and ${rest} more` : joined;
}
