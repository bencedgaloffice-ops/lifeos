import { createClient } from "@/lib/supabase/server";
import { OverviewModule, type OverviewData } from "@/components/dashboard/modules/OverviewModule";
import { formatDate, relativeDays } from "@/lib/format";
import { getServerLocale } from "@/lib/i18n/server";
import {
  ACHIEVEMENTS,
  buildMissions,
  computeLifeProgress,
  evaluateAchievements,
  type LifeSnapshot,
} from "@/lib/gamification";

export const metadata = { title: "Mission Control" };

export default async function DashboardHome() {
  const supabase = await createClient();
  const locale = await getServerLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Extra signals for net worth, area tiles, and the achievement catalog.
  const [
    { data: accounts },
    { data: assets },
    { data: nutritionRecent },
    { count: shiftsCount },
    { count: apiaryCount },
    { count: honeyCount },
    { count: dreamsCount },
    { count: milestonesCount },
    { count: kitchenCount },
    { count: shoppingCount },
    { count: mapLocationsCount },
    { data: achievementRows },
  ] = await Promise.all([
    supabase.from("accounts").select("current_balance").is("organization_id", null),
    supabase.from("assets").select("estimated_value, category"),
    supabase.from("nutrition_entries").select("logged_at").gte("logged_at", new Date(Date.now() - 14 * 86_400_000).toISOString()),
    supabase.from("shifts").select("id", { count: "exact", head: true }),
    supabase.from("apiaries").select("id", { count: "exact", head: true }),
    supabase.from("honey_harvest_log").select("id", { count: "exact", head: true }),
    supabase.from("vision_cards").select("id", { count: "exact", head: true }),
    supabase.from("milestones").select("id", { count: "exact", head: true }),
    supabase.from("kitchen_items").select("id", { count: "exact", head: true }),
    supabase.from("shopping_list_items").select("id", { count: "exact", head: true }).eq("checked", false),
    supabase.from("life_map_locations").select("id", { count: "exact", head: true }),
    supabase.from("achievements").select("key, unlocked_at"),
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

  const allGoals = goals ?? [];
  const activeGoals = allGoals.filter((g) => g.status !== "completed");
  const completedGoals = allGoals.filter((g) => g.status === "completed");
  const goalsAvg = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length) : null;

  const allProjects = projects ?? [];
  const activeProjects = allProjects.filter((p) => p.status !== "completed");
  const completedProjects = allProjects.filter((p) => p.status === "completed");
  const projectsAvg = activeProjects.length ? Math.round(activeProjects.reduce((s, p) => s + p.progress_percent, 0) / activeProjects.length) : null;

  const consistencyDays = new Set((nutritionRecent ?? []).map((e) => new Date(e.logged_at).toISOString().slice(0, 10))).size;
  const hasNutritionData = (nutritionRecent ?? []).length > 0 || Boolean(profile?.calorie_target);

  // ---- Gamification: build the snapshot, evaluate achievements, level up ----
  const baseSnapshot: LifeSnapshot = {
    goalsTotal: allGoals.length,
    goalsCompleted: completedGoals.length,
    goalsAvgProgress: goalsAvg ?? 0,
    projectsTotal: allProjects.length,
    projectsCompleted: completedProjects.length,
    projectsAvgProgress: projectsAvg ?? 0,
    journalCount: (journal ?? []).length,
    savingsRate,
    netWorth,
    consistencyDays,
    assetsPropertyCount: (assets ?? []).filter((a) => a.category === "property").length,
    shiftsCount: shiftsCount ?? 0,
    apiaryCount: apiaryCount ?? 0,
    honeyHarvestCount: honeyCount ?? 0,
    dreamsCount: dreamsCount ?? 0,
    milestonesCount: milestonesCount ?? 0,
    mapLocationsCount: mapLocationsCount ?? 0,
    achievementsUnlocked: 0,
  };
  const unlockedKeys = evaluateAchievements(baseSnapshot);
  const snapshot: LifeSnapshot = { ...baseSnapshot, achievementsUnlocked: unlockedKeys.length };
  const progress = computeLifeProgress(snapshot);

  // Persist any newly-earned achievements so their unlock date sticks.
  const existing = new Map((achievementRows ?? []).map((r) => [r.key, r.unlocked_at]));
  const newlyUnlocked = unlockedKeys.filter((k) => !existing.has(k));
  if (user && newlyUnlocked.length) {
    await supabase
      .from("achievements")
      .upsert(newlyUnlocked.map((key) => ({ user_id: user.id, key })), { onConflict: "user_id,key", ignoreDuplicates: true });
    for (const k of newlyUnlocked) existing.set(k, new Date().toISOString());
  }

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    test: undefined as unknown as never, // don't ship the predicate to the client
    unlocked: unlockedKeys.includes(a.key),
    unlockedAt: existing.get(a.key) ?? null,
  }));

  const missions = buildMissions(
    activeGoals.map((g) => ({ id: g.id, title: g.title, progress: g.progress_percent, category: g.category, status: g.status })),
    activeProjects.map((p) => ({ id: p.id, name: p.name, progress: p.progress_percent, deadline: p.deadline, status: p.status })),
  );

  // Today summary — a thin pointer into the full Calendar module.
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const todaysEvents = (events ?? []).filter((e) => new Date(e.start_at) <= todayEnd && new Date(e.start_at) >= new Date(now.toDateString()));
  const nextEvent = (events ?? [])[0] ?? null;

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
    todayCalendar: {
      count: todaysEvents.length,
      nextTitle: nextEvent?.title ?? null,
      nextWhen: nextEvent ? relativeDays(nextEvent.start_at, locale) || formatDate(nextEvent.start_at, undefined, locale) : null,
    },
    latestJournal: (() => {
      const latest = (journal ?? [])[0];
      return latest ? { title: latest.title, body: latest.body, date: latest.entry_date } : null;
    })(),
    lifeScore: {
      health: hasNutritionData ? Math.round((consistencyDays / 14) * 100) : null,
      money: Math.round(Math.max(0, Math.min(100, 50 + savingsRate))),
      growth: goalsAvg,
      productivity: projectsAvg,
      relationshipsNote: profile?.relationships_note ?? null,
    },
    progress,
    missions,
    achievements,
    tiles: {
      shifts: shiftsCount ?? 0,
      kitchenItems: kitchenCount ?? 0,
      shoppingItems: shoppingCount ?? 0,
      consistencyDays,
      calorieTarget: profile?.calorie_target ?? null,
      dreams: dreamsCount ?? 0,
      milestones: milestonesCount ?? 0,
    },
  };

  return <OverviewModule data={data} />;
}
