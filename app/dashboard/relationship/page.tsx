import { createClient } from "@/lib/supabase/server";
import { RelationshipModule } from "@/components/dashboard/modules/RelationshipModule";
import type { Relationship, WeddingTask, Milestone } from "@/lib/types";

export const metadata = { title: "Relationship" };

export default async function RelationshipPage() {
  const supabase = await createClient();

  const { data: relationship } = await supabase.from("relationship").select("*").maybeSingle();

  const [{ data: weddingTasks }, { data: sharedMilestones }] = await Promise.all([
    relationship
      ? supabase
          .from("wedding_tasks")
          .select("*")
          .eq("relationship_id", relationship.id)
          .order("due_date", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    supabase.from("milestones").select("*").eq("category", "Relationship").order("date", { ascending: true }),
  ]);

  return (
    <RelationshipModule
      relationship={(relationship as Relationship) ?? null}
      weddingTasks={(weddingTasks as WeddingTask[]) ?? []}
      sharedMilestones={(sharedMilestones as Milestone[]) ?? []}
    />
  );
}
