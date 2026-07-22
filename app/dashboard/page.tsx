import { createClient } from "@/lib/supabase/server";
import { OverviewModule, type OverviewData } from "@/components/dashboard/modules/OverviewModule";
import { formatDate, relativeDays } from "@/lib/format";
import { getServerLocale, tServer } from "@/lib/i18n/server";

export const metadata = { title: "Overview" };

export default async function DashboardHome() {
  const supabase = await createClient();
  const locale = await getServerLocale();

  const [
    { data: profile },
    { data: goals },
    { data: tx },
    { data: projects },
    { data: events },
    { data: journal },
    { data: holdings },
  ] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("goals").select("id, title, progress_percent, category, status, target_date").order("created_at", { ascending: false }),
    supabase.from("transactions").select("amount, direction, occurred_at"),
    supabase.from("projects").select("id, name, progress_percent, deadline, status").order("created_at", { ascending: false }),
    supabase.from("calendar_events").select("id, title, start_at").gte("start_at", new Date().toISOString()).order("start_at", { ascending: true }).limit(6),
    supabase.from("journal_entries").select("title, body, entry_date").order("entry_date", { ascending: false }),
    supabase.from("investment_holdings").select("current_value, quantity, avg_cost"),
  ]);

  const [{ data: accounts }, { data: assets }, { data: nutritionRecent }] = await Promise.all([
    supabase.from("accounts").select("current_balance"),
    supabase.from("assets").select("estimated_value"),
    supabase.from("nutrition_entries").select("logged_at").gte("logged_at", new Date(Date.now() - 14 * 86_400_000).toISOString()),
  ]);

  const currency = profile?.preferred_currency || "USD";
  const num = (v: number | null | undefined) => Number(v ?? 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const monthIncome = (tx ?? []).filter((t) => t.direction === "in" && inMonth(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0);
  const monthSpending = (tx ?? []).filter((t) => t.direction === "out" && inMonth(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0);
  const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthSpending) / monthIncome) * 100) : 0;

  const portfolioValue = (holdings ?? []).reduce((s, h) => s + num(h.current_value ?? num(h.quantity) * num(h.avg_cost)), 0);
  const accountsTotal = (accounts ?? []).reduce((s, a) => s + num(a.current_balance), 0);
  const assetsTotal = (assets ?? []).reduce((s, a) => s + num(a.estimated_value), 0);
  const netWorth = num(profile?.current_savings) + portfolioValue + accountsTotal + assetsTotal;

  const activeGoals = (goals ?? []).filter((g) => g.status !== "completed");
  const goalsAvg = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length) : null;
  const activeProjects = (projects ?? []).filter((p) => p.status !== "completed");

  // Today summary — a thin pointer into the full Calendar module, which owns
  // the merged view (calendar_events + goals/projects/documents/etc).
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todaysEvents = (events ?? []).filter((e) => new Date(e.start_at) <= todayEnd && new Date(e.start_at) >= new Date(now.toDateString()));
  const nextEvent = (events ?? [])[0] ?? null;
  const todayCalendar: OverviewData["todayCalendar"] = {
    count: todaysEvents.length,
    nextTitle: nextEvent?.title ?? null,
    nextWhen: nextEvent ? relativeDays(nextEvent.start_at, locale) || formatDate(nextEvent.start_at, undefined, locale) : null,
  };

  const growth: OverviewData["growth"] = [];
  if (profile?.health_goal) growth.push({ label: tServer(locale, "profile.healthGoal"), value: profile.health_goal });
  if (profile?.spiritual_goal) growth.push({ label: tServer(locale, "profile.spiritualGoal"), value: profile.spiritual_goal });
  if (profile?.learning_goal) growth.push({ label: tServer(locale, "profile.learningGoal"), value: profile.learning_goal });
  if (profile?.growth_focus) growth.push({ label: tServer(locale, "profile.growthFocus"), value: profile.growth_focus });

  const latest = (journal ?? [])[0];

  const projectsAvg = activeProjects.length
    ? Math.round(activeProjects.reduce((s, p) => s + p.progress_percent, 0) / activeProjects.length)
    : null;
  const consistencyDays = new Set(
    (nutritionRecent ?? []).map((e) => new Date(e.logged_at).toISOString().slice(0, 10)),
  ).size;
  const hasNutritionData = (nutritionRecent ?? []).length > 0 || Boolean(profile?.calorie_target);

  const lifeScore: OverviewData["lifeScore"] = {
    health: hasNutritionData ? Math.round((consistencyDays / 14) * 100) : null,
    money: Math.round(Math.max(0, Math.min(100, 50 + savingsRate))),
    growth: goalsAvg,
    productivity: projectsAvg,
    relationshipsNote: profile?.relationships_note ?? null,
  };

  const data: OverviewData = {
    name: profile?.display_name || "Explorer",
    currency,
    onboarded: Boolean(profile?.onboarded),
    mission: profile?.mission ?? null,
    netWorth,
    savingsRate,
    monthIncome,
    monthSpending,
    goalsAvg,
    activeGoals: activeGoals.length,
    activeProjects: activeProjects.length,
    journalCount: (journal ?? []).length,
    goals: activeGoals.slice(0, 4).map((g) => ({ id: g.id, title: g.title, progress: g.progress_percent, category: g.category })),
    projects: activeProjects.slice(0, 4).map((p) => ({ id: p.id, name: p.name, progress: p.progress_percent, deadline: p.deadline })),
    todayCalendar,
    growth,
    latestJournal: latest ? { title: latest.title, body: latest.body, date: latest.entry_date } : null,
    lifeScore,
  };

  return <OverviewModule data={data} />;
}
