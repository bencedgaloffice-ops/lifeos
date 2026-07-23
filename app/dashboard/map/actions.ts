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
  revalidatePath("/dashboard/map");
}

export async function createLocation(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("life_map_locations").insert({
    user_id: user.id,
    name,
    category: String(formData.get("category") ?? "other"),
    description: String(formData.get("description") ?? "").trim() || null,
    life_area_id: String(formData.get("life_area_id") ?? "") || null,
    organization_id: String(formData.get("organization_id") ?? "") || null,
    position_x: 400 + Math.random() * 200,
    position_y: 400 + Math.random() * 200,
  });
  refresh();
}

/** Persists a pin's position after it's dragged on the map. */
export async function updateLocationPosition(id: string, x: number, y: number) {
  const { supabase } = await requireUser();
  await supabase
    .from("life_map_locations")
    .update({ position_x: x, position_y: y, updated_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}

export async function updateLocation(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase
    .from("life_map_locations")
    .update({
      name,
      category: String(formData.get("category") ?? "other"),
      description: String(formData.get("description") ?? "").trim() || null,
      life_area_id: String(formData.get("life_area_id") ?? "") || null,
      organization_id: String(formData.get("organization_id") ?? "") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh();
}

export async function deleteLocation(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("life_map_locations").delete().eq("id", id);
  refresh();
}
