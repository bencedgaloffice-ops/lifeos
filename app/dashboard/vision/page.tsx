import { createClient } from "@/lib/supabase/server";
import { VisionBoardModule } from "@/components/dashboard/modules/VisionBoardModule";
import type { VisionCard, Goal, Organization } from "@/lib/types";

export const metadata = { title: "Vision Board" };

export default async function VisionBoardPage() {
  const supabase = await createClient();

  const [{ data: cards }, { data: goals }, { data: organizations }] = await Promise.all([
    supabase.from("vision_cards").select("*").order("z_index", { ascending: true }),
    supabase.from("goals").select("*").neq("status", "dropped").order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").order("created_at", { ascending: true }),
  ]);

  return (
    <VisionBoardModule
      cards={(cards as VisionCard[]) ?? []}
      goals={(goals as Goal[]) ?? []}
      organizations={(organizations as Organization[]) ?? []}
    />
  );
}
