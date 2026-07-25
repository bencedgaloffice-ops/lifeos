"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ChefHat,
  Sparkles,
  Clock,
  Users,
  Flame,
  Star,
  Trash2,
  Plus,
  ShoppingCart,
  AlertTriangle,
  Check,
  ChevronDown,
  Shuffle,
} from "lucide-react";
import type { KitchenItem, Recipe, RecipeIngredient } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, EmptyState, Field, inputClass } from "@/components/dashboard/ui";
import { rankRecipes, expiringSoon, daysUntilExpiry, missingNames, type RecipeMatch } from "@/lib/kitchen/chef";
import {
  generateRecipe,
  deleteRecipe,
  toggleRecipeFavourite,
  cookRecipe,
  addMissingToShoppingList,
  createRecipe,
} from "@/app/dashboard/kitchen/chef-actions";

/**
 * AI Chef — what can I cook tonight, and what's about to go off?
 *
 * Ranking is done client-side by lib/kitchen/chef.ts against the real kitchen
 * inventory, so the "cookable now" badge is arithmetic, never a model's
 * opinion. The model only writes new recipes.
 */
export function AIChef({
  items,
  recipes,
  ingredients,
}: {
  items: KitchenItem[];
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [craving, setCraving] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [cooked, setCooked] = useState<Set<string>>(new Set());

  const matches = useMemo(() => rankRecipes(recipes, ingredients, items), [recipes, ingredients, items]);
  const urgent = useMemo(() => expiringSoon(items, 5), [items]);
  const cookableCount = matches.filter((m) => m.cookableNow).length;

  async function handleGenerate() {
    setStatus(null);
    const res = await generateRecipe(craving);
    if (res.ok) {
      setStatus(t("kitchen.chefGenerated", { name: res.recipeName ?? "" }));
      setCraving("");
    } else {
      setStatus(
        res.reason === "not_configured"
          ? t("kitchen.chefNotConfigured")
          : res.reason === "empty_kitchen"
            ? t("kitchen.chefEmptyKitchen")
            : t("kitchen.chefFailed"),
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- Brief: what's about to expire ---- */}
      <Panel accent="kitchen">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ChefHat className="h-4 w-4 text-orange-300" /> {t("kitchen.chefTitle")}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              {items.length === 0
                ? t("kitchen.chefEmptyKitchen")
                : urgent.length > 0
                  ? t("kitchen.chefUrgent", { n: urgent.length, cookable: cookableCount })
                  : t("kitchen.chefCalm", { cookable: cookableCount })}
            </p>
            {urgent.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {urgent.slice(0, 8).map((i) => {
                  const d = daysUntilExpiry(i);
                  const bad = d !== null && d <= 1;
                  return (
                    <li
                      key={i.id}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] ${
                        bad
                          ? "border-red-400/30 bg-red-500/10 text-red-200/90"
                          : "border-amber-300/25 bg-amber-400/10 text-amber-100/85"
                      }`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {i.name}
                      <span className="opacity-60">
                        {d !== null && d < 0 ? t("kitchen.chefExpired") : t("kitchen.chefDaysLeft", { n: d ?? 0 })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ---- Generate ---- */}
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Field label={t("kitchen.chefCraving")}>
              <input
                value={craving}
                onChange={(e) => setCraving(e.target.value)}
                placeholder={t("kitchen.chefCravingPlaceholder")}
                className={inputClass}
              />
            </Field>
          </div>
          <button
            onClick={() => startTransition(handleGenerate)}
            disabled={pending || items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/90 px-4 py-2 text-xs font-semibold text-black transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {pending ? t("kitchen.chefThinking") : t("kitchen.chefGenerate")}
          </button>
          <button
            onClick={() => setManualOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3.5 py-2 text-xs text-white/70 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("kitchen.chefManual")}
          </button>
        </div>
        {status && <p className="mt-2 text-xs text-white/55">{status}</p>}

        {manualOpen && (
          <form
            action={(fd) => {
              startTransition(() => createRecipe(fd));
              setManualOpen(false);
            }}
            className="mt-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("kitchen.chefName")}>
              <input name="name" required className={inputClass} />
            </Field>
            <Field label={t("kitchen.chefCuisine")}>
              <input name="cuisine" placeholder="Hungarian" className={inputClass} />
            </Field>
            <Field label={t("kitchen.chefMinutes")}>
              <input name="minutes" type="number" min="1" className={inputClass} />
            </Field>
            <Field label={t("kitchen.chefServings")}>
              <input name="servings" type="number" min="1" defaultValue={2} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("kitchen.chefIngredientsLabel")}>
                <textarea name="ingredients" rows={4} placeholder={t("kitchen.chefOnePerLine")} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("kitchen.chefStepsLabel")}>
                <textarea name="steps" rows={4} placeholder={t("kitchen.chefOnePerLine")} className={inputClass} />
              </Field>
            </div>
            <button className="justify-self-start rounded-xl bg-white px-4 py-2 text-xs font-medium text-black sm:col-span-2">
              {t("kitchen.save")}
            </button>
          </form>
        )}
      </Panel>

      {/* ---- Ranked recipes ---- */}
      {matches.length === 0 ? (
        <Panel>
          <EmptyState icon={ChefHat} title={t("kitchen.chefNoRecipes")} hint={t("kitchen.chefNoRecipesHint")} />
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {matches.map((m) => (
            <RecipeCard
              key={m.recipe.id}
              match={m}
              open={expanded === m.recipe.id}
              onToggle={() => setExpanded(expanded === m.recipe.id ? null : m.recipe.id)}
              cooked={cooked.has(m.recipe.id)}
              onCooked={() => setCooked((prev) => new Set(prev).add(m.recipe.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({
  match,
  open,
  onToggle,
  cooked,
  onCooked,
}: {
  match: RecipeMatch;
  open: boolean;
  onToggle: () => void;
  cooked: boolean;
  onCooked: () => void;
}) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const { recipe, have, missing, coverage, cookableNow, usesExpiring } = match;

  async function handleCook() {
    await cookRecipe(recipe.id, missingNames(match));
    onCooked();
  }

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        cookableNow ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-hairline bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 truncate text-sm font-semibold text-white/90">
            {recipe.name}
            {recipe.is_favourite && <Star className="h-3.5 w-3.5 flex-none fill-amber-300 text-amber-300" />}
          </h4>
          {recipe.description && <p className="mt-1 text-xs leading-relaxed text-white/50">{recipe.description}</p>}
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            onClick={() => startTransition(() => toggleRecipeFavourite(recipe.id, !recipe.is_favourite))}
            className="text-white/25 transition-colors hover:text-amber-300"
            aria-label="Favourite"
          >
            <Star className={`h-3.5 w-3.5 ${recipe.is_favourite ? "fill-amber-300 text-amber-300" : ""}`} />
          </button>
          <button
            onClick={() => startTransition(() => deleteRecipe(recipe.id))}
            className="text-white/20 transition-colors hover:text-red-300"
            aria-label="Delete recipe"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* meta */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-white/45">
        {recipe.minutes && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {recipe.minutes} {t("kitchen.chefMin")}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" /> {recipe.servings}
        </span>
        {recipe.calories && (
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3 w-3" /> {recipe.calories} kcal
          </span>
        )}
        {recipe.cuisine && <span>{recipe.cuisine}</span>}
      </div>

      {/* coverage bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[0.65rem]">
          <span className={cookableNow ? "text-emerald-300" : "text-white/45"}>
            {cookableNow
              ? t("kitchen.chefCookNow")
              : t("kitchen.chefMissingN", { n: missing.length, have: have.length, total: have.length + missing.length })}
          </span>
          <span className="font-mono tabular-nums text-white/35">{Math.round(coverage * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className={`h-full rounded-full ${cookableNow ? "bg-emerald-400/80" : "bg-orange-400/70"}`}
            style={{ width: `${Math.round(coverage * 100)}%` }}
          />
        </div>
      </div>

      {usesExpiring.length > 0 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/[0.07] p-2 text-[0.68rem] leading-relaxed text-amber-100/85">
          <Sparkles className="mt-0.5 h-3 w-3 flex-none" />
          {t("kitchen.chefRescues", { items: usesExpiring.map((i) => i.name).join(", ") })}
        </p>
      )}

      {/* actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => startTransition(handleCook)}
          disabled={cooked}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-1.5 text-[0.7rem] font-semibold text-black disabled:opacity-45"
        >
          {cooked ? <Check className="h-3 w-3" /> : <ChefHat className="h-3 w-3" />}
          {cooked ? t("kitchen.chefCooked") : t("kitchen.chefCookThis")}
        </button>
        {missing.length > 0 && (
          <button
            onClick={() => startTransition(() => addMissingToShoppingList(missingNames(match)))}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-[0.7rem] text-white/70 hover:text-white"
          >
            <ShoppingCart className="h-3 w-3" /> {t("kitchen.chefAddMissing", { n: missing.length })}
          </button>
        )}
        <button
          onClick={onToggle}
          className="ml-auto inline-flex items-center gap-1 text-[0.7rem] text-white/45 hover:text-white/80"
        >
          {open ? t("kitchen.chefHide") : t("kitchen.chefRecipe")}
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-hairline pt-3">
          <div>
            <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-white/35">
              {t("kitchen.chefIngredientsLabel")}
            </p>
            <ul className="space-y-1">
              {match.ingredients.map((im) => (
                <li key={im.ingredient.id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      im.stockItem ? (im.substituted ? "bg-amber-300" : "bg-emerald-400") : "bg-white/20"
                    }`}
                  />
                  <span className={im.stockItem ? "text-white/80" : "text-white/40"}>{im.ingredient.name}</span>
                  {im.ingredient.quantity && (
                    <span className="font-mono text-[0.65rem] text-white/35">{im.ingredient.quantity}</span>
                  )}
                  {im.ingredient.optional && <span className="text-[0.6rem] text-white/25">{t("kitchen.chefOptional")}</span>}
                  {im.substituted && im.stockItem && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[0.62rem] text-amber-200/75">
                      <Shuffle className="h-2.5 w-2.5" /> {im.stockItem.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {recipe.steps.length > 0 && (
            <div>
              <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-white/35">
                {t("kitchen.chefStepsLabel")}
              </p>
              <ol className="space-y-1.5">
                {recipe.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-white/65">
                    <span className="flex-none font-mono text-[0.65rem] text-orange-300/70">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
