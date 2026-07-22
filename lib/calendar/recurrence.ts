/**
 * A deliberately small subset of RFC 5545 RRULE, just enough for daily,
 * weekly (with weekday selection), monthly (by day-of-month) and yearly
 * routines with an optional interval and end date:
 *
 *   FREQ=DAILY;INTERVAL=2
 *   FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=2026-12-31
 *   FREQ=MONTHLY;INTERVAL=1
 *   FREQ=YEARLY
 *
 * Nothing is pre-generated in the database — `expandOccurrences` computes
 * concrete instances for whatever date range is currently visible, and the
 * same string is passed straight through as a real ICS `RRULE:` line so
 * subscribed Google/Apple calendars recur correctly too.
 */

import { addDays, addMonths, addYears, isAfter, isBefore } from "date-fns";

export type RecurrenceRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byDay: number[] | null; // 0 = Sunday .. 6 = Saturday
  until: Date | null;
};

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Accepts both the compact RFC 5545 form (YYYYMMDD[THHMMSSZ]) and a plain
 * dashed date (YYYY-MM-DD), and treats UNTIL as inclusive end-of-day. */
function parseUntil(value: string): Date | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const d = new Date(`${year}-${month}-${day}T23:59:59`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseRRule(rule: string | null | undefined): RecurrenceRule | null {
  if (!rule) return null;
  const parts = Object.fromEntries(
    rule
      .split(";")
      .map((p) => p.split("="))
      .filter((kv): kv is [string, string] => kv.length === 2)
      .map(([k, v]) => [k.trim().toUpperCase(), v.trim()]),
  );
  const freq = parts.FREQ as RecurrenceRule["freq"] | undefined;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;

  const interval = Math.max(1, Number(parts.INTERVAL) || 1);
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(",")
        .map((d) => DAY_CODES[d.trim().toUpperCase()])
        .filter((n): n is number => n !== undefined)
    : null;
  const until = parts.UNTIL ? parseUntil(parts.UNTIL) : null;

  return { freq, interval, byDay: byDay && byDay.length ? byDay : null, until };
}

export function serializeRRule(rule: RecurrenceRule): string {
  const segments = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) segments.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) {
    const codes = Object.entries(DAY_CODES);
    const names = rule.byDay
      .map((d) => codes.find(([, v]) => v === d)?.[0])
      .filter(Boolean);
    segments.push(`BYDAY=${names.join(",")}`);
  }
  if (rule.until) segments.push(`UNTIL=${rule.until.toISOString().slice(0, 10).replace(/-/g, "")}`);
  return segments.join(";");
}

const MAX_OCCURRENCES = 2000;

/** Concrete occurrences of `event` that overlap [rangeStart, rangeEnd]. */
export function expandOccurrences(
  event: { start_at: string; end_at: string; recurrence_rule: string | null },
  rangeStart: Date,
  rangeEnd: Date,
): { start: Date; end: Date }[] {
  const baseStart = new Date(event.start_at);
  const baseEnd = new Date(event.end_at);
  const durationMs = baseEnd.getTime() - baseStart.getTime();

  const rule = parseRRule(event.recurrence_rule);
  if (!rule) {
    return isAfter(baseEnd, rangeStart) && isBefore(baseStart, rangeEnd)
      ? [{ start: baseStart, end: baseEnd }]
      : [];
  }

  const hardEnd = rule.until && isBefore(rule.until, rangeEnd) ? rule.until : rangeEnd;
  const occurrences: { start: Date; end: Date }[] = [];

  if (rule.freq === "WEEKLY" && rule.byDay) {
    // Walk week by week from the base date, emitting one occurrence per
    // selected weekday, honouring INTERVAL as "every N weeks".
    let weekStart = addDays(baseStart, -baseStart.getDay());
    let weekIndex = 0;
    while (!isAfter(weekStart, hardEnd) && occurrences.length < MAX_OCCURRENCES) {
      if (weekIndex % rule.interval === 0) {
        for (const day of rule.byDay) {
          const occStart = addDays(weekStart, day);
          occStart.setHours(baseStart.getHours(), baseStart.getMinutes(), baseStart.getSeconds(), 0);
          if (isBefore(occStart, baseStart)) continue;
          if (rule.until && isAfter(occStart, rule.until)) continue;
          const occEnd = new Date(occStart.getTime() + durationMs);
          if (isAfter(occEnd, rangeStart) && isBefore(occStart, rangeEnd)) {
            occurrences.push({ start: occStart, end: occEnd });
          }
        }
      }
      weekStart = addDays(weekStart, 7);
      weekIndex += 1;
    }
    return occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  const step = (d: Date) => {
    switch (rule.freq) {
      case "DAILY":
        return addDays(d, rule.interval);
      case "MONTHLY":
        return addMonths(d, rule.interval);
      case "YEARLY":
        return addYears(d, rule.interval);
      default:
        return addDays(d, rule.interval);
    }
  };

  let cursorStart = baseStart;
  let cursorEnd = baseEnd;
  while (!isAfter(cursorStart, hardEnd) && occurrences.length < MAX_OCCURRENCES) {
    if (rule.until && isAfter(cursorStart, rule.until)) break;
    if (isAfter(cursorEnd, rangeStart) && isBefore(cursorStart, rangeEnd)) {
      occurrences.push({ start: cursorStart, end: cursorEnd });
    }
    const nextStart = step(cursorStart);
    cursorEnd = new Date(nextStart.getTime() + durationMs);
    cursorStart = nextStart;
  }

  return occurrences;
}

export const RECURRENCE_LABELS: Record<RecurrenceRule["freq"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};
