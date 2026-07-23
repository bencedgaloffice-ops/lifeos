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

  const [
    { data: transactions },
    { data: projects },
    { data: licenses },
    { data: apiaries },
    { data: hives },
    { data: inspections },
    { data: harvests },
    { data: products },
    { data: customers },
    { data: orders },
    { data: orderItems },
    { data: grants },
    { data: correspondence },
    { data: masterplan },
  ] = await Promise.all([
    supabase.from("transactions").select("*").eq("organization_id", orgId).order("occurred_at", { ascending: false }),
    supabase.from("projects").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("org_licenses").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("apiaries").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("hives").select("*, apiaries!inner(organization_id)").eq("apiaries.organization_id", orgId),
    supabase
      .from("hive_inspections")
      .select("*, hives!inner(apiary_id, apiaries!inner(organization_id))")
      .eq("hives.apiaries.organization_id", orgId)
      .order("inspection_date", { ascending: false }),
    supabase
      .from("honey_harvest_log")
      .select("*, apiaries!inner(organization_id)")
      .eq("apiaries.organization_id", orgId)
      .order("harvest_date", { ascending: false }),
    supabase.from("products").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("customers").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("orders").select("*").eq("organization_id", orgId).order("order_date", { ascending: false }),
    supabase.from("order_items").select("*, orders!inner(organization_id)").eq("orders.organization_id", orgId),
    supabase.from("grant_applications").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase
      .from("grant_correspondence")
      .select("*, grant_applications!inner(organization_id)")
      .eq("grant_applications.organization_id", orgId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("masterplan_phases")
      .select("*")
      .eq("organization_id", orgId)
      .order("phase_number", { ascending: true }),
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
