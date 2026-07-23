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

/* ---------------- Legacy identity: emblem & scripture ---------------- */

export async function updateLegacyIdentity(formData: FormData) {
  const { supabase, user } = await requireUser();

  await supabase.from("legacy_identity").upsert(
    {
      user_id: user.id,
      emblem_name: String(formData.get("emblem_name") ?? "").trim() || null,
      emblem_meaning: String(formData.get("emblem_meaning") ?? "").trim() || null,
      scripture_reference: String(formData.get("scripture_reference") ?? "").trim() || null,
      scripture_text: String(formData.get("scripture_text") ?? "").trim() || null,
      family_story: String(formData.get("family_story") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  refresh();
}

/* ---------------- Family members ---------------- */

export async function createFamilyMember(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("family_members").insert({
    user_id: user.id,
    name,
    relation: String(formData.get("relation") ?? "").trim() || null,
    birth_year: Number(formData.get("birth_year") ?? 0) || null,
    death_year: Number(formData.get("death_year") ?? 0) || null,
    story: String(formData.get("story") ?? "").trim() || null,
  });
  refresh();
}

export async function deleteFamilyMember(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("family_members").delete().eq("id", id);
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
