import { createClient } from "@/lib/supabase/server";
import { JournalModule } from "@/components/dashboard/modules/JournalModule";
import type { JournalEntry } from "@/lib/types";

export const metadata = { title: "Journal" };

export default async function JournalPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("journal_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  return <JournalModule entries={(data as JournalEntry[]) ?? []} />;
}
