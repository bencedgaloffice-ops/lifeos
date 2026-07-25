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

export type PriceIndex = Map<string, { storeId: string; price: number; unit: string | null; observedAt: string }[]>;

const norm = (s: string) => s.trim().toLowerCase();

/** Group observed prices by normalised item name, cheapest first. */
export function buildPriceIndex(prices: StorePrice[]): PriceIndex {
  const idx: PriceIndex = new Map();
  for (const p of prices) {
    const key = norm(p.item_name);
    const list = idx.get(key) ?? [];
    list.push({ storeId: p.store_id, price: Number(p.price_huf), unit: p.unit, observedAt: p.observed_at });
    idx.set(key, list);
  }
  for (const list of idx.values()) list.sort((a, b) => a.price - b.price);
  return idx;
}

export type Assignment = {
  item: ShoppingListItem;
  /** Cheapest chain we have evidence for, or null when nothing is recorded. */
  storeId: string | null;
  price: number | null;
  /** Money saved versus the priciest recorded option for the same item. */
  saving: number | null;
  /** True when this is a guess from the chain's price level, not a real price. */
  estimated: boolean;
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
        estimated: !known,
      };
    }
    const options = priceIndex.get(norm(item.name));
    if (!options?.length) {
      return { item, storeId: null, price: null, saving: null, estimated: true };
    }
    const cheapest = options[0];
    const priciest = options[options.length - 1];
    return {
      item,
      storeId: cheapest.storeId,
      price: cheapest.price,
      saving: options.length > 1 ? priciest.price - cheapest.price : null,
      estimated: false,
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

/**
 * A one-line recommendation for where to do the bulk of this shop, based on
 * how many items each chain wins and what the chain is generally good for.
 */
export function bestStoreAdvice(runs: StoreRun[]): { store: Store; itemCount: number } | null {
  if (!runs.length) return null;
  return { store: runs[0].store, itemCount: runs[0].items.length };
}
