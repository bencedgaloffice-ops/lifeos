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
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard");
}

function numOrNull(fd: FormData, key: string): number | null {
  const v = String(fd.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function saveNutritionProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("profiles")
    .update({
      height_cm: numOrNull(formData, "height_cm"),
      weight_kg: numOrNull(formData, "weight_kg"),
      target_weight_kg: numOrNull(formData, "target_weight_kg"),
      fitness_goal: String(formData.get("fitness_goal") ?? "").trim() || null,
      calorie_target: numOrNull(formData, "calorie_target"),
      protein_target_g: numOrNull(formData, "protein_target_g"),
    })
    .eq("id", user.id);
  refresh();
}

export async function logMeal(formData: FormData) {
  const { supabase, user } = await requireUser();
  const meal = String(formData.get("meal") ?? "snack");
  const description = String(formData.get("description") ?? "").trim() || null;

  await supabase.from("nutrition_entries").insert({
    user_id: user.id,
    meal,
    description,
    calories: numOrNull(formData, "calories"),
    protein_g: numOrNull(formData, "protein_g"),
    carbs_g: numOrNull(formData, "carbs_g"),
    fat_g: numOrNull(formData, "fat_g"),
    water_ml: numOrNull(formData, "water_ml"),
  });
  refresh();
}

export async function deleteMealEntry(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("nutrition_entries").delete().eq("id", id);
  refresh();
}

export async function logWeight(formData: FormData) {
  const { supabase, user } = await requireUser();
  const weight = Number(formData.get("weight_kg") ?? 0);
  if (!weight) return;
  const date = String(formData.get("logged_date") ?? "") || new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("weight_log")
    .select("id")
    .eq("user_id", user.id)
    .eq("logged_date", date)
    .maybeSingle();

  if (existing) {
    await supabase.from("weight_log").update({ weight_kg: weight }).eq("id", existing.id);
  } else {
    await supabase.from("weight_log").insert({ user_id: user.id, logged_date: date, weight_kg: weight });
  }

  // Keep the headline profile weight in sync with the latest log entry.
  await supabase.from("profiles").update({ weight_kg: weight }).eq("id", user.id);
  refresh();
}
