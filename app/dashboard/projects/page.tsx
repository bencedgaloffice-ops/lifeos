import { createClient } from "@/lib/supabase/server";
import { ProjectsModule } from "@/components/dashboard/modules/ProjectsModule";
import type { Project, Organization } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data }, { data: organizations }] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").order("created_at", { ascending: true }),
  ]);

  return <ProjectsModule projects={(data as Project[]) ?? []} organizations={(organizations as Organization[]) ?? []} />;
}
