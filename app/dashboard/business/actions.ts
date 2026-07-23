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

export async function updateOrganization(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const description = String(formData.get("description") ?? "").trim() || null;

  await supabase
    .from("organizations")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/dashboard/business");
  revalidatePath(`/dashboard/business/${id}`);
  revalidatePath("/dashboard/business/organizations");
}
