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

  return (
    <SettingsModule
      feedToken={data?.calendar_feed_token ?? null}
      googleConfigured={isGoogleConfigured()}
      googleConnection={
        connection
          ? { syncEnabled: connection.sync_enabled, lastSyncedAt: connection.last_synced_at }
          : null
      }
    />
  );
}
