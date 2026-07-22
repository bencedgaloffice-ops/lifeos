import { createClient } from "@/lib/supabase/server";
import { SettingsModule } from "@/components/dashboard/modules/SettingsModule";
import { getConnection, isGoogleConfigured } from "@/lib/google/client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("calendar_feed_token")
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const connection = user ? await getConnection(user.id) : null;

  const [{ count: eventCount }, { count: shiftCount }, { data: latestImported }] = await Promise.all([
    supabase.from("calendar_events").select("id", { count: "exact", head: true }).not("google_event_id", "is", null),
    supabase.from("shifts").select("id", { count: "exact", head: true }).not("google_event_id", "is", null),
    supabase
      .from("calendar_events")
      .select("start_at")
      .not("google_event_id", "is", null)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <SettingsModule
      feedToken={data?.calendar_feed_token ?? null}
      googleConfigured={isGoogleConfigured()}
      googleConnection={
        connection
          ? { syncEnabled: connection.sync_enabled, lastSyncedAt: connection.last_synced_at }
          : null
      }
      googleImported={{
        count: (eventCount ?? 0) + (shiftCount ?? 0),
        latestEventDate: latestImported?.start_at ?? null,
      }}
    />
  );
}
