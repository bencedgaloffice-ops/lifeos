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
  revalidatePath("/dashboard/relationship");
  revalidatePath("/dashboard");
}

export async function updateRelationship(formData: FormData) {
  const { supabase, user } = await requireUser();

  await supabase.from("relationship").upsert(
    {
      user_id: user.id,
      partner_name: String(formData.get("partner_name") ?? "").trim() || null,
      relationship_start_date: String(formData.get("relationship_start_date") ?? "") || null,
      engagement_date: String(formData.get("engagement_date") ?? "") || null,
      wedding_date: String(formData.get("wedding_date") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  refresh();
}

export async function createWeddingTask(relationshipId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await supabase.from("wedding_tasks").insert({
    user_id: user.id,
    relationship_id: relationshipId,
    title,
    category: String(formData.get("category") ?? "").trim() || null,
    due_date: String(formData.get("due_date") ?? "") || null,
  });
  refresh();
}

export async function updateWeddingTaskStatus(id: string, status: string) {
  const { supabase } = await requireUser();
  await supabase.from("wedding_tasks").update({ status }).eq("id", id);
  refresh();
}

export async function deleteWeddingTask(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("wedding_tasks").delete().eq("id", id);
  refresh();
}

export async function createSharedMilestone(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!title || !date) return;

  await supabase.from("milestones").insert({
    user_id: user.id,
    title,
    date,
    category: "Relationship",
  });
  refresh();
}

export async function deleteSharedMilestone(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("milestones").delete().eq("id", id);
  refresh();
}
