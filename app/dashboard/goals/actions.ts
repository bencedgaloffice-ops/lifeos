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

export async function createGoal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const target_date = String(formData.get("target_date") ?? "") || null;
  const progress_percent = Number(formData.get("progress_percent") ?? 0) || 0;

  await supabase.from("goals").insert({
    user_id: user.id,
    title,
    description,
    category,
    target_date,
    progress_percent: Math.max(0, Math.min(100, progress_percent)),
    status: progress_percent >= 100 ? "completed" : "active",
  });

  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}

export async function updateGoalProgress(id: string, progress: number) {
  const { supabase } = await requireUser();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await supabase
    .from("goals")
    .update({
      progress_percent: clamped,
      status: clamped >= 100 ? "completed" : "active",
    })
    .eq("id", id);
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}

export async function deleteGoal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("goals").delete().eq("id", id);
  revalidatePath("/dashboard/goals");
  revalidatePath("/dashboard");
}
