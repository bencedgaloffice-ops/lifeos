import { createClient } from "@/lib/supabase/server";
import { GoalsModule } from "@/components/dashboard/modules/GoalsModule";
import type { Goal } from "@/lib/types";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });

  return <GoalsModule goals={(data as Goal[]) ?? []} />;
}
