import type { CalendarEvent, CalendarItem, LifeArea, Shift } from "@/lib/types";
import { expandOccurrences } from "@/lib/calendar/recurrence";

const DEFAULT_COLOR = "#3B82F6";
const DEFAULT_ICON = "CalendarDays";

const KIND_FALLBACK: Record<Exclude<CalendarItem["kind"], "event" | "shift">, { color: string; icon: string }> = {
  goal: { color: "#8B5CF6", icon: "Target" },
  project: { color: "#F59E0B", icon: "FolderKanban" },
  document: { color: "#94A3B8", icon: "FileStack" },
  responsibility: { color: "#F87171", icon: "ClipboardList" },
  milestone: { color: "#38BDF8", icon: "Milestone" },
};

function areaLookup(lifeAreas: LifeArea[]) {
  const byId = new Map(lifeAreas.map((a) => [a.id, a]));
  const byName = new Map(lifeAreas.map((a) => [a.name, a]));
  return { byId, byName };
}

type LinkedRow = {
  id: string;
  title: string;
  date: string | null;
  description?: string | null;
  life_area_id?: string | null;
};

function linkedItems(
  rows: LinkedRow[],
  kind: Exclude<CalendarItem["kind"], "event" | "shift">,
  sourceTable: string,
  areas: ReturnType<typeof areaLookup>,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarItem[] {
  const fallback = KIND_FALLBACK[kind];
  const items: CalendarItem[] = [];
  for (const row of rows) {
    if (!row.date) continue;
    const start = new Date(`${row.date.slice(0, 10)}T09:00:00`);
    if (start < rangeStart || start > rangeEnd) continue;
    const area = row.life_area_id ? areas.byId.get(row.life_area_id) : undefined;
    items.push({
      id: `${sourceTable}-${row.id}`,
      title: row.title,
      start: start.toISOString(),
      end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: true,
      color: area?.color ?? fallback.color,
      icon: area?.icon ?? fallback.icon,
      kind,
      editable: true,
      sourceTable,
      sourceId: row.id,
      priority: null,
      location: null,
      description: row.description ?? null,
      recurrenceRule: null,
      isRecurringInstance: false,
      lifeAreaId: row.life_area_id ?? null,
      reminderMinutesBefore: null,
      subtype: null,
    });
  }
  return items;
}

export function mergeCalendarItems(input: {
  events: CalendarEvent[];
  lifeAreas: LifeArea[];
  shifts: Shift[];
  goals: { id: string; title: string; target_date: string | null; life_area_id?: string | null }[];
  projects: { id: string; name: string; deadline: string | null; life_area_id?: string | null }[];
  documents: { id: string; title: string; expires_at: string | null; life_area_id?: string | null }[];
  responsibilities: { id: string; title: string; due_date: string | null; completed: boolean }[];
  milestones: { id: string; title: string; date: string | null; life_area_id?: string | null }[];
  rangeStart: Date;
  rangeEnd: Date;
}): CalendarItem[] {
  const { events, lifeAreas, shifts, goals, projects, documents, responsibilities, milestones, rangeStart, rangeEnd } = input;
  const areas = areaLookup(lifeAreas);
  const items: CalendarItem[] = [];

  for (const event of events) {
    const occurrences = expandOccurrences(event, rangeStart, rangeEnd);
    const area = event.life_area_id ? areas.byId.get(event.life_area_id) : undefined;
    occurrences.forEach((occ, index) => {
      items.push({
        id: index === 0 ? event.id : `${event.id}-${occ.start.toISOString()}`,
        title: event.title,
        start: occ.start.toISOString(),
        end: occ.end.toISOString(),
        allDay: event.all_day,
        color: area?.color ?? DEFAULT_COLOR,
        icon: area?.icon ?? DEFAULT_ICON,
        kind: "event",
        editable: true,
        sourceTable: "calendar_events",
        sourceId: event.id,
        priority: event.priority,
        location: event.location,
        description: event.description,
        recurrenceRule: event.recurrence_rule,
        isRecurringInstance: index > 0,
        lifeAreaId: event.life_area_id,
        reminderMinutesBefore: event.reminder_minutes_before,
        subtype: event.subtype,
      });
    });
  }

  const icsbArea = areas.byName.get("ICSB Security");
  for (const shift of shifts) {
    const start = new Date(shift.start_at);
    const end = new Date(shift.end_at);
    if (end < rangeStart || start > rangeEnd) continue;
    items.push({
      id: `shifts-${shift.id}`,
      title: `${shift.shift_type[0].toUpperCase()}${shift.shift_type.slice(1)} shift`,
      start: shift.start_at,
      end: shift.end_at,
      allDay: false,
      color: icsbArea?.color ?? "#EF4444",
      icon: icsbArea?.icon ?? "ShieldCheck",
      kind: "shift",
      editable: true,
      sourceTable: "shifts",
      sourceId: shift.id,
      priority: null,
      location: null,
      description: shift.notes,
      recurrenceRule: null,
      isRecurringInstance: false,
      lifeAreaId: icsbArea?.id ?? null,
      reminderMinutesBefore: null,
      subtype: shift.shift_type,
    });
  }

  items.push(
    ...linkedItems(
      goals.map((g) => ({ id: g.id, title: g.title, date: g.target_date, life_area_id: g.life_area_id })),
      "goal",
      "goals",
      areas,
      rangeStart,
      rangeEnd,
    ),
    ...linkedItems(
      projects.map((p) => ({ id: p.id, title: p.name, date: p.deadline, life_area_id: p.life_area_id })),
      "project",
      "projects",
      areas,
      rangeStart,
      rangeEnd,
    ),
    ...linkedItems(
      documents.map((d) => ({ id: d.id, title: d.title, date: d.expires_at, life_area_id: d.life_area_id })),
      "document",
      "documents",
      areas,
      rangeStart,
      rangeEnd,
    ),
    ...linkedItems(
      responsibilities
        .filter((r) => !r.completed)
        .map((r) => ({ id: r.id, title: r.title, date: r.due_date })),
      "responsibility",
      "responsibilities",
      areas,
      rangeStart,
      rangeEnd,
    ),
    ...linkedItems(
      milestones.map((m) => ({ id: m.id, title: m.title, date: m.date, life_area_id: m.life_area_id })),
      "milestone",
      "milestones",
      areas,
      rangeStart,
      rangeEnd,
    ),
  );

  return items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
