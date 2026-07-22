import { createClient } from "@/lib/supabase/server";
import { ProfileModule } from "@/components/dashboard/modules/ProfileModule";
import type { Profile } from "@/lib/types";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").maybeSingle();
  return <ProfileModule profile={(data as Profile) ?? null} />;
}
