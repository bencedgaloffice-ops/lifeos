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
  revalidatePath("/dashboard/legacy");
  revalidatePath("/dashboard");
}

/* ---------------- Dreams ---------------- */

export async function createDream(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const description = String(formData.get("description") ?? "").trim() || null;

  const { data: existing } = await supabase
    .from("dreams")
    .select("order_index")
    .eq("user_id", user.id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("dreams").insert({
    user_id: user.id,
    title,
    description,
    order_index: (existing?.order_index ?? -1) + 1,
  });
  refresh();
}

export async function deleteDream(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("dreams").delete().eq("id", id);
  refresh();
}

/* ---------------- Milestones ---------------- */

export async function createMilestone(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!title || !date) return;

  await supabase.from("milestones").insert({
    user_id: user.id,
    title,
    date,
  });
  refresh();
}

export async function deleteMilestone(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("milestones").delete().eq("id", id);
  refresh();
}
