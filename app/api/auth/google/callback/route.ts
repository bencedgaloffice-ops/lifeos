import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origin}/api/auth/google/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    // Google only issues a refresh token on first consent (or with
    // prompt=consent, which /start always sets) — if it's missing here,
    // something upstream changed; safest is to ask the user to reconnect.
    return NextResponse.redirect(`${origin}/dashboard/settings?google=no_refresh_token`);
  }

  const { data: existing } = await supabase
    .from("google_calendar_connections")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = {
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    sync_enabled: true,
    sync_token: null,
  };

  if (existing) {
    await supabase.from("google_calendar_connections").update(row).eq("id", existing.id);
  } else {
    await supabase.from("google_calendar_connections").insert(row);
  }

  const response = NextResponse.redirect(`${origin}/dashboard/settings?google=connected`);
  response.cookies.delete("google_oauth_state");
  return response;
}
