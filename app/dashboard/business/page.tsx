import { createClient } from "@/lib/supabase/server";
import { BusinessOverviewModule } from "@/components/dashboard/modules/BusinessOverviewModule";
import type { Organization, Transaction, CalendarEvent } from "@/lib/types";

export const metadata = { title: "Business" };

export default async function BusinessOverviewPage() {
  const supabase = await createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [{ data: organizations }, { data: transactions }, { data: events }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("*").not("organization_id", "is", null),
    supabase.from("calendar_events").select("*").gte("start_at", sevenDaysAgo),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from("profiles").select("preferred_currency").eq("id", user.id).maybeSingle();
    }),
  ]);

  return (
    <BusinessOverviewModule
      organizations={(organizations as Organization[]) ?? []}
      transactions={(transactions as Transaction[]) ?? []}
      events={(events as CalendarEvent[]) ?? []}
      currency={profile?.preferred_currency || "USD"}
    />
  );
}
