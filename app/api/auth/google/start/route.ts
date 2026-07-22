import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { isGoogleConfigured } from "@/lib/google/client";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/** Kicks off the Google OAuth consent flow. Requires an active LifeOS
 * session — this only ever connects the calendar for whoever is already
 * signed in, never a bare public entry point. */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=not_configured`);
  }

  const state = randomBytes(24).toString("hex");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(`${AUTH_URL}?${params}`);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
