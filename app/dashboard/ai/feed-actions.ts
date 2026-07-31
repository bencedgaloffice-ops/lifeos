"use server";

/**
 * The read/write surface behind the AI Activity Feed.
 *
 * All of it runs under the user's own Supabase client, so RLS is the boundary
 * and no query needs an explicit user filter. This is the window into what the
 * background agents have been doing — their open suggestions, the notifications
 * they raised, and a short trail of recent runs — plus the actions the user
 * takes on them (open, dismiss, mark read).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listOpenRecommendations, setRecommendationStatus } from "@/lib/ai-core/recommendations";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/ai-core/notifications";
import type { Recommendation, NotificationRow } from "@/lib/ai-core/types";

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return supabase;
}

export type AgentRunLite = {
  id: string;
  agent: string;
  trigger: string;
  ok: boolean;
  ms: number | null;
  detail: string | null;
  created_at: string;
};

export type ActivityFeed = {
  recommendations: Recommendation[];
  notifications: NotificationRow[];
  runs: AgentRunLite[];
};

export async function getActivityFeed(): Promise<ActivityFeed> {
  const supabase = await client();
  const [recommendations, notifications, { data: runs }] = await Promise.all([
    listOpenRecommendations(supabase, 12),
    listNotifications(supabase, { limit: 12 }),
    supabase
      .from("agent_runs")
      .select("id, agent, trigger, ok, ms, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  return { recommendations, notifications, runs: ((runs as AgentRunLite[]) ?? []) };
}

export async function dismissRecommendation(id: string) {
  const supabase = await client();
  await setRecommendationStatus(supabase, id, "dismissed");
  revalidatePath("/dashboard/ai");
}

export async function actOnRecommendation(id: string) {
  const supabase = await client();
  await setRecommendationStatus(supabase, id, "acted");
  revalidatePath("/dashboard/ai");
}

export async function readNotification(id: string) {
  const supabase = await client();
  await markNotificationRead(supabase, id);
  revalidatePath("/dashboard/ai");
}

export async function readAllNotifications() {
  const supabase = await client();
  await markAllNotificationsRead(supabase);
  revalidatePath("/dashboard/ai");
}
