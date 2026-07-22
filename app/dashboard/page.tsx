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

  const currency = profile?.preferred_currency || "USD";
  const num = (v: number | null | undefined) => Number(v ?? 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const monthIncome = (tx ?? []).filter((t) => t.direction === "in" && inMonth(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0);
  const monthSpending = (tx ?? []).filter((t) => t.direction === "out" && inMonth(t.occurred_at)).reduce((s, t) => s + num(t.amount), 0);
  const savingsRate = monthIncome > 0 ? Math.round(((monthIncome - monthSpending) / monthIncome) * 100) : 0;

  const portfolioValue = (holdings ?? []).reduce((s, h) => s + num(h.current_value ?? num(h.quantity) * num(h.avg_cost)), 0);
  const netWorth = num(profile?.current_savings) + portfolioValue;

  const activeGoals = (goals ?? []).filter((g) => g.status !== "completed");
  const goalsAvg = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length) : null;
  const activeProjects = (projects ?? []).filter((p) => p.status !== "completed");

  // Reminders: upcoming events + upcoming goal/project deadlines
  const reminders: OverviewData["reminders"] = [];
  (events ?? []).forEach((e) =>
    reminders.push({ id: e.id, title: e.title, when: relativeDays(e.start_at, locale) || formatDate(e.start_at, undefined, locale), kind: "event", deletable: true }),
  );
  const soon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - now.getTime()) / 86_400_000;
    return days >= -1 && days <= 30;
  };
  activeGoals.filter((g) => soon(g.target_date)).slice(0, 3).forEach((g) =>
    reminders.push({ id: `goal-${g.id}`, title: `${tServer(locale, "nav.goals.label")}: ${g.title}`, when: relativeDays(g.target_date, locale), kind: "reminder", deletable: false }),
  );
  activeProjects.filter((p) => soon(p.deadline)).slice(0, 3).forEach((p) =>
    reminders.push({ id: `proj-${p.id}`, title: `${tServer(locale, "nav.projects.label")}: ${p.name}`, when: relativeDays(p.deadline, locale), kind: "reminder", deletable: false }),
  );

  const growth: OverviewData["growth"] = [];
  if (profile?.health_goal) growth.push({ label: tServer(locale, "profile.healthGoal"), value: profile.health_goal });
  if (profile?.spiritual_goal) growth.push({ label: tServer(locale, "profile.spiritualGoal"), value: profile.spiritual_goal });
  if (profile?.learning_goal) growth.push({ label: tServer(locale, "profile.learningGoal"), value: profile.learning_goal });
  if (profile?.growth_focus) growth.push({ label: tServer(locale, "profile.growthFocus"), value: profile.growth_focus });

  const latest = (journal ?? [])[0];

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
    reminders: reminders.slice(0, 6),
    growth,
    latestJournal: latest ? { title: latest.title, body: latest.body, date: latest.entry_date } : null,
  };

  return <OverviewModule data={data} />;
}
