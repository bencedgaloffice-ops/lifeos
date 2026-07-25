"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ShoppingBag,
  Store as StoreIcon,
  TrendingDown,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Search,
  Route,
  Bot,
} from "lucide-react";
import type { Store, StorePrice, ShoppingListItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, EmptyState, Field, inputClass } from "@/components/dashboard/ui";
import {
  buildPriceIndex,
  assignItems,
  planRuns,
  totalSaving,
  bestStoreAdvice,
  singleStoreTotals,
  huf,
  STORE_HINTS,
} from "@/lib/kitchen/stores";
import { recordStorePrice, deleteStorePrice, setShoppingItemStore, applyStorePlan } from "@/app/dashboard/kitchen/actions";
import {
  researchItemPrices,
  researchShoppingList,
  confirmEstimate,
  clearEstimates,
  type ResearchOutcome,
} from "@/app/dashboard/kitchen/research-actions";
import { StoreLogo } from "./StoreLogo";

/**
 * Smart Shopping — Hungarian grocery intelligence.
 *
 * Splits the shopping list across METRO / Tesco / Auchan / Lidl / ALDI / SPAR /
 * Penny based on prices the user has actually recorded, shows what each run
 * costs, and how much the split saves versus buying everything at the priciest
 * option. Nothing is scraped or invented: an item is only assigned once there
 * is a real observed price for it.
 */
export function SmartShopping({
  stores,
  prices,
  shoppingList,
}: {
  stores: Store[];
  prices: StorePrice[];
  shoppingList: ShoppingListItem[];
}) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [researchNote, setResearchNote] = useState<string | null>(null);

  const outstanding = useMemo(() => shoppingList.filter((i) => !i.checked), [shoppingList]);
  const priceIndex = useMemo(() => buildPriceIndex(prices), [prices]);
  const assignments = useMemo(() => assignItems(outstanding, priceIndex), [outstanding, priceIndex]);
  const { runs, unassigned } = useMemo(() => planRuns(assignments, stores), [assignments, stores]);
  const saving = useMemo(() => totalSaving(assignments), [assignments]);
  const advice = useMemo(() => bestStoreAdvice(runs), [runs]);
  const grandTotal = useMemo(() => runs.reduce((s, r) => s + r.subtotal, 0), [runs]);
  const oneTrip = useMemo(() => singleStoreTotals(outstanding, priceIndex, stores), [outstanding, priceIndex, stores]);
  const anyEstimates = useMemo(() => prices.some((p) => p.source === "ai_estimate"), [prices]);

  /** Turn a research outcome into one translated line of feedback. */
  function describe(res: ResearchOutcome): string {
    if (res.ok) {
      const items = res.results.filter((r) => r.count > 0).length;
      const chains = res.results.reduce((s, r) => s + r.count, 0);
      return t("kitchen.researchDone", { items, chains });
    }
    if (res.reason === "not_configured") return t("kitchen.researchNotConfigured");
    if (res.reason === "no_stores") return t("kitchen.researchNoStores");
    if (res.reason === "unresearchable") return t("kitchen.researchUnclear");
    return t("kitchen.researchNothing");
  }

  async function runResearch(key: string, fn: () => Promise<ResearchOutcome>) {
    setBusy(key);
    setResearchNote(null);
    try {
      setResearchNote(describe(await fn()));
    } finally {
      setBusy(null);
    }
  }

  const planToApply = useMemo(
    () =>
      assignments
        .filter((a) => a.storeId && !a.item.store_id)
        .map((a) => ({ itemId: a.item.id, storeId: a.storeId! })),
    [assignments],
  );

  return (
    <div className="space-y-4">
      {/* ---- Jarvis headline ---- */}
      <Panel accent="kitchen">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="h-4 w-4 text-orange-300" /> {t("kitchen.smartShoppingTitle")}
            </h3>
            {outstanding.length === 0 ? (
              <p className="mt-2 text-xs text-white/45">{t("kitchen.smartShoppingEmpty")}</p>
            ) : advice ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-white/65">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-orange-300" />
                <span>
                  {t("kitchen.storeAdvice", { store: advice.store.name, n: advice.itemCount })}
                  {saving > 0 && <> {t("kitchen.storeSaving", { amount: huf(saving, locale) })}</>}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-white/45">{t("kitchen.noPricesYet")}</p>
            )}
          </div>
          {grandTotal > 0 && (
            <div className="text-right">
              <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/40">{t("kitchen.basketTotal")}</p>
              <p className="font-mono text-lg font-semibold tabular-nums text-white">{huf(grandTotal, locale)}</p>
              {saving > 0 && (
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.7rem] text-emerald-300">
                  <TrendingDown className="h-3 w-3" /> {huf(saving, locale)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {planToApply.length > 0 && (
            <button
              onClick={() => startTransition(() => applyStorePlan(planToApply))}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-400/90 px-4 py-2 text-xs font-semibold text-black transition-transform hover:-translate-y-0.5"
            >
              <Check className="h-3.5 w-3.5" /> {t("kitchen.applyPlan", { n: planToApply.length })}
            </button>
          )}
          {outstanding.length > 0 && (
            <button
              onClick={() => runResearch("all", researchShoppingList)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-300/30 bg-orange-400/10 px-4 py-2 text-xs font-semibold text-orange-100 transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <Search className="h-3.5 w-3.5" />
              {busy === "all" ? t("kitchen.researching") : t("kitchen.researchAll")}
            </button>
          )}
          {anyEstimates && (
            <button
              onClick={() => startTransition(() => clearEstimates())}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-2 text-[0.7rem] text-white/55 hover:text-white"
            >
              <Trash2 className="h-3 w-3" /> {t("kitchen.clearEstimates")}
            </button>
          )}
        </div>

        {researchNote && <p className="mt-2.5 text-xs text-white/55">{researchNote}</p>}
        {anyEstimates && (
          <p className="mt-2 flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-white/35">
            <Bot className="mt-0.5 h-3 w-3 flex-none" /> {t("kitchen.estimateDisclaimer")}
          </p>
        )}
      </Panel>

      {/* ---- One trip vs. split shop: where is it cheapest in total? ---- */}
      {oneTrip.length > 0 && (
        <Panel>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Route className="h-4 w-4 text-orange-300" /> {t("kitchen.oneTripTitle")}
          </h3>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-white/45">
            {t("kitchen.oneTripHint", { total: huf(grandTotal, locale) })}
          </p>
          <div className="space-y-1.5">
            {oneTrip.map((r, i) => {
              const best = i === 0;
              const width = Math.round((r.covered / outstanding.length) * 100);
              return (
                <div
                  key={r.store.id}
                  className={`rounded-xl border p-3 ${
                    best ? "border-emerald-400/25 bg-emerald-400/[0.04]" : "border-hairline bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <StoreLogo slug={r.store.slug} className="h-6 w-[66px]" />
                    <span className="text-[0.68rem] text-white/40">
                      {t("kitchen.oneTripCovers", { covered: r.covered, total: outstanding.length })}
                    </span>
                    {!r.confident && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.6rem] text-white/40">
                        <Bot className="h-2.5 w-2.5" /> {t("kitchen.estimateBadge")}
                      </span>
                    )}
                    <span className="ml-auto font-mono text-sm tabular-nums text-white/80">{huf(r.total, locale)}</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full ${best ? "bg-emerald-400/70" : "bg-white/20"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  {r.missing.length > 0 && (
                    <p className="mt-1.5 truncate text-[0.62rem] text-white/30">
                      {t("kitchen.oneTripMissing", { items: r.missing.join(", ") })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ---- One card per store run ---- */}
      {runs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((run) => (
            <div key={run.store.id} className="rounded-2xl border border-hairline bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <StoreLogo slug={run.store.slug} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.65rem] leading-snug text-white/40">
                    {STORE_HINTS[run.store.slug] ?? run.store.strengths ?? ""}
                  </p>
                </div>
                <span className="flex-none font-mono text-xs tabular-nums text-white/70">{huf(run.subtotal, locale)}</span>
              </div>
              <ul className="space-y-1.5">
                {run.items.map((a) => (
                  <li key={a.item.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-white/80">{a.item.name}</span>
                    {a.aiEstimate && (
                      <span
                        className="inline-flex flex-none items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[0.58rem] text-white/40"
                        title={a.confidence != null ? t("kitchen.estimateConfidence", { n: a.confidence }) : undefined}
                      >
                        <Bot className="h-2.5 w-2.5" />
                        {a.confidence != null ? `${a.confidence}%` : t("kitchen.estimateBadge")}
                      </span>
                    )}
                    <span className={`flex-none font-mono tabular-nums ${a.estimated ? "text-white/30" : "text-white/55"}`}>
                      {a.price != null ? huf(a.price, locale) : "—"}
                    </span>
                    {a.aiEstimate && a.priceId && (
                      <button
                        onClick={() => startTransition(() => confirmEstimate(a.priceId!))}
                        title={t("kitchen.confirmEstimate")}
                        aria-label={t("kitchen.confirmEstimate")}
                        className="flex-none text-white/25 transition-colors hover:text-emerald-300"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ---- Items we have no price for yet ---- */}
      {unassigned.length > 0 && (
        <Panel>
          <h3 className="text-sm font-semibold">{t("kitchen.needPrices")}</h3>
          <p className="mt-1 mb-3 text-xs text-white/45">{t("kitchen.needPricesHint")}</p>
          <div className="divide-y divide-hairline">
            {unassigned.map((a) => (
              <div key={a.item.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-white/85">{a.item.name}</span>
                  <button
                    onClick={() => runResearch(a.item.id, () => researchItemPrices(a.item.name))}
                    disabled={busy !== null}
                    className="inline-flex flex-none items-center gap-1 rounded-full border border-orange-300/25 bg-orange-400/10 px-2.5 py-1 text-[0.7rem] text-orange-100/90 hover:bg-orange-400/15 disabled:opacity-40"
                  >
                    <Search className="h-3 w-3" />
                    {busy === a.item.id ? t("kitchen.researching") : t("kitchen.researchItem")}
                  </button>
                  <button
                    onClick={() => setAddingFor(addingFor === a.item.id ? null : a.item.id)}
                    className="inline-flex flex-none items-center gap-1 rounded-full glass px-2.5 py-1 text-[0.7rem] text-white/70 hover:text-white"
                  >
                    <Plus className="h-3 w-3" /> {t("kitchen.addPrice")}
                  </button>
                </div>

                {addingFor === a.item.id && (
                  <form
                    action={(fd) => {
                      fd.set("item_name", a.item.name);
                      startTransition(() => recordStorePrice(fd));
                      setAddingFor(null);
                    }}
                    className="mt-2 grid gap-2 rounded-xl bg-white/[0.03] p-3 sm:grid-cols-[1fr_7rem_6rem_auto]"
                  >
                    <Field label={t("kitchen.store")}>
                      <select name="store_id" required className={inputClass} defaultValue="">
                        <option value="" disabled className="bg-base">
                          {t("kitchen.choose")}
                        </option>
                        {stores.map((s) => (
                          <option key={s.id} value={s.id} className="bg-base">
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("kitchen.priceHuf")}>
                      <input name="price_huf" type="number" min="1" step="1" required placeholder="599" className={inputClass} />
                    </Field>
                    <Field label={t("kitchen.unit")}>
                      <input name="unit" placeholder="1 L" className={inputClass} />
                    </Field>
                    <button className="self-end rounded-xl bg-white px-3 py-2 text-xs font-medium text-black">
                      {t("kitchen.save")}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ---- The chains + recorded prices ---- */}
      <Panel>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StoreIcon className="h-4 w-4 text-accent-soft" /> {t("kitchen.storesTitle")}
        </h3>
        <p className="mt-1 mb-4 text-xs text-white/45">{t("kitchen.storesHint")}</p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {stores.map((s) => {
            const mine = prices.filter((p) => p.store_id === s.id);
            return (
              <div key={s.id} className="rounded-xl border border-hairline bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <StoreLogo slug={s.slug} className="h-6 w-[66px]" />
                  <span className="ml-auto text-[0.6rem] tracking-wide text-white/35">{"Ft".repeat(s.price_level)}</span>
                </div>
                <p className="mt-1.5 text-[0.65rem] leading-relaxed text-white/40">
                  {STORE_HINTS[s.slug] ?? s.strengths ?? ""}
                </p>
                <p className="mt-2 font-mono text-[0.65rem] text-white/30">
                  {t("kitchen.pricesRecorded", { n: mine.length })}
                </p>
              </div>
            );
          })}
        </div>

        {prices.length > 0 && (
          <div className="mt-4 divide-y divide-hairline border-t border-hairline pt-2">
            {prices.slice(0, 12).map((p) => {
              const store = stores.find((s) => s.id === p.store_id);
              return (
                <div key={p.id} className="group flex items-center gap-3 py-2 text-xs">
                  <StoreLogo slug={store?.slug ?? ""} className="h-5 w-[54px]" />
                  <span className="min-w-0 flex-1 truncate text-white/80">{p.item_name}</span>
                  {p.unit && <span className="flex-none text-white/30">{p.unit}</span>}
                  {p.source === "ai_estimate" && (
                    <span className="inline-flex flex-none items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[0.58rem] text-white/40">
                      <Bot className="h-2.5 w-2.5" /> {p.confidence != null ? `${p.confidence}%` : t("kitchen.estimateBadge")}
                    </span>
                  )}
                  <span
                    className={`flex-none font-mono tabular-nums ${
                      p.source === "ai_estimate" ? "text-white/35" : "text-white/70"
                    }`}
                  >
                    {huf(Number(p.price_huf), locale)}
                  </span>
                  {p.source === "ai_estimate" && (
                    <button
                      onClick={() => startTransition(() => confirmEstimate(p.id))}
                      title={t("kitchen.confirmEstimate")}
                      aria-label={t("kitchen.confirmEstimate")}
                      className="flex-none text-white/25 transition-colors hover:text-emerald-300"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => startTransition(() => deleteStorePrice(p.id))}
                    className="flex-none text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                    aria-label="Delete price"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {stores.length === 0 && <EmptyState icon={StoreIcon} title={t("kitchen.noStores")} hint={t("kitchen.noStoresHint")} />}
      </Panel>

      {/* ---- Manual override: pin an item to a chain ---- */}
      {outstanding.length > 0 && stores.length > 0 && (
        <Panel>
          <h3 className="text-sm font-semibold">{t("kitchen.pinTitle")}</h3>
          <p className="mt-1 mb-3 text-xs text-white/45">{t("kitchen.pinHint")}</p>
          <div className="divide-y divide-hairline">
            {outstanding.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-white/85">{item.name}</span>
                <select
                  value={item.store_id ?? ""}
                  onChange={(e) => startTransition(() => setShoppingItemStore(item.id, e.target.value || null))}
                  className="rounded-lg border border-hairline bg-white/[0.04] px-2 py-1 text-xs text-white/80"
                >
                  <option value="" className="bg-base">
                    {t("kitchen.auto")}
                  </option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id} className="bg-base">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
