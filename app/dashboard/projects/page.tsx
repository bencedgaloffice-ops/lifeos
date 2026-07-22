import { createClient } from "@/lib/supabase/server";
import { ProjectsModule } from "@/components/dashboard/modules/ProjectsModule";
import type { Project } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  return <ProjectsModule projects={(data as Project[]) ?? []} />;
}
