"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard/habits");
  revalidatePath("/dashboard");
}

export async function createHabit(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("habits").insert({
    user_id: user.id,
    name,
    cadence: String(formData.get("cadence") ?? "daily"),
    target_per_period: Number(formData.get("target_per_period") ?? 1) || 1,
  });
  refresh();
}

export async function deleteHabit(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("habits").delete().eq("id", id);
  refresh();
}

export async function toggleHabitLog(habitId: string, date: string, completed: boolean) {
  const { supabase, user } = await requireUser();

  if (completed) {
    await supabase.from("habit_logs").upsert(
      { user_id: user.id, habit_id: habitId, log_date: date, completed: true },
      { onConflict: "habit_id,log_date" },
    );
  } else {
    await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", date);
  }
  refresh();
}
