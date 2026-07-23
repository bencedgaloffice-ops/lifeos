"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GarageDealStage } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard/business/garage");
}

function parseLinks(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function numOrNull(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function num(raw: FormDataEntryValue | null, fallback = 0): number {
  return numOrNull(raw) ?? fallback;
}

function intOrNull(raw: FormDataEntryValue | null): number | null {
  const n = numOrNull(raw);
  return n === null ? null : Math.round(n);
}

// ---------------------------------------------------------------------------
// My Vehicles
// ---------------------------------------------------------------------------

export async function createVehicle(formData: FormData) {
  const { supabase, user } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase.from("garage_vehicles").insert({
    user_id: user.id,
    brand,
    model,
    year: intOrNull(formData.get("year")),
    mileage: numOrNull(formData.get("mileage")),
    value: numOrNull(formData.get("value")),
    purchase_price: numOrNull(formData.get("purchase_price")),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    links: parseLinks(formData.get("links")),
  });
  refresh();
}

export async function updateVehicle(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase
    .from("garage_vehicles")
    .update({
      brand,
      model,
      year: intOrNull(formData.get("year")),
      mileage: numOrNull(formData.get("mileage")),
      value: numOrNull(formData.get("value")),
      purchase_price: numOrNull(formData.get("purchase_price")),
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      links: parseLinks(formData.get("links")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh();
}

export async function deleteVehicle(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("garage_vehicles").delete().eq("id", id);
  refresh();
}

export async function createServiceRecord(vehicleId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;

  await supabase.from("garage_service_records").insert({
    user_id: user.id,
    vehicle_id: vehicleId,
    service_date: String(formData.get("service_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
    description,
    cost: numOrNull(formData.get("cost")),
    mileage_at_service: numOrNull(formData.get("mileage_at_service")),
  });
  refresh();
}

export async function deleteServiceRecord(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("garage_service_records").delete().eq("id", id);
  refresh();
}

/** Documents attach through the same Documents Vault table everything else
 * uses — scoped to a vehicle via garage_vehicle_id — so a service invoice
 * or registration paper filed here also shows up in Protection's vault. */
export async function attachVehicleDocument(vehicleId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await supabase.from("documents").insert({
    user_id: user.id,
    garage_vehicle_id: vehicleId,
    title,
    file_path: String(formData.get("link") ?? "").trim(),
    category: "vehicle",
    tags: ["garage"],
  });
  refresh();
}

export async function deleteVehicleDocument(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("documents").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Dream Garage
// ---------------------------------------------------------------------------

export async function createDreamVehicle(formData: FormData) {
  const { supabase, user } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase.from("garage_dream_vehicles").insert({
    user_id: user.id,
    brand,
    model,
    year: intOrNull(formData.get("year")),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    estimated_price: numOrNull(formData.get("estimated_price")),
    priority_rating: Math.min(5, Math.max(1, Math.round(num(formData.get("priority_rating"), 3)))),
    purchase_goal: String(formData.get("purchase_goal") ?? "").trim() || null,
    target_date: String(formData.get("target_date") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  refresh();
}

export async function updateDreamVehicle(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase
    .from("garage_dream_vehicles")
    .update({
      brand,
      model,
      year: intOrNull(formData.get("year")),
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      estimated_price: numOrNull(formData.get("estimated_price")),
      priority_rating: Math.min(5, Math.max(1, Math.round(num(formData.get("priority_rating"), 3)))),
      purchase_goal: String(formData.get("purchase_goal") ?? "").trim() || null,
      target_date: String(formData.get("target_date") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", id);
  refresh();
}

export async function deleteDreamVehicle(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("garage_dream_vehicles").delete().eq("id", id);
  refresh();
}

// ---------------------------------------------------------------------------
// Import Business Dashboard — trading pipeline
// ---------------------------------------------------------------------------

export async function createImportDeal(formData: FormData) {
  const { supabase, user } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase.from("garage_import_deals").insert({
    user_id: user.id,
    brand,
    model,
    year: intOrNull(formData.get("year")),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    stage: "found",
    purchase_price: num(formData.get("purchase_price")),
    transport_cost: num(formData.get("transport_cost")),
    registration_cost: num(formData.get("registration_cost")),
    repair_cost: num(formData.get("repair_cost")),
    expected_selling_price: num(formData.get("expected_selling_price")),
    notes: String(formData.get("notes") ?? "").trim() || null,
    links: parseLinks(formData.get("links")),
  });
  refresh();
}

export async function updateImportDeal(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!brand || !model) return;

  await supabase
    .from("garage_import_deals")
    .update({
      brand,
      model,
      year: intOrNull(formData.get("year")),
      image_url: String(formData.get("image_url") ?? "").trim() || null,
      purchase_price: num(formData.get("purchase_price")),
      transport_cost: num(formData.get("transport_cost")),
      registration_cost: num(formData.get("registration_cost")),
      repair_cost: num(formData.get("repair_cost")),
      expected_selling_price: num(formData.get("expected_selling_price")),
      notes: String(formData.get("notes") ?? "").trim() || null,
      links: parseLinks(formData.get("links")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh();
}

const STAGE_ORDER: GarageDealStage[] = ["found", "inspection", "purchase", "transport", "registration", "ready_for_sale", "sold"];

export async function moveDealStage(id: string, direction: "forward" | "back") {
  const { supabase } = await requireUser();
  const { data: deal } = await supabase.from("garage_import_deals").select("stage").eq("id", id).maybeSingle();
  if (!deal) return;
  const idx = STAGE_ORDER.indexOf(deal.stage as GarageDealStage);
  const nextIdx = direction === "forward" ? Math.min(idx + 1, STAGE_ORDER.length - 1) : Math.max(idx - 1, 0);
  const nextStage = STAGE_ORDER[nextIdx];
  if (nextStage === deal.stage) return;

  await supabase
    .from("garage_import_deals")
    .update({ stage: nextStage, updated_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}

export async function markDealSold(id: string, formData: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from("garage_import_deals")
    .update({
      stage: "sold",
      actual_selling_price: numOrNull(formData.get("actual_selling_price")),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  refresh();
}

export async function deleteImportDeal(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("garage_import_deals").delete().eq("id", id);
  refresh();
}
