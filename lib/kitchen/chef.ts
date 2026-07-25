import type { KitchenItem, Recipe, RecipeIngredient } from "@/lib/types";

/**
 * The AI Chef matching engine.
 *
 * Given the user's real fridge/freezer/pantry contents and their saved recipes,
 * work out what can actually be cooked tonight, what's one shop away, and —
 * most valuable of all — which recipes use up the food that's about to expire.
 *
 * Pure and synchronous, like lib/kitchen/stores.ts: no database, no model call.
 * The LLM's job (in the server action) is to *invent* recipes; deciding what is
 * cookable from real stock is arithmetic, and arithmetic should not be
 * hallucinated.
 */

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Common swaps, keyed by the ingredient a recipe asks for. If the pantry has
 * any listed alternative, the ingredient counts as satisfied — flagged as a
 * substitution so the UI can say "using butter instead of oil".
 *
 * Deliberately conservative: only swaps that genuinely work in most dishes.
 */
export const SUBSTITUTIONS: Record<string, string[]> = {
  butter: ["margarine", "oil", "olaj", "vaj"],
  oil: ["butter", "olive oil", "olaj", "vaj"],
  milk: ["cream", "yogurt", "tej", "tejszín", "joghurt"],
  cream: ["milk", "yogurt", "tejszín", "tejföl", "sour cream"],
  yogurt: ["sour cream", "cream", "joghurt", "tejföl"],
  onion: ["shallot", "spring onion", "hagyma", "leek"],
  garlic: ["garlic powder", "fokhagyma"],
  rice: ["couscous", "quinoa", "rizs", "bulgur"],
  pasta: ["noodles", "tészta", "spaghetti", "penne"],
  chicken: ["turkey", "csirke", "pulyka"],
  beef: ["pork", "marha", "sertés", "mince", "darált hús"],
  sugar: ["honey", "cukor", "méz"],
  lemon: ["lime", "citrom", "vinegar", "ecet"],
  parmesan: ["cheese", "sajt", "pecorino", "trappista"],
  cheese: ["parmesan", "sajt", "mozzarella", "trappista"],
  stock: ["bouillon", "broth", "alaplé", "leveskocka"],
  tomato: ["passata", "tinned tomatoes", "paradicsom", "tomato puree"],
  egg: ["tojás"],
  flour: ["liszt"],
  potato: ["burgonya", "krumpli"],
};

export type IngredientMatch = {
  ingredient: RecipeIngredient;
  /** The pantry item satisfying it, if any. */
  stockItem: KitchenItem | null;
  /** True when satisfied by a substitute rather than the exact ingredient. */
  substituted: boolean;
};

export type RecipeMatch = {
  recipe: Recipe;
  ingredients: IngredientMatch[];
  /** Non-optional ingredients we have (exactly or via a substitute). */
  have: IngredientMatch[];
  /** Non-optional ingredients we do not have — the shopping list for this dish. */
  missing: IngredientMatch[];
  /** 0–1 across required ingredients only. 1 means cookable right now. */
  coverage: number;
  cookableNow: boolean;
  /** Stock items this recipe would use up that expire within the urgency window. */
  usesExpiring: KitchenItem[];
  /** Days until the soonest expiry among usesExpiring, or null. */
  soonestExpiryDays: number | null;
  /** Ranking score — higher is a better suggestion right now. */
  score: number;
};

/** Days left before an item's expiry date, or null if it has none. */
export function daysUntilExpiry(item: KitchenItem, now = new Date()): number | null {
  if (!item.expires_at) return null;
  const then = new Date(item.expires_at);
  if (Number.isNaN(then.getTime())) return null;
  const ms = then.getTime() - new Date(now.toDateString()).getTime();
  return Math.floor(ms / 86_400_000);
}

/** Everything expiring within `withinDays` (including already expired), soonest first. */
export function expiringSoon(items: KitchenItem[], withinDays = 5, now = new Date()): KitchenItem[] {
  return items
    .map((item) => ({ item, days: daysUntilExpiry(item, now) }))
    .filter((e): e is { item: KitchenItem; days: number } => e.days !== null && e.days <= withinDays)
    .sort((a, b) => a.days - b.days)
    .map((e) => e.item);
}

/**
 * Does the stock satisfy this ingredient name? Matching is substring-based in
 * both directions ("chicken breast" in stock satisfies "chicken"; "milk" in
 * stock satisfies "whole milk") because kitchen items are free text.
 */
function findInStock(name: string, stock: KitchenItem[]): { item: KitchenItem; substituted: boolean } | null {
  const want = norm(name);
  if (!want) return null;

  const direct = stock.find((s) => {
    const have = norm(s.name);
    return have.includes(want) || want.includes(have);
  });
  if (direct) return { item: direct, substituted: false };

  // Substitutions: check every alias of every key the ingredient matches.
  for (const [key, alts] of Object.entries(SUBSTITUTIONS)) {
    if (!want.includes(key)) continue;
    for (const alt of alts) {
      const found = stock.find((s) => norm(s.name).includes(alt));
      if (found) return { item: found, substituted: true };
    }
  }
  return null;
}

/** Match one recipe against the current kitchen stock. */
export function matchRecipe(
  recipe: Recipe,
  ingredients: RecipeIngredient[],
  stock: KitchenItem[],
  now = new Date(),
): RecipeMatch {
  const matches: IngredientMatch[] = ingredients.map((ingredient) => {
    const hit = findInStock(ingredient.name, stock);
    return {
      ingredient,
      stockItem: hit?.item ?? null,
      substituted: hit?.substituted ?? false,
    };
  });

  const required = matches.filter((m) => !m.ingredient.optional);
  const have = required.filter((m) => m.stockItem);
  const missing = required.filter((m) => !m.stockItem);
  const coverage = required.length ? have.length / required.length : 1;

  // Which soon-to-expire items this dish would actually consume.
  const used = matches.map((m) => m.stockItem).filter((s): s is KitchenItem => Boolean(s));
  const usesExpiring = used
    .map((item) => ({ item, days: daysUntilExpiry(item, now) }))
    .filter((e): e is { item: KitchenItem; days: number } => e.days !== null && e.days <= 5)
    .sort((a, b) => a.days - b.days)
    .map((e) => e.item);

  const soonestExpiryDays = usesExpiring.length ? daysUntilExpiry(usesExpiring[0], now) : null;

  /*
   * Score: coverage dominates (a dish you can't cook isn't a suggestion), then
   * rescuing food about to expire, then favourites, then a small nudge toward
   * quick meals. Deliberately a readable weighted sum, not a tuned formula.
   */
  let score = coverage * 100;
  if (coverage === 1) score += 25;
  if (soonestExpiryDays !== null) score += Math.max(0, 30 - soonestExpiryDays * 5);
  score += usesExpiring.length * 4;
  if (recipe.is_favourite) score += 12;
  if (recipe.minutes && recipe.minutes <= 20) score += 5;
  score -= matches.filter((m) => m.substituted).length * 3;

  return {
    recipe,
    ingredients: matches,
    have,
    missing,
    coverage,
    cookableNow: missing.length === 0,
    usesExpiring,
    soonestExpiryDays,
    score,
  };
}

/** Match and rank every recipe against current stock, best suggestion first. */
export function rankRecipes(
  recipes: Recipe[],
  ingredients: RecipeIngredient[],
  stock: KitchenItem[],
  now = new Date(),
): RecipeMatch[] {
  const byRecipe = new Map<string, RecipeIngredient[]>();
  for (const ing of ingredients) {
    const list = byRecipe.get(ing.recipe_id) ?? [];
    list.push(ing);
    byRecipe.set(ing.recipe_id, list);
  }
  return recipes
    .map((r) => matchRecipe(r, byRecipe.get(r.id) ?? [], stock, now))
    .sort((a, b) => b.score - a.score);
}

/**
 * A one-line brief for the recipe generator: what's in the kitchen, with the
 * about-to-expire items called out first so the model builds a dish around
 * them. This is the whole point of generating rather than looking up — the
 * recipe is shaped by what's actually going off.
 */
export function pantryBrief(stock: KitchenItem[], now = new Date()): string {
  if (!stock.length) return "The kitchen is empty.";
  const urgent = expiringSoon(stock, 5, now);
  const urgentNames = urgent.map((i) => {
    const d = daysUntilExpiry(i, now);
    return d !== null && d < 0 ? `${i.name} (expired)` : `${i.name} (${d} day${d === 1 ? "" : "s"} left)`;
  });
  const rest = stock.filter((s) => !urgent.some((u) => u.id === s.id)).map((s) => s.name);

  const parts: string[] = [];
  if (urgentNames.length) parts.push(`Use up first (expiring): ${urgentNames.join(", ")}.`);
  if (rest.length) parts.push(`Also in stock: ${rest.join(", ")}.`);
  return parts.join(" ");
}

/** Total non-optional ingredients missing across a set of matches — used for
 * the "add everything missing to the shopping list" affordance. */
export function missingNames(match: RecipeMatch): string[] {
  return match.missing.map((m) => m.ingredient.name);
}
