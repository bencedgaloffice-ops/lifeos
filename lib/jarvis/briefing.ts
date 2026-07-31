/**
 * Proactive briefing — deciding what is worth interrupting someone about.
 *
 * A reactive assistant waits to be asked. The useful version notices things:
 * food about to spoil, a shift starting at 06:45 tomorrow, an anniversary next
 * week, a shopping list nobody has priced. LifeOS already holds all of that,
 * which is the only reason this can be honest rather than generic.
 *
 * The hard part is not gathering signals, it is restraint. An assistant that
 * reports six things every morning gets ignored within a week, so every signal
 * carries an urgency and the engine returns only what clears the bar. Silence
 * is a valid, common, and correct output.
 *
 * Pure and synchronous: the caller fetches, this decides. No model call — what
 * matters today is arithmetic on real dates, and paying a model to rank five
 * rules would be slower, costlier and less predictable.
 */

export type Signal = {
  /** Stable id, so the UI can remember what has been dismissed. */
  id: string;
  /** 0–100. Only signals at or above THRESHOLD are surfaced. */
  urgency: number;
  /** One sentence, written to be read aloud. */
  text: string;
  /** Where to send the user if they want to act on it. */
  route?: string;
  /** A short category used only for dedup — one signal per kind. The rule
   * engine uses a fixed set; persisted agent recommendations merged in by
   * getBriefing bring their own kinds, so this is a free string. */
  kind: string;
};

/** Below this, a signal is real but not worth an interruption. */
export const THRESHOLD = 45;

/** How many signals a single briefing may contain. Beyond three it stops being
 * a briefing and becomes a to-do list, which people ignore. */
export const MAX_SIGNALS = 3;

export type BriefingInput = {
  now: Date;
  kitchen: { id: string; name: string; expires_at: string | null }[];
  shoppingOpen: { id: string; name: string }[];
  /** Item names that have at least one recorded or estimated price. */
  pricedItems: Set<string>;
  events: { id: string; title: string; start_at: string; all_day: boolean }[];
  shifts: { id: string; start_at: string }[];
  goals: { id: string; title: string; target_date: string | null; status: string | null }[];
  /** Recipes cookable right now, from the chef engine. */
  cookableNow: { id: string; name: string; rescues: string[] }[];
};

const days = (from: Date, to: Date) =>
  Math.floor((new Date(to.toDateString()).getTime() - new Date(from.toDateString()).getTime()) / 86_400_000);

const hours = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

const list = (names: string[], max = 3): string => {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
  return rest > 0 ? `${joined} and ${rest} more` : joined;
};

/**
 * Build the briefing.
 *
 * Ordered by urgency, capped, and deduplicated by kind so one busy area cannot
 * crowd out everything else — three expiry warnings is a worse briefing than
 * one expiry warning, one shift reminder and one anniversary.
 */
export function buildBriefing(input: BriefingInput): Signal[] {
  const { now } = input;
  const signals: Signal[] = [];

  /* ---- Food about to spoil. The most actionable thing in the app. ---- */
  const expiring = input.kitchen
    .map((i) => ({ item: i, d: i.expires_at ? days(now, new Date(i.expires_at)) : null }))
    .filter((x): x is { item: typeof x.item; d: number } => x.d !== null && x.d <= 3);

  const expired = expiring.filter((x) => x.d < 0);
  const today = expiring.filter((x) => x.d >= 0 && x.d <= 1);
  const soon = expiring.filter((x) => x.d > 1);

  if (expired.length) {
    signals.push({
      id: `expired:${expired.map((x) => x.item.id).join(",")}`,
      urgency: 70,
      kind: "expiry",
      text: `${list(expired.map((x) => x.item.name))} ${expired.length === 1 ? "has" : "have"} passed their date — worth checking before you cook.`,
      route: "/dashboard/kitchen?view=manager",
    });
  } else if (today.length) {
    signals.push({
      id: `expiring:${today.map((x) => x.item.id).join(",")}`,
      urgency: 82,
      kind: "expiry",
      text: `${list(today.map((x) => x.item.name))} ${today.length === 1 ? "goes" : "go"} off today or tomorrow.`,
      route: "/dashboard/kitchen?view=chef",
    });
  } else if (soon.length >= 2) {
    signals.push({
      id: `expiring-soon:${soon.map((x) => x.item.id).join(",")}`,
      urgency: 52,
      kind: "expiry",
      text: `${list(soon.map((x) => x.item.name))} need using within three days.`,
      route: "/dashboard/kitchen?view=chef",
    });
  }

  /* ---- A dish that rescues the expiring food beats a warning about it. ---- */
  const rescue = input.cookableNow.find((r) => r.rescues.length > 0);
  if (rescue) {
    signals.push({
      id: `cook:${rescue.id}`,
      urgency: 68,
      kind: "cook",
      text: `You can cook ${rescue.name} tonight with what's in — it uses up ${list(rescue.rescues, 2)}.`,
      route: "/dashboard/kitchen?view=chef",
    });
  }

  /* ---- An early shift is worth a heads-up the evening before. ---- */
  for (const shift of input.shifts) {
    const start = new Date(shift.start_at);
    const h = hours(now, start);
    if (h < 0 || h > 16) continue;
    const early = start.getUTCHours() <= 6;
    signals.push({
      id: `shift:${shift.id}`,
      urgency: early ? 76 : 58,
      kind: "shift",
      text:
        h <= 3
          ? `Your ICSB shift starts in about ${Math.max(1, Math.round(h))} ${Math.round(h) === 1 ? "hour" : "hours"}.`
          : `ICSB shift tomorrow, starting ${start.toISOString().slice(11, 16)} UTC — an early one.`,
      route: "/dashboard/calendar",
    });
    break;
  }

  /* ---- Dates that must not be missed. Anniversaries are unforgiving. ---- */
  for (const ev of input.events) {
    const d = days(now, new Date(ev.start_at));
    if (d < 0 || d > 10) continue;
    const sentimental = /anniversary|évforduló|birthday|szülinap|születésnap|wedding|esküvő|eljegyz/i.test(ev.title);
    if (!sentimental && d > 1) continue;
    signals.push({
      id: `event:${ev.id}`,
      urgency: sentimental ? (d <= 7 ? 88 : 60) : 50,
      kind: "date",
      text:
        d === 0
          ? `${ev.title} — that's today.`
          : d === 1
            ? `${ev.title} is tomorrow.`
            : `${ev.title} is in ${d} days.`,
      route: "/dashboard/calendar",
    });
    if (sentimental) break;
  }

  /* ---- A shopping list nobody has priced can't be optimised. ---- */
  const unpriced = input.shoppingOpen.filter((i) => !input.pricedItems.has(i.name.trim().toLowerCase()));
  if (unpriced.length >= 4) {
    signals.push({
      id: `unpriced:${unpriced.length}`,
      urgency: 46,
      kind: "shopping",
      text: `${unpriced.length} items on your list have no price yet — I can research them and work out the cheapest run.`,
      route: "/dashboard/kitchen?view=shopping",
    });
  }

  /* ---- A goal with a date that has quietly passed. ---- */
  const slipped = input.goals.filter(
    (g) => g.target_date && g.status !== "done" && g.status !== "completed" && days(now, new Date(g.target_date)) < 0,
  );
  if (slipped.length) {
    signals.push({
      id: `goal:${slipped.map((g) => g.id).join(",")}`,
      urgency: 54,
      kind: "goal",
      text: `${list(slipped.map((g) => g.title), 2)} ${slipped.length === 1 ? "is" : "are"} past the target date. Worth re-dating or closing.`,
      route: "/dashboard/goals",
    });
  }

  /* One per kind, most urgent first, capped. */
  const seen = new Set<Signal["kind"]>();
  return signals
    .filter((s) => s.urgency >= THRESHOLD)
    .sort((a, b) => b.urgency - a.urgency)
    .filter((s) => {
      if (seen.has(s.kind)) return false;
      seen.add(s.kind);
      return true;
    })
    .slice(0, MAX_SIGNALS);
}

/** Stitch signals into something speakable. Empty when there is nothing to say
 * — an assistant with nothing useful to report should say nothing. */
export function speakBriefing(signals: Signal[], name: string, now = new Date()): string {
  if (!signals.length) return "";
  const h = now.getHours();
  const greeting = h < 11 ? `Good morning, ${name}.` : h < 18 ? `Afternoon, ${name}.` : `Evening, ${name}.`;
  return `${greeting} ${signals.map((s) => s.text).join(" ")}`;
}
