import { createClient } from "@/lib/supabase/server";
import { CalendarModule } from "@/components/dashboard/modules/CalendarModule";
import { mergeCalendarItems } from "@/lib/calendar/merge";
import { getConnection } from "@/lib/google/client";
import { pullFromGoogle } from "@/lib/google/sync";

export const metadata = { title: "Calendar" };

const STALE_AFTER_MS = 5 * 60_000;

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const connection = await getConnection(user.id);
    const stale = !connection?.last_synced_at || Date.now() - new Date(connection.last_synced_at).getTime() > STALE_AFTER_MS;
    if (connection?.sync_enabled && stale) {
      await pullFromGoogle(user.id);
    }
  }

  const now = new Date();
  const rangeStart = new Date(now.getFullYear() - 1, 0, 1);
  const rangeEnd = new Date(now.getFullYear() + 2, 0, 1);

  const [
    { data: profile },
    { data: lifeAreas },
    { data: events },
    { data: shifts },
    { data: goals },
    { data: projects },
    { data: documents },
    { data: responsibilities },
    { data: milestones },
    { data: apiaries },
    { data: harvestLog },
    { data: habitToday },
    { data: habitRecent },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, icsb_hourly_rate, preferred_currency").maybeSingle(),
    supabase.from("life_areas").select("*").order("name"),
    supabase.from("calendar_events").select("*"),
    supabase.from("shifts").select("*").order("start_at", { ascending: false }),
    supabase.from("goals").select("id, title, target_date, life_area_id"),
    supabase.from("projects").select("id, name, deadline, life_area_id"),
    supabase.from("documents").select("id, title, expires_at, life_area_id"),
    supabase.from("responsibilities").select("id, title, due_date, completed"),
    supabase.from("milestones").select("id, title, date, life_area_id"),
    supabase.from("apiaries").select("*").order("created_at", { ascending: false }),
    supabase.from("honey_harvest_log").select("*").order("harvest_date", { ascending: false }),
    supabase.from("habit_entries").select("*").eq("entry_date", now.toISOString().slice(0, 10)).maybeSingle(),
    supabase
      .from("habit_entries")
      .select("entry_date, bible_study, workout")
      .gte("entry_date", new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const items = mergeCalendarItems({
    events: events ?? [],
    lifeAreas: lifeAreas ?? [],
    shifts: shifts ?? [],
    goals: goals ?? [],
    projects: projects ?? [],
    documents: documents ?? [],
    responsibilities: responsibilities ?? [],
    milestones: milestones ?? [],
    rangeStart,
    rangeEnd,
  });

  return (
    <CalendarModule
      items={items}
      lifeAreas={lifeAreas ?? []}
      shifts={shifts ?? []}
      apiaries={apiaries ?? []}
      harvestLog={harvestLog ?? []}
      habitToday={habitToday ?? null}
      habitRecent={habitRecent ?? []}
      icsbHourlyRate={profile?.icsb_hourly_rate ?? null}
      displayName={profile?.display_name ?? null}
      currency={profile?.preferred_currency ?? "USD"}
    />
  );
}
