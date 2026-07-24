"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Plus, Gauge, Gem, TrendingUp, Sparkles } from "lucide-react";
import type { GarageVehicle, GarageServiceRecord, GarageDreamVehicle, GarageImportDeal, Document } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Field, inputClass, Segmented, EmptyState, Numeral } from "@/components/dashboard/ui";
import { carbonWeave, spotlight } from "@/components/dashboard/garage/carbon";
import { VehicleCard } from "@/components/dashboard/garage/VehicleCard";
import { DreamCard } from "@/components/dashboard/garage/DreamCard";
import { PipelineBoard, OpportunityCalculator } from "@/components/dashboard/garage/PipelineBoard";
import { GarageShowroom } from "@/components/dashboard/garage/GarageShowroom";
import { createVehicle, createDreamVehicle, createImportDeal } from "@/app/dashboard/business/garage/actions";

const ACCENT = "#9BB0C4";

type Tab = "vehicles" | "dreams" | "pipeline";

type Props = {
  currency: string;
  vehicles: GarageVehicle[];
  serviceRecords: GarageServiceRecord[];
  dreamVehicles: GarageDreamVehicle[];
  deals: GarageImportDeal[];
  vehicleDocuments: Document[];
};

export function GarageModule({ currency, vehicles, serviceRecords, dreamVehicles, deals, vehicleDocuments }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("vehicles");
  const [view, setView] = useState<"showroom" | "manager">("showroom");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingDream, setAddingDream] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);
  const fc = (n: number) => formatCurrency(n, currency, { locale });

  const fleetValue = vehicles.reduce((s, v) => s + Number(v.value ?? 0), 0);
  const activeDealCount = deals.filter((d) => d.stage !== "sold").length;
  const pipelineProfit = deals
    .filter((d) => d.stage !== "sold")
    .reduce((s, d) => s + Number(d.expected_selling_price) - (Number(d.purchase_price) + Number(d.transport_cost) + Number(d.registration_cost) + Number(d.repair_cost)), 0);

  const recordsByVehicle = useMemo(() => {
    const map: Record<string, GarageServiceRecord[]> = {};
    for (const r of serviceRecords) (map[r.vehicle_id] ??= []).push(r);
    return map;
  }, [serviceRecords]);

  const docsByVehicle = useMemo(() => {
    const map: Record<string, Document[]> = {};
    for (const d of vehicleDocuments) {
      if (!d.garage_vehicle_id) continue;
      (map[d.garage_vehicle_id] ??= []).push(d);
    }
    return map;
  }, [vehicleDocuments]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-end">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "showroom", label: t("garage.viewShowroom") },
            { value: "manager", label: t("garage.viewManager") },
          ]}
        />
      </div>

      {view === "showroom" ? (
        <GarageShowroom currency={currency} vehicles={vehicles} dreamVehicles={dreamVehicles} deals={deals} />
      ) : (
      <div>
      {/* Cinematic garage homepage header */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-hairline">
        <div className="absolute inset-0" style={carbonWeave} />
        <div className="absolute inset-0" style={spotlight(ACCENT, 0.4)} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="relative p-6 sm:p-8">
          <ModuleHeader
            icon={Car}
            title={t("garage.title")}
            subtitle={t("garage.subtitle")}
            accent="garage"
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setTab("vehicles");
                    setAddingVehicle(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("garage.addVehicle")}
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl glass-strong p-4">
              <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40"><Gauge className="h-3 w-3" /> {t("garage.fleetValue")}</p>
              <Numeral className="mt-1 block text-xl font-semibold text-white sm:text-2xl">{fc(fleetValue)}</Numeral>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl glass-strong p-4">
              <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40"><Gem className="h-3 w-3" /> {t("garage.dreamCount")}</p>
              <Numeral className="mt-1 block text-xl font-semibold text-white sm:text-2xl">{dreamVehicles.length}</Numeral>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl glass-strong p-4">
              <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40"><TrendingUp className="h-3 w-3" /> {t("garage.activeDeals")}</p>
              <Numeral className="mt-1 block text-xl font-semibold text-white sm:text-2xl">{activeDealCount}</Numeral>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl glass-strong p-4">
              <p className="text-[0.65rem] uppercase tracking-wider text-white/40">{t("garage.projectedProfit")}</p>
              <Numeral className="mt-1 block text-xl font-semibold sm:text-2xl" style={{ color: ACCENT }}>{fc(pipelineProfit)}</Numeral>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "vehicles", label: t("garage.tabVehicles") },
            { value: "dreams", label: t("garage.tabDreams") },
            { value: "pipeline", label: t("garage.tabPipeline") },
          ]}
        />
        {tab === "dreams" && (
          <button onClick={() => setAddingDream((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("garage.addDream")}
          </button>
        )}
        {tab === "pipeline" && (
          <button onClick={() => setAddingDeal((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("garage.addOpportunity")}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {tab === "vehicles" && (
          <motion.div key="vehicles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {addingVehicle && (
              <Panel className="mb-5" glow accent="garage">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">{t("garage.addVehicle")}</h3>
                </div>
                <form
                  action={(fd) => {
                    startTransition(() => createVehicle(fd));
                    setAddingVehicle(false);
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <Field label={t("garage.formBrand")}><input name="brand" required className={inputClass} /></Field>
                  <Field label={t("garage.formModel")}><input name="model" required className={inputClass} /></Field>
                  <Field label={t("garage.formYear")}><input name="year" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.mileage")}><input name="mileage" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.value")}><input name="value" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.formPurchasePrice")}><input name="purchase_price" type="number" className={inputClass} /></Field>
                  <div className="sm:col-span-2"><Field label={t("garage.formImageUrl")}><input name="image_url" placeholder="https://…" className={inputClass} /></Field></div>
                  <div className="sm:col-span-2"><Field label={t("garage.formModelUrl")}><input name="model_url" placeholder="https://…/car.glb" className={inputClass} /></Field></div>
                  <Field label={t("garage.formEngine")}><input name="engine" placeholder="3.0L I6" className={inputClass} /></Field>
                  <Field label={t("garage.formHorsepower")}><input name="horsepower" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.formFuel")}><input name="fuel" placeholder="Petrol / Diesel / EV" className={inputClass} /></Field>
                  <Field label={t("garage.formTransmission")}><input name="transmission" placeholder="Automatic" className={inputClass} /></Field>
                  <Field label={t("garage.formCountry")}><input name="country" placeholder="Germany" className={inputClass} /></Field>
                  <Field label={t("garage.formVin")}><input name="vin" className={inputClass} /></Field>
                  <div className="sm:col-span-2"><Field label={t("garage.formLinks")}><textarea name="links" rows={2} placeholder={t("garage.formLinksHint")} className={inputClass + " resize-none"} /></Field></div>
                  <div className="sm:col-span-2"><Field label={t("garage.formNotes")}><textarea name="notes" rows={2} className={inputClass + " resize-none"} /></Field></div>
                  <div className="flex gap-3 sm:col-span-2">
                    <button type="submit" className="rounded-full px-5 py-2.5 text-sm font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                    <button type="button" onClick={() => setAddingVehicle(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">{t("garage.cancel")}</button>
                  </div>
                </form>
              </Panel>
            )}

            {vehicles.length === 0 ? (
              <EmptyState icon={Car} title={t("garage.emptyVehicles")} hint={t("garage.emptyVehiclesHint")} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} serviceRecords={recordsByVehicle[v.id] ?? []} documents={docsByVehicle[v.id] ?? []} currency={currency} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "dreams" && (
          <motion.div key="dreams" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {addingDream && (
              <Panel className="mb-5" glow accent="garage">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">{t("garage.addDream")}</h3>
                </div>
                <form
                  action={(fd) => {
                    startTransition(() => createDreamVehicle(fd));
                    setAddingDream(false);
                  }}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <Field label={t("garage.formBrand")}><input name="brand" required className={inputClass} /></Field>
                  <Field label={t("garage.formModel")}><input name="model" required className={inputClass} /></Field>
                  <Field label={t("garage.formYear")}><input name="year" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.estimatedPrice")}><input name="estimated_price" type="number" className={inputClass} /></Field>
                  <Field label={t("garage.formPriority")}>
                    <select name="priority_rating" defaultValue={3} className={inputClass}>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n} className="bg-base">{n}</option>)}
                    </select>
                  </Field>
                  <Field label={t("garage.formTargetDate")}><input name="target_date" type="date" className={inputClass} /></Field>
                  <div className="sm:col-span-2"><Field label={t("garage.formImageUrl")}><input name="image_url" placeholder="https://…" className={inputClass} /></Field></div>
                  <div className="sm:col-span-2"><Field label={t("garage.formPurchaseGoal")}><input name="purchase_goal" placeholder={t("garage.formPurchaseGoalHint")} className={inputClass} /></Field></div>
                  <div className="sm:col-span-2"><Field label={t("garage.formNotes")}><textarea name="notes" rows={2} className={inputClass + " resize-none"} /></Field></div>
                  <div className="flex gap-3 sm:col-span-2">
                    <button type="submit" className="rounded-full px-5 py-2.5 text-sm font-medium text-black" style={{ backgroundColor: ACCENT }}>{t("garage.save")}</button>
                    <button type="button" onClick={() => setAddingDream(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">{t("garage.cancel")}</button>
                  </div>
                </form>
              </Panel>
            )}

            {dreamVehicles.length === 0 ? (
              <EmptyState icon={Sparkles} title={t("garage.emptyDreams")} hint={t("garage.emptyDreamsHint")} />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {dreamVehicles.map((d) => (
                  <DreamCard key={d.id} dream={d} currency={currency} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "pipeline" && (
          <motion.div key="pipeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            {addingDeal && (
              <OpportunityCalculator
                currency={currency}
                onClose={() => setAddingDeal(false)}
                onSubmit={(fd) => {
                  startTransition(() => createImportDeal(fd));
                  setAddingDeal(false);
                }}
              />
            )}
            {deals.length === 0 && !addingDeal ? (
              <EmptyState icon={TrendingUp} title={t("garage.emptyPipeline")} hint={t("garage.emptyPipelineHint")} />
            ) : (
              <PipelineBoard deals={deals} currency={currency} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      )}
    </div>
  );
}
