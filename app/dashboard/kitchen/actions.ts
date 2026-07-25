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

/* ---------------- Hungarian store intelligence ---------------- */

/** Record a price the user actually saw at a chain. This is what makes the
 * cheapest-store recommendation real rather than invented. */
export async function recordStorePrice(fd: FormData) {
  const { supabase, user } = await requireUser();
  const itemName = String(fd.get("item_name") ?? "").trim();
  const storeId = String(fd.get("store_id") ?? "");
  const price = Number(fd.get("price_huf"));
  if (!itemName || !storeId || !Number.isFinite(price) || price <= 0) return;

  await supabase.from("store_prices").insert({
    user_id: user.id,
    store_id: storeId,
    item_name: itemName,
    unit: (String(fd.get("unit") ?? "").trim() || null) as string | null,
    price_huf: price,
  });
  refresh();
}

export async function deleteStorePrice(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("store_prices").delete().eq("id", id);
  refresh();
}

/** Pin a shopping-list item to a specific chain (overrides the suggestion). */
export async function setShoppingItemStore(id: string, storeId: string | null) {
  const { supabase } = await requireUser();
  await supabase.from("shopping_list_items").update({ store_id: storeId }).eq("id", id);
  refresh();
}

/** Accept the whole suggested plan in one go. */
export async function applyStorePlan(plan: { itemId: string; storeId: string }[]) {
  const { supabase } = await requireUser();
  await Promise.all(
    plan.map(({ itemId, storeId }) =>
      supabase.from("shopping_list_items").update({ store_id: storeId }).eq("id", itemId),
    ),
  );
  refresh();
}
