"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  Wallet,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Plane,
  MapPin,
  Star,
  Globe2,
  Truck,
  ClipboardCheck,
  BadgeCheck,
  Tag,
} from "lucide-react";
import type { GarageVehicle, GarageDreamVehicle, GarageImportDeal, GarageDealStage, VehicleSpecs } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ShowroomCanvas } from "@/components/three/ShowroomCanvas";
import { RealLifeMapCanvas } from "@/components/map/RealLifeMapCanvas";
import { DEMO_ESCALADE_SKETCHFAB, resolveSpecs, parseModelSource } from "@/lib/garage/vehicle-catalog";

type ShowStatus = "owned" | "watching" | "importing" | "forsale" | "sold";

type ShowVehicle = {
  id: string;
  name: string;
  brand: string;
  year: number | null;
  mileage: number | null;
  value: number | null;
  purchase: number | null;
  status: ShowStatus;
  country: string;
  accent: string;
  modelUrl?: string;
  specs: VehicleSpecs;
};

const ACCENTS = ["#9BB0C4", "#C9A227", "#E0245E", "#3FA7FF", "#7C5CFF", "#31C48D"];
function accentFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  return ACCENTS[h % ACCENTS.length];
}

const STAGE_FLOW: GarageDealStage[] = ["found", "purchase", "transport", "inspection", "registration", "ready_for_sale", "sold"];
const STAGE_ICON: Record<GarageDealStage, typeof Truck> = {
  found: Globe2,
  purchase: Tag,
  transport: Truck,
  inspection: ClipboardCheck,
  registration: BadgeCheck,
  ready_for_sale: Star,
  sold: Wallet,
};

export function GarageShowroom({
  currency,
  vehicles,
  dreamVehicles,
  deals,
}: {
  currency: string;
  vehicles: GarageVehicle[];
  dreamVehicles: GarageDreamVehicle[];
  deals: GarageImportDeal[];
}) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, currency, { locale });
  const [poweredOn, setPoweredOn] = useState(false);
  const [idx, setIdx] = useState(0);

  const showcase: ShowVehicle[] = useMemo(() => {
    const owned: ShowVehicle[] = vehicles.map((v) => {
      const specs = resolveSpecs(v.brand, v.specs);
      return {
        id: v.id,
        name: `${v.brand} ${v.model}`.trim(),
        brand: v.brand,
        year: v.year,
        mileage: v.mileage,
        value: v.value,
        purchase: v.purchase_price,
        status: "owned",
        country: specs.country ?? "Hungary",
        accent: accentFor(v.brand + v.model),
        modelUrl: v.model_url ?? undefined,
        specs,
      };
    });
    const importing: ShowVehicle[] = deals
      .filter((d) => d.stage !== "sold")
      .map((d) => {
        const specs = resolveSpecs(d.brand, null);
        return {
          id: d.id,
          name: `${d.brand} ${d.model}`.trim(),
          brand: d.brand,
          year: d.year,
          mileage: null,
          value: d.expected_selling_price,
          purchase: d.purchase_price,
          status: "importing",
          country: specs.country ?? "Germany",
          accent: accentFor(d.brand + d.model),
          modelUrl: d.model_url ?? undefined,
          specs,
        };
      });
    const watching: ShowVehicle[] = dreamVehicles.map((d) => {
      const specs = resolveSpecs(d.brand, null);
      return {
        id: d.id,
        name: `${d.brand} ${d.model}`.trim(),
        brand: d.brand,
        year: d.year,
        mileage: null,
        value: d.estimated_price,
        purchase: null,
        status: "watching",
        country: specs.country ?? "—",
        accent: accentFor(d.brand + d.model),
        modelUrl: d.model_url ?? undefined,
        specs,
      };
    });
    const merged = [...owned, ...importing, ...watching];
    if (merged.length) return merged;
    // A concept placeholder so the stage is never empty.
    return [
      {
        id: "concept",
        name: "Cadillac Escalade ESV",
        brand: "Cadillac",
        year: 2015,
        mileage: 78000,
        value: 62000,
        purchase: 48000,
        status: "watching",
        country: "United States",
        accent: "#C9A227",
        modelUrl: DEMO_ESCALADE_SKETCHFAB,
        specs: {
          country: "United States",
          fuel: "Petrol",
          transmission: "8-speed automatic",
          engine: "6.2L V8",
          horsepower: 420,
          drivetrain: "AWD",
        },
      },
    ];
  }, [vehicles, deals, dreamVehicles, t]);

  const active = showcase[Math.min(idx, showcase.length - 1)];
  const ai = useMemo(() => analyze(active), [active]);
  const modelSource = parseModelSource(active.modelUrl);

  const statusLabel: Record<ShowStatus, string> = {
    owned: t("showroom.statusOwned"),
    watching: t("showroom.statusWatching"),
    importing: t("showroom.statusImporting"),
    forsale: t("showroom.statusForSale"),
    sold: t("showroom.statusSold"),
  };

  const step = (d: number) => setIdx((i) => (i + d + showcase.length) % showcase.length);

  const soldDeals = deals.filter((d) => d.stage === "sold");
  const totalProfit = soldDeals.reduce(
    (s, d) => s + ((d.actual_selling_price ?? d.expected_selling_price) - d.purchase_price - d.transport_cost - d.registration_cost - d.repair_cost),
    0,
  );

  return (
    <div className="relative">
      {/* Cinematic "lights on" entrance */}
      <AnimatePresence>
        {!poweredOn && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-3xl bg-black"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            onAnimationComplete={() => {
              if (!poweredOn) setTimeout(() => setPoweredOn(true), 1500);
            }}
          >
            <motion.div
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: "-120%" }}
              animate={{ x: "320%" }}
              transition={{ duration: 1.8, ease: "easeInOut" }}
            />
            <div className="text-center">
              <p className="font-display text-lg tracking-[0.4em] text-white/80">{t("showroom.powering")}</p>
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/30">{t("showroom.tagline")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-5">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/40">{t("showroom.eyebrow")}</p>
        <h1 className="font-display text-3xl text-white">{t("showroom.title")}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Stat label={t("showroom.collection")} value={`${vehicles.length}`} />
          <Stat label={t("showroom.importing")} value={`${deals.filter((d) => d.stage !== "sold").length}`} />
          <Stat label={t("showroom.soldCount")} value={`${soldDeals.length}`} />
          <Stat label={t("showroom.totalProfit")} value={fc(totalProfit)} accent="#31C48D" />
        </div>
      </div>

      {/* Stage + holographic panel */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative h-[58vh] min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-black/50">
          <div className="absolute inset-0">
            {modelSource.kind === "sketchfab" ? (
              <iframe
                title={active.name}
                src={modelSource.embedUrl}
                className="h-full w-full border-0"
                allow="autoplay; fullscreen; xr-spatial-tracking; web-share"
                allowFullScreen
              />
            ) : (
              <ShowroomCanvas accent={active.accent} modelUrl={modelSource.kind === "glb" ? modelSource.url : undefined} />
            )}
          </div>
          <span className="pointer-events-none absolute right-4 top-16 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[0.55rem] uppercase tracking-wider text-white/45 backdrop-blur">
            {modelSource.kind === "sketchfab" ? t("showroom.modelSketchfab") : modelSource.kind === "glb" ? t("showroom.model3d") : t("showroom.modelStylized")}
          </span>
          {/* Vehicle name + controls */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <div>
              <p className="font-display text-xl text-white drop-shadow">{active.name}</p>
              <p className="text-xs text-white/50">
                {active.year ?? "—"} · {active.country}
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em]"
              style={{ background: `${active.accent}22`, color: active.accent, border: `1px solid ${active.accent}55` }}
            >
              {statusLabel[active.status]}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
            <button onClick={() => step(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">{t("showroom.dragHint")}</p>
            <button onClick={() => step(1)} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white/70 backdrop-blur hover:text-white">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Holographic spec + AI panel */}
        <motion.div
          key={active.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
          style={{ boxShadow: `0 0 50px -18px ${active.accent}` }}
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Spec label={t("showroom.fBrand")} value={active.brand} />
            <Spec label={t("showroom.fYear")} value={active.year != null ? `${active.year}` : "—"} />
            <Spec label={t("showroom.fMileage")} value={active.mileage != null ? `${active.mileage.toLocaleString()} km` : "—"} />
            <Spec label={t("showroom.fCountry")} value={active.country} />
            <Spec label={t("showroom.fEngine")} value={active.specs.engine ?? "—"} />
            <Spec label={t("showroom.fHp")} value={active.specs.horsepower != null ? `${active.specs.horsepower} hp` : "—"} />
            <Spec label={t("showroom.fFuel")} value={active.specs.fuel ?? "—"} />
            <Spec label={t("showroom.fTransmission")} value={active.specs.transmission ?? "—"} />
            <Spec label={t("showroom.fVin")} value={active.specs.vin ?? "—"} />
            <Spec label={t("showroom.fPurchase")} value={active.purchase != null ? fc(active.purchase) : "—"} />
            <Spec label={t("showroom.fValue")} value={active.value != null ? fc(active.value) : "—"} accent={active.accent} />
            <Spec label={t("showroom.fImport")} value={ai.estImport != null ? fc(ai.estImport) : "—"} />
            <Spec label={t("showroom.fRegistration")} value={ai.estReg != null ? fc(ai.estReg) : "—"} />
            <Spec label={t("showroom.fExpected")} value={ai.expectedSale != null ? fc(ai.expectedSale) : "—"} />
            <Spec label={t("showroom.fProfit")} value={ai.estProfit != null ? fc(ai.estProfit) : "—"} accent={ai.estProfit != null && ai.estProfit >= 0 ? "#31C48D" : "#E0245E"} />
          </div>

          {/* AI analysis */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-white/45">
              <Sparkles className="h-3.5 w-3.5 text-[#ff8b93]" /> {t("showroom.aiTitle")}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Score icon={TrendingUp} label={t("showroom.investment")} value={ai.investment} color="#31C48D" />
              <Score icon={ShieldAlert} label={t("showroom.risk")} value={ai.risk} color="#E0245E" />
              <Score icon={Gauge} label={t("showroom.demand")} value={ai.demand} color="#3FA7FF" suffix="" text />
            </div>
            <div className="mt-3 space-y-1 text-xs text-white/55">
              <p>
                {t("showroom.avgHu")}: <span className="font-mono text-white/80">{ai.avgHu != null ? fc(ai.avgHu) : "—"}</span>
              </p>
              <p>
                {t("showroom.avgDe")}: <span className="font-mono text-white/80">{ai.avgDe != null ? fc(ai.avgDe) : "—"}</span>
              </p>
            </div>
            <div className="mt-3 rounded-xl bg-[#ff2d3f]/[0.06] px-3 py-2 text-xs italic text-white/70">
              &ldquo;{t(ai.recKey)}&rdquo;
            </div>
          </div>

          {/* Vehicle rail */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {showcase.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setIdx(i)}
                className={`flex-none rounded-xl border px-3 py-2 text-left transition ${i === idx ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}
              >
                <p className="whitespace-nowrap text-xs text-white/80">{v.name}</p>
                <p className="text-[0.6rem] uppercase tracking-wider" style={{ color: v.accent }}>
                  {statusLabel[v.status]}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Import Center */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Truck className="h-4 w-4 text-white/55" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">{t("showroom.importCenter")}</h2>
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {STAGE_FLOW.map((stage, i) => {
            const Icon = STAGE_ICON[stage];
            const inStage = deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className="flex items-center">
                <div className="min-w-[130px] flex-none rounded-2xl border border-white/10 bg-black/30 p-3">
                  <p className="flex items-center gap-1.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white/45">
                    <Icon className="h-3.5 w-3.5" /> {t(`showroom.stage.${stage}`)}
                  </p>
                  <p className="mt-1 font-display text-lg text-white/85">{inStage.length}</p>
                  {inStage.slice(0, 2).map((d) => (
                    <p key={d.id} className="truncate text-[0.65rem] text-white/50">
                      {d.brand} {d.model}
                    </p>
                  ))}
                </div>
                {i < STAGE_FLOW.length - 1 && <ChevronRight className="mx-0.5 h-4 w-4 flex-none text-white/20" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Holographic Europe map with the Escalade + private jet */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-white/55" />
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">{t("showroom.worldMap")}</h2>
        </div>
        <div className="relative h-[52vh] min-h-[380px] overflow-hidden rounded-2xl">
          <RealLifeMapCanvas />
          {/* Private jet, Budapest ↔ Munich */}
          <motion.div
            className="pointer-events-none absolute left-[12%] top-[26%] z-[400] text-cyan-300/90"
            animate={{ x: ["0%", "62vw", "0%"], y: ["0px", "-26px", "0px"] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          >
            <Plane className="h-6 w-6 -rotate-45 drop-shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
          </motion.div>
        </div>
        <p className="mt-2 text-[0.65rem] text-white/35">{t("showroom.mapNote")}</p>
      </div>

      {/* Search Market */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-white/55" />
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">{t("showroom.market")}</h2>
          </div>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-white/40">{t("showroom.marketNote")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET.map((m) => {
            const profit = m.expected - m.price - m.importEst;
            return (
              <div key={m.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-sm text-white/90">{m.name}</p>
                    <p className="text-[0.65rem] text-white/45">
                      {m.year} · {m.km.toLocaleString()} km · {m.country}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < m.rating ? "fill-amber-400 text-amber-400" : "text-white/20"}`} />
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem]">
                  <Kv k={t("showroom.mPrice")} v={fc(m.price)} />
                  <Kv k={t("showroom.mImport")} v={fc(m.importEst)} />
                  <Kv k={t("showroom.mExpected")} v={fc(m.expected)} />
                  <Kv k={t("showroom.mProfit")} v={fc(profit)} accent={profit >= 0 ? "#31C48D" : "#E0245E"} />
                </div>
                <p className="mt-3 rounded-lg bg-[#ff2d3f]/[0.06] px-2 py-1.5 text-[0.65rem] italic text-white/60">
                  <Sparkles className="mr-1 inline h-3 w-3 text-[#ff8b93]" />
                  {t(m.recKey)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- AI analysis (deterministic, clearly estimated) ---------- */
function analyze(v: ShowVehicle) {
  const value = v.value;
  const purchase = v.purchase;
  const margin = value != null && purchase != null && purchase > 0 ? (value - purchase) / purchase : null;
  const estImport = value != null ? Math.round(value * 0.08) : null;
  const estReg = value != null ? Math.round(value * 0.04) : null;
  const expectedSale = value != null ? Math.round(value * 1.12) : null;
  const estProfit = expectedSale != null && purchase != null && estImport != null && estReg != null ? expectedSale - purchase - estImport - estReg : null;
  const avgHu = value != null ? Math.round(value * 1.06) : null;
  const avgDe = purchase != null ? Math.round(purchase * 0.94) : value != null ? Math.round(value * 0.86) : null;

  const clamp = (n: number) => Math.max(5, Math.min(99, Math.round(n)));
  const investment = margin != null ? clamp(52 + margin * 130) : 60;
  const kmRisk = v.mileage != null ? Math.min(60, (v.mileage / 250000) * 60) : 25;
  const ageRisk = v.year != null ? Math.min(30, ((new Date().getFullYear() - v.year) / 20) * 30) : 15;
  const risk = clamp(kmRisk + ageRisk + 8);
  const demand = investment >= 70 ? "showroom.demandStrong" : investment >= 55 ? "showroom.demandSteady" : "showroom.demandSoft";
  const recKey = investment >= 72 ? "showroom.recExcellent" : investment >= 55 ? "showroom.recSolid" : "showroom.recHold";

  return { estImport, estReg, expectedSale, estProfit, avgHu, avgDe, investment, risk, demand, recKey };
}

/* ---------- Sample market intelligence (architecture placeholder) ---------- */
const MARKET = [
  { id: "m1", name: "BMW M4 Competition", year: 2022, km: 28000, country: "Germany", price: 74000, importEst: 6200, expected: 89000, rating: 5, recKey: "showroom.recExcellent" },
  { id: "m2", name: "Audi RS6 Avant", year: 2021, km: 41000, country: "Austria", price: 92000, importEst: 7100, expected: 108000, rating: 4, recKey: "showroom.recSolid" },
  { id: "m3", name: "Mercedes G63 AMG", year: 2020, km: 55000, country: "Switzerland", price: 138000, importEst: 9800, expected: 159000, rating: 5, recKey: "showroom.recExcellent" },
  { id: "m4", name: "Porsche 911 Carrera", year: 2019, km: 62000, country: "Netherlands", price: 96000, importEst: 6800, expected: 111000, rating: 4, recKey: "showroom.recSolid" },
  { id: "m5", name: "Volkswagen Golf R", year: 2023, km: 14000, country: "Germany", price: 41000, importEst: 3600, expected: 49000, rating: 4, recKey: "showroom.recSolid" },
  { id: "m6", name: "Range Rover Sport", year: 2021, km: 47000, country: "Belgium", price: 79000, importEst: 6400, expected: 90000, rating: 3, recKey: "showroom.recHold" },
];

/* ---------- small presentational bits ---------- */
function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
      <span className="text-white/40">{label} </span>
      <span className="font-mono" style={{ color: accent ?? "rgba(255,255,255,0.9)" }}>
        {value}
      </span>
    </span>
  );
}

function Spec({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[0.55rem] uppercase tracking-[0.15em] text-white/35">{label}</p>
      <p className="truncate font-mono text-sm" style={{ color: accent ?? "rgba(255,255,255,0.9)" }}>
        {value}
      </p>
    </div>
  );
}

function Score({
  icon: Icon,
  label,
  value,
  color,
  suffix = "",
  text = false,
}: {
  icon: typeof Gauge;
  label: string;
  value: number | string;
  color: string;
  suffix?: string;
  text?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="rounded-xl bg-white/[0.03] p-2">
      <Icon className="mx-auto h-4 w-4" style={{ color }} />
      <p className="mt-1 font-display text-base" style={{ color }}>
        {text ? t(value as string) : `${value}${suffix}`}
      </p>
      <p className="text-[0.55rem] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div>
      <span className="text-white/40">{k}: </span>
      <span className="font-mono" style={{ color: accent ?? "rgba(255,255,255,0.85)" }}>
        {v}
      </span>
    </div>
  );
}
