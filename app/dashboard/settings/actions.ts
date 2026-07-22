"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revokeConnection } from "@/lib/google/client";
import { pullFromGoogle } from "@/lib/google/sync";

/** Generates (or rotates) the private calendar-feed token and returns it. */
export async function rotateCalendarToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_calendar_feed_token");
  if (error) return null;
  revalidatePath("/dashboard/settings");
  return (data as string) ?? null;
}

/** Persists the preferred locale on the profile (cookie handles the UI). */
export async function saveLocale(locale: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ locale: locale === "hu" ? "hu" : "en" })
    .eq("id", user.id);
}

export async function disconnectGoogle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await revokeConnection(user.id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/calendar");
}

export async function syncGoogleNow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await pullFromGoogle(user.id);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/calendar");
}
