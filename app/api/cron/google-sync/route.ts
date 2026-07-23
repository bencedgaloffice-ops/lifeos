import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pullFromGoogle } from "@/lib/google/sync";

export const maxDuration = 60;

/**
 * A scheduled top-up pull (see vercel.json) for every connected user.
 *
 * Pushing already happens the instant a manual event is created, edited, or
 * deleted (app/dashboard/calendar/actions.ts calls pushEventToGoogle
 * directly), and pulling already happens every time the Calendar page loads
 * (app/dashboard/calendar/page.tsx). Neither of those catches a change made
 * on Google's side while LifeOS isn't open, though — that's what this cron
 * is for. It reuses the exact same pullFromGoogle logic, just handed a
 * service-role client instead of the normal cookie-bound one, since a cron
 * invocation has no request session to read cookies from.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: connections } = await supabase
    .from("google_calendar_connections")
    .select("user_id")
    .eq("sync_enabled", true);

  let synced = 0;
  const errors: string[] = [];
  for (const { user_id: userId } of connections ?? []) {
    try {
      await pullFromGoogle(userId, supabase);
      synced++;
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ synced, errors });
}
