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
  revalidatePath("/dashboard/kitchen");
}

/* ---------------- Kitchen items (fridge / pantry / freezer) ---------------- */

export async function createKitchenItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const location = String(formData.get("location") ?? "fridge");
  const quantity = String(formData.get("quantity") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const expiresAt = String(formData.get("expires_at") ?? "") || null;

  await supabase.from("kitchen_items").insert({
    user_id: user.id,
    name,
    location,
    quantity,
    category,
    expires_at: expiresAt,
  });
  refresh();
}

export async function deleteKitchenItem(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("kitchen_items").delete().eq("id", id);
  refresh();
}

/* ---------------- Shopping list ---------------- */

export async function addShoppingItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const category = String(formData.get("category") ?? "").trim() || null;

  await supabase.from("shopping_list_items").insert({ user_id: user.id, name, category });
  refresh();
}

export async function toggleShoppingItem(id: string, checked: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("shopping_list_items").update({ checked }).eq("id", id);
  refresh();
}

export async function deleteShoppingItem(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("shopping_list_items").delete().eq("id", id);
  refresh();
}

/* ---------------- Log a suggested meal into Nutrition ---------------- */

export async function logSuggestedMeal(input: {
  name: string;
  calories: number;
  proteinG: number;
}) {
  const { supabase, user } = await requireUser();
  await supabase.from("nutrition_entries").insert({
    user_id: user.id,
    meal: "lunch",
    description: input.name,
    calories: input.calories,
    protein_g: input.proteinG,
  });
  revalidatePath("/dashboard/nutrition");
  revalidatePath("/dashboard");
}
