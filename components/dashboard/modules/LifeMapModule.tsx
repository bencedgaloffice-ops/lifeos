"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Map, Plus, Trash2, Pencil, X, Target, FileStack, Wallet, Car, Navigation, Gauge, Clock, CheckCircle2 } from "lucide-react";
import type { LifeMapLocation, LifeArea, Organization, Goal, Document, Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Field, inputClass, Progress, Numeral } from "@/components/dashboard/ui";
import { LifeMapCanvas } from "@/components/three/LifeMapCanvas";
import { createLocation, updateLocation, deleteLocation } from "@/app/dashboard/map/actions";
import { computeVehicleState, type VehicleState } from "@/lib/vehicle-sim";

type Props = {
  locations: LifeMapLocation[];
  lifeAreas: LifeArea[];
  organizations: Organization[];
  goals: Goal[];
  documents: Document[];
  transactions: Transaction[];
  /** Renders every sidebar module as a clickable portal orbiting Hungary —
   * used on the home screen's Map tab, off on the plain /dashboard/map page. */
  showNavPins?: boolean;
  /** Hides this module's own header/legend — the home screen supplies its own. */
  compact?: boolean;
};

const CATEGORY_COLOR: Record<string, string> = {
  home: "#F5A15E",
  agriculture: "#10B981",
  work: "#3B82F6",
  travel: "#F472B6",
  other: "#67E8F9",
};

export function LifeMapModule({ locations, lifeAreas, organizations, goals, documents, transactions, showNavPins = false, compact = false }: Props) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<LifeMapLocation["category"]>("other");
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [vehicleState, setVehicleState] = useState<VehicleState | null>(null);

  // Keeps the operational panel's distance/ETA/status live while it's open —
  // the vehicle never stops moving, so its numbers shouldn't freeze either.
  useEffect(() => {
    if (!vehicleOpen) return;
    const tick = () => setVehicleState(computeVehicleState());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [vehicleOpen]);

  const selected = locations.find((l) => l.id === selectedId) ?? null;

  const linkedGoals = useMemo(
    () => (selected?.life_area_id ? goals.filter((g) => g.life_area_id === selected.life_area_id) : []),
    [goals, selected],
  );
  const linkedDocuments = useMemo(
    () => (selected?.life_area_id ? documents.filter((d) => d.life_area_id === selected.life_area_id || d.organization_id === selected.organization_id) : []),
    [documents, selected],
  );
  const linkedTransactions = useMemo(
    () => (selected?.organization_id ? transactions.filter((tx) => tx.organization_id === selected.organization_id).slice(0, 6) : []),
    [transactions, selected],
  );
  const netForLocation = linkedTransactions.reduce((s, tx) => s + (tx.direction === "in" ? Number(tx.amount) : -Number(tx.amount)), 0);

  /** Per-pin goal completion, so a location can visibly "light up" as its
   * linked goals get achieved — the map doubles as a progress readout. */
  const progressByLocation = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    for (const loc of locations) {
      if (!loc.life_area_id) continue;
      const forLocation = goals.filter((g) => g.life_area_id === loc.life_area_id);
      if (forLocation.length === 0) continue;
      map[loc.id] = { total: forLocation.length, completed: forLocation.filter((g) => g.status === "achieved").length };
    }
    return map;
  }, [goals, locations]);

  return (
    <div>
      {!compact && (
        <ModuleHeader
          icon={Map}
          title={t("map.title")}
          subtitle={t("map.subtitle")}
          accent="map"
          action={
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> {t("map.addLocation")}
            </button>
          }
        />
      )}
      {compact && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("map.addLocation")}
          </button>
        </div>
      )}

      {open && (
        <Panel className="mb-5">
          <form
            action={(fd) => {
              startTransition(() => createLocation(fd));
              setOpen(false);
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label={t("map.formName")}>
              <input name="name" required className={inputClass} />
            </Field>
            <Field label={t("map.formCategory")}>
              <select name="category" value={category} onChange={(e) => setCategory(e.target.value as LifeMapLocation["category"])} className={inputClass}>
                <option value="home" className="bg-base">{t("map.categoryHome")}</option>
                <option value="agriculture" className="bg-base">{t("map.categoryAgriculture")}</option>
                <option value="work" className="bg-base">{t("map.categoryWork")}</option>
                <option value="travel" className="bg-base">{t("map.categoryTravel")}</option>
                <option value="other" className="bg-base">{t("map.categoryOther")}</option>
              </select>
            </Field>
            <Field label={t("map.formLifeArea")}>
              <select name="life_area_id" defaultValue="" className={inputClass}>
                <option value="" className="bg-base">{t("map.formNone")}</option>
                {lifeAreas.map((a) => <option key={a.id} value={a.id} className="bg-base">{a.name}</option>)}
              </select>
            </Field>
            <Field label={t("map.formOrganization")}>
              <select name="organization_id" defaultValue="" className={inputClass}>
                <option value="" className="bg-base">{t("map.formNone")}</option>
                {organizations.map((o) => <option key={o.id} value={o.id} className="bg-base">{o.name}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("map.formDescription")}>
                <textarea name="description" rows={2} className={inputClass + " resize-none"} />
              </Field>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5">
                {t("map.save")}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("map.cancel")}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Category legend */}
      {!compact && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-white/50">
          {Object.entries(CATEGORY_COLOR).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {t(`map.category${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className={selected || vehicleOpen ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className={`relative w-full overflow-hidden rounded-3xl border border-hairline ${compact ? "h-[72vh]" : "h-[65vh]"}`}>
            {locations.length === 0 && !showNavPins ? (
              <div className="flex h-full items-center justify-center text-sm text-white/40">{t("map.empty")}</div>
            ) : (
              <LifeMapCanvas
                locations={locations}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id || null);
                  if (id) setVehicleOpen(false);
                }}
                progress={progressByLocation}
                navPins={showNavPins}
                onNavigate={(href) => router.push(href)}
                onOpenVehicle={(state) => {
                  setVehicleState(state);
                  setVehicleOpen(true);
                  setSelectedId(null);
                }}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-white/35">{t("map.hint")}</p>
        </div>

        {/* Vehicle operational status panel */}
        <AnimatePresence>
          {vehicleOpen && vehicleState && (
            <motion.div
              key="vehicle"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-2"
            >
              <Panel className="relative h-full" glow>
                <button
                  onClick={() => setVehicleOpen(false)}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 pr-8">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
                    <Car className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/40">{t("vehicle.title")}</p>
                    <p className="text-sm font-medium text-white/80">{t(`vehicle.status.${vehicleState.status}`)}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
                    <Navigation className="h-3.5 w-3.5" /> {t("vehicle.currentMission")}
                  </p>
                  <p className="text-sm text-white/85">{t(`vehicle.mission.${vehicleState.missionKey}`)}</p>
                </div>

                <div className="mt-4">
                  <p className="mb-1.5 text-xs uppercase tracking-wider text-white/40">{t("vehicle.location")}</p>
                  <p className="text-sm text-white/85">
                    {t(`homeMap.locationName.${vehicleState.fromKey}`)} → {t(`homeMap.locationName.${vehicleState.toKey}`)}
                  </p>
                </div>

                {vehicleState.distanceKm > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40">
                        <Gauge className="h-3 w-3" /> {t("vehicle.distance")}
                      </p>
                      <Numeral className="mt-1 block text-lg font-semibold text-white">{Math.round(vehicleState.distanceKm)} km</Numeral>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-white/40">
                        <Clock className="h-3 w-3" /> {t("vehicle.eta")}
                      </p>
                      <Numeral className="mt-1 block text-lg font-semibold text-cyan-300">{vehicleState.etaMinutes} {t("vehicle.minutes")}</Numeral>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-1.5 text-xs text-white/45">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("vehicle.dailyActivity", { n: vehicleState.locationsVisitedToday })}
                </div>

                <p className="mt-5 text-xs leading-relaxed text-white/30">{t("vehicle.simNote")}</p>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drill-down side panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-2"
            >
              <Panel className="relative h-full">
                <button
                  onClick={() => setSelectedId(null)}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>

                {editing ? (
                  <form
                    action={(fd) => {
                      startTransition(() => updateLocation(selected.id, fd));
                      setEditing(false);
                    }}
                    className="grid gap-3 pr-8"
                  >
                    <Field label={t("map.formName")}>
                      <input name="name" defaultValue={selected.name} required className={inputClass} />
                    </Field>
                    <Field label={t("map.formCategory")}>
                      <select name="category" defaultValue={selected.category} className={inputClass}>
                        <option value="home" className="bg-base">{t("map.categoryHome")}</option>
                        <option value="agriculture" className="bg-base">{t("map.categoryAgriculture")}</option>
                        <option value="work" className="bg-base">{t("map.categoryWork")}</option>
                        <option value="travel" className="bg-base">{t("map.categoryTravel")}</option>
                        <option value="other" className="bg-base">{t("map.categoryOther")}</option>
                      </select>
                    </Field>
                    <Field label={t("map.formLifeArea")}>
                      <select name="life_area_id" defaultValue={selected.life_area_id ?? ""} className={inputClass}>
                        <option value="" className="bg-base">{t("map.formNone")}</option>
                        {lifeAreas.map((a) => <option key={a.id} value={a.id} className="bg-base">{a.name}</option>)}
                      </select>
                    </Field>
                    <Field label={t("map.formOrganization")}>
                      <select name="organization_id" defaultValue={selected.organization_id ?? ""} className={inputClass}>
                        <option value="" className="bg-base">{t("map.formNone")}</option>
                        {organizations.map((o) => <option key={o.id} value={o.id} className="bg-base">{o.name}</option>)}
                      </select>
                    </Field>
                    <Field label={t("map.formDescription")}>
                      <textarea name="description" defaultValue={selected.description ?? ""} rows={3} className={inputClass + " resize-none"} />
                    </Field>
                    <div className="flex gap-3">
                      <button type="submit" className="rounded-full bg-cyan-400 px-5 py-2 text-xs font-medium text-black">{t("map.save")}</button>
                      <button type="button" onClick={() => setEditing(false)} className="rounded-full glass px-5 py-2 text-xs text-white/70">{t("map.cancel")}</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="pr-8">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ backgroundColor: `${CATEGORY_COLOR[selected.category]}22`, color: CATEGORY_COLOR[selected.category] }}
                      >
                        {t(`map.category${selected.category.charAt(0).toUpperCase()}${selected.category.slice(1)}`)}
                      </span>
                      <h3 className="mt-2.5 text-xl font-semibold tracking-tight">{selected.name}</h3>
                      {selected.description && <p className="mt-1.5 text-sm leading-relaxed text-white/60">{selected.description}</p>}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
                        <Pencil className="h-3.5 w-3.5" /> {t("map.edit")}
                      </button>
                      <button
                        onClick={() => {
                          startTransition(() => deleteLocation(selected.id));
                          setSelectedId(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("map.delete")}
                      </button>
                    </div>

                    {linkedGoals.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40"><Target className="h-3.5 w-3.5" /> {t("map.linkedGoals")}</p>
                        <div className="space-y-3">
                          {linkedGoals.slice(0, 4).map((g) => (
                            <div key={g.id}>
                              <div className="mb-1 flex justify-between text-sm"><span className="truncate text-white/80">{g.title}</span><span className="text-white/45">{g.progress_percent}%</span></div>
                              <Progress value={g.progress_percent} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {linkedDocuments.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40"><FileStack className="h-3.5 w-3.5" /> {t("map.linkedDocuments")}</p>
                        <ul className="space-y-1.5 text-sm text-white/65">
                          {linkedDocuments.slice(0, 5).map((d) => <li key={d.id} className="truncate">{d.title}</li>)}
                        </ul>
                      </div>
                    )}

                    {linkedTransactions.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-white/40">
                          <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> {t("map.linkedFinance")}</span>
                          <Numeral className={netForLocation >= 0 ? "text-emerald-300" : "text-white/60"}>{formatCurrency(netForLocation, transactions[0]?.currency, { locale })}</Numeral>
                        </p>
                        <ul className="space-y-1.5 text-sm text-white/60">
                          {linkedTransactions.map((tx) => (
                            <li key={tx.id} className="flex justify-between gap-2">
                              <span className="truncate">{tx.description || "—"}</span>
                              <Numeral className="shrink-0">{formatDate(tx.occurred_at, undefined, locale)}</Numeral>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {linkedGoals.length === 0 && linkedDocuments.length === 0 && linkedTransactions.length === 0 && (
                      <p className="mt-5 text-xs text-white/35">{t("map.noLinks")}</p>
                    )}
                  </>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
