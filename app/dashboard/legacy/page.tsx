import { createClient } from "@/lib/supabase/server";
import { LegacyModule } from "@/components/dashboard/modules/LegacyModule";
import type { Dream, Milestone, Goal, Project } from "@/lib/types";

export const metadata = { title: "Legacy" };

export default async function LegacyPage() {
  const supabase = await createClient();

  const [{ data: dreams }, { data: milestones }, { data: goals }, { data: projects }] = await Promise.all([
    supabase.from("dreams").select("*").order("order_index", { ascending: true }),
    supabase.from("milestones").select("*").order("date", { ascending: true }),
    supabase.from("goals").select("*").neq("status", "completed").order("created_at", { ascending: false }).limit(4),
    supabase.from("projects").select("*").neq("status", "completed").order("created_at", { ascending: false }).limit(4),
  ]);

  return (
    <LegacyModule
      dreams={(dreams as Dream[]) ?? []}
      milestones={(milestones as Milestone[]) ?? []}
      goals={(goals as Goal[]) ?? []}
      projects={(projects as Project[]) ?? []}
    />
  );
}
