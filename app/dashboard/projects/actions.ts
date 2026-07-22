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

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const description = String(formData.get("description") ?? "").trim() || null;
  const deadline = String(formData.get("deadline") ?? "") || null;
  const progress_percent = Number(formData.get("progress_percent") ?? 0) || 0;

  await supabase.from("projects").insert({
    user_id: user.id,
    name,
    description,
    deadline,
    progress_percent: Math.max(0, Math.min(100, progress_percent)),
    status: "active",
  });

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
}

export async function updateProjectProgress(id: string, progress: number) {
  const { supabase } = await requireUser();
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await supabase
    .from("projects")
    .update({
      progress_percent: clamped,
      status: clamped >= 100 ? "completed" : "active",
    })
    .eq("id", id);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
}

export async function deleteProject(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
}
