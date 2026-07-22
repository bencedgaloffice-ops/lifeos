import type { CalendarItem } from "@/lib/types";

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function endOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}

export function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  const start = startOfDay(day).getTime();
  const end = endOfDay(day).getTime();
  return items.filter((it) => {
    const s = new Date(it.start).getTime();
    const e = new Date(it.end).getTime();
    return s <= end && e >= start;
  });
}

/** Groups items by calendar day for the given inclusive range. */
export function groupByDay(items: CalendarItem[], rangeStart: Date, rangeEnd: Date): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  const cursor = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  while (cursor <= end) {
    map.set(dayKey(cursor), itemsOnDay(items, cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return map;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function monthMatrix(anchor: Date): Date[][] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function weekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** The dominant category color for a day — used by Year view's heatmap cells. */
export function dominantColor(items: CalendarItem[]): string | null {
  if (!items.length) return null;
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.color, (counts.get(it.color) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
