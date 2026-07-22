"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import type { Locale } from "@/lib/i18n/translations";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function saveMemory(formData: FormData) {
  const { supabase, user } = await requireUser();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await supabase.from("ai_memory").insert({
    user_id: user.id,
    memory_type: "note",
    content,
    importance: 3,
  });
  revalidatePath("/dashboard/ai");
}

export async function deleteMemory(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("ai_memory").delete().eq("id", id);
  revalidatePath("/dashboard/ai");
}

/** Response templates for the rule-based companion, per language. */
const R = {
  en: {
    fallbackName: "there",
    moneyNone: (n: string) =>
      `You haven't logged any income yet this month, ${n}. Add a couple of transactions in Finance and I'll tell you exactly where your money is going and how much you're keeping.`,
    moneyStrong: "That's a strong, wealth-building pace.",
    moneyOk: "You're in the black — there's room to push this higher.",
    moneyOver: "You're spending more than you earn this month; worth a look.",
    moneyGoal: (g: string) => ` Your stated goal — “${g}” — is the north star to optimize toward.`,
    moneySummary: (inc: string, out: string, rate: number, verdict: string, goal: string) =>
      `This month you brought in ${inc} and spent ${out}, a ${rate}% savings rate. ${verdict}${goal}`,
    goalsNone: (n: string) =>
      `You have no active goals yet, ${n}. Add one or two in the Goals module and I'll help you keep momentum.`,
    goalsSummary: (avg: number, count: number, top: string, topPct: number) =>
      `You're averaging ${avg}% across ${count} active goal${count > 1 ? "s" : ""}. “${top}” is your furthest along at ${topPct}%. Small, consistent steps compound — pick one to move 10% this week.`,
    projectsNone: (n: string) =>
      `No active projects right now, ${n}. When you add one, I'll track its progress and flag deadlines before they sneak up.`,
    projectsSummary: (count: number) =>
      `You have ${count} active project${count > 1 ? "s" : ""}. Focus tends to beat breadth — protect deep-work time for the one that matters most this month.`,
    whoami: (name: string) =>
      `You're ${name}. As you fill in your profile, finances, goals and journal, I get a clearer picture of your whole life — and my guidance gets sharper.`,
    bitGoals: (avg: number) => `your goals sit at ${avg}% on average`,
    bitSavings: (rate: number) => `you're saving ${rate}% of your income this month`,
    bitCash: (amt: string) => `you've got ${amt} in savings`,
    fallback: (n: string, summary: string) =>
      `I'm here to help you think clearly about your life, ${n}.${summary} Ask me about your money, your goals, or your projects — I reason over everything you've put into LifeOS.`,
    rightNow: (bits: string) => ` Right now, ${bits}.`,
  },
  hu: {
    fallbackName: "barátom",
    moneyNone: (n: string) =>
      `Ebben a hónapban még nem rögzítettél bevételt, ${n}. Adj hozzá néhány tranzakciót a Pénzügyekben, és pontosan megmutatom, hová megy a pénzed és mennyit tartasz meg.`,
    moneyStrong: "Ez erős, vagyonépítő tempó.",
    moneyOk: "Pluszban vagy — de van tér feljebb tolni.",
    moneyOver: "Ebben a hónapban többet költesz, mint amennyit keresel; érdemes ránézni.",
    moneyGoal: (g: string) => ` A kitűzött célod — „${g}” — az iránytű, ami felé optimalizálni érdemes.`,
    moneySummary: (inc: string, out: string, rate: number, verdict: string, goal: string) =>
      `Ebben a hónapban ${inc} bevételed és ${out} kiadásod volt, ez ${rate}%-os megtakarítási ráta. ${verdict}${goal}`,
    goalsNone: (n: string) =>
      `Még nincs aktív célod, ${n}. Adj hozzá egyet-kettőt a Célok modulban, és segítek lendületben maradni.`,
    goalsSummary: (avg: number, count: number, top: string, topPct: number) =>
      `Átlagosan ${avg}%-on állsz ${count} aktív célban. A „${top}” halad a legjobban, ${topPct}%-on. A kis, következetes lépések összeadódnak — válassz egyet, amit 10%-kal előre viszel ezen a héten.`,
    projectsNone: (n: string) =>
      `Jelenleg nincs aktív projekted, ${n}. Ha hozzáadsz egyet, követem a haladását és időben szólok a határidőkről.`,
    projectsSummary: (count: number) =>
      `${count} aktív projekted van. A fókusz többet ér, mint a szélesség — védd meg a mélymunka-idődet a hónap legfontosabb projektjére.`,
    whoami: (name: string) =>
      `Te ${name} vagy. Ahogy kitöltöd a profilod, pénzügyeidet, céljaidat és naplódat, egyre tisztábban látom az egész életedet — és egyre pontosabb tanácsot tudok adni.`,
    bitGoals: (avg: number) => `a céljaid átlagosan ${avg}%-on állnak`,
    bitSavings: (rate: number) => `a bevételed ${rate}%-át takarítod meg ebben a hónapban`,
    bitCash: (amt: string) => `${amt} megtakarításod van`,
    fallback: (n: string, summary: string) =>
      `Azért vagyok itt, hogy segítsek tisztán látni az életedet, ${n}.${summary} Kérdezz a pénzedről, a céljaidról vagy a projektjeidről — mindent átlátok, amit a LifeOS-ba tettél.`,
    rightNow: (bits: string) => ` Jelenleg ${bits}.`,
  },
} as const;

/**
 * A grounded, rule-based companion. It reasons over the user's real LifeOS
 * data to answer — no fabricated external knowledge. This is the foundation
 * the deeper AI will build on. Answers in the user's chosen language.
 */
export async function askCompanion(question: string, locale: Locale = "en"): Promise<string> {
  const { supabase, user } = await requireUser();
  const q = question.toLowerCase();
  const L = R[locale] ?? R.en;

  const [{ data: profile }, { data: goals }, { data: tx }, { data: projects }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, preferred_currency, current_savings, financial_goal")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("goals").select("title, progress_percent, target_date, status"),
      supabase.from("transactions").select("amount, direction, occurred_at"),
      supabase.from("projects").select("name, progress_percent, deadline, status"),
    ]);

  const currency = profile?.preferred_currency || "USD";
  const name = profile?.display_name?.split(" ")[0] || L.fallbackName;
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const inMonth = (iso: string) => new Date(iso) >= monthStart;
  const income = (tx ?? []).filter((t) => t.direction === "in" && inMonth(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0);
  const spending = (tx ?? []).filter((t) => t.direction === "out" && inMonth(t.occurred_at)).reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = income > 0 ? Math.round(((income - spending) / income) * 100) : null;

  const activeGoals = (goals ?? []).filter((g) => g.status !== "completed");
  const avgGoal = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress_percent, 0) / activeGoals.length)
    : null;

  // Match both English and Hungarian phrasings.
  if (/(save|saving|money|spend|budget|financ|wealth|rich|pénz|megtakarít|költ|anyagi|vagyon)/.test(q)) {
    if (savingsRate === null) return L.moneyNone(name);
    const verdict = savingsRate >= 20 ? L.moneyStrong : savingsRate >= 0 ? L.moneyOk : L.moneyOver;
    const goalLine = profile?.financial_goal ? L.moneyGoal(profile.financial_goal) : "";
    return L.moneySummary(fc(income), fc(spending), savingsRate, verdict, goalLine);
  }

  if (/(goal|progress|achieve|dream|cél|halad|álom|elér)/.test(q)) {
    if (!activeGoals.length) return L.goalsNone(name);
    const top = [...activeGoals].sort((a, b) => b.progress_percent - a.progress_percent)[0];
    return L.goalsSummary(avgGoal ?? 0, activeGoals.length, top.title, top.progress_percent);
  }

  if (/(project|work|build|deadline|projekt|munka|határidő|épít)/.test(q)) {
    const active = (projects ?? []).filter((p) => p.status !== "completed");
    if (!active.length) return L.projectsNone(name);
    return L.projectsSummary(active.length);
  }

  if (/(who am i|about me|profile|myself|ki vagyok|magamról|profilom)/.test(q)) {
    return L.whoami(profile?.display_name || name);
  }

  const bits: string[] = [];
  if (avgGoal !== null) bits.push(L.bitGoals(avgGoal));
  if (savingsRate !== null) bits.push(L.bitSavings(savingsRate));
  if (profile?.current_savings) bits.push(L.bitCash(fc(Number(profile.current_savings))));
  const summary = bits.length ? L.rightNow(bits.join(", ")) : "";
  return L.fallback(name, summary);
}
