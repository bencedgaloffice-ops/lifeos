import { createClient } from "@/lib/supabase/server";
import { OrganizationsListModule } from "@/components/dashboard/modules/OrganizationsListModule";
import type { Organization } from "@/lib/types";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: true });

  return <OrganizationsListModule organizations={(data as Organization[]) ?? []} />;
}
