import { createClient } from "@/lib/supabase/server";
import { LifeMapModule } from "@/components/dashboard/modules/LifeMapModule";
import type { LifeMapLocation, LifeArea, Organization, Goal, Document, Transaction } from "@/lib/types";

export const metadata = { title: "Life Map" };

export default async function LifeMapPage() {
  const supabase = await createClient();

  const [
    { data: locations },
    { data: lifeAreas },
    { data: organizations },
    { data: goals },
    { data: documents },
    { data: transactions },
  ] = await Promise.all([
    supabase.from("life_map_locations").select("*").order("created_at", { ascending: true }),
    supabase.from("life_areas").select("*").order("name"),
    supabase.from("organizations").select("*").order("created_at", { ascending: true }),
    supabase.from("goals").select("*").neq("status", "dropped").order("created_at", { ascending: false }),
    supabase.from("documents").select("*").order("uploaded_at", { ascending: false }),
    supabase.from("transactions").select("*").order("occurred_at", { ascending: false }).limit(200),
  ]);

  return (
    <LifeMapModule
      locations={(locations as LifeMapLocation[]) ?? []}
      lifeAreas={(lifeAreas as LifeArea[]) ?? []}
      organizations={(organizations as Organization[]) ?? []}
      goals={(goals as Goal[]) ?? []}
      documents={(documents as Document[]) ?? []}
      transactions={(transactions as Transaction[]) ?? []}
    />
  );
}
