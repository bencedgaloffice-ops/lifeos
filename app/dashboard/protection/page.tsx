import { createClient } from "@/lib/supabase/server";
import { ProtectionModule } from "@/components/dashboard/modules/ProtectionModule";
import type { Document, Responsibility, SecurityNote } from "@/lib/types";

export const metadata = { title: "Protection" };

export default async function ProtectionPage() {
  const supabase = await createClient();

  const [{ data: documents }, { data: responsibilities }, { data: notes }] = await Promise.all([
    supabase.from("documents").select("*").order("expires_at", { ascending: true, nullsFirst: false }),
    supabase.from("responsibilities").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("security_notes").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <ProtectionModule
      documents={(documents as Document[]) ?? []}
      responsibilities={(responsibilities as Responsibility[]) ?? []}
      notes={(notes as SecurityNote[]) ?? []}
    />
  );
}
