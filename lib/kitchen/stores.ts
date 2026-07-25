import type { Store, StorePrice, ShoppingListItem } from "@/lib/types";

/**
 * Hungarian grocery intelligence.
 *
 * Given the user's shopping list and the prices they have actually observed at
 * each chain, work out where to buy what. Everything here is pure and
 * synchronous so it can run on the server or the client and be unit-reasoned
 * about without a database.
 *
 * Prices come from the user's own `store_prices` observations — LifeOS does not
 * scrape retailer sites, so a recommendation only ever reflects real prices the
 * user has recorded. Where nothing has been recorded we fall back to the
 * chain's general price level rather than inventing a number.
 */

/** Typical basket character of each chain, used when no price is known yet. */
export const STORE_HINTS: Record<string, string> = {
  metro: "Bulk buys, meat and catering packs",
  tesco: "Widest range, strong own-brand",
  auchan: "Big fresh produce and butcher counters",
  lidl: "Cheapest staples and bakery",
  aldi: "Low-cost basics",
  spar: "Closest and quickest, priciest",
  penny: "Quick top-ups, good meat deals",
};

export type PriceEntry = {
  storeId: string;
  price: number;
  unit: string | null;
  observedAt: string;
  /** True when this number came from AI research, not a shelf the user saw. */
  aiEstimate: boolean;
  confidence: number | null;
  priceId: string;
};

export type PriceIndex = Map<string, PriceEntry[]>;

export const norm = (s: string) => s.trim().toLowerCase();

/**
 * Group prices by normalised item name, cheapest first.
 *
 * An item's *observed* prices and its *estimated* prices are never mixed: if the
 * user has recorded even one real price for an item, the estimates for that item
 * are dropped from the plan entirely. Comparing a shelf price against a guess
 * would produce a fake saving, which is worse than no number at all.
 */
export function buildPriceIndex(prices: StorePrice[]): PriceIndex {
  const idx: PriceIndex = new Map();
  for (const p of prices) {
    const key = norm(p.item_name);
    const list = idx.get(key) ?? [];
    list.push({
      storeId: p.store_id,
      price: Number(p.price_huf),
      unit: p.unit,
      observedAt: p.observed_at,
      aiEstimate: p.source === "ai_estimate",
      confidence: p.confidence,
      priceId: p.id,
    });
    idx.set(key, list);
  }
  for (const [key, list] of idx) {
    const observed = list.filter((e) => !e.aiEstimate);
    const kept = observed.length ? observed : list;
    kept.sort((a, b) => a.price - b.price);
    idx.set(key, kept);
  }
  return idx;
}

export type Assignment = {
  item: ShoppingListItem;
  /** Cheapest chain we have evidence for, or null when nothing is recorded. */
  storeId: string | null;
  price: number | null;
  /** Money saved versus the priciest recorded option for the same item. */
  saving: number | null;
  /** True when the price is not a shelf price the user recorded themselves. */
  estimated: boolean;
  /** True specifically when the number came from AI research. */
  aiEstimate: boolean;
  confidence: number | null;
  /** The store_prices row behind this number, so the UI can confirm it. */
  priceId: string | null;
};

/**
 * Assign every unchecked list item to the cheapest chain we have a real price
 * for. Items with no recorded price are left unassigned rather than guessed,
 * so the totals stay honest.
 */
export function assignItems(items: ShoppingListItem[], priceIndex: PriceIndex): Assignment[] {
  return items.map((item) => {
    // An explicit user choice always wins over the recommendation.
    if (item.store_id) {
      const known = priceIndex.get(norm(item.name))?.find((p) => p.storeId === item.store_id);
      return {
        item,
        storeId: item.store_id,
        price: known?.price ?? (item.estimated_price_huf ? Number(item.estimated_price_huf) : null),
        saving: null,
        estimated: !known || known.aiEstimate,
        aiEstimate: known?.aiEstimate ?? false,
        confidence: known?.confidence ?? null,
        priceId: known?.priceId ?? null,
      };
    }
    const options = priceIndex.get(norm(item.name));
    if (!options?.length) {
      return {
        item,
        storeId: null,
        price: null,
        saving: null,
        estimated: true,
        aiEstimate: false,
        confidence: null,
        priceId: null,
      };
    }
    const cheapest = options[0];
    const priciest = options[options.length - 1];
    return {
      item,
      storeId: cheapest.storeId,
      price: cheapest.price,
      saving: options.length > 1 ? priciest.price - cheapest.price : null,
      estimated: cheapest.aiEstimate,
      aiEstimate: cheapest.aiEstimate,
      confidence: cheapest.confidence,
      priceId: cheapest.priceId,
    };
  });
}

export type StoreRun = {
  store: Store;
  items: Assignment[];
  subtotal: number;
  /** How much of the subtotal is a real observed price rather than a guess. */
  confident: boolean;
};

/** Group assignments into one "run" per chain, biggest basket first. */
export function planRuns(assignments: Assignment[], stores: Store[]): { runs: StoreRun[]; unassigned: Assignment[] } {
  const byId = new Map(stores.map((s) => [s.id, s]));
  const groups = new Map<string, Assignment[]>();
  const unassigned: Assignment[] = [];

  for (const a of assignments) {
    if (!a.storeId || !byId.has(a.storeId)) {
      unassigned.push(a);
      continue;
    }
    const list = groups.get(a.storeId) ?? [];
    list.push(a);
    groups.set(a.storeId, list);
  }

  const runs: StoreRun[] = [...groups.entries()].map(([storeId, list]) => ({
    store: byId.get(storeId)!,
    items: list,
    subtotal: list.reduce((sum, a) => sum + (a.price ?? 0), 0),
    confident: list.every((a) => !a.estimated),
  }));

  runs.sort((a, b) => b.items.length - a.items.length || b.subtotal - a.subtotal);
  return { runs, unassigned };
}

/** Total saving available by splitting the shop across chains. */
export function totalSaving(assignments: Assignment[]): number {
  return assignments.reduce((sum, a) => sum + (a.saving ?? 0), 0);
}

/** Round-trip friendly HUF formatting (no decimals — forints are whole). */
export function huf(n: number, locale: string = "hu"): string {
  return new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-US", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(n);
}

export type SingleStoreTotal = {
  store: Store;
  /** Cost of the items this chain can actually price. */
  total: number;
  /** How many list items this chain has any price for. */
  covered: number;
  /** Items this chain has no price for at all — you'd still need another shop. */
  missing: string[];
  /** True when every price used is a real observed one. */
  confident: boolean;
};

/**
 * "If I did this whole shop at one chain, which one is cheapest?"
 *
 * This is a different question from planRuns, which splits the basket for the
 * absolute lowest total. One trip to a slightly pricier chain often beats
 * driving to four — so both numbers are shown and the user decides.
 *
 * Coverage matters more than the total: a chain that can only price three of
 * ten items looks artificially cheap, so `covered`/`missing` travel with the
 * number and the UI sorts by coverage first.
 */
export function singleStoreTotals(
  items: ShoppingListItem[],
  priceIndex: PriceIndex,
  stores: Store[],
): SingleStoreTotal[] {
  return stores
    .map((store) => {
      let total = 0;
      let covered = 0;
      let confident = true;
      const missing: string[] = [];

      for (const item of items) {
        const here = priceIndex.get(norm(item.name))?.find((e) => e.storeId === store.id);
        if (!here) {
          missing.push(item.name);
          continue;
        }
        total += here.price;
        covered += 1;
        if (here.aiEstimate) confident = false;
      }
      return { store, total, covered, missing, confident };
    })
    .filter((r) => r.covered > 0)
    .sort((a, b) => b.covered - a.covered || a.total - b.total);
}

/**
 * A one-line recommendation for where to do the bulk of this shop, based on
 * how many items each chain wins and what the chain is generally good for.
 */
export function bestStoreAdvice(runs: StoreRun[]): { store: Store; itemCount: number } | null {
  if (!runs.length) return null;
  return { store: runs[0].store, itemCount: runs[0].items.length };
}
