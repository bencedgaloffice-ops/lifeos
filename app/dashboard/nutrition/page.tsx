import { createClient } from "@/lib/supabase/server";
import { NutritionModule } from "@/components/dashboard/modules/NutritionModule";
import type { Profile, NutritionEntry, WeightLogEntry } from "@/lib/types";

export const metadata = { title: "Nutrition" };

export default async function NutritionPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [{ data: profile }, { data: todayEntries }, { data: recentEntries }, { data: weightLog }] =
    await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase
        .from("nutrition_entries")
        .select("*")
        .gte("logged_at", todayStart.toISOString())
        .order("logged_at", { ascending: true }),
      supabase
        .from("nutrition_entries")
        .select("logged_at")
        .gte("logged_at", twoWeeksAgo),
      supabase
        .from("weight_log")
        .select("*")
        .order("logged_date", { ascending: true })
        .limit(90),
    ]);

  // Consistency: distinct days logged in the last 14.
  const daysLogged = new Set(
    (recentEntries ?? []).map((e) => new Date(e.logged_at).toISOString().slice(0, 10)),
  ).size;

  return (
    <NutritionModule
      profile={(profile as Profile) ?? null}
      todayEntries={(todayEntries as NutritionEntry[]) ?? []}
      weightLog={(weightLog as WeightLogEntry[]) ?? []}
      consistencyDays={daysLogged}
    />
  );
}
