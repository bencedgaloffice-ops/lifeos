"use server";

/**
 * AI Chef — recipe generation and cooking.
 *
 * The division of labour matters: Claude *invents* the recipe (which is
 * genuinely creative work, and is shaped by a brief describing what's actually
 * in the fridge and what's about to expire), while lib/kitchen/chef.ts decides
 * what is cookable from real stock. Nothing about the user's inventory is
 * inferred by a model — only the dish is.
 *
 * Generation requires ANTHROPIC_API_KEY. Without it, saved recipes, matching,
 * expiry rescue and "cook this" all still work; only the generate button
 * reports that it isn't configured.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { askClaude, isAnthropicConfigured } from "@/lib/jarvis/llm";
import type { KitchenItem } from "@/lib/types";
import { pantryBrief } from "@/lib/kitchen/chef";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard/kitchen");
}

/* ------------------------------- CRUD ------------------------------- */

/** Save a recipe by hand. Ingredients arrive as one per line. */
export async function createRecipe(fd: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;

  const steps = String(fd.get("steps") ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  const ingredientLines = String(fd.get("ingredients") ?? "")
    .split("\n")
    .map((s) => s.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

  const minutes = Number(fd.get("minutes"));
  const servings = Number(fd.get("servings"));

  const { data: recipe } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name,
      description: String(fd.get("description") ?? "").trim() || null,
      steps,
      minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
      servings: Number.isFinite(servings) && servings > 0 ? Math.round(servings) : 2,
      cuisine: String(fd.get("cuisine") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (recipe && ingredientLines.length) {
    await supabase.from("recipe_ingredients").insert(
      ingredientLines.map((line) => ({ recipe_id: recipe.id, name: line, optional: false })),
    );
  }
  refresh();
}

export async function deleteRecipe(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("recipes").delete().eq("id", id);
  refresh();
}

export async function toggleRecipeFavourite(id: string, isFavourite: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("recipes").update({ is_favourite: isFavourite }).eq("id", id);
  refresh();
}

/* --------------------------- Cook this dish --------------------------- */

/**
 * "Cook this" — log the meal to Nutrition and push everything missing onto the
 * shopping list in one action. Items already on the list are not duplicated.
 */
export async function cookRecipe(recipeId: string, missing: string[]) {
  const { supabase, user } = await requireUser();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("name, calories, protein_g")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return;

  if (missing.length) {
    const { data: existing } = await supabase
      .from("shopping_list_items")
      .select("name")
      .eq("checked", false);
    const already = new Set(((existing as { name: string }[]) ?? []).map((i) => i.name.trim().toLowerCase()));
    const rows = missing
      .map((n) => n.trim())
      .filter((n) => n && !already.has(n.toLowerCase()))
      .map((name) => ({ user_id: user.id, name, category: "recipe" }));
    if (rows.length) await supabase.from("shopping_list_items").insert(rows);
  }

  await supabase.from("nutrition_entries").insert({
    user_id: user.id,
    meal: "dinner",
    description: recipe.name,
    calories: recipe.calories ?? null,
    protein_g: recipe.protein_g ?? null,
  });

  revalidatePath("/dashboard/nutrition");
  refresh();
}

/** Add a single missing ingredient to the shopping list. */
export async function addMissingToShoppingList(names: string[]) {
  const { supabase, user } = await requireUser();
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return;

  const { data: existing } = await supabase.from("shopping_list_items").select("name").eq("checked", false);
  const already = new Set(((existing as { name: string }[]) ?? []).map((i) => i.name.trim().toLowerCase()));
  const rows = clean
    .filter((n) => !already.has(n.toLowerCase()))
    .map((name) => ({ user_id: user.id, name, category: "recipe" }));
  if (rows.length) await supabase.from("shopping_list_items").insert(rows);
  refresh();
}

/* ---------------------------- Generation ---------------------------- */

export type GenerateOutcome = {
  ok: boolean;
  reason: "ok" | "not_configured" | "empty_kitchen" | "failed";
  recipeName?: string;
};

const CHEF_SYSTEM = `You are the AI Chef inside LifeOS, cooking for a household in Hungary.

You are given exactly what is in their fridge, freezer and pantry right now, with any items that are about to expire called out. Design ONE real, genuinely appetising dish.

Rules:
- Build the dish around the expiring items first. Rescuing food is the whole point.
- Prefer ingredients they already have. You may require at most 3 ingredients they do not have, and only common ones (a spice, an onion, a stock cube).
- Basic seasonings (salt, pepper, oil, water) may be assumed and left out of the ingredient list.
- Steps must be specific and executable: real temperatures, real times, real pan sizes. No "cook until done".
- Keep it to a realistic weeknight scale unless the stock obviously suggests otherwise.
- calories and protein_g are per serving, and should be honest estimates for the dish as written.

Reply with ONLY a JSON object, no markdown fence, no prose:
{"name":"...","description":"one sentence","cuisine":"Hungarian","minutes":35,"servings":2,"calories":540,"protein_g":38,"ingredients":[{"name":"chicken thigh","quantity":"400 g","optional":false}],"steps":["...","..."]}`;

type GeneratedRecipe = {
  name: string;
  description?: unknown;
  cuisine?: unknown;
  minutes?: unknown;
  servings?: unknown;
  calories?: unknown;
  protein_g?: unknown;
  ingredients?: unknown;
  steps?: unknown;
};

function unfence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function parseRecipe(raw: string | null): GeneratedRecipe | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(unfence(raw));
  } catch {
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
  const obj = data as GeneratedRecipe;
  return typeof obj.name === "string" && obj.name.trim() ? obj : null;
}

const int = (v: unknown, fallback: number | null): number | null => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Generate a recipe from what's actually in the kitchen and save it.
 *
 * `craving` is an optional free-text steer ("something quick", "vegetarian",
 * "use the paprika") — the pantry brief is always sent regardless, so the
 * result stays grounded in real stock.
 */
export async function generateRecipe(craving?: string): Promise<GenerateOutcome> {
  if (!isAnthropicConfigured()) return { ok: false, reason: "not_configured" };

  const { supabase, user } = await requireUser();
  const { data: items } = await supabase.from("kitchen_items").select("*");
  const stock = (items as KitchenItem[]) ?? [];
  if (!stock.length) return { ok: false, reason: "empty_kitchen" };

  const brief = pantryBrief(stock);
  const steer = craving?.trim() ? `\nThe cook is in the mood for: ${craving.trim()}` : "";
  const raw = await askClaude(CHEF_SYSTEM, `${brief}${steer}`, 1400);
  const parsed = parseRecipe(raw);
  if (!parsed) return { ok: false, reason: "failed" };

  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
    : [];

  const { data: recipe } = await supabase
    .from("recipes")
    .insert({
      user_id: user.id,
      name: parsed.name.trim(),
      description: typeof parsed.description === "string" ? parsed.description.trim() || null : null,
      cuisine: typeof parsed.cuisine === "string" ? parsed.cuisine.trim() || null : null,
      steps,
      minutes: int(parsed.minutes, null),
      servings: int(parsed.servings, 2) ?? 2,
      calories: int(parsed.calories, null),
      protein_g: int(parsed.protein_g, null),
    })
    .select("id")
    .single();

  if (!recipe) return { ok: false, reason: "failed" };

  if (Array.isArray(parsed.ingredients)) {
    const rows = parsed.ingredients
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const i = raw as Record<string, unknown>;
        const name = typeof i.name === "string" ? i.name.trim() : "";
        if (!name) return null;
        return {
          recipe_id: recipe.id,
          name,
          quantity: typeof i.quantity === "string" ? i.quantity.trim() || null : null,
          optional: i.optional === true,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (rows.length) await supabase.from("recipe_ingredients").insert(rows);
  }

  refresh();
  return { ok: true, reason: "ok", recipeName: parsed.name.trim() };
}
