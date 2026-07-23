import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { GoogleCalendarConnection } from "@/lib/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Every function here defaults to the cookie-bound Server Component/Action
 * client, exactly as before — but accepts an already-built client too, so
 * the sync cron job (no request, no session) can pass in a service-role
 * client instead. */
export async function getConnection(userId: string, client?: SupabaseClient): Promise<GoogleCalendarConnection | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** Returns a valid access token, refreshing it first if it's within 2
 * minutes of expiring. Marks the connection sync_enabled=false if the
 * refresh token has been revoked (nothing else retries after that until
 * the user reconnects). */
export async function getValidAccessToken(userId: string, client?: SupabaseClient): Promise<string | null> {
  const connection = await getConnection(userId, client);
  if (!connection || !connection.sync_enabled) return null;

  const expiresInMs = new Date(connection.token_expires_at).getTime() - Date.now();
  if (expiresInMs > 2 * 60_000) return connection.access_token;

  const supabase = client ?? (await createClient());
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    await supabase.from("google_calendar_connections").update({ sync_enabled: false }).eq("user_id", userId);
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_connections")
    .update({ access_token: data.access_token, token_expires_at: tokenExpiresAt })
    .eq("user_id", userId);

  return data.access_token;
}

export async function revokeConnection(userId: string, client?: SupabaseClient): Promise<void> {
  const connection = await getConnection(userId, client);
  const supabase = client ?? (await createClient());
  if (connection) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(connection.refresh_token)}`, { method: "POST" }).catch(() => {});
  }
  await supabase.from("google_calendar_connections").delete().eq("user_id", userId);
}
