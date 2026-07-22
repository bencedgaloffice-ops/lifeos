"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";

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

/**
 * A grounded, rule-based companion. It reasons over the user's real LifeOS
 * data to answer — no fabricated external knowledge. This is the foundation
 * the deeper AI will build on.
 */
export async function askCompanion(question: string): Promise<string> {
  const { supabase, user } = await requireUser();
  const q = question.toLowerCase();

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
  const name = profile?.display_name?.split(" ")[0] || "there";

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

  if (/(save|saving|money|spend|budget|financ|wealth|rich)/.test(q)) {
    if (savingsRate === null)
      return `You haven't logged any income yet this month, ${name}. Add a couple of transactions in Finance and I'll tell you exactly where your money is going and how much you're keeping.`;
    const verdict = savingsRate >= 20 ? "That's a strong, wealth-building pace." : savingsRate >= 0 ? "You're in the black — there's room to push this higher." : "You're spending more than you earn this month; worth a look.";
    const goalLine = profile?.financial_goal ? ` Your stated goal — “${profile.financial_goal}” — is the north star to optimize toward.` : "";
    return `This month you brought in ${formatCurrency(income, currency)} and spent ${formatCurrency(spending, currency)}, a ${savingsRate}% savings rate. ${verdict}${goalLine}`;
  }

  if (/(goal|progress|achieve|dream)/.test(q)) {
    if (!activeGoals.length) return `You have no active goals yet, ${name}. Add one or two in the Goals module and I'll help you keep momentum.`;
    const top = [...activeGoals].sort((a, b) => b.progress_percent - a.progress_percent)[0];
    return `You're averaging ${avgGoal}% across ${activeGoals.length} active goal${activeGoals.length > 1 ? "s" : ""}. “${top.title}” is your furthest along at ${top.progress_percent}%. Small, consistent steps compound — pick one to move 10% this week.`;
  }

  if (/(project|work|build|deadline)/.test(q)) {
    const active = (projects ?? []).filter((p) => p.status !== "completed");
    if (!active.length) return `No active projects right now, ${name}. When you add one, I'll track its progress and flag deadlines before they sneak up.`;
    return `You have ${active.length} active project${active.length > 1 ? "s" : ""}. Focus tends to beat breadth — protect deep-work time for the one that matters most this month.`;
  }

  if (/(who am i|about me|profile|myself)/.test(q)) {
    return `You're ${profile?.display_name || name}. As you fill in your profile, finances, goals and journal, I get a clearer picture of your whole life — and my guidance gets sharper.`;
  }

  const bits: string[] = [];
  if (avgGoal !== null) bits.push(`your goals sit at ${avgGoal}% on average`);
  if (savingsRate !== null) bits.push(`you're saving ${savingsRate}% of your income this month`);
  if (profile?.current_savings) bits.push(`you've got ${formatCurrency(Number(profile.current_savings), currency)} in savings`);
  const summary = bits.length ? ` Right now, ${bits.join(", ")}.` : "";
  return `I'm here to help you think clearly about your life, ${name}.${summary} Ask me about your money, your goals, or your projects — I reason over everything you've put into LifeOS.`;
}
