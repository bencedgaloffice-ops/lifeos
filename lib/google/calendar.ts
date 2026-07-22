const API_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleEventTime = { date?: string; dateTime?: string; timeZone?: string };

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "cancelled" | "tentative";
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  recurrence?: string[];
  updated?: string;
};

type ListResult = { items: GoogleEvent[]; nextSyncToken?: string; nextPageToken?: string };

async function googleFetch(accessToken: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

/** Lists events, following an incremental syncToken when we have one so
 * deletions arrive as `status: "cancelled"` items instead of requiring a
 * full-list diff. Falls back to a rolling ±2 year window on first sync. */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
): Promise<{ items: GoogleEvent[]; nextSyncToken: string | null; syncTokenExpired: boolean }> {
  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({ singleEvents: "false", maxResults: "250" });
    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      const now = new Date();
      params.set("timeMin", new Date(now.getFullYear() - 2, 0, 1).toISOString());
      params.set("timeMax", new Date(now.getFullYear() + 2, 0, 1).toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);

    const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    if (res.status === 410) {
      // Sync token expired/invalidated — caller should retry a full resync.
      return { items: [], nextSyncToken: null, syncTokenExpired: true };
    }
    if (!res.ok) throw new Error(`Google Calendar list failed: ${res.status}`);

    const data = (await res.json()) as ListResult;
    items.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { items, nextSyncToken, syncTokenExpired: false };
}

export async function insertEvent(accessToken: string, calendarId: string, event: Partial<GoogleEvent>): Promise<GoogleEvent> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Google Calendar insert failed: ${res.status}`);
  return res.json();
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleEvent>,
): Promise<GoogleEvent> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Google Calendar update failed: ${res.status}`);
  return res.json();
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
  });
  // 410 = already gone on Google's side — treat as success.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`Google Calendar delete failed: ${res.status}`);
  }
}
