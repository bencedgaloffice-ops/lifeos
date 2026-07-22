"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import type { Locale } from "@/lib/i18n/translations";
import { expandOccurrences } from "@/lib/calendar/recurrence";

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
    protectionNone: (n: string) =>
      `No documents or responsibilities tracked yet, ${n}. Add them in Protection and I'll flag anything expiring or overdue.`,
    protectionSummary: (expiring: number, overdue: number) =>
      `You have ${expiring} document${expiring === 1 ? "" : "s"} expiring soon and ${overdue} overdue responsibilit${overdue === 1 ? "y" : "ies"}. Worth a look in Protection.`,
    protectionClear: "Nothing expiring soon and no overdue responsibilities — you're covered.",
    legacyNone: (n: string) =>
      `Your vision board is empty, ${n}. Add a dream or milestone in Legacy — it's where the story you're building lives.`,
    legacySummary: (dreams: number, milestones: number) =>
      `You're holding onto ${dreams} dream${dreams === 1 ? "" : "s"} and ${milestones} milestone${milestones === 1 ? "" : "s"} in your Legacy. That's the shape of the life you're building.`,
    kitchenEmpty: (n: string) =>
      `Your kitchen is empty right now, ${n}. Add a few items in Kitchen and I can suggest meals from what you have.`,
    kitchenSummary: (count: number, topSuggestion: string | null) =>
      topSuggestion
        ? `You have ${count} item${count === 1 ? "" : "s"} in your kitchen. Based on what's there, you could make ${topSuggestion} — check Kitchen for the full recipe.`
        : `You have ${count} item${count === 1 ? "" : "s"} in your kitchen, but not quite enough for a suggested meal yet — add a few more staples.`,
    freeTimeNone: "Today is completely open — no events on your calendar.",
    freeTimeSummary: (slots: string) => `Today's open blocks: ${slots}. Good windows for deep work or rest.`,
    busiestDaySummary: (day: string, count: number) =>
      `${day} is your busiest day this week, with ${count} scheduled item${count === 1 ? "" : "s"}. Everything else this week is lighter — worth protecting ${day} from anything non-essential.`,
    busiestDayNone: "This week looks evenly paced — nothing stands out as overloaded.",
    suggestSlot: (activity: string, when: string) =>
      `${when} looks open for ${activity} — want me to note it as a reminder in Calendar?`,
    suggestSlotNone: (activity: string) =>
      `I couldn't find a clear gap today or tomorrow for ${activity} — your schedule is tight. Check the Week view in Calendar to find the best fit.`,
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
    protectionNone: (n: string) =>
      `Még nincs nyilvántartott dokumentumod vagy kötelezettséged, ${n}. Add hozzá őket a Védelemben, és szólok, ha valami lejár vagy késik.`,
    protectionSummary: (expiring: number, overdue: number) =>
      `${expiring} dokumentumod jár le hamarosan, és ${overdue} kötelezettséged késik. Érdemes megnézni a Védelem oldalt.`,
    protectionClear: "Semmi nem jár le hamarosan, és nincs késő kötelezettséged — minden rendben.",
    legacyNone: (n: string) =>
      `A vízió-táblád üres, ${n}. Adj hozzá egy álmot vagy mérföldkövet az Örökségben — ott él a történet, amit építesz.`,
    legacySummary: (dreams: number, milestones: number) =>
      `${dreams} álmot és ${milestones} mérföldkövet őrzöl az Örökségedben. Ez annak az életnek a formája, amit építesz.`,
    kitchenEmpty: (n: string) =>
      `A konyhád most üres, ${n}. Adj hozzá néhány tételt a Konyhában, és tudok ételt javasolni abból, ami megvan.`,
    kitchenSummary: (count: number, topSuggestion: string | null) =>
      topSuggestion
        ? `${count} tételed van a konyhában. Ami megvan, abból elkészíthetnéd ezt: ${topSuggestion} — a teljes receptért nézd meg a Konyhát.`
        : `${count} tételed van a konyhában, de még nem elég egy ételjavaslathoz — adj hozzá pár alapanyagot.`,
    freeTimeNone: "Ma teljesen szabad a naptárad — nincs benne esemény.",
    freeTimeSummary: (slots: string) => `Mai szabad időszakok: ${slots}. Jó alkalom mélymunkára vagy pihenésre.`,
    busiestDaySummary: (day: string, count: number) =>
      `${day} a legzsúfoltabb napod ezen a héten, ${count} beütemezett elemmel. A hét többi része nyugodtabb — érdemes megvédeni ${day} napot mindentől, ami nem elengedhetetlen.`,
    busiestDayNone: "Ez a hét egyenletesnek tűnik — semmi nem tűnik túlterheltnek.",
    suggestSlot: (activity: string, when: string) =>
      `${when} szabadnak tűnik erre: ${activity} — jelöljem emlékeztetőként a Naptárban?`,
    suggestSlotNone: (activity: string) =>
      `Nem találtam szabad rést ma vagy holnap erre: ${activity} — tele van a naptárad. Nézd meg a Naptár Hét nézetét a legjobb időpontért.`,
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

  const [
    { data: profile },
    { data: goals },
    { data: tx },
    { data: projects },
    { data: documents },
    { data: responsibilities },
    { data: dreams },
    { data: milestones },
    { data: kitchenItems },
    { data: calendarEvents },
    { data: shifts },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, preferred_currency, current_savings, financial_goal")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("goals").select("title, progress_percent, target_date, status"),
    supabase.from("transactions").select("amount, direction, occurred_at"),
    supabase.from("projects").select("name, progress_percent, deadline, status"),
    supabase.from("documents").select("expires_at"),
    supabase.from("responsibilities").select("due_date, completed"),
    supabase.from("dreams").select("id"),
    supabase.from("milestones").select("id"),
    supabase.from("kitchen_items").select("name"),
    supabase.from("calendar_events").select("start_at, end_at, all_day, recurrence_rule"),
    supabase.from("shifts").select("start_at, end_at"),
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

  if (/(goal|progress|achieve|cél|halad|elér)/.test(q)) {
    if (!activeGoals.length) return L.goalsNone(name);
    const top = [...activeGoals].sort((a, b) => b.progress_percent - a.progress_percent)[0];
    return L.goalsSummary(avgGoal ?? 0, activeGoals.length, top.title, top.progress_percent);
  }

  if (/(project|work|build|deadline|projekt|munka|határidő|épít)/.test(q)) {
    const active = (projects ?? []).filter((p) => p.status !== "completed");
    if (!active.length) return L.projectsNone(name);
    return L.projectsSummary(active.length);
  }

  if (/(document|responsibilit|expir|secure|protect|dokumentum|kötelezettség|lejár|védelem)/.test(q)) {
    const docs = documents ?? [];
    const resps = responsibilities ?? [];
    if (!docs.length && !resps.length) return L.protectionNone(name);
    const now2 = Date.now();
    const expiring = docs.filter((d) => d.expires_at && new Date(d.expires_at).getTime() - now2 < 30 * 86_400_000).length;
    const overdue = resps.filter((r) => !r.completed && r.due_date && new Date(r.due_date).getTime() < now2).length;
    if (!expiring && !overdue) return L.protectionClear;
    return L.protectionSummary(expiring, overdue);
  }

  if (/(dream|milestone|legacy|álom|mérföldkő|örökség)/.test(q)) {
    const dreamCount = (dreams ?? []).length;
    const milestoneCount = (milestones ?? []).length;
    if (!dreamCount && !milestoneCount) return L.legacyNone(name);
    return L.legacySummary(dreamCount, milestoneCount);
  }

  if (/(eat|meal|fridge|kitchen|cook|recipe|enni|étel|hűtő|konyha|főz|recept)/.test(q)) {
    const items = kitchenItems ?? [];
    if (!items.length) return L.kitchenEmpty(name);
    const { suggestMeals } = await import("@/app/dashboard/kitchen/suggestions");
    const suggestions = suggestMeals(items.map((i) => i.name), 1);
    return L.kitchenSummary(items.length, suggestions[0]?.name ?? null);
  }

  // Busy windows for today (and tomorrow), used by both the free-time and
  // suggestion branches below — expands recurring events, includes ICSB
  // shifts, and merges overlapping intervals.
  function busyWindowsOn(day: Date): { start: number; end: number }[] {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const windows: { start: number; end: number }[] = [];
    for (const e of calendarEvents ?? []) {
      if (e.all_day) continue;
      for (const occ of expandOccurrences(e, dayStart, dayEnd)) {
        windows.push({ start: occ.start.getTime(), end: occ.end.getTime() });
      }
    }
    for (const s of shifts ?? []) {
      const start = new Date(s.start_at).getTime();
      if (start >= dayStart.getTime() && start <= dayEnd.getTime()) {
        windows.push({ start, end: new Date(s.end_at).getTime() });
      }
    }
    return windows.sort((a, b) => a.start - b.start);
  }

  function freeGaps(day: Date, dayStartHour = 7, dayEndHour = 22): { start: number; end: number }[] {
    const busy = busyWindowsOn(day);
    const dayStart = new Date(day);
    dayStart.setHours(dayStartHour, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(dayEndHour, 0, 0, 0);

    const gaps: { start: number; end: number }[] = [];
    let cursor = dayStart.getTime();
    for (const b of busy) {
      if (b.start > cursor) gaps.push({ start: cursor, end: Math.min(b.start, dayEnd.getTime()) });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < dayEnd.getTime()) gaps.push({ start: cursor, end: dayEnd.getTime() });
    return gaps.filter((g) => g.end - g.start >= 30 * 60_000);
  }

  const timeFmt = (ms: number) => new Date(ms).toLocaleTimeString(locale === "hu" ? "hu-HU" : "en-US", { hour: "numeric", minute: "2-digit" });

  if (/(free time|am i free|available|schedule.*today|szabad.*idő|ráérek|programom.*ma)/.test(q)) {
    const gaps = freeGaps(now);
    if (!gaps.length) return L.freeTimeNone;
    const slots = gaps.slice(0, 4).map((g) => `${timeFmt(g.start)}–${timeFmt(g.end)}`).join(", ");
    return L.freeTimeSummary(slots);
  }

  if (/(busiest|overload|too much|too busy|elfoglalt|túlterhelt|zsúfolt)/.test(q)) {
    const weekCounts: { day: Date; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      weekCounts.push({ day: d, count: busyWindowsOn(d).length });
    }
    const busiest = weekCounts.reduce((max, cur) => (cur.count > max.count ? cur : max), weekCounts[0]);
    if (busiest.count === 0) return L.busiestDayNone;
    const dayLabel = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { weekday: "long" }).format(busiest.day);
    return L.busiestDaySummary(dayLabel, busiest.count);
  }

  if (/(bible study|when should i (study|pray)|mikor.*bibli|bibliatanulmány)/.test(q)) {
    const gaps = [...freeGaps(now), ...freeGaps(new Date(now.getTime() + 86_400_000))];
    const activity = locale === "hu" ? "bibliatanulmányozás" : "Bible study";
    if (!gaps.length) return L.suggestSlotNone(activity);
    return L.suggestSlot(activity, timeFmt(gaps[0].start));
  }

  if (/(workout|exercise|when should i (train|work ?out)|mikor.*edz|edzés)/.test(q)) {
    const gaps = [...freeGaps(now), ...freeGaps(new Date(now.getTime() + 86_400_000))];
    const activity = locale === "hu" ? "edzés" : "a workout";
    if (!gaps.length) return L.suggestSlotNone(activity);
    return L.suggestSlot(activity, timeFmt(gaps[0].start));
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
