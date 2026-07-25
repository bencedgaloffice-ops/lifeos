/**
 * AI price research — the honest version.
 *
 * What this is NOT: a scraper. Hungarian chains publish no price API, their
 * sites are JS-rendered and block bots, and scraping them would violate their
 * terms and break on the next redesign. DuckDuckGo's Instant Answer API (the
 * keyless source Jarvis already uses) returns encyclopedic snippets, never
 * shelf prices. So there is no route to a genuine live price feed here.
 *
 * What this IS: Claude estimating a realistic HUF price band per chain from
 * what it knows about the Hungarian grocery market, written to `store_prices`
 * flagged `source = 'ai_estimate'`. The estimates are always visibly marked,
 * they never outrank a price the user actually recorded, and one tap promotes
 * one into a real observation. Day one you get a usable comparison; over a few
 * shops the user's corrections turn it into real data.
 *
 * Everything in this file is pure — prompt building, parsing, validation — so
 * the server action stays a thin wrapper and this logic can be reasoned about
 * without a database or a model call.
 */

export type ResearchedPrice = {
  slug: string;
  priceHuf: number;
  confidence: number;
};

export type ResearchResult = {
  item: string;
  unit: string | null;
  prices: ResearchedPrice[];
  note: string | null;
};

/** Forint bounds for a single grocery line. Anything outside is a bad parse,
 * not a real price — a model that returns 3 or 900000 has misunderstood. */
const MIN_HUF = 20;
const MAX_HUF = 200_000;

export const RESEARCH_SYSTEM = `You are a Hungarian grocery pricing analyst for LifeOS.

Given one shopping list item, estimate its typical current shelf price in Hungarian forints (HUF) at each of the Hungarian chains listed by the user.

Rules:
- Price a normal single retail unit (1 L milk, 1 kg potatoes, one standard pack). State that unit.
- Use ordinary shelf prices, not promotions.
- Reflect real relative positioning: Lidl and ALDI are cheapest on staples, Penny is close behind, Tesco and Auchan are mid-range with the widest choice, SPAR is the most expensive convenience option, METRO is wholesale (bulk unit prices, membership required).
- Only include a chain if that chain would plausibly stock the item. Omit chains that would not.
- confidence is 0-100: how sure you are of this specific number. Common staples score high; unusual, branded, or highly variable items score low. Be honest — a low score is more useful than a confident wrong number.
- If the item is too vague to price (e.g. "food", "stuff"), return an empty prices array and explain in note.

Reply with ONLY a JSON object, no markdown fence, no prose:
{"item":"<item as given>","unit":"<unit priced, e.g. 1 L>","prices":[{"slug":"lidl","price_huf":389,"confidence":75}],"note":"<one short sentence, or null>"}`;

/** The user-side prompt: the item, the chains that actually exist for this
 * user, and any web context we managed to find. */
export function buildResearchPrompt(item: string, slugs: string[], webContext?: string | null): string {
  const lines = [`Item: ${item}`, `Chains available: ${slugs.join(", ")}`];
  if (webContext) lines.push(`Web context (may be irrelevant, ignore if so): ${webContext}`);
  return lines.join("\n");
}

/** Strip a ```json fence if the model added one despite being asked not to. */
function unfence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/**
 * Parse and validate a model reply. Returns null when the reply is unusable —
 * callers treat that as "research failed", never as "no prices exist".
 * Unknown chain slugs and out-of-range prices are dropped individually so one
 * bad line doesn't discard an otherwise good result.
 */
export function parseResearch(raw: string | null, allowedSlugs: string[]): ResearchResult | null {
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(unfence(raw));
  } catch {
    // Sometimes a model wraps JSON in a sentence. Take the outermost object.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      data = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const allowed = new Set(allowedSlugs);

  const prices: ResearchedPrice[] = [];
  if (Array.isArray(obj.prices)) {
    for (const entry of obj.prices) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const slug = typeof e.slug === "string" ? e.slug.trim().toLowerCase() : "";
      const price = Math.round(Number(e.price_huf));
      const confidence = Math.round(Number(e.confidence));
      if (!allowed.has(slug)) continue;
      if (!Number.isFinite(price) || price < MIN_HUF || price > MAX_HUF) continue;
      if (prices.some((p) => p.slug === slug)) continue; // first wins
      prices.push({
        slug,
        priceHuf: price,
        confidence: Number.isFinite(confidence) ? Math.min(100, Math.max(0, confidence)) : 50,
      });
    }
  }

  const item = typeof obj.item === "string" && obj.item.trim() ? obj.item.trim() : null;
  if (!item) return null;

  return {
    item,
    unit: typeof obj.unit === "string" && obj.unit.trim() ? obj.unit.trim() : null,
    prices,
    note: typeof obj.note === "string" && obj.note.trim() ? obj.note.trim() : null,
  };
}

/** Items too vague to price are rejected before we spend a model call. */
export function isResearchable(name: string): boolean {
  const n = name.trim();
  return n.length >= 2 && n.length <= 80 && /[\p{L}]/u.test(n);
}

/** How many items one "research the whole list" run will handle. Keeps a
 * single click bounded in cost and latency even with a 40-item list. */
export const RESEARCH_BATCH_LIMIT = 12;
