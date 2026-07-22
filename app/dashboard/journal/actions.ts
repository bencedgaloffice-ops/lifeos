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

export async function createEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const title = String(formData.get("title") ?? "").trim() || null;
  const mood = String(formData.get("mood") ?? "").trim() || null;
  const entry_date =
    String(formData.get("entry_date") ?? "") || new Date().toISOString().slice(0, 10);

  await supabase.from("journal_entries").insert({
    user_id: user.id,
    title,
    body,
    mood,
    entry_date,
  });

  revalidatePath("/dashboard/journal");
  revalidatePath("/dashboard");
}

export async function deleteEntry(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("journal_entries").delete().eq("id", id);
  revalidatePath("/dashboard/journal");
  revalidatePath("/dashboard");
}
