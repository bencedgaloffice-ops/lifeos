import { createClient } from "@/lib/supabase/server";
import { FinanceModule } from "@/components/dashboard/modules/FinanceModule";

export const metadata = { title: "Finance" };

type TxRow = {
  id: string;
  amount: number;
  direction: "in" | "out";
  description: string | null;
  occurred_at: string;
  budget_categories: { name: string } | null;
};

export default async function FinancePage() {
  const supabase = await createClient();

  const [{ data: profile }, { data: txData }, { data: holdings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferred_currency, current_savings, monthly_income, monthly_expenses, financial_goal")
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id, amount, direction, description, occurred_at, budget_categories(name)")
      .order("occurred_at", { ascending: false }),
    supabase.from("investment_holdings").select("id, symbol, quantity, avg_cost, current_value"),
  ]);

  const currency = profile?.preferred_currency || "USD";
  const transactions = (txData ?? []) as unknown as TxRow[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const num = (v: number | null | undefined) => Number(v ?? 0);

  const monthIncome = transactions
    .filter((t) => t.direction === "in" && inMonth(t.occurred_at))
    .reduce((s, t) => s + num(t.amount), 0);
  const monthSpending = transactions
    .filter((t) => t.direction === "out" && inMonth(t.occurred_at))
    .reduce((s, t) => s + num(t.amount), 0);

  const savingsRate =
    monthIncome > 0 ? Math.round(((monthIncome - monthSpending) / monthIncome) * 100) : 0;

  // Spending by category (this month)
  const categoryMap = new Map<string, number>();
  transactions
    .filter((t) => t.direction === "out" && inMonth(t.occurred_at))
    .forEach((t) => {
      const key = t.budget_categories?.name || t.description || "Other";
      categoryMap.set(key, (categoryMap.get(key) ?? 0) + num(t.amount));
    });
  const categoryData = [...categoryMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // 6-month income vs expense series
  const series: { label: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = new Intl.DateTimeFormat("en-US", { month: "short" }).format(start);
    const within = (iso: string) => {
      const d = new Date(iso);
      return d >= start && d < end;
    };
    series.push({
      label,
      income: transactions
        .filter((t) => t.direction === "in" && within(t.occurred_at))
        .reduce((s, t) => s + num(t.amount), 0),
      expense: transactions
        .filter((t) => t.direction === "out" && within(t.occurred_at))
        .reduce((s, t) => s + num(t.amount), 0),
    });
  }

  const portfolioValue = (holdings ?? []).reduce(
    (s, h) => s + num(h.current_value ?? (h.quantity ?? 0) * (h.avg_cost ?? 0)),
    0,
  );
  const netWorth = num(profile?.current_savings) + portfolioValue;

  return (
    <FinanceModule
      currency={currency}
      netWorth={netWorth}
      monthIncome={monthIncome}
      monthSpending={monthSpending}
      savingsRate={savingsRate}
      portfolioValue={portfolioValue}
      financialGoal={profile?.financial_goal ?? null}
      categoryData={categoryData}
      series={series}
      recent={transactions.slice(0, 12).map((t) => ({
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
