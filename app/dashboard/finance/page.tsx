import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { FinanceModule } from "@/components/dashboard/modules/FinanceModule";

export const metadata = { title: "Finance" };

type TxRow = {
  id: string;
  amount: number;
  direction: "in" | "out";
  description: string | null;
  occurred_at: string;
  account_id: string;
  budget_categories: { name: string } | null;
};

export default async function FinancePage() {
  const supabase = await createClient();
  const locale = await getServerLocale();

  const [
    { data: profile },
    { data: txData },
    { data: holdings },
    { data: accounts },
    { data: budgets },
    { data: recurring },
    { data: snapshots },
    { data: assets },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, preferred_currency, current_savings, financial_goal")
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, amount, direction, description, occurred_at, account_id, budget_categories(name)")
      .order("occurred_at", { ascending: false }),
    supabase.from("investment_holdings").select("id, symbol, quantity, avg_cost, current_value"),
    supabase.from("accounts").select("id, name, type, current_balance, currency").order("created_at", { ascending: true }),
    supabase
      .from("budget_categories")
      .select("id, name, monthly_limit")
      .not("monthly_limit", "is", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("recurring_transactions")
      .select("id, name, amount, type, frequency, next_date")
      .eq("active", true)
      .order("next_date", { ascending: true }),
    supabase
      .from("net_worth_snapshots")
      .select("snapshot_date, net_worth")
      .order("snapshot_date", { ascending: true })
      .limit(90),
    supabase.from("assets").select("id, name, category, estimated_value").order("created_at", { ascending: true }),
  ]);

  const currency = profile?.preferred_currency || "USD";
  const transactions = (txData ?? []) as unknown as TxRow[];
  const num = (v: number | null | undefined) => Number(v ?? 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;

  const monthIncome = transactions
    .filter((t) => t.direction === "in" && inMonth(t.occurred_at))
    .reduce((s, t) => s + num(t.amount), 0);
  const monthSpending = transactions
    .filter((t) => t.direction === "out" && inMonth(t.occurred_at))
    .reduce((s, t) => s + num(t.amount), 0);
  const savingsRate =
    monthIncome > 0 ? Math.round(((monthIncome - monthSpending) / monthIncome) * 100) : 0;

  // Spending per category name this month (feeds both the category chart and budget bars)
  const categorySpend = new Map<string, number>();
  transactions
    .filter((t) => t.direction === "out" && inMonth(t.occurred_at))
    .forEach((t) => {
      const key = t.budget_categories?.name || t.description || "Other";
      categorySpend.set(key, (categorySpend.get(key) ?? 0) + num(t.amount));
    });
  const categoryData = [...categorySpend.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // 6-month income/expense series
  const series: { label: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { month: "short" }).format(start);
    const within = (iso: string) => {
      const d = new Date(iso);
      return d >= start && d < end;
    };
    series.push({
      label,
      income: transactions.filter((t) => t.direction === "in" && within(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0),
      expense: transactions.filter((t) => t.direction === "out" && within(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0),
    });
  }

  const portfolioValue = (holdings ?? []).reduce(
    (s, h) => s + num(h.current_value ?? (h.quantity ?? 0) * (h.avg_cost ?? 0)),
    0,
  );
  const accountsTotal = (accounts ?? []).reduce((s, a) => s + num(a.current_balance), 0);
  const assetsTotal = (assets ?? []).reduce((s, a) => s + num(a.estimated_value), 0);
  const netWorth = num(profile?.current_savings) + portfolioValue + accountsTotal + assetsTotal;

  return (
    <FinanceModule
      currency={currency}
      holderName={profile?.display_name ?? null}
      netWorth={netWorth}
      accountsTotal={accountsTotal}
      monthIncome={monthIncome}
      monthSpending={monthSpending}
      savingsRate={savingsRate}
      portfolioValue={portfolioValue}
      financialGoal={profile?.financial_goal ?? null}
      categoryData={categoryData}
      series={series}
      accounts={(accounts ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type ?? "checking",
        balance: num(a.current_balance),
      }))}
      assets={(assets ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category as "property" | "vehicle" | "business" | "other",
        value: num(a.estimated_value),
      }))}
      budgets={(budgets ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        limit: num(b.monthly_limit),
        spent: categorySpend.get(b.name) ?? 0,
      }))}
      recurring={(recurring ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        amount: num(r.amount),
        type: (r.type === "in" ? "in" : "out") as "in" | "out",
        frequency: r.frequency,
        nextDate: r.next_date,
      }))}
      trend={(snapshots ?? []).map((s) => ({ date: s.snapshot_date, value: num(s.net_worth) }))}
      recent={transactions.slice(0, 10).map((t) => ({
        id: t.id,
        amount: num(t.amount),
        direction: t.direction,
        label: t.budget_categories?.name || t.description || "Transaction",
        occurred_at: t.occurred_at,
      }))}
      holdings={(holdings ?? []).map((h) => ({
        id: h.id,
        symbol: h.symbol,
        value: num(h.current_value ?? (h.quantity ?? 0) * (h.avg_cost ?? 0)),
      }))}
    />
  );
}
