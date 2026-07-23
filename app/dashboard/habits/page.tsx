import { createClient } from "@/lib/supabase/server";
import { HabitsModule } from "@/components/dashboard/modules/HabitsModule";
import type { Habit, HabitLog } from "@/lib/types";

export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const supabase = await createClient();

  const sevenDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from("habits").select("*").eq("active", true).order("created_at", { ascending: true }),
    supabase.from("habit_logs").select("*").gte("log_date", sevenDaysAgo),
  ]);

  return <HabitsModule habits={(habits as Habit[]) ?? []} logs={(logs as HabitLog[]) ?? []} />;
}
