"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Quick-add a calendar event / reminder from the Life Overview. */
export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const category = String(formData.get("category") ?? "").trim() || null;

  const start = dateStr
    ? new Date(`${dateStr}T${timeStr || "09:00"}:00`)
    : new Date();
  const allDay = !timeStr;
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  await supabase.from("calendar_events").insert({
    user_id: user.id,
    title,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: allDay,
    category,
    source: "manual",
  });

  revalidatePath("/dashboard");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await supabase.from("calendar_events").delete().eq("id", id);
  revalidatePath("/dashboard");
}
