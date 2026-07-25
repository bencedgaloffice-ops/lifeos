"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ChefHat,
  Snowflake,
  Archive,
  Refrigerator,
  ShoppingCart,
  Plus,
  Trash2,
  Mail,
  Sparkles,
  Check,
} from "lucide-react";
import type { KitchenItem, ShoppingListItem, Store, StorePrice, MusicStation, Recipe, RecipeIngredient } from "@/lib/types";
import type { SuggestedMeal } from "@/app/dashboard/kitchen/suggestions";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Pill, EmptyState, Field, inputClass, Segmented } from "@/components/dashboard/ui";
import { Kitchen3DCanvas, type KitchenObject } from "@/components/three/Kitchen3DCanvas";
import { SmartShopping } from "@/components/dashboard/kitchen/SmartShopping";
import { KitchenMusic } from "@/components/dashboard/kitchen/KitchenMusic";
import { AIChef } from "@/components/dashboard/kitchen/AIChef";
import {
  createKitchenItem,
  deleteKitchenItem,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  logSuggestedMeal,
} from "@/app/dashboard/kitchen/actions";

type Props = {
  items: KitchenItem[];
  shoppingList: ShoppingListItem[];
  suggestions: SuggestedMeal[];
  stores: Store[];
  prices: StorePrice[];
  stations: MusicStation[];
  recipes: Recipe[];
  recipeIngredients: RecipeIngredient[];
};

const locationIcons = { fridge: Refrigerator, pantry: Archive, freezer: Snowflake } as const;

// Using the hand-built kitchen (fully animated). To load an imported GLB
// instead, drop it at public/models/modern-kitchen.glb and set this to that
// path — the loader + fallback are already wired (see KitchenModel.tsx).
const KITCHEN_MODEL_URL: string | null = null;

/** Soonest-expiring first — mirrors how the 3D shelves are ordered. */
function byExpiry(items: KitchenItem[]): KitchenItem[] {
  const d = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);
  return [...items].sort((a, b) => d(a.expires_at) - d(b.expires_at));
}

/** How many items are within 3 days of expiring. */
function expiringSoon(items: KitchenItem[]): number {
  return items.filter((i) => i.expires_at && (new Date(i.expires_at).getTime() - Date.now()) / 86_400_000 <= 3).length;
}

function expiryTone(dateStr: string | null): "amber" | null {
  if (!dateStr) return null;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86_400_000;
  return days <= 3 ? "amber" : null;
}

export function KitchenModule({
  items,
  shoppingList,
  suggestions,
  stores,
  prices,
  stations,
  recipes,
  recipeIngredients,
}: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [openItem, setOpenItem] = useState<null | "fridge" | "pantry" | "freezer">(null);
  const [openList, setOpenList] = useState(false);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"world" | "manager" | "chef" | "shopping" | "music">("world");
  // Start with nothing selected so the page opens on the wide room view —
  // selecting an object flies the camera to it, which would otherwise hide
  // the whole kitchen behind a close-up on first load.
  const [selected, setSelected] = useState<KitchenObject | null>(null);

  const objectLabels: Record<KitchenObject, string> = {
    fridge: t("kitchen.fridge"),
    freezer: t("kitchen.freezer"),
    pantry: t("kitchen.pantry"),
    island: t("kitchen.objIsland"),
    oven: t("kitchen.objOven"),
    sink: t("kitchen.objSink"),
  };

  const controlLabels = {
    lights: t("kitchen.ctrlLights"),
    day: t("kitchen.ctrlDay"),
    night: t("kitchen.ctrlNight"),
    water: t("kitchen.ctrlWater"),
    stove: t("kitchen.ctrlStove"),
    oven: t("kitchen.ctrlOven"),
  };

  const grouped = useMemo(() => {
    const g: Record<"fridge" | "pantry" | "freezer", KitchenItem[]> = { fridge: [], pantry: [], freezer: [] };
    items.forEach((i) => g[i.location].push(i));
    return g;
  }, [items]);

  const mailtoHref = useMemo(() => {
    const unchecked = shoppingList.filter((i) => !i.checked);
    const checked = shoppingList.filter((i) => i.checked);
    const lines = [
      ...unchecked.map((i) => `☐ ${i.name}${i.quantity ? ` (${i.quantity})` : ""}`),
      ...(checked.length ? ["", "— Already have —", ...checked.map((i) => `☑ ${i.name}`)] : []),
    ];
    const body = encodeURIComponent(lines.join("\n") || "");
    return `mailto:?subject=${encodeURIComponent("LifeOS Shopping List")}&body=${body}`;
  }, [shoppingList]);

  async function handleLogMeal(meal: SuggestedMeal) {
    await logSuggestedMeal({ name: meal.name, calories: meal.calories, proteinG: meal.proteinG });
    setLogged((prev) => new Set(prev).add(meal.id));
  }

  const toggle = (
    <Segmented
      value={view}
      onChange={setView}
      options={[
        { value: "world", label: t("kitchen.viewWorld") },
        { value: "manager", label: t("kitchen.viewManager") },
        { value: "chef", label: t("kitchen.viewChef") },
        { value: "shopping", label: t("kitchen.viewShopping") },
        { value: "music", label: t("kitchen.viewMusic") },
      ]}
    />
  );

  // World view is a full-bleed, immersive page — it breaks out of the
  // dashboard's content padding and fills the viewport below the topbar.
  if (view === "world") {
    return (
      <div className="relative -mx-5 -my-7 h-[calc(100dvh-73px)] overflow-hidden bg-black sm:-mx-8 sm:-my-9">
        <div className="absolute inset-0">
          <Kitchen3DCanvas selected={selected} onSelect={(k) => setSelected((cur) => (cur === k ? null : k))} onDeselect={() => setSelected(null)} labels={objectLabels} controls={controlLabels} inventory={grouped} modelUrl={KITCHEN_MODEL_URL} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-5 sm:p-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{t("kitchen.title")}</h1>
            <p className="mt-1 text-[0.6rem] uppercase tracking-[0.25em] text-white/45">{t("kitchen.worldHint")}</p>
          </div>
          <div className="pointer-events-auto">{toggle}</div>
        </div>
        {selected && (
            <div className="absolute right-3 top-24 z-20 max-h-[calc(100%-7rem)] w-72 overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white/90">{objectLabels[selected]}</p>
                <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white">✕</button>
              </div>
              {(selected === "fridge" || selected === "freezer" || selected === "pantry") ? (
                grouped[selected].length === 0 ? (
                  <p className="text-xs text-white/45">{t("kitchen.noItems")}</p>
                ) : (
                  <ul className="space-y-2">
                    {expiringSoon(grouped[selected]) > 0 && (
                      <li className="mb-1 flex items-start gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/10 p-2.5 text-[0.7rem] leading-relaxed text-amber-100/90">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none" />
                        <span>{t("kitchen.jarvisOrganized", { n: expiringSoon(grouped[selected]) })}</span>
                      </li>
                    )}
                    {byExpiry(grouped[selected]).map((it) => (
                      <li key={it.id} className="rounded-xl bg-white/[0.04] p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/85">{it.name}</span>
                          {it.quantity && <span className="font-mono text-xs text-white/55">{it.quantity}</span>}
                        </div>
                        {it.expires_at && (
                          <p className="mt-0.5 text-[0.65rem] text-white/40">
                            {t("kitchen.expiresPrefix")} {formatDate(it.expires_at, undefined, locale)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : selected === "island" || selected === "oven" ? (
                suggestions.length === 0 ? (
                  <p className="text-xs text-white/45">{t("kitchen.jarvisNoPick")}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-orange-300/80">
                      <Sparkles className="h-3.5 w-3.5" /> {t("kitchen.jarvisPick")}
                    </p>
                    {suggestions.slice(0, 2).map((s) => (
                      <div key={s.id} className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-sm text-white/90">{s.name}</p>
                        <p className="mt-1 text-[0.7rem] text-white/50">
                          {s.calories} kcal · {s.proteinG}g {t("kitchen.protein")}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-xs leading-relaxed text-white/50">{t("kitchen.sinkDesc")}</p>
              )}
            </div>
          )}
      </div>
    );
  }

  if (view === "music") {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ModuleHeader icon={ChefHat} title={t("kitchen.title")} subtitle={t("kitchen.musicSubtitle")} accent="kitchen" />
          {toggle}
        </div>
        <div className="mt-4">
          <KitchenMusic stations={stations} />
        </div>
      </div>
    );
  }

  if (view === "chef") {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ModuleHeader icon={ChefHat} title={t("kitchen.title")} subtitle={t("kitchen.chefSubtitle")} accent="kitchen" />
          {toggle}
        </div>
        <div className="mt-4">
          <AIChef items={items} recipes={recipes} ingredients={recipeIngredients} />
        </div>
      </div>
    );
  }

  if (view === "shopping") {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ModuleHeader icon={ChefHat} title={t("kitchen.title")} subtitle={t("kitchen.smartShoppingSubtitle")} accent="kitchen" />
          {toggle}
        </div>
        <div className="mt-4">
          <SmartShopping stores={stores} prices={prices} shoppingList={shoppingList} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModuleHeader icon={ChefHat} title={t("kitchen.title")} subtitle={t("kitchen.subtitle")} accent="kitchen" />
        {toggle}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {(["fridge", "pantry", "freezer"] as const).map((loc) => {
          const Icon = locationIcons[loc];
          return (
            <Panel key={loc}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-accent-soft" /> {t(`kitchen.${loc}`)}
                </h3>
                <button
                  onClick={() => setOpenItem(openItem === loc ? null : loc)}
                  className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("kitchen.addItem")}
                </button>
              </div>

              {openItem === loc && (
                <form
                  action={(fd) => {
                    fd.set("location", loc);
                    startTransition(() => createKitchenItem(fd));
                    setOpenItem(null);
                  }}
                  className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4"
                >
                  <Field label={t("kitchen.formItemName")}>
                    <input name="name" required placeholder={t("kitchen.formItemNamePlaceholder")} className={inputClass} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("kitchen.formQuantity")}>
                      <input name="quantity" placeholder={t("kitchen.formQuantityPlaceholder")} className={inputClass} />
                    </Field>
                    <Field label={t("kitchen.formExpiresAt")}>
                      <input type="date" name="expires_at" className={inputClass} />
                    </Field>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
                      {t("kitchen.save")}
                    </button>
                    <button type="button" onClick={() => setOpenItem(null)} className="rounded-full glass px-4 py-2 text-sm text-white/70">
                      {t("kitchen.cancel")}
                    </button>
                  </div>
                </form>
              )}

              {grouped[loc].length === 0 ? (
                <EmptyState icon={Icon} title={t("kitchen.noItems")} hint={t("kitchen.noItemsHint")} />
              ) : (
                <div className="divide-y divide-hairline">
                  {grouped[loc].map((item) => {
                    const tone = expiryTone(item.expires_at);
                    return (
                      <div key={item.id} className="group flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                            {item.quantity && <span className="ml-1.5 text-white/40">· {item.quantity}</span>}
                          </p>
                          {item.expires_at && (
                            <p className="text-xs text-white/40">
                              {t("kitchen.expiresPrefix")} {formatDate(item.expires_at, undefined, locale)}
                            </p>
                          )}
                        </div>
                        {tone && (
                          <Pill tone={tone}>
                            {new Date(item.expires_at!) < new Date() ? t("kitchen.expired") : t("kitchen.expiringSoon")}
                          </Pill>
                        )}
                        <form action={() => startTransition(() => deleteKitchenItem(item.id))}>
                          <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        {/* Shopping list */}
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingCart className="h-4 w-4 text-accent-soft" /> {t("kitchen.shoppingListTitle")}
            </h3>
            <div className="flex items-center gap-2">
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" /> {t("kitchen.emailList")}
              </a>
              <button
                onClick={() => setOpenList((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" /> {t("kitchen.addToList")}
              </button>
            </div>
          </div>

          {openList && (
            <form
              action={(fd) => {
                startTransition(() => addShoppingItem(fd));
                setOpenList(false);
              }}
              className="mb-4 flex gap-2"
            >
              <input name="name" required placeholder={t("kitchen.formListName")} className={inputClass} />
              <select name="category" className={inputClass + " max-w-[9rem]"} defaultValue="">
                <option value="" className="bg-base">{t("kitchen.categories.other")}</option>
                <option value="vegetables" className="bg-base">{t("kitchen.categories.vegetables")}</option>
                <option value="fruit" className="bg-base">{t("kitchen.categories.fruit")}</option>
                <option value="meat" className="bg-base">{t("kitchen.categories.meat")}</option>
                <option value="dairy" className="bg-base">{t("kitchen.categories.dairy")}</option>
                <option value="household" className="bg-base">{t("kitchen.categories.household")}</option>
              </select>
              <button className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-white" aria-label="Add">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          )}

          {shoppingList.length === 0 ? (
            <EmptyState icon={ShoppingCart} title={t("kitchen.noListItems")} hint={t("kitchen.noListItemsHint")} />
          ) : (
            <div className="divide-y divide-hairline">
              {shoppingList.map((item) => (
                <div key={item.id} className="group flex items-center gap-3 py-2.5">
                  <button
                    onClick={() => startTransition(() => toggleShoppingItem(item.id, !item.checked))}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      item.checked ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/25 text-transparent hover:border-white/50"
                    }`}
                    aria-label="Toggle"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <span className={`flex-1 truncate text-sm ${item.checked ? "text-white/35 line-through" : "text-white/85"}`}>
                    {item.name}
                  </span>
                  {item.category && <Pill tone="neutral">{t(`kitchen.categories.${item.category}`)}</Pill>}
                  <form action={() => startTransition(() => deleteShoppingItem(item.id))}>
                    <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Suggested meals */}
        <Panel className="lg:col-span-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent-soft" /> {t("kitchen.suggestedMealsTitle")}
          </h3>
          <p className="mt-1 mb-4 text-xs text-white/40">{t("kitchen.suggestedMealsHint")}</p>

          {suggestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">{t("kitchen.noSuggestions")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestions.map((meal, i) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="rounded-2xl bg-white/[0.03] p-4"
                >
                  <p className="text-sm font-semibold tracking-tight">{meal.name}</p>
                  <ol className="mt-2 space-y-1">
                    {meal.steps.map((s, si) => (
                      <li key={si} className="flex gap-1.5 text-xs leading-relaxed text-white/50">
                        <span className="text-accent-soft">{si + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                    <span>{meal.calories} kcal · {meal.proteinG}g protein</span>
                    <span>${meal.estimatedCost.toFixed(0)}</span>
                  </div>
                  <button
                    onClick={() => handleLogMeal(meal)}
                    disabled={logged.has(meal.id)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-black transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {logged.has(meal.id) ? <Check className="h-3.5 w-3.5" /> : null}
                    {logged.has(meal.id) ? t("kitchen.logged") : t("kitchen.logThisMeal")}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
