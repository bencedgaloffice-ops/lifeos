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

async function preferredCurrency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", userId)
    .maybeSingle();
  return data?.preferred_currency || "USD";
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
    .insert({ user_id: userId, name: "Main account", type: "checking", currency })
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

/** Keeps a daily net-worth snapshot so the trend chart accrues history. */
async function snapshotNetWorth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const [{ data: accounts }, { data: holdings }, { data: profile }] = await Promise.all([
    supabase.from("accounts").select("current_balance, type").eq("user_id", userId),
    supabase.from("investment_holdings").select("current_value, quantity, avg_cost"),
    supabase.from("profiles").select("current_savings").eq("id", userId).maybeSingle(),
  ]);

  const num = (v: number | null | undefined) => Number(v ?? 0);
  let assets = num(profile?.current_savings);
  let liabilities = 0;
  (accounts ?? []).forEach((a) => {
    const bal = num(a.current_balance);
    if (a.type === "credit" || bal < 0) liabilities += Math.abs(Math.min(bal, 0)) + (a.type === "credit" && bal > 0 ? bal : 0);
    else assets += bal;
  });
  (holdings ?? []).forEach((h) => {
    assets += num(h.current_value ?? num(h.quantity) * num(h.avg_cost));
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("net_worth_snapshots")
    .select("id")
    .eq("user_id", userId)
    .eq("snapshot_date", today)
    .maybeSingle();

  const row = {
    user_id: userId,
    snapshot_date: today,
    total_assets: assets,
    total_liabilities: liabilities,
    net_worth: assets - liabilities,
  };
  if (existing) {
    await supabase.from("net_worth_snapshots").update(row).eq("id", existing.id);
  } else {
    await supabase.from("net_worth_snapshots").insert(row);
  }
}

function refresh() {
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

/* ---------------- Transactions ---------------- */

export async function createTransaction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  if (!amount) return;

  const direction = String(formData.get("direction") ?? "out") === "in" ? "in" : "out";
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryName = String(formData.get("category") ?? "").trim();
  const occurredDate = String(formData.get("occurred_at") ?? "");
  const accountIdRaw = String(formData.get("account_id") ?? "").trim();

  const currency = await preferredCurrency(supabase, user.id);
  const account_id = accountIdRaw || (await ensureAccount(supabase, user.id, currency));
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

  // Keep the account balance in sync like a real ledger.
  const { data: account } = await supabase
    .from("accounts")
    .select("current_balance")
    .eq("id", account_id)
    .maybeSingle();
  if (account) {
    const delta = direction === "in" ? amount : -amount;
    await supabase
      .from("accounts")
      .update({ current_balance: Number(account.current_balance) + delta })
      .eq("id", account_id);
  }

  await snapshotNetWorth(supabase, user.id);
  refresh();
}

export async function deleteTransaction(id: string) {
  const { supabase, user } = await requireUser();

  // Reverse the balance effect before removing the row.
  const { data: tx } = await supabase
    .from("transactions")
    .select("amount, direction, account_id")
    .eq("id", id)
    .maybeSingle();
  if (tx) {
    const { data: account } = await supabase
      .from("accounts")
      .select("current_balance")
      .eq("id", tx.account_id)
      .maybeSingle();
    if (account) {
      const delta = tx.direction === "in" ? -Number(tx.amount) : Number(tx.amount);
      await supabase
        .from("accounts")
        .update({ current_balance: Number(account.current_balance) + delta })
        .eq("id", tx.account_id);
    }
  }

  await supabase.from("transactions").delete().eq("id", id);
  await snapshotNetWorth(supabase, user.id);
  refresh();
}

/* ---------------- Accounts ---------------- */

export async function createAccount(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const type = String(formData.get("type") ?? "checking");
  const balance = Number(formData.get("balance") ?? 0) || 0;
  const currency = await preferredCurrency(supabase, user.id);

  await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    currency,
    current_balance: balance,
  });

  await snapshotNetWorth(supabase, user.id);
  refresh();
}

export async function deleteAccount(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("transactions").delete().eq("account_id", id);
  await supabase.from("recurring_transactions").delete().eq("account_id", id);
  await supabase.from("accounts").delete().eq("id", id);
  await snapshotNetWorth(supabase, user.id);
  refresh();
}

/* ---------------- Budgets ---------------- */

export async function createBudget(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const limit = Math.abs(Number(formData.get("monthly_limit") ?? 0));
  if (!name || !limit) return;

  const currency = await preferredCurrency(supabase, user.id);
  const id = await ensureCategory(supabase, user.id, name, currency);
  if (id) {
    await supabase.from("budget_categories").update({ monthly_limit: limit }).eq("id", id);
  }
  refresh();
}

export async function deleteBudget(id: string) {
  const { supabase } = await requireUser();
  // Only clear the limit — keep the category so past transactions stay labelled.
  await supabase.from("budget_categories").update({ monthly_limit: null }).eq("id", id);
  refresh();
}

/* ---------------- Recurring payments ---------------- */

export async function createRecurring(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const amount = Math.abs(Number(formData.get("amount") ?? 0));
  if (!name || !amount) return;

  const type = String(formData.get("type") ?? "out") === "in" ? "in" : "out";
  const frequency = String(formData.get("frequency") ?? "monthly");
  const nextDate =
    String(formData.get("next_date") ?? "") || new Date().toISOString().slice(0, 10);

  const currency = await preferredCurrency(supabase, user.id);
  const account_id = await ensureAccount(supabase, user.id, currency);

  await supabase.from("recurring_transactions").insert({
    user_id: user.id,
    account_id,
    name,
    amount,
    type,
    frequency,
    next_date: nextDate,
    active: true,
  });
  refresh();
}

export async function deleteRecurring(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("recurring_transactions").delete().eq("id", id);
  refresh();
}

/* ---------------- Investments ---------------- */

export async function addInvestment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const symbol = String(formData.get("symbol") ?? "").trim();
  const value = Math.abs(Number(formData.get("value") ?? 0));
  if (!symbol || !value) return;

  const currency = await preferredCurrency(supabase, user.id);

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

  await snapshotNetWorth(supabase, user.id);
  refresh();
}

export async function deleteInvestment(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("investment_holdings").delete().eq("id", id);
  await snapshotNetWorth(supabase, user.id);
  refresh();
}
