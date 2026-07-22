import { createClient } from "@/lib/supabase/server";
import { SettingsModule } from "@/components/dashboard/modules/SettingsModule";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("calendar_feed_token")
    .maybeSingle();

  return <SettingsModule feedToken={data?.calendar_feed_token ?? null} />;
}
