import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type FeedEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category: string | null;
  recurrence_rule: string | null;
  updated_at: string;
};

/** Escapes text per RFC 5545 (commas, semicolons, backslashes, newlines). */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, "");
}

/** Folds lines longer than 75 octets per RFC 5545. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
}

/**
 * Public ICS calendar feed, gated by an unguessable per-user token.
 * Subscribe to this URL from Google Calendar ("From URL") or Apple Calendar
 * (File → New Calendar Subscription) and your LifeOS events appear there,
 * refreshed automatically by their servers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // UUID sanity-check before hitting the database.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  // Anonymous client is enough — the SECURITY DEFINER RPC does the token check.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc("get_calendar_feed", { feed_token: token });

  if (error) {
    return new Response("Feed unavailable", { status: 500 });
  }

  const events = (data ?? []) as FeedEvent[];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LifeOS//Personal Operating System//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold("X-WR-CALNAME:LifeOS"),
    "X-WR-TIMEZONE:UTC",
    // Ask clients to refresh roughly hourly.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${e.id}@lifeos`));
    lines.push(`DTSTAMP:${icsDateTime(e.updated_at)}`);
    if (e.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start_at)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(e.end_at)}`);
    } else {
      lines.push(`DTSTART:${icsDateTime(e.start_at)}`);
      lines.push(`DTEND:${icsDateTime(e.end_at)}`);
    }
    lines.push(fold(`SUMMARY:${icsEscape(e.title)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${icsEscape(e.description)}`));
    if (e.category) lines.push(fold(`CATEGORIES:${icsEscape(e.category)}`));
    if (e.recurrence_rule) lines.push(fold(`RRULE:${e.recurrence_rule}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="lifeos.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}
