import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { JarvisRoot } from "@/components/jarvis/JarvisRoot";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure a profile row exists for this user (no DB trigger creates one).
  const metaName =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Explorer";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({ id: user.id, display_name: metaName });
  }

  const name = profile?.display_name || metaName;

  // The companion provider wraps the whole dashboard so the floating widget
  // and the dedicated Jarvis page share one live session.
  return (
    <JarvisRoot variant="dashboard" userName={name}>
      <DashboardShell name={name} email={user.email ?? ""}>
        {children}
      </DashboardShell>
    </JarvisRoot>
  );
}
