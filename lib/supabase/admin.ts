import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * Service-role client — bypasses Row Level Security entirely. Only ever use
 * this from trusted server-only contexts with no user session, such as the
 * Google Calendar sync cron job that runs across every user's connection.
 * Never expose this client (or the key it reads) to anything reachable from
 * the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
