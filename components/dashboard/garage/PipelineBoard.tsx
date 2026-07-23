"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Trash2, Sparkles, Car, CheckCircle2, Plus, X } from "lucide-react";
import type { GarageDealStage, GarageImportDeal } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Field, inputClass, Numeral, Panel } from "@/components/dashboard/ui";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { spotlight, carbonWeave } from "./carbon";
import { moveDealStage, deleteImportDeal, markDealSold } from "@/app/dashboard/business/garage/actions";

const ACCENT = "#9BB0C4";

const STAGES: GarageDealStage[] = ["found", "inspection", "purchase", "transport", "registration", "ready_for_sale", "sold"];

function dealMath(deal: Pick<GarageImportDeal, "purchase_price" | "transport_cost" | "registration_cost" | "repair_cost" | "expected_selling_price">) {
  const investment = Number(deal.purchase_price) + Number(deal.transport_cost) + Number(deal.registration_cost) + Number(deal.repair_cost);
  const profit = Number(deal.expected_selling_price) - investment;
  const roi = investment > 0 ? (profit / investment) * 100 : 0;
  return { investment, profit, roi };
}

export function PipelineBoard({ deals, currency }: { deals: GarageImportDeal[]; currency: string }) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const byStage = useMemo(() => {
    const map: Record<GarageDealStage, GarageImportDeal[]> = { found: [], inspection: [], purchase: [], transport: [], registration: [], ready_for_sale: [], sold: [] };
    for (const d of deals) map[d.stage].push(d);
    return map;
  }, [deals]);

  const totals = useMemo(() => {
    const active = deals.filter((d) => d.stage !== "sold");
    const profitPotential = active.reduce((s, d) => s + dealMath(d).profit, 0);
    const soldDeals = deals.filter((d) => d.stage === "sold");
    const realizedProfit = soldDeals
      .filter((d) => d.actual_selling_price !== null)
      .reduce((s, d) => s + (Number(d.actual_selling_price) - dealMath(d).investment), 0);
    return { activeCount: active.length, profitPotential, soldCount: soldDeals.length, realizedProfit };
  }, [deals]);

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Panel className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.activeDeals")}</p>
          <Numeral className="mt-1 block text-xl font-semibold text-white">{totals.activeCount}</Numeral>
        </Panel>
        <Panel className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.projectedProfit")}</p>
          <Numeral className="mt-1 block text-xl font-semibold" style={{ color: ACCENT }}>{fc(totals.profitPotential)}</Numeral>
        </Panel>
        <Panel className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.sold")}</p>
          <Numeral className="mt-1 block text-xl font-semibold text-white">{totals.soldCount}</Numeral>
        </Panel>
        <Panel className="p-4">
          <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.realizedProfit")}</p>
          <Numeral className="mt-1 block text-xl font-semibold text-emerald-300">{fc(totals.realizedProfit)}</Numeral>
        </Panel>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div key={stage} className="w-72 shrink-0">
            <p className="mb-2 flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-white/45">
              {t(`garage.stage.${stage}`)}
              <span className="text-white/25">{byStage[stage].length}</span>
            </p>
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {byStage[stage].map((deal) => (
                  <DealCard key={deal.id} deal={deal} currency={currency} isFirst={stage === STAGES[0]} isLast={stage === "sold"} />
                ))}
              </AnimatePresence>
              {byStage[stage].length === 0 && <div className="rounded-2xl border border-dashed border-hairline px-3 py-6 text-center text-xs text-white/25">{t("garage.stageEmpty")}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal, currency, isFirst, isLast }: { deal: GarageImportDeal; currency: string; isFirst: boolean; isLast: boolean }) {
  const { t, locale } = useLocale();
  const { runText } = useJarvis();
  const [, startTransition] = useTransition();
  const [soldForm, setSoldForm] = useState(false);
  const fc = (n: number) => formatCurrency(n, currency, { locale });
  const { investment, profit, roi } = dealMath(deal);
  const realized = deal.actual_selling_price !== null ? Number(deal.actual_selling_price) - investment : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-hairline bg-white/[0.02]"
    >
      <div className="relative h-20 w-full overflow-hidden">
        {deal.image_url ? (
          <img src={deal.image_url} alt={`${deal.brand} ${deal.model}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={carbonWeave}>
            <Car className="h-6 w-6 text-white/15" strokeWidth={1.25} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0" style={spotlight(ACCENT, 0.3)} />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white/90">
          {deal.brand} {deal.model} {deal.year ? <span className="text-white/40">· {deal.year}</span> : null}
        </p>

        {deal.stage === "sold" ? (
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between text-white/50"><span>{t("garage.investment")}</span><Numeral>{fc(investment)}</Numeral></div>
            {deal.actual_selling_price !== null ? (
              <div className="flex justify-between font-medium text-emerald-300"><span>{t("garage.realizedProfit")}</span><Numeral>{fc(realized ?? 0)}</Numeral></div>
            ) : soldForm ? (
              <form
                action={(fd) => {
                  startTransition(() => markDealSold(deal.id, fd));
                  setSoldForm(false);
                }}
                className="flex items-center gap-1.5"
              >
                <input name="actual_selling_price" type="number" placeholder={t("garage.formActualPrice")} required className={inputClass + " py-1 text-xs"} />
                <button type="submit" className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
              </form>
            ) : (
              <button onClick={() => setSoldForm(true)} className="mt-1 flex items-center gap-1 text-white/40 hover:text-white/70">
                <CheckCircle2 className="h-3 w-3" /> {t("garage.recordSalePrice")}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[0.65rem]">
            <div>
              <p className="text-white/35">{t("garage.investment")}</p>
              <Numeral className="text-white/75">{fc(investment)}</Numeral>
            </div>
            <div>
              <p className="text-white/35">{t("garage.profit")}</p>
              <Numeral className={profit >= 0 ? "text-emerald-300" : "text-red-300"}>{fc(profit)}</Numeral>
            </div>
            <div>
              <p className="text-white/35">ROI</p>
              <Numeral className={roi >= 0 ? "text-emerald-300" : "text-red-300"}>{roi.toFixed(0)}%</Numeral>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex gap-1">
            {!isFirst && (
              <button onClick={() => startTransition(() => moveDealStage(deal.id, "back"))} className="flex h-6 w-6 items-center justify-center rounded-full glass text-white/50 hover:text-white">
                <ArrowLeft className="h-3 w-3" />
              </button>
            )}
            {!isLast && (
              <button onClick={() => startTransition(() => moveDealStage(deal.id, "forward"))} className="flex h-6 w-6 items-center justify-center rounded-full glass text-white/50 hover:text-white">
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            <button onClick={() => runText(`analyze ${deal.brand} ${deal.model}`)} className="flex h-6 w-6 items-center justify-center rounded-full glass text-white/50 hover:text-white" title={t("garage.askJarvis")}>
              <Sparkles className="h-3 w-3" />
            </button>
            <button onClick={() => startTransition(() => deleteImportDeal(deal.id))} className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-300 hover:bg-red-500/20">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** The Vehicle Opportunity Calculator — live-computes totals as you type,
 * then submits as a new "found" deal at the head of the pipeline. */
export function OpportunityCalculator({
  currency,
  onSubmit,
  onClose,
}: {
  currency: string;
  onSubmit: (fd: FormData) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const [purchase, setPurchase] = useState(0);
  const [transport, setTransport] = useState(0);
  const [registration, setRegistration] = useState(0);
  const [repair, setRepair] = useState(0);
  const [expected, setExpected] = useState(0);
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const investment = purchase + transport + registration + repair;
  const profit = expected - investment;
  const roi = investment > 0 ? (profit / investment) * 100 : 0;

  const numField = (label: string, name: string, value: number, setValue: (n: number) => void) => (
    <Field label={label}>
      <input
        name={name}
        type="number"
        value={value || ""}
        onChange={(e) => setValue(Number(e.target.value) || 0)}
        className={inputClass}
      />
    </Field>
  );

  return (
    <Panel className="mb-5" glow accent="garage">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">{t("garage.opportunityCalculator")}</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label={t("garage.formBrand")}><input name="brand" required className={inputClass} /></Field>
        <Field label={t("garage.formModel")}><input name="model" required className={inputClass} /></Field>
        <Field label={t("garage.formYear")}><input name="year" type="number" className={inputClass} /></Field>
        <Field label={t("garage.formImageUrl")}><input name="image_url" className={inputClass} /></Field>
        {numField(t("garage.formPurchasePrice"), "purchase_price", purchase, setPurchase)}
        {numField(t("garage.formTransportCost"), "transport_cost", transport, setTransport)}
        {numField(t("garage.formRegistrationCost"), "registration_cost", registration, setRegistration)}
        {numField(t("garage.formRepairCost"), "repair_cost", repair, setRepair)}
        <div className="sm:col-span-2">{numField(t("garage.formExpectedPrice"), "expected_selling_price", expected, setExpected)}</div>
        <div className="sm:col-span-2"><Field label={t("garage.formNotes")}><textarea name="notes" rows={2} className={inputClass + " resize-none"} /></Field></div>

        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/[0.03] p-4 sm:col-span-2">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.investment")}</p>
            <Numeral className="mt-1 block text-lg font-semibold text-white">{fc(investment)}</Numeral>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.profit")}</p>
            <Numeral className={`mt-1 block text-lg font-semibold ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{fc(profit)}</Numeral>
          </div>
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">ROI</p>
            <Numeral className={`mt-1 block text-lg font-semibold ${roi >= 0 ? "text-emerald-300" : "text-red-300"}`}>{roi.toFixed(1)}%</Numeral>
          </div>
        </div>

        <div className="flex gap-3 sm:col-span-2">
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-black" style={{ backgroundColor: ACCENT }}>
            <Plus className="h-4 w-4" /> {t("garage.addToPipeline")}
          </button>
          <button type="button" onClick={onClose} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">{t("garage.cancel")}</button>
        </div>
      </form>
    </Panel>
  );
}
