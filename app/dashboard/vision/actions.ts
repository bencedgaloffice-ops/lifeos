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
  revalidatePath("/dashboard/vision");
  revalidatePath("/dashboard");
}

export async function createVisionCard(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const category = String(formData.get("category") ?? "personal") === "business" ? "business" : "personal";
  const goalId = String(formData.get("goal_id") ?? "") || null;
  const organizationId = category === "business" ? String(formData.get("organization_id") ?? "") || null : null;
  const progressOverride = formData.get("progress_override")
    ? Math.max(0, Math.min(100, Number(formData.get("progress_override"))))
    : null;

  const { data: existing } = await supabase
    .from("vision_cards")
    .select("z_index")
    .eq("user_id", user.id)
    .order("z_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("vision_cards").insert({
    user_id: user.id,
    title,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    target_date: String(formData.get("target_date") ?? "") || null,
    category,
    goal_id: goalId,
    organization_id: organizationId,
    progress_override: progressOverride,
    notes: String(formData.get("notes") ?? "").trim() || null,
    z_index: (existing?.z_index ?? 0) + 1,
  });
  refresh();
}

export async function deleteVisionCard(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("vision_cards").delete().eq("id", id);
  refresh();
}

/** Persists a card's free position + layer order after a canvas drag. */
export async function updateVisionCardPosition(id: string, x: number, y: number, zIndex: number) {
  const { supabase } = await requireUser();
  await supabase
    .from("vision_cards")
    .update({ position_x: x, position_y: y, z_index: zIndex, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/dashboard/vision");
}
