"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Building, Briefcase, LineChart, Landmark, Gem, ArrowUpRight, ArrowDownRight, ShieldCheck, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * LifeOS Treasury — Step 1.
 *
 * A private family-office wealth dashboard: a dark-luxury Net Worth hero,
 * the Wealth Overview (assets / liabilities / net worth / health score), and
 * the Asset Portfolio. Runs on the same real data the Finance module already
 * loads; further sections (Cash Flow, Wealth Timeline, AI Advisor) land in
 * later steps. Palette is charcoal glass with gold + white accents.
 */

const GOLD = "#C9A227";
const GOLD_SOFT = "#E7C766";
const POS = "#3FBF8F";
const NEG = "#E0605E";

type Props = {
  currency: string;
  holderName: string | null;
  netWorth: number;
  accountsTotal: number;
  portfolioValue: number;
  businessNet: number;
  savingsRate: number;
  accounts: { id: string; name: string; type: string; balance: number }[];
  assets: { id: string; name: string; category: "property" | "vehicle" | "business" | "other"; value: number }[];
  trend: { date: string; value: number }[];
};

export function TreasuryDashboard(props: Props) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, props.currency, { locale });
  const fcCompact = (n: number) =>
    new Intl.NumberFormat(locale === "hu" ? "hu-HU" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  const model = useMemo(() => {
    const liab = props.accounts
      .filter((a) => a.balance < 0 || /credit|loan|mortgage|debt/i.test(a.type))
      .reduce((s, a) => s + Math.abs(a.balance), 0);
    const totalAssets = props.netWorth + liab;

    const bucket = (cat: Props["assets"][number]["category"]) => props.assets.filter((a) => a.category === cat).reduce((s, a) => s + a.value, 0);
    const realEstate = bucket("property");
    const businesses = Math.max(bucket("business"), props.businessNet > 0 ? props.businessNet : 0);
    const investments = props.portfolioValue;
    const cash = props.accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
    const valuables = bucket("vehicle") + bucket("other");

    // Yearly growth from the net-worth snapshot trend.
    const first = props.trend[0]?.value;
    const last = props.trend[props.trend.length - 1]?.value ?? props.netWorth;
    const yearGrowth = first && first > 0 ? ((last - first) / first) * 100 : null;

    // Financial health: solvency + diversification + savings behaviour.
    const solvency = totalAssets > 0 ? Math.max(0, 1 - liab / totalAssets) : 0;
    const classes = [realEstate, businesses, investments, cash, valuables].filter((v) => v > 0).length;
    const diversification = Math.min(1, classes / 4);
    const savings = Math.max(0, Math.min(1, (props.savingsRate + 20) / 70));
    const health = Math.round((solvency * 0.5 + diversification * 0.25 + savings * 0.25) * 100);

    return { liab, totalAssets, realEstate, businesses, investments, cash, valuables, yearGrowth, health };
  }, [props]);

  const portfolio: { key: string; icon: LucideIcon; value: number; yield: number }[] = [
    { key: "realEstate", icon: Building, value: model.realEstate, yield: 0.04 },
    { key: "businesses", icon: Briefcase, value: model.businesses, yield: 0.16 },
    { key: "investments", icon: LineChart, value: model.investments, yield: 0.06 },
    { key: "cashReserves", icon: Landmark, value: model.cash, yield: 0.02 },
    { key: "valuableAssets", icon: Gem, value: model.valuables, yield: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.4em]" style={{ color: GOLD }}>
            {t("treasury.eyebrow")}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-white">{t("treasury.title")}</h1>
        </div>
        {props.holderName && (
          <div className="text-right">
            <p className="text-[0.55rem] uppercase tracking-[0.3em] text-white/35">{t("treasury.holder")}</p>
            <p className="font-display text-sm text-white/80">{props.holderName}</p>
          </div>
        )}
      </div>

      {/* Net Worth hero */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl border p-7 sm:p-9"
        style={{ borderColor: "rgba(201,162,39,0.25)", background: "linear-gradient(135deg, rgba(201,162,39,0.07), rgba(255,255,255,0.015) 45%, rgba(0,0,0,0.2))" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(201,162,39,0.4), transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/45">
              <span className="h-px w-6" style={{ background: GOLD }} /> {t("treasury.netWorth")}
            </p>
            <p className="mt-3 font-display text-4xl leading-none text-white sm:text-6xl">{fc(props.netWorth)}</p>
            {model.yearGrowth != null && (
              <p className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: model.yearGrowth >= 0 ? POS : NEG }}>
                {model.yearGrowth >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {model.yearGrowth >= 0 ? "+" : ""}
                {model.yearGrowth.toFixed(1)}% <span className="text-white/40">{t("treasury.thisYear")}</span>
              </p>
            )}
          </div>
          <Sparkline trend={props.trend} fallback={props.netWorth} />
        </div>
      </motion.div>

      {/* Wealth Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard label={t("treasury.totalAssets")} value={fc(model.totalAssets)} tone="white" />
        <OverviewCard label={t("treasury.liabilities")} value={fc(model.liab)} tone="neg" />
        <OverviewCard label={t("treasury.netWorth")} value={fc(props.netWorth)} tone="gold" />
        <HealthCard label={t("treasury.healthScore")} score={model.health} />
      </div>

      {/* Asset Portfolio */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/55">
          <span className="h-px w-5" style={{ background: GOLD }} /> {t("treasury.portfolio")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portfolio.map((p, i) => {
            const income = p.value * p.yield;
            const active = p.value > 0;
            const Icon = p.icon;
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-[color:rgba(201,162,39,0.35)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(201,162,39,0.12)", color: GOLD_SOFT }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider" style={{ color: active ? POS : "rgba(255,255,255,0.3)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? POS : "rgba(255,255,255,0.3)" }} />
                    {active ? t("treasury.active") : t("treasury.dormant")}
                  </span>
                </div>
                <p className="mt-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/40">{t(`treasury.${p.key}`)}</p>
                <p className="mt-1 font-display text-2xl text-white">{fc(p.value)}</p>
                {income > 0 && (
                  <p className="mt-2 text-xs text-white/45">
                    {t("treasury.income")} ≈ <span style={{ color: GOLD_SOFT }}>{fcCompact(income)}</span>
                    {t("treasury.perYear")} · {t("treasury.est")}
                  </p>
                )}
              </motion.div>
            );
          })}
          {/* Placeholder tile pointing at upcoming steps */}
          <div className="flex items-center rounded-2xl border border-dashed border-white/10 bg-transparent p-5 text-xs leading-relaxed text-white/35">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 flex-none" style={{ color: GOLD }} /> {t("treasury.soon")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, tone }: { label: string; value: string; tone: "white" | "gold" | "neg" }) {
  const color = tone === "gold" ? GOLD_SOFT : tone === "neg" ? NEG : "#ffffff";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-2 font-display text-xl sm:text-2xl" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function HealthCard({ label, score }: { label: string; score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = score >= 70 ? POS : score >= 40 ? GOLD : NEG;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <svg width="58" height="58" viewBox="0 0 58 58" className="flex-none -rotate-90">
        <circle cx="29" cy="29" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="29" cy="29" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/40">{label}</p>
        <p className="mt-1 font-display text-2xl text-white">
          {score}
          <span className="text-sm text-white/40">/100</span>
        </p>
      </div>
    </div>
  );
}

function Sparkline({ trend, fallback }: { trend: { date: string; value: number }[]; fallback: number }) {
  const pts = trend.length >= 2 ? trend.map((t) => t.value) : [fallback * 0.82, fallback * 0.88, fallback * 0.91, fallback * 0.97, fallback];
  const w = 220;
  const h = 64;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#tg)" />
      <path d={path} fill="none" stroke={GOLD_SOFT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
