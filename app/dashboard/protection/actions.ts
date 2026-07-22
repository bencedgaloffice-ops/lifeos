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
  revalidatePath("/dashboard/protection");
  revalidatePath("/dashboard");
}

/* ---------------- Documents ---------------- */

export async function createDocument(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const category = String(formData.get("category") ?? "").trim() || null;
  const expiresAt = String(formData.get("expires_at") ?? "") || null;

  await supabase.from("documents").insert({
    user_id: user.id,
    title,
    file_path: "",
    category,
    expires_at: expiresAt,
  });
  refresh();
}

export async function deleteDocument(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("documents").delete().eq("id", id);
  refresh();
}

/* ---------------- Responsibilities ---------------- */

export async function createResponsibility(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueDate = String(formData.get("due_date") ?? "") || null;
  const recurrence = String(formData.get("recurrence") ?? "").trim() || null;

  await supabase.from("responsibilities").insert({
    user_id: user.id,
    title,
    due_date: dueDate,
    recurrence,
  });
  refresh();
}

export async function toggleResponsibility(id: string, completed: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("responsibilities").update({ completed }).eq("id", id);
  refresh();
}

export async function deleteResponsibility(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("responsibilities").delete().eq("id", id);
  refresh();
}

/* ---------------- Security notes ---------------- */

export async function createSecurityNote(formData: FormData) {
  const { supabase, user } = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!label || !value) return;

  await supabase.from("security_notes").insert({ user_id: user.id, label, value });
  refresh();
}

export async function deleteSecurityNote(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("security_notes").delete().eq("id", id);
  refresh();
}
