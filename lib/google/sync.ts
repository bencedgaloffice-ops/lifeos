import { createClient } from "@/lib/supabase/server";
import { getConnection, getValidAccessToken } from "@/lib/google/client";
import { listEvents, insertEvent, updateEvent, deleteEvent, type GoogleEvent } from "@/lib/google/calendar";
import type { CalendarEvent } from "@/lib/types";

function toGoogleEvent(row: Pick<CalendarEvent, "title" | "description" | "location" | "start_at" | "end_at" | "all_day" | "recurrence_rule">): Partial<GoogleEvent> {
  const body: Partial<GoogleEvent> = {
    summary: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
  };
  if (row.all_day) {
    body.start = { date: row.start_at.slice(0, 10) };
    body.end = { date: row.end_at.slice(0, 10) };
  } else {
    body.start = { dateTime: row.start_at };
    body.end = { dateTime: row.end_at };
  }
  if (row.recurrence_rule) body.recurrence = [`RRULE:${row.recurrence_rule}`];
  return body;
}

function fromGoogleEvent(item: GoogleEvent): Omit<CalendarEvent, "id" | "user_id" | "created_at" | "updated_at" | "google_event_id" | "life_area_id" | "priority" | "reminder_minutes_before" | "subtype" | "parent_event_id" | "category"> {
  const allDay = Boolean(item.start?.date);
  const start_at = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T00:00:00Z` : new Date().toISOString());
  const end_at = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00Z` : new Date(Date.now() + 3_600_000).toISOString());
  const rrule = item.recurrence?.find((r) => r.startsWith("RRULE:"))?.replace(/^RRULE:/, "") ?? null;

  return {
    title: item.summary || "(untitled)",
    description: item.description ?? null,
    location: item.location ?? null,
    start_at,
    end_at,
    all_day: allDay,
    source: "google",
    recurrence_rule: rrule,
  };
}

/** Pulls remote changes since the last sync via Google's incremental
 * syncToken (deletions arrive as status:"cancelled" items — no full-list
 * diffing needed). Falls back to a fresh ±2 year window if the token has
 * expired on Google's side. No-ops silently if nothing is connected. */
export async function pullFromGoogle(userId: string): Promise<void> {
  const connection = await getConnection(userId);
  if (!connection || !connection.sync_enabled) return;

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const supabase = await createClient();

  try {
    let result = await listEvents(accessToken, connection.google_calendar_id, connection.sync_token);
    if (result.syncTokenExpired) {
      result = await listEvents(accessToken, connection.google_calendar_id, null);
    }

    for (const item of result.items) {
      if (item.status === "cancelled") {
        await supabase.from("calendar_events").delete().eq("user_id", userId).eq("google_event_id", item.id);
        continue;
      }

      const mapped = fromGoogleEvent(item);
      const { data: existing } = await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .eq("google_event_id", item.id)
        .maybeSingle();

      if (existing) {
        await supabase.from("calendar_events").update(mapped).eq("id", existing.id);
      } else {
        await supabase.from("calendar_events").insert({ ...mapped, user_id: userId, google_event_id: item.id });
      }
    }

    await supabase
      .from("google_calendar_connections")
      .update({ sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString() })
      .eq("user_id", userId);
  } catch (err) {
    console.error("Google Calendar pull failed", err);
  }
}

/** Pushes a local create/update/delete out to Google. Never throws — a
 * Google API hiccup should never break the local edit that already
 * committed; it's simply not reflected on Google's side until the next
 * successful push or pull. */
export async function pushEventToGoogle(
  userId: string,
  event: Pick<CalendarEvent, "id" | "title" | "description" | "location" | "start_at" | "end_at" | "all_day" | "recurrence_rule" | "google_event_id">,
  op: "upsert" | "delete",
): Promise<void> {
  const connection = await getConnection(userId);
  if (!connection || !connection.sync_enabled) return;

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const supabase = await createClient();

  try {
    if (op === "delete") {
      if (event.google_event_id) {
        await deleteEvent(accessToken, connection.google_calendar_id, event.google_event_id);
      }
      return;
    }

    const body = toGoogleEvent(event);
    if (event.google_event_id) {
      await updateEvent(accessToken, connection.google_calendar_id, event.google_event_id, body);
    } else {
      const created = await insertEvent(accessToken, connection.google_calendar_id, body);
      await supabase.from("calendar_events").update({ google_event_id: created.id }).eq("id", event.id);
    }
  } catch (err) {
    console.error("Google Calendar push failed", err);
  }
}
