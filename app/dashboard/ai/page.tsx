import { createClient } from "@/lib/supabase/server";
import { AICompanion } from "@/components/dashboard/modules/AICompanion";
import { formatCurrency } from "@/lib/format";
import { getServerLocale, tServer } from "@/lib/i18n/server";
import type { AiMemory } from "@/lib/types";

export const metadata = { title: "AI Companion" };

export default async function AIPage() {
  const supabase = await createClient();
  const locale = await getServerLocale();
  const tr = (k: string) => tServer(locale, k);

  const [{ data: profile }, { data: goals }, { data: tx }, { data: projects }, { data: memories }, { data: journal }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, preferred_currency, current_savings").maybeSingle(),
      supabase.from("goals").select("progress_percent, status"),
      supabase.from("transactions").select("amount, direction, occurred_at"),
      supabase.from("projects").select("status"),
      supabase.from("ai_memory").select("*").order("created_at", { ascending: false }),
      supabase.from("journal_entries").select("id"),
    ]);

  const currency = profile?.preferred_currency || "USD";
  const name = profile?.display_name?.split(" ")[0] || (locale === "hu" ? "barátom" : "there");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const income = (tx ?? []).filter((t) => t.direction === "in" && inMonth(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0);
  const spending = (tx ?? []).filter((t) => t.direction === "out" && inMonth(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = income > 0 ? Math.round(((income - spending) / income) * 100) : null;

  const activeGoals = (goals ?? []).filter((g) => g.status !== "completed");
  const avgGoal = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length) : null;
  const activeProjects = (projects ?? []).filter((p) => p.status !== "completed").length;

  const insights: { label: string; value: string }[] = [];
  if (avgGoal !== null) insights.push({ label: tr("ai.insightGoalMomentum"), value: `${avgGoal}% ${tr("ai.insightAvgSuffix")}` });
  if (savingsRate !== null) insights.push({ label: tr("ai.insightSavingsRate"), value: `${savingsRate}% ${tr("ai.insightThisMonth")}` });
  if (profile?.current_savings) insights.push({ label: tr("ai.insightSavings"), value: formatCurrency(Number(profile.current_savings), currency, { locale }) });
  if (activeProjects) insights.push({ label: tr("ai.insightActiveProjects"), value: String(activeProjects) });
  if ((journal ?? []).length) insights.push({ label: tr("ai.insightJournalEntries"), value: String((journal ?? []).length) });

  const greeting = tr("ai.greeting").replace("{{name}}", name);

  return (
    <AICompanion
      insights={insights}
      memories={(memories as AiMemory[]) ?? []}
      greeting={greeting}
    />
  );
}
