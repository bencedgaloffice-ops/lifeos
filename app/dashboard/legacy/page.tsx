import { createClient } from "@/lib/supabase/server";
import { LegacyModule } from "@/components/dashboard/modules/LegacyModule";
import type { LegacyIdentity, FamilyMember, Milestone, Goal, Project } from "@/lib/types";

export const metadata = { title: "Legacy" };

export default async function LegacyPage() {
  const supabase = await createClient();

  const [{ data: identity }, { data: familyMembers }, { data: milestones }, { data: goals }, { data: projects }] =
    await Promise.all([
      supabase.from("legacy_identity").select("*").maybeSingle(),
      supabase.from("family_members").select("*").order("order_index", { ascending: true }),
      supabase.from("milestones").select("*").order("date", { ascending: true }),
      supabase.from("goals").select("*").neq("status", "completed").order("created_at", { ascending: false }).limit(4),
      supabase.from("projects").select("*").neq("status", "completed").order("created_at", { ascending: false }).limit(4),
    ]);

  return (
    <LegacyModule
      identity={(identity as LegacyIdentity) ?? null}
      familyMembers={(familyMembers as FamilyMember[]) ?? []}
      milestones={(milestones as Milestone[]) ?? []}
      goals={(goals as Goal[]) ?? []}
      projects={(projects as Project[]) ?? []}
    />
  );
}
