"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Building, Briefcase, LineChart, Landmark, Gem } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * LifeOS Treasury — a private family-office wealth dashboard modelled on the
 * Signet aesthetic: warm near-black canvas, an editorial serif for headings
 * and monetary figures, restrained champagne-gold with muted green (positive)
 * and rose (liabilities) accents, flat hairline cards (no glassmorphism), a
 * gold-underlined tab row, and the signature gold "KEY INSIGHT" advisory box.
 * Runs entirely on the real finance data the module already loads.
 */

const GOLD = "#C0A15E";
const CREAM = "#ECE6D8";
const GREEN = "#6BA97F";
const ROSE = "#C88686";
const GRID = "rgba(236,230,216,0.10)";

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

type Tab = "networth" | "assets" | "accounts";

export function TreasuryDashboard(props: Props) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, props.currency, { locale });
  const [tab, setTab] = useState<Tab>("networth");

  const m = useMemo(() => {
    const liabilities = props.accounts
      .filter((a) => a.balance < 0 || /credit|loan|mortgage|debt/i.test(a.type))
      .reduce((s, a) => s + Math.abs(a.balance), 0);
    const cash = props.accounts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
    const accountsValue = cash + props.portfolioValue;
    const totalBeforeDebt = props.netWorth + liabilities;
    const otherAssets = Math.max(0, totalBeforeDebt - accountsValue);

    const bucket = (c: Props["assets"][number]["category"]) => props.assets.filter((a) => a.category === c).reduce((s, a) => s + a.value, 0);
    const accountsPct = totalBeforeDebt > 0 ? Math.round((accountsValue / totalBeforeDebt) * 100) : 0;

    const first = props.trend[0]?.value;
    const last = props.trend[props.trend.length - 1]?.value ?? props.netWorth;
    const yearGrowth = first && first > 0 ? ((last - first) / first) * 100 : null;

    // Key insight — a real, plain-language read on leverage.
    let insight: string;
    if (liabilities <= 0) insight = t("treasury.insightNoDebt");
    else if (cash >= liabilities) insight = t("treasury.insightLight");
    else if (totalBeforeDebt * 0.4 >= liabilities) insight = t("treasury.insightModerate");
    else insight = t("treasury.insightWatch");

    return {
      liabilities,
      cash,
      accountsValue,
      otherAssets,
      totalBeforeDebt,
      accountsPct,
      yearGrowth,
      insight,
      realEstate: bucket("property"),
      businesses: Math.max(bucket("business"), props.businessNet > 0 ? props.businessNet : 0),
      investments: props.portfolioValue,
      valuables: bucket("vehicle") + bucket("other"),
    };
  }, [props, t]);

  const refreshed = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const tabs: { key: Tab; label: string }[] = [
    { key: "networth", label: t("treasury.tabNetWorth") },
    { key: "assets", label: t("treasury.tabAssets") },
    { key: "accounts", label: t("treasury.tabAccounts") },
  ];

  return (
    <div className="rounded-3xl border border-[color:rgba(236,230,216,0.08)] bg-[#0b0b0c] p-6 sm:p-8" style={{ fontFamily: "var(--font-inter)" }}>
      {/* Entity header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:rgba(236,230,216,0.08)] pb-5">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GREEN }}>
            {t("treasury.active")}
          </p>
          <h1 className="mt-1 font-serif text-2xl text-[color:#ECE6D8] sm:text-3xl">
            {props.holderName ? `${props.holderName} ${t("treasury.familyOffice")}` : t("treasury.title")}
          </h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[color:rgba(236,230,216,0.4)]">
            <RefreshCw className="h-3 w-3" /> {t("treasury.lastRefreshed")} {refreshed}
          </p>
        </div>
        <span className="rounded-md border px-3 py-1 font-serif text-sm italic" style={{ borderColor: GRID, color: GOLD }}>
          {t("treasury.title")}
        </span>
      </div>

      {/* Tab row */}
      <div className="mt-5 flex flex-wrap gap-6 border-b border-[color:rgba(236,230,216,0.08)]">
        {tabs.map((tb) => {
          const on = tab === tb.key;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className="relative -mb-px pb-3 text-sm transition-colors"
              style={{ color: on ? CREAM : "rgba(236,230,216,0.45)" }}
            >
              {tb.label}
              {on && <span className="absolute inset-x-0 bottom-0 h-px" style={{ background: GOLD }} />}
            </button>
          );
        })}
      </div>

      {tab === "networth" && (
        <motion.div key="nw" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>
            {t("treasury.portfolioEyebrow")}
          </p>
          <h2 className="mt-1 font-serif text-2xl text-[color:#ECE6D8]">{t("treasury.netWorth")}</h2>
          <p className="text-sm text-[color:rgba(236,230,216,0.45)]">{t("treasury.netWorthSub")}</p>

          <p className="mt-6 text-[0.6rem] uppercase tracking-[0.3em] text-[color:rgba(236,230,216,0.4)]">{t("treasury.totalNetWorth")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <span className="font-serif text-4xl leading-none text-[color:#F4EFE3] sm:text-6xl">{fc(props.netWorth)}</span>
            {m.yearGrowth != null && (
              <span className="mb-1 text-sm" style={{ color: m.yearGrowth >= 0 ? GREEN : ROSE }}>
                {m.yearGrowth >= 0 ? "↑" : "↓"} {Math.abs(m.yearGrowth).toFixed(1)}%
              </span>
            )}
          </div>

          {/* Three-card balance sheet */}
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <BalanceCard label={t("treasury.accounts")} value={fc(m.accountsValue)} sub={t("treasury.cashInvestments")} />
            <BalanceCard label={t("treasury.otherAssets")} value={fc(m.otherAssets)} sub={t("treasury.propertyHoldings")} />
            <BalanceCard label={t("treasury.liabilities")} value={fc(m.liabilities)} sub={t("treasury.loansCredit")} color={ROSE} />
          </div>

          {/* Key insight (AI advisor) */}
          <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(192,161,94,0.45)", background: "linear-gradient(90deg, rgba(192,161,94,0.12), rgba(192,161,94,0.03))" }}>
            <div className="border-l-2 p-5" style={{ borderColor: GOLD }}>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>
                {t("treasury.keyInsight")}
              </p>
              <p className="mt-2 font-serif text-lg text-[color:#ECE6D8]">{m.insight}</p>
            </div>
          </div>

          {/* Composition + snapshot */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[color:rgba(236,230,216,0.5)]">{t("treasury.composition")}</p>
              <p className="mt-2 text-xs text-[color:rgba(236,230,216,0.45)]">
                {t("treasury.totalBeforeDebt")} <span className="text-[color:#ECE6D8]">{fc(m.totalBeforeDebt)}</span>
              </p>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full" style={{ background: "rgba(236,230,216,0.08)" }}>
                <div style={{ width: `${m.accountsPct}%`, background: GOLD }} />
                <div style={{ width: `${100 - m.accountsPct}%`, background: "rgba(236,230,216,0.28)" }} />
              </div>
              <div className="mt-2 flex gap-4 text-[0.7rem] text-[color:rgba(236,230,216,0.5)]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: GOLD }} /> {t("treasury.accounts")} {m.accountsPct}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "rgba(236,230,216,0.28)" }} /> {t("treasury.other")} {100 - m.accountsPct}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[color:rgba(236,230,216,0.5)]">{t("treasury.snapshot")}</p>
              <dl className="mt-3 space-y-2 text-sm">
                <SnapRow k={t("treasury.cashVsDebt")} v={m.liabilities > 0 ? `${Math.round((m.cash / m.liabilities) * 100)}%` : "∞"} />
                <SnapRow k={t("treasury.linkedAccounts")} v={`${props.accounts.length}`} />
                <SnapRow k={t("treasury.holdingsRecorded")} v={`${props.assets.length}`} />
              </dl>
            </div>
          </div>
        </motion.div>
      )}

      {tab === "assets" && (
        <motion.div key="as" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="grid gap-3 pt-7 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "realEstate", icon: Building, value: m.realEstate },
            { key: "businesses", icon: Briefcase, value: m.businesses },
            { key: "investments", icon: LineChart, value: m.investments },
            { key: "cashReserves", icon: Landmark, value: m.cash },
            { key: "valuableAssets", icon: Gem, value: m.valuables },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.key} className="rounded-xl border border-[color:rgba(236,230,216,0.08)] p-5">
                <Icon className="h-4 w-4" style={{ color: GOLD }} />
                <p className="mt-3 text-[0.6rem] uppercase tracking-[0.2em] text-[color:rgba(236,230,216,0.45)]">{t(`treasury.${a.key}`)}</p>
                <p className="mt-1 font-serif text-2xl text-[color:#ECE6D8]">{fc(a.value)}</p>
              </div>
            );
          })}
        </motion.div>
      )}

      {tab === "accounts" && (
        <motion.div key="ac" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
          <div className="divide-y divide-[color:rgba(236,230,216,0.07)]">
            {props.accounts.length === 0 && <p className="py-6 text-sm text-[color:rgba(236,230,216,0.4)]">{t("treasury.noAccounts")}</p>}
            {props.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-[color:#ECE6D8]">{a.name}</p>
                  <p className="text-[0.65rem] uppercase tracking-wider text-[color:rgba(236,230,216,0.4)]">{a.type}</p>
                </div>
                <span className="font-serif text-lg" style={{ color: a.balance < 0 ? ROSE : CREAM }}>
                  {fc(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function BalanceCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[color:rgba(236,230,216,0.08)] p-5">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-[color:rgba(236,230,216,0.4)]">{label}</p>
      <p className="mt-2 font-serif text-2xl" style={{ color: color ?? "#ECE6D8" }}>
        {value}
      </p>
      <p className="mt-1 text-[0.7rem] text-[color:rgba(236,230,216,0.4)]">{sub}</p>
    </div>
  );
}

function SnapRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[color:rgba(236,230,216,0.06)] pb-2">
      <dt className="text-[color:rgba(236,230,216,0.5)]">{k}</dt>
      <dd className="text-[color:#ECE6D8]">{v}</dd>
    </div>
  );
}
