"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  PieChart,
  Building,
  Landmark,
  Users,
  Briefcase,
  LineChart as LineIcon,
  Gem,
  ShieldCheck,
  Check,
  MessageSquare,
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * LifeOS Treasury — a private family-office dashboard modelled on Signet:
 * a left icon rail, an editorial serif for headings and figures, a warm
 * near-black canvas, champagne gold with muted green/rose accents, flat
 * hairline cards, a net-worth line chart, the gold KEY INSIGHT box, and an
 * Advisors ("Financial Director") desk. All from the real finance data.
 */

const GOLD = "#C0A15E";
const CREAM = "#ECE6D8";
const GREEN = "#6BA97F";
const ROSE = "#C88686";
const HAIR = "rgba(236,230,216,0.09)";
const MUTE = "rgba(236,230,216,0.45)";

type Props = {
  currency: string;
  holderName: string | null;
  netWorth: number;
  accountsTotal: number;
  portfolioValue: number;
  businessNet: number;
  savingsRate: number;
  monthIncome: number;
  monthSpending: number;
  accounts: { id: string; name: string; type: string; balance: number }[];
  assets: { id: string; name: string; category: "property" | "vehicle" | "business" | "other"; value: number }[];
  holdings: { id: string; symbol: string; value: number }[];
  trend: { date: string; value: number }[];
  onManage?: () => void;
};

type Section = "portfolio" | "cashflow" | "investments" | "assets" | "accounts" | "advisors";

export function TreasuryDashboard(props: Props) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, props.currency, { locale });
  const [section, setSection] = useState<Section>("portfolio");

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

    let insight: string;
    if (liabilities <= 0) insight = t("treasury.insightNoDebt");
    else if (cash >= liabilities) insight = t("treasury.insightLight");
    else if (totalBeforeDebt * 0.4 >= liabilities) insight = t("treasury.insightModerate");
    else insight = t("treasury.insightWatch");

    return {
      liabilities, cash, accountsValue, otherAssets, totalBeforeDebt, accountsPct, yearGrowth, insight,
      realEstate: bucket("property"),
      businesses: Math.max(bucket("business"), props.businessNet > 0 ? props.businessNet : 0),
      investments: props.portfolioValue,
      valuables: bucket("vehicle") + bucket("other"),
    };
  }, [props, t]);

  const refreshed = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

  const rail: { key: Section; label: string; icon: LucideIcon }[] = [
    { key: "portfolio", label: t("treasury.railPortfolio"), icon: PieChart },
    { key: "cashflow", label: t("treasury.railCashFlow"), icon: ArrowRightLeft },
    { key: "investments", label: t("treasury.railInvestments"), icon: LineIcon },
    { key: "assets", label: t("treasury.railAssets"), icon: Building },
    { key: "accounts", label: t("treasury.railAccounts"), icon: Landmark },
    { key: "advisors", label: t("treasury.railAdvisors"), icon: Users },
  ];

  // Cash-flow intelligence (monthly).
  const passiveMonthly = Math.round((m.realEstate * 0.04 + m.investments * 0.06 + m.valuables * 0) / 12);
  const businessMonthly = Math.max(0, Math.round(props.businessNet));
  const activeMonthly = Math.max(0, Math.round(props.monthIncome - businessMonthly));
  const freeCashFlow = Math.round(props.monthIncome + passiveMonthly - props.monthSpending);

  return (
    <div className="flex overflow-hidden rounded-3xl border" style={{ borderColor: HAIR, background: "#0b0b0c" }}>
      {/* Left icon rail */}
      <nav className="flex w-16 flex-none flex-col items-center gap-1 border-r py-5 sm:w-20" style={{ borderColor: HAIR }}>
        <div className="mb-4 grid h-8 w-8 place-items-center rounded" style={{ border: `1px solid ${GOLD}` }}>
          <span className="font-serif text-sm" style={{ color: GOLD }}>
            ₲
          </span>
        </div>
        {rail.map((r) => {
          const on = section === r.key;
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              onClick={() => setSection(r.key)}
              className="flex w-full flex-col items-center gap-1 rounded-lg py-2.5 transition-colors"
              style={{ background: on ? "rgba(192,161,94,0.14)" : "transparent", color: on ? GOLD : MUTE }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[0.5rem] uppercase tracking-wider">{r.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1 p-6 sm:p-8">
        {/* Entity header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5" style={{ borderColor: HAIR }}>
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GREEN }}>{t("treasury.active")}</p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl" style={{ color: CREAM }}>
              {props.holderName ? `${props.holderName} ${t("treasury.familyOffice")}` : t("treasury.title")}
            </h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs" style={{ color: MUTE }}>
              <RefreshCw className="h-3 w-3" /> {t("treasury.lastRefreshed")} {refreshed}
            </p>
          </div>
          <span className="rounded-md border px-3 py-1 font-serif text-sm italic" style={{ borderColor: HAIR, color: GOLD }}>{t("treasury.title")}</span>
        </div>

        {section === "portfolio" && (
          <motion.div key="p" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>{t("treasury.portfolioEyebrow")}</p>
            <h2 className="mt-1 font-serif text-2xl" style={{ color: CREAM }}>{t("treasury.netWorth")}</h2>
            <p className="text-sm" style={{ color: MUTE }}>{t("treasury.netWorthSub")}</p>

            <p className="mt-6 text-[0.6rem] uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.totalNetWorth")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <span className="font-serif text-4xl leading-none sm:text-6xl" style={{ color: "#F4EFE3" }}>{fc(props.netWorth)}</span>
              {m.yearGrowth != null && (
                <span className="mb-1 text-sm" style={{ color: m.yearGrowth >= 0 ? GREEN : ROSE }}>
                  {m.yearGrowth >= 0 ? "↑" : "↓"} {Math.abs(m.yearGrowth).toFixed(1)}%
                </span>
              )}
            </div>

            {/* Balance over time */}
            <p className="mt-8 text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.balanceOverTime")}</p>
            <BalanceChart trend={props.trend} fallback={props.netWorth} locale={locale} />

            {/* Balance sheet */}
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <BalanceCard label={t("treasury.accounts")} value={fc(m.accountsValue)} sub={t("treasury.cashInvestments")} />
              <BalanceCard label={t("treasury.otherAssets")} value={fc(m.otherAssets)} sub={t("treasury.propertyHoldings")} />
              <BalanceCard label={t("treasury.liabilities")} value={fc(m.liabilities)} sub={t("treasury.loansCredit")} color={ROSE} />
            </div>

            {/* Key insight */}
            <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(192,161,94,0.45)", background: "linear-gradient(90deg, rgba(192,161,94,0.12), rgba(192,161,94,0.03))" }}>
              <div className="border-l-2 p-5" style={{ borderColor: GOLD }}>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>{t("treasury.keyInsight")}</p>
                <p className="mt-2 font-serif text-lg" style={{ color: CREAM }}>{m.insight}</p>
              </div>
            </div>

            {/* Composition + snapshot */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.composition")}</p>
                <p className="mt-2 text-xs" style={{ color: MUTE }}>
                  {t("treasury.totalBeforeDebt")} <span style={{ color: CREAM }}>{fc(m.totalBeforeDebt)}</span>
                </p>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full" style={{ background: "rgba(236,230,216,0.08)" }}>
                  <div style={{ width: `${m.accountsPct}%`, background: GOLD }} />
                  <div style={{ width: `${100 - m.accountsPct}%`, background: "rgba(236,230,216,0.28)" }} />
                </div>
                <div className="mt-2 flex gap-4 text-[0.7rem]" style={{ color: MUTE }}>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: GOLD }} /> {t("treasury.accounts")} {m.accountsPct}%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "rgba(236,230,216,0.28)" }} /> {t("treasury.other")} {100 - m.accountsPct}%</span>
                </div>
              </div>
              <div>
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.snapshot")}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <SnapRow k={t("treasury.cashVsDebt")} v={m.liabilities > 0 ? `${Math.round((m.cash / m.liabilities) * 100)}%` : "∞"} />
                  <SnapRow k={t("treasury.linkedAccounts")} v={`${props.accounts.length}`} />
                  <SnapRow k={t("treasury.holdingsRecorded")} v={`${props.assets.length}`} />
                </dl>
              </div>
            </div>
          </motion.div>
        )}

        {section === "cashflow" && (
          <motion.div key="cf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>{t("treasury.railCashFlow")}</p>
            <h2 className="mt-1 font-serif text-2xl" style={{ color: CREAM }}>{t("treasury.cashFlowTitle")}</h2>
            <p className="text-sm" style={{ color: MUTE }}>{t("treasury.cashFlowSub")}</p>

            {props.monthIncome === 0 && props.monthSpending === 0 ? (
              <ManageHint text={t("treasury.emptyCashFlow")} cta={t("treasury.manageCta")} onManage={props.onManage} />
            ) : (
              <>
                <div className="mt-6 divide-y" style={{ borderColor: HAIR }}>
                  <FlowRow label={t("treasury.activeIncome")} value={fc(activeMonthly)} tone="pos" />
                  <FlowRow label={t("treasury.businessIncome")} value={fc(businessMonthly)} tone="pos" />
                  <FlowRow label={t("treasury.passiveIncome")} value={fc(passiveMonthly)} tone="pos" hint={t("treasury.est")} />
                  <FlowRow label={t("treasury.monthlyExpenses")} value={`- ${fc(props.monthSpending)}`} tone="neg" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border p-5" style={{ borderColor: "rgba(192,161,94,0.4)", background: "rgba(192,161,94,0.06)" }}>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>{t("treasury.freeCashFlow")}</span>
                  <span className="font-serif text-2xl" style={{ color: freeCashFlow >= 0 ? GREEN : ROSE }}>{fc(freeCashFlow)}</span>
                </div>
                <p className="mt-2 text-[0.7rem]" style={{ color: MUTE }}>{t("treasury.perMonth")}</p>
              </>
            )}
          </motion.div>
        )}

        {section === "investments" && (
          <motion.div key="inv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>{t("treasury.railInvestments")}</p>
            <h2 className="mt-1 font-serif text-2xl" style={{ color: CREAM }}>{t("treasury.investments")}</h2>
            <p className="mt-4 text-[0.6rem] uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.portfolioValue")}</p>
            <p className="font-serif text-4xl" style={{ color: "#F4EFE3" }}>{fc(props.portfolioValue)}</p>
            {props.holdings.length === 0 ? (
              <ManageHint text={t("treasury.emptyInvestments")} cta={t("treasury.manageCta")} onManage={props.onManage} />
            ) : (
              <div className="mt-5 divide-y" style={{ borderColor: HAIR }}>
                {props.holdings.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-3">
                    <span className="text-sm" style={{ color: CREAM }}>{h.symbol}</span>
                    <span className="font-serif text-lg" style={{ color: CREAM }}>{fc(h.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {section === "assets" && (
          <motion.div key="a" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
            {props.assets.length === 0 && props.accounts.length === 0 && (
              <ManageHint text={t("treasury.emptyAssets")} cta={t("treasury.manageCta")} onManage={props.onManage} />
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { key: "realEstate", icon: Building, value: m.realEstate },
              { key: "businesses", icon: Briefcase, value: m.businesses },
              { key: "investments", icon: LineIcon, value: m.investments },
              { key: "cashReserves", icon: Landmark, value: m.cash },
              { key: "valuableAssets", icon: Gem, value: m.valuables },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="rounded-xl border p-5" style={{ borderColor: HAIR }}>
                  <Icon className="h-4 w-4" style={{ color: GOLD }} />
                  <p className="mt-3 text-[0.6rem] uppercase tracking-[0.2em]" style={{ color: MUTE }}>{t(`treasury.${a.key}`)}</p>
                  <p className="mt-1 font-serif text-2xl" style={{ color: CREAM }}>{fc(a.value)}</p>
                </div>
              );
            })}
            </div>
          </motion.div>
        )}

        {section === "accounts" && (
          <motion.div key="c" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
            <div className="divide-y" style={{ borderColor: HAIR }}>
              {props.accounts.length === 0 && <p className="py-6 text-sm" style={{ color: MUTE }}>{t("treasury.noAccounts")}</p>}
              {props.accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3" style={{ borderColor: HAIR }}>
                  <div>
                    <p className="text-sm" style={{ color: CREAM }}>{a.name}</p>
                    <p className="text-[0.65rem] uppercase tracking-wider" style={{ color: MUTE }}>{a.type}</p>
                  </div>
                  <span className="font-serif text-lg" style={{ color: a.balance < 0 ? ROSE : CREAM }}>{fc(a.balance)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {section === "advisors" && (
          <Advisors m={m} fc={fc} />
        )}
      </div>
    </div>
  );
}

/* ---------------- Advisors desk ---------------- */
function Advisors({ m, fc }: { m: { liabilities: number; cash: number; investments: number }; fc: (n: number) => string }) {
  const { t } = useLocale();
  const [resolved, setResolved] = useState<Record<number, string>>({});
  const items: { title: string; sub: string }[] = [];
  if (m.liabilities > 0) items.push({ title: t("treasury.advLiabTitle"), sub: `${t("treasury.advLiabSub")} ${fc(m.liabilities)}.` });
  items.push({ title: t("treasury.advValTitle"), sub: t("treasury.advValSub") });
  if (m.investments <= 0) items.push({ title: t("treasury.advInvestTitle"), sub: t("treasury.advInvestSub") });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="pt-7">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em]" style={{ color: GOLD }}>{t("treasury.railAdvisors")}</p>
      <h2 className="mt-1 font-serif text-2xl" style={{ color: CREAM }}>{t("treasury.advisorsTitle")}</h2>
      <p className="text-sm" style={{ color: MUTE }}>{t("treasury.advisorsSub")}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Director card */}
        <div className="rounded-xl border p-5" style={{ borderColor: HAIR }}>
          <p className="text-[0.6rem] uppercase tracking-[0.2em]" style={{ color: GOLD }}>{t("treasury.directorRole")}</p>
          <p className="mt-1 font-serif text-xl" style={{ color: CREAM }}>{t("treasury.directorName")}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-wider" style={{ background: "rgba(107,169,127,0.15)", color: GREEN }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} /> {t("treasury.active")}
          </span>
          <p className="mt-3 text-sm" style={{ color: MUTE }}>{t("treasury.directorLine")}</p>
        </div>

        {/* Action stream */}
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em]" style={{ color: MUTE }}>{t("treasury.waitingOnYou")}</p>
          <div className="mt-3 space-y-3">
            {items.map((it, i) => {
              const state = resolved[i];
              return (
                <div key={i} className="rounded-xl border p-4" style={{ borderColor: state ? "rgba(107,169,127,0.4)" : HAIR }}>
                  <p className="font-serif text-base" style={{ color: CREAM }}>{it.title}</p>
                  <p className="mt-1 text-sm" style={{ color: MUTE }}>{it.sub}</p>
                  {state ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs" style={{ color: GREEN }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> {state}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdvBtn icon={Check} label={t("treasury.approve")} gold onClick={() => setResolved((r) => ({ ...r, [i]: t("treasury.approved") }))} />
                      <AdvBtn icon={MessageSquare} label={t("treasury.ask")} onClick={() => setResolved((r) => ({ ...r, [i]: t("treasury.asked") }))} />
                      <AdvBtn icon={ShieldCheck} label={t("treasury.letHandle")} onClick={() => setResolved((r) => ({ ...r, [i]: t("treasury.handled") }))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdvBtn({ icon: Icon, label, gold, onClick }: { icon: LucideIcon; label: string; gold?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors hover:opacity-80"
      style={{ borderColor: gold ? GOLD : HAIR, color: gold ? GOLD : MUTE }}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function FlowRow({ label, value, tone, hint }: { label: string; value: string; tone: "pos" | "neg"; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm" style={{ color: MUTE }}>
        {label}
        {hint && <span className="ml-1.5 text-[0.65rem]" style={{ color: "rgba(236,230,216,0.3)" }}>· {hint}</span>}
      </span>
      <span className="font-serif text-lg" style={{ color: tone === "neg" ? ROSE : CREAM }}>{value}</span>
    </div>
  );
}

function ManageHint({ text, cta, onManage }: { text: string; cta: string; onManage?: () => void }) {
  return (
    <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-dashed p-5" style={{ borderColor: HAIR }}>
      <p className="text-sm" style={{ color: MUTE }}>{text}</p>
      {onManage && (
        <button
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider transition-colors hover:opacity-80"
          style={{ borderColor: GOLD, color: GOLD }}
        >
          <Plus className="h-3 w-3" /> {cta}
        </button>
      )}
    </div>
  );
}

/* ---------------- Balance-over-time chart ---------------- */
function BalanceChart({ trend, fallback, locale }: { trend: { date: string; value: number }[]; fallback: number; locale: string }) {
  const pts =
    trend.length >= 2
      ? trend
      : Array.from({ length: 8 }, (_, i) => ({ date: "", value: fallback * (0.8 + (i / 7) * 0.2) }));
  const w = 900;
  const h = 190;
  const pad = 6;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const labels = trend.length >= 2 ? pickLabels(trend, locale) : [];

  return (
    <div className="mt-3 rounded-xl border p-4" style={{ borderColor: HAIR }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 190 }}>
        <defs>
          <linearGradient id="tgv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="rgba(236,230,216,0.06)" strokeWidth="1" />
        ))}
        <path d={`${line} L${x(pts.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} fill="url(#tgv)" />
        <path d={line} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      {labels.length > 0 && (
        <div className="mt-1 flex justify-between text-[0.6rem]" style={{ color: MUTE }}>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function pickLabels(trend: { date: string; value: number }[], locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { month: "short", day: "numeric" });
  const idxs = [0, Math.floor(trend.length / 2), trend.length - 1];
  return idxs.map((i) => {
    const d = trend[i]?.date;
    return d ? fmt.format(new Date(d)) : "";
  });
}

function BalanceCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: HAIR }}>
      <p className="text-[0.6rem] uppercase tracking-[0.2em]" style={{ color: MUTE }}>{label}</p>
      <p className="mt-2 font-serif text-2xl" style={{ color: color ?? CREAM }}>{value}</p>
      <p className="mt-1 text-[0.7rem]" style={{ color: MUTE }}>{sub}</p>
    </div>
  );
}

function SnapRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "rgba(236,230,216,0.06)" }}>
      <dt style={{ color: MUTE }}>{k}</dt>
      <dd style={{ color: CREAM }}>{v}</dd>
    </div>
  );
}
