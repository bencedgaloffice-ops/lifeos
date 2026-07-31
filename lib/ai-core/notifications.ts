/**
 * The notification store.
 *
 * Distinct from recommendations on purpose: a recommendation is a standing
 * suggestion an agent maintains ("insurance expires soon"), while a
 * notification is a discrete "here is something now" that the user reads once
 * and clears. The Executive agent is usually the one that decides a cluster of
 * recommendations is worth an actual notification — most recommendations never
 * become one, which is how the system stays quiet.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationRow } from "./types";

export async function notify(
  supabase: SupabaseClient,
  userId: string,
  n: { source: string; title: string; body?: string; route?: string },
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    source: n.source,
    title: n.title,
    body: n.body ?? null,
    route: n.route ?? null,
  });
  if (error) console.error("notify failed:", error.message);
}

export async function listNotifications(
  supabase: SupabaseClient,
  { unreadOnly = false, limit = 30 }: { unreadOnly?: boolean; limit?: number } = {},
): Promise<NotificationRow[]> {
  let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (unreadOnly) q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) {
    console.error("listNotifications failed:", error.message);
    return [];
  }
  return (data as NotificationRow[]) ?? [];
}

export async function markNotificationRead(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("markNotificationRead failed:", error.message);
}

export async function markAllNotificationsRead(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) console.error("markAllNotificationsRead failed:", error.message);
}
