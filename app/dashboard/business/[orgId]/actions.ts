"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function refresh(orgId: string) {
  revalidatePath(`/dashboard/business/${orgId}`);
  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard/finance");
}

async function ensureOrgAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string,
  orgName: string,
): Promise<string> {
  const accountName = `${orgName} — Business`;
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", accountName)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", userId)
    .maybeSingle();

  const { data: created } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: accountName,
      type: "other",
      currency: profile?.preferred_currency || "USD",
    })
    .select("id")
    .single();
  return created!.id;
}

/* ---------------- Financials ---------------- */

export async function createOrgTransaction(orgId: string, orgName: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  if (!amount) return;

  const direction = String(formData.get("direction") ?? "out") === "in" ? "in" : "out";
  const description = String(formData.get("description") ?? "").trim() || null;
  const occurredDate = String(formData.get("occurred_at") ?? "");
  const account_id = await ensureOrgAccount(supabase, user.id, orgId, orgName);

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id,
    organization_id: orgId,
    amount,
    currency: profile?.preferred_currency || "USD",
    direction,
    description,
    occurred_at: occurredDate ? new Date(occurredDate).toISOString() : new Date().toISOString(),
  });

  refresh(orgId);
}

export async function deleteOrgTransaction(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("transactions").delete().eq("id", id);
  refresh(orgId);
}

/* ---------------- Licenses ---------------- */

export async function createLicense(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("org_licenses").insert({
    user_id: user.id,
    organization_id: orgId,
    name,
    license_number: String(formData.get("license_number") ?? "").trim() || null,
    issuing_body: String(formData.get("issuing_body") ?? "").trim() || null,
    issued_date: String(formData.get("issued_date") ?? "") || null,
    expires_at: String(formData.get("expires_at") ?? "") || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function deleteLicense(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("org_licenses").delete().eq("id", id);
  refresh(orgId);
}

/* ---------------- Beekeeping: apiaries, hives, inspections, harvests ---------------- */

export async function createApiary(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("apiaries").insert({
    user_id: user.id,
    organization_id: orgId,
    name,
    location_text: String(formData.get("location_text") ?? "").trim() || null,
    hive_count: Number(formData.get("hive_count") ?? 0) || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function createHive(orgId: string, apiaryId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  await supabase.from("hives").insert({
    user_id: user.id,
    apiary_id: apiaryId,
    label,
    colony_status: String(formData.get("colony_status") ?? "stable"),
    queen_marked: formData.get("queen_marked") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function updateHiveStatus(orgId: string, id: string, colony_status: string) {
  const { supabase } = await requireUser();
  await supabase.from("hives").update({ colony_status, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(orgId);
}

export async function deleteHive(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("hives").delete().eq("id", id);
  refresh(orgId);
}

export async function createInspection(orgId: string, hiveId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  await supabase.from("hive_inspections").insert({
    user_id: user.id,
    hive_id: hiveId,
    inspection_date: String(formData.get("inspection_date") ?? "") || new Date().toISOString().slice(0, 10),
    findings: String(formData.get("findings") ?? "").trim() || null,
    actions_taken: String(formData.get("actions_taken") ?? "").trim() || null,
    varroa_load: String(formData.get("varroa_load") ?? "none"),
    disease_flag: formData.get("disease_flag") === "on",
    feeding_needed: formData.get("feeding_needed") === "on",
    temperament: String(formData.get("temperament") ?? "") || null,
  });
  refresh(orgId);
}

export async function deleteInspection(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("hive_inspections").delete().eq("id", id);
  refresh(orgId);
}

export async function createHarvest(orgId: string, apiaryId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const quantity_kg = Math.abs(Number(formData.get("quantity_kg") ?? 0));
  if (!quantity_kg) return;

  await supabase.from("honey_harvest_log").insert({
    user_id: user.id,
    apiary_id: apiaryId,
    hive_id: String(formData.get("hive_id") ?? "") || null,
    honey_type: String(formData.get("honey_type") ?? "").trim() || null,
    harvest_date: String(formData.get("harvest_date") ?? "") || new Date().toISOString().slice(0, 10),
    quantity_kg,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function deleteHarvest(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("honey_harvest_log").delete().eq("id", id);
  refresh(orgId);
}

/* ---------------- Sales: products, customers, orders ---------------- */

export async function createProduct(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("products").insert({
    user_id: user.id,
    organization_id: orgId,
    name,
    category: String(formData.get("category") ?? "honey"),
    unit: String(formData.get("unit") ?? "jar").trim() || "jar",
    price: Math.abs(Number(formData.get("price") ?? 0)),
    stock_qty: Math.abs(Number(formData.get("stock_qty") ?? 0)),
  });
  refresh(orgId);
}

export async function deleteProduct(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("products").delete().eq("id", id);
  refresh(orgId);
}

export async function createCustomer(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await supabase.from("customers").insert({
    user_id: user.id,
    organization_id: orgId,
    name,
    contact_info: String(formData.get("contact_info") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function deleteCustomer(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("customers").delete().eq("id", id);
  refresh(orgId);
}

export async function createOrder(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const productId = String(formData.get("product_id") ?? "");
  const quantity = Math.abs(Number(formData.get("quantity") ?? 0));
  if (!productId || !quantity) return;

  const { data: product } = await supabase
    .from("products")
    .select("price, stock_qty")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return;

  const unit_price = Number(product.price);
  const total_amount = unit_price * quantity;
  const customerId = String(formData.get("customer_id") ?? "") || null;

  const { data: order } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      organization_id: orgId,
      customer_id: customerId,
      status: String(formData.get("status") ?? "pending"),
      order_date: String(formData.get("order_date") ?? "") || new Date().toISOString().slice(0, 10),
      total_amount,
    })
    .select("id")
    .single();

  if (order) {
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      quantity,
      unit_price,
    });
    await supabase
      .from("products")
      .update({ stock_qty: Math.max(0, Number(product.stock_qty) - quantity) })
      .eq("id", productId);
  }

  refresh(orgId);
}

export async function deleteOrder(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("orders").delete().eq("id", id);
  refresh(orgId);
}

/* ---------------- Grant & masterplan ---------------- */

export async function updateGrantStatus(orgId: string, id: string, status: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("grant_applications")
    .update({
      status,
      decision_date: status === "approved" || status === "rejected" ? new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh(orgId);
}

export async function createGrantApplication(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const program_name = String(formData.get("program_name") ?? "").trim();
  if (!program_name) return;

  await supabase.from("grant_applications").insert({
    user_id: user.id,
    organization_id: orgId,
    program_name,
    amount_requested: Number(formData.get("amount_requested") ?? 0) || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function createCorrespondence(orgId: string, grantId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) return;

  await supabase.from("grant_correspondence").insert({
    user_id: user.id,
    grant_application_id: grantId,
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    direction: String(formData.get("direction") ?? "outgoing"),
    subject,
    body: String(formData.get("body") ?? "").trim() || null,
  });
  refresh(orgId);
}

export async function deleteCorrespondence(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("grant_correspondence").delete().eq("id", id);
  refresh(orgId);
}

export async function createMasterplanPhase(orgId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const { data: existing } = await supabase
    .from("masterplan_phases")
    .select("phase_number")
    .eq("organization_id", orgId)
    .order("phase_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("masterplan_phases").insert({
    user_id: user.id,
    organization_id: orgId,
    phase_number: (existing?.phase_number ?? 0) + 1,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    target_date: String(formData.get("target_date") ?? "") || null,
  });
  refresh(orgId);
}

export async function updateMasterplanPhaseStatus(orgId: string, id: string, status: string) {
  const { supabase } = await requireUser();
  await supabase.from("masterplan_phases").update({ status }).eq("id", id);
  refresh(orgId);
}

export async function deleteMasterplanPhase(orgId: string, id: string) {
  const { supabase } = await requireUser();
  await supabase.from("masterplan_phases").delete().eq("id", id);
  refresh(orgId);
}
