"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { serializeRRule, type RecurrenceRule } from "@/lib/calendar/recurrence";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
}

function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v || null;
}

function combineDateTime(date: string, time: string | null): Date {
  return new Date(`${date}T${time || "09:00"}:00`);
}

function buildRecurrence(fd: FormData): string | null {
  const freq = String(fd.get("repeats") ?? "none");
  if (freq === "none") return null;

  const byDayRaw = fd.getAll("byDay").map(String);
  const until = str(fd, "repeats_until");
  const rule: RecurrenceRule = {
    freq: freq.toUpperCase() as RecurrenceRule["freq"],
    interval: 1,
    byDay: freq === "weekly" && byDayRaw.length ? byDayRaw.map(Number) : null,
    until: until ? new Date(`${until}T23:59:59`) : null,
  };
  return serializeRRule(rule);
}

/* ---------------- Calendar events ---------------- */

export async function upsertCalendarEvent(formData: FormData) {
  const { supabase, user } = await requireUser();

  const id = str(formData, "id");
  const title = str(formData, "title");
  if (!title) return;

  const date = str(formData, "date") || new Date().toISOString().slice(0, 10);
  const allDay = formData.get("all_day") === "on";
  const start = combineDateTime(date, allDay ? "00:00" : str(formData, "start_time"));
  const endTime = allDay ? "23:59" : str(formData, "end_time");
  const end = endTime ? combineDateTime(date, endTime) : new Date(start.getTime() + 60 * 60 * 1000);

  const row = {
    user_id: user.id,
    title,
    description: str(formData, "description"),
    life_area_id: str(formData, "life_area_id"),
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: allDay,
    location: str(formData, "location"),
    priority: str(formData, "priority") as "low" | "medium" | "high" | null,
    reminder_minutes_before: (() => {
      const v = str(formData, "reminder_minutes_before");
      return v ? Number(v) : null;
    })(),
    recurrence_rule: buildRecurrence(formData),
    subtype: str(formData, "subtype"),
    source: "manual" as const,
  };

  const scope = String(formData.get("scope") ?? "series");
  const occurrenceStart = str(formData, "occurrence_start");

  if (!id) {
    await supabase.from("calendar_events").insert(row);
  } else if (scope === "future" && occurrenceStart) {
    // Truncate the original series the day before this occurrence, then
    // insert a new series starting here with the edited values.
    const cutoff = new Date(new Date(occurrenceStart).getTime() - 86_400_000);
    const { data: original } = await supabase
      .from("calendar_events")
      .select("recurrence_rule")
      .eq("id", id)
      .maybeSingle();
    if (original?.recurrence_rule) {
      const untilStr = cutoff.toISOString().slice(0, 10).replace(/-/g, "");
      const truncated = original.recurrence_rule.replace(/;?UNTIL=[0-9TZ]+/i, "") + `;UNTIL=${untilStr}`;
      await supabase.from("calendar_events").update({ recurrence_rule: truncated }).eq("id", id);
    }
    await supabase.from("calendar_events").insert({ ...row, parent_event_id: id });
  } else {
    await supabase.from("calendar_events").update(row).eq("id", id);
  }

  refresh();
}

export async function deleteCalendarEvent(id: string, scope: "series" | "future" = "series", occurrenceStart?: string) {
  const { supabase } = await requireUser();

  if (scope === "future" && occurrenceStart) {
    const { data: event } = await supabase
      .from("calendar_events")
      .select("recurrence_rule")
      .eq("id", id)
      .maybeSingle();
    if (event?.recurrence_rule) {
      const cutoff = new Date(new Date(occurrenceStart).getTime() - 86_400_000);
      const untilStr = cutoff.toISOString().slice(0, 10).replace(/-/g, "");
      const truncated = event.recurrence_rule.replace(/;?UNTIL=[0-9TZ]+/i, "") + `;UNTIL=${untilStr}`;
      await supabase.from("calendar_events").update({ recurrence_rule: truncated }).eq("id", id);
      refresh();
      return;
    }
  }

  await supabase.from("calendar_events").delete().eq("id", id);
  refresh();
}

/** Drag-to-reschedule for a calendar_events row (Month/Week/Timeline drop).
 * `occurrenceMoment`/`newMoment` are either "YYYY-MM-DD" (Month, date-only
 * nudge) or "YYYY-MM-DDTHH:mm" (Week/Timeline, precise). Shifts the whole
 * series by the resulting delta, preserving duration — a fast nudge. For
 * "this occurrence only" / "this and future" semantics on a recurring
 * event, open it and use the modal's explicit save. */
export async function updateEventDate(id: string, occurrenceMoment: string, newMoment: string) {
  const { supabase } = await requireUser();
  const { data: event } = await supabase
    .from("calendar_events")
    .select("start_at, end_at")
    .eq("id", id)
    .maybeSingle();
  if (!event) return;

  const parse = (m: string) => new Date(m.includes("T") ? m : `${m}T00:00:00`);
  const deltaMs = parse(newMoment).getTime() - parse(occurrenceMoment).getTime();
  const newStart = new Date(new Date(event.start_at).getTime() + deltaMs);
  const newEnd = new Date(new Date(event.end_at).getTime() + deltaMs);

  await supabase
    .from("calendar_events")
    .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
    .eq("id", id);
  refresh();
}

/** Dragging a linked item (goal/project/document/responsibility/milestone)
 * updates that module's own date field directly — nothing is duplicated. */
export async function rescheduleLinkedItem(sourceTable: string, id: string, newDateISO: string) {
  const { supabase } = await requireUser();
  const date = newDateISO.slice(0, 10);

  const columnByTable: Record<string, string> = {
    goals: "target_date",
    projects: "deadline",
    documents: "expires_at",
    responsibilities: "due_date",
    milestones: "date",
  };
  const column = columnByTable[sourceTable];
  if (!column) return;

  await supabase.from(sourceTable).update({ [column]: date }).eq("id", id);
  refresh();
}

/* ---------------- Life Categories ---------------- */

export async function createLifeArea(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = str(formData, "name");
  if (!name) return;

  await supabase.from("life_areas").insert({
    user_id: user.id,
    name,
    icon: str(formData, "icon") || "CalendarDays",
    color: str(formData, "color") || "#3B82F6",
  });
  refresh();
}

export async function updateLifeArea(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const name = str(formData, "name");
  if (!name) return;

  await supabase
    .from("life_areas")
    .update({ name, icon: str(formData, "icon"), color: str(formData, "color") })
    .eq("id", id);
  refresh();
}

/** Blocks deletion while events reference the category — offers reassignment instead. */
export async function deleteLifeArea(id: string, reassignToId?: string) {
  const { supabase } = await requireUser();

  const { count } = await supabase
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("life_area_id", id);

  if (count && count > 0) {
    if (!reassignToId) return { blocked: count };
    await supabase.from("calendar_events").update({ life_area_id: reassignToId }).eq("life_area_id", id);
  }

  await supabase.from("life_areas").delete().eq("id", id);
  refresh();
  return { blocked: 0 };
}

/* ---------------- ICSB Security shifts ---------------- */

export async function createShift(formData: FormData) {
  const { supabase, user } = await requireUser();
  const shiftType = str(formData, "shift_type");
  const date = str(formData, "date");
  if (!shiftType || !date) return;

  const start = combineDateTime(date, str(formData, "start_time") || "08:00");
  const end = combineDateTime(date, str(formData, "end_time") || "16:00");
  const rateRaw = str(formData, "hourly_rate");

  await supabase.from("shifts").insert({
    user_id: user.id,
    shift_type: shiftType,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    hourly_rate: rateRaw ? Number(rateRaw) : null,
    notes: str(formData, "notes"),
  });
  refresh();
}

export async function deleteShift(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("shifts").delete().eq("id", id);
  refresh();
}

export async function saveDefaultHourlyRate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const rate = str(formData, "icsb_hourly_rate");
  await supabase
    .from("profiles")
    .update({ icsb_hourly_rate: rate ? Number(rate) : null })
    .eq("id", user.id);
  refresh();
}

/* ---------------- Migratory Beekeeping ---------------- */

export async function createApiary(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = str(formData, "name");
  if (!name) return;

  await supabase.from("apiaries").insert({
    user_id: user.id,
    name,
    location_text: str(formData, "location_text"),
    hive_count: (() => {
      const v = str(formData, "hive_count");
      return v ? Number(v) : null;
    })(),
    notes: str(formData, "notes"),
  });
  refresh();
}

export async function deleteApiary(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("apiaries").delete().eq("id", id);
  refresh();
}

export async function createHarvestLog(formData: FormData) {
  const { supabase, user } = await requireUser();
  const quantityRaw = str(formData, "quantity_kg");
  if (!quantityRaw) return;

  await supabase.from("honey_harvest_log").insert({
    user_id: user.id,
    apiary_id: str(formData, "apiary_id"),
    harvest_date: str(formData, "harvest_date") || new Date().toISOString().slice(0, 10),
    quantity_kg: Number(quantityRaw),
    notes: str(formData, "notes"),
  });
  refresh();
}

export async function deleteHarvestLog(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("honey_harvest_log").delete().eq("id", id);
  refresh();
}

type SeasonTemplateKey = "acacia" | "rapeseed" | "sunflower" | "forest";

const SEASON_TEMPLATES: Record<SeasonTemplateKey, { title: string; startMonth: number; startDay: number; endMonth: number; endDay: number; subtype: string }> = {
  acacia: { title: "Acacia bloom", startMonth: 5, startDay: 15, endMonth: 6, endDay: 5, subtype: "harvest" },
  rapeseed: { title: "Rapeseed bloom", startMonth: 4, startDay: 10, endMonth: 5, endDay: 5, subtype: "harvest" },
  sunflower: { title: "Sunflower bloom", startMonth: 7, startDay: 1, endMonth: 7, endDay: 25, subtype: "harvest" },
  forest: { title: "Forest honeydew", startMonth: 7, startDay: 15, endMonth: 8, endDay: 20, subtype: "harvest" },
};

/** Inserts an editable, yearly-recurring starting point for a bloom window —
 * not live botanical data. The user drags it to match their actual region/year. */
export async function applySeasonTemplate(key: SeasonTemplateKey) {
  const { supabase, user } = await requireUser();
  const template = SEASON_TEMPLATES[key];
  if (!template) return;

  const year = new Date().getFullYear();
  const start = new Date(year, template.startMonth - 1, template.startDay, 9, 0);
  const end = new Date(year, template.endMonth - 1, template.endDay, 18, 0);

  const { data: beeArea } = await supabase
    .from("life_areas")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", "Migratory Beekeeping")
    .maybeSingle();

  await supabase.from("calendar_events").insert({
    user_id: user.id,
    title: template.title,
    life_area_id: beeArea?.id ?? null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: true,
    subtype: template.subtype,
    recurrence_rule: "FREQ=YEARLY",
    source: "manual",
  });
  refresh();
}

/* ---------------- Daily habits (Today command center) ---------------- */

export async function upsertHabitEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const entryDate = str(formData, "entry_date") || new Date().toISOString().slice(0, 10);

  const numOrNull = (key: string) => {
    const v = str(formData, key);
    return v ? Number(v) : null;
  };

  const { data: existing } = await supabase
    .from("habit_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("entry_date", entryDate)
    .maybeSingle();

  const row = {
    user_id: user.id,
    entry_date: entryDate,
    bible_study: formData.get("bible_study") === "on",
    workout: formData.get("workout") === "on",
    water_ml: numOrNull("water_ml"),
    mood: numOrNull("mood"),
    energy: numOrNull("energy"),
    focus_score: numOrNull("focus_score"),
    notes: str(formData, "notes"),
  };

  if (existing) {
    await supabase.from("habit_entries").update(row).eq("id", existing.id);
  } else {
    await supabase.from("habit_entries").insert(row);
  }
  refresh();
}
