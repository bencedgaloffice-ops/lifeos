import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationWorkspaceModule } from "@/components/dashboard/modules/OrganizationWorkspaceModule";
import type {
  Organization,
  Transaction,
  Project,
  OrgLicense,
  Apiary,
  Hive,
  HiveInspection,
  HoneyHarvestLog,
  Product,
  Customer,
  Order,
  OrderItem,
  GrantApplication,
  GrantCorrespondence,
  MasterplanPhase,
} from "@/lib/types";

export const metadata = { title: "Organization" };

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();

  if (!organization) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", organization.user_id)
    .maybeSingle();

  // Fetch org-scoped rows directly, then walk the relationship chain by ID
  // (apiary -> hive -> inspection, order -> order_item, grant -> correspondence)
  // rather than relying on multi-level embedded-resource filters.
  const [
    { data: transactions },
    { data: projects },
    { data: licenses },
    { data: apiaries },
    { data: products },
    { data: customers },
    { data: orders },
    { data: grants },
    { data: masterplan },
  ] = await Promise.all([
    supabase.from("transactions").select("*").eq("organization_id", orgId).order("occurred_at", { ascending: false }),
    supabase.from("projects").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("org_licenses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("apiaries").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("products").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("customers").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("orders").select("*").eq("organization_id", orgId).order("order_date", { ascending: false }),
    supabase.from("grant_applications").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("masterplan_phases").select("*").eq("organization_id", orgId).order("phase_number", { ascending: true }),
  ]);

  const apiaryIds = (apiaries ?? []).map((a) => a.id);
  const orderIds = (orders ?? []).map((o) => o.id);
  const grantIds = (grants ?? []).map((g) => g.id);

  const { data: hives } = apiaryIds.length
    ? await supabase.from("hives").select("*").in("apiary_id", apiaryIds).order("created_at", { ascending: true })
    : { data: [] };
  const hiveIds = (hives ?? []).map((h) => h.id);

  const [{ data: inspections }, { data: harvests }, { data: orderItems }, { data: correspondence }] = await Promise.all([
    hiveIds.length
      ? supabase.from("hive_inspections").select("*").in("hive_id", hiveIds).order("inspection_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    apiaryIds.length
      ? supabase.from("honey_harvest_log").select("*").in("apiary_id", apiaryIds).order("harvest_date", { ascending: false })
      : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("order_items").select("*").in("order_id", orderIds) : Promise.resolve({ data: [] }),
    grantIds.length
      ? supabase.from("grant_correspondence").select("*").in("grant_application_id", grantIds).order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <OrganizationWorkspaceModule
      organization={organization as Organization}
      transactions={(transactions as Transaction[]) ?? []}
      projects={(projects as Project[]) ?? []}
      licenses={(licenses as OrgLicense[]) ?? []}
      apiaries={(apiaries as Apiary[]) ?? []}
      hives={(hives as Hive[]) ?? []}
      inspections={(inspections as HiveInspection[]) ?? []}
      harvests={(harvests as HoneyHarvestLog[]) ?? []}
      products={(products as Product[]) ?? []}
      customers={(customers as Customer[]) ?? []}
      orders={(orders as Order[]) ?? []}
      orderItems={(orderItems as OrderItem[]) ?? []}
      grants={(grants as GrantApplication[]) ?? []}
      correspondence={(correspondence as GrantCorrespondence[]) ?? []}
      masterplan={(masterplan as MasterplanPhase[]) ?? []}
      currency={profile?.preferred_currency || "USD"}
    />
  );
}
