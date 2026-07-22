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

async function ensureAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currency: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: "Main account", type: "cash", currency })
    .select("id")
    .single();
  return created!.id;
}

async function ensureCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  name: string,
  currency: string,
): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  const { data: existing } = await supabase
    .from("budget_categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", clean)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("budget_categories")
    .insert({ user_id: userId, name: clean, currency })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function createTransaction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  if (!amount) return;

  const direction = String(formData.get("direction") ?? "out") === "in" ? "in" : "out";
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryName = String(formData.get("category") ?? "").trim();
  const occurredDate = String(formData.get("occurred_at") ?? "");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .maybeSingle();
  const currency = profile?.preferred_currency || "USD";

  const account_id = await ensureAccount(supabase, user.id, currency);
  const category_id =
    direction === "out" && categoryName
      ? await ensureCategory(supabase, user.id, categoryName, currency)
      : null;

  await supabase.from("transactions").insert({
    user_id: user.id,
    account_id,
    category_id,
    amount,
    currency,
    direction,
    description: description ?? (categoryName || null),
    occurred_at: occurredDate ? new Date(occurredDate).toISOString() : new Date().toISOString(),
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function deleteTransaction(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("transactions").delete().eq("id", id);
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function addInvestment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const symbol = String(formData.get("symbol") ?? "").trim();
  const value = Math.abs(Number(formData.get("value") ?? 0));
  if (!symbol || !value) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .maybeSingle();
  const currency = profile?.preferred_currency || "USD";

  let { data: account } = await supabase
    .from("investment_accounts")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!account) {
    const { data: created } = await supabase
      .from("investment_accounts")
      .insert({ user_id: user.id, name: "Portfolio", type: "brokerage", currency })
      .select("id")
      .single();
    account = created;
  }

  await supabase.from("investment_holdings").insert({
    investment_account_id: account!.id,
    symbol,
    quantity: 1,
    avg_cost: value,
    current_value: value,
  });

  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function deleteInvestment(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("investment_holdings").delete().eq("id", id);
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}
