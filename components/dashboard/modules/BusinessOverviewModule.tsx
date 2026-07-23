"use client";

import Link from "next/link";
import { Briefcase, ArrowUpRight, Clock, TrendingUp } from "lucide-react";
import type { Organization, Transaction, CalendarEvent } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, StatCard, Pill, EmptyState } from "@/components/dashboard/ui";

type Props = {
  organizations: Organization[];
  transactions: Transaction[];
  events: CalendarEvent[];
  currency: string;
};

export function BusinessOverviewModule({ organizations, transactions, events, currency }: Props) {
  const { t, locale } = useLocale();

  const income = transactions.filter((tx) => tx.direction === "in").reduce((s, tx) => s + Number(tx.amount), 0);
  const expense = transactions.filter((tx) => tx.direction === "out").reduce((s, tx) => s + Number(tx.amount), 0);
  const net = income - expense;

  const perOrg = organizations.map((org) => {
    const orgTx = transactions.filter((tx) => tx.organization_id === org.id);
    const orgIncome = orgTx.filter((tx) => tx.direction === "in").reduce((s, tx) => s + Number(tx.amount), 0);
    const orgExpense = orgTx.filter((tx) => tx.direction === "out").reduce((s, tx) => s + Number(tx.amount), 0);
    return { org, net: orgIncome - orgExpense };
  });

  const hoursOf = (list: CalendarEvent[]) =>
    list.reduce((s, e) => s + Math.max(0, new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / 3_600_000, 0);

  const lifeHours = hoursOf(events.filter((e) => !e.organization_id));
  const orgHours = organizations.map((org) => ({
    org,
    hours: hoursOf(events.filter((e) => e.organization_id === org.id)),
  }));
  const totalHours = lifeHours + orgHours.reduce((s, o) => s + o.hours, 0);

  return (
    <div>
      <ModuleHeader icon={Briefcase} title={t("nav.businessOverview.label")} subtitle={t("business.overviewSubtitle")} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("business.statIncome")} value={formatCurrency(income, currency, { compact: true, locale })} />
        <StatCard label={t("business.statExpense")} value={formatCurrency(expense, currency, { compact: true, locale })} />
        <StatCard label={t("business.statNet")} value={formatCurrency(net, currency, { compact: true, locale })} accent={net >= 0} />
        <StatCard label={t("business.statOrgs")} value={String(organizations.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cross-org financial rollup */}
        <Panel>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-accent-soft" /> {t("business.rollupTitle")}
          </h3>
          {perOrg.length === 0 ? (
            <EmptyState icon={TrendingUp} title={t("business.emptyGeneric")} />
          ) : (
            <div className="space-y-3">
              {perOrg.map(({ org, net: orgNet }) => (
                <div key={org.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-white/80">{org.name}</span>
                  <span className={`text-sm font-medium ${orgNet >= 0 ? "text-emerald-300" : "text-white/70"}`}>
                    {formatCurrency(orgNet, currency, { compact: true, locale })}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-white/35">{t("business.rollupHint")}</p>
        </Panel>

        {/* Time allocation view */}
        <Panel>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-accent-soft" /> {t("business.timeAllocationTitle")}
          </h3>
          {totalHours === 0 ? (
            <EmptyState icon={Clock} title={t("business.noTimeData")} hint={t("business.noTimeDataHint")} />
          ) : (
            <div className="space-y-3">
              <TimeBar label={t("shell.section.life")} hours={lifeHours} total={totalHours} />
              {orgHours.map(({ org, hours }) => (
                <TimeBar key={org.id} label={org.name} hours={hours} total={totalHours} />
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-white/35">{t("business.timeAllocationHint")}</p>
        </Panel>
      </div>

      {/* Organization cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {organizations.map((org) => (
          <Link
            key={org.id}
            href={`/dashboard/business/${org.id}`}
            className="group relative overflow-hidden rounded-2xl glass p-4 shadow-glass transition-transform hover:-translate-y-0.5"
          >
            <Pill tone="accent">{t(`business.type.${org.type ?? "own_business"}`)}</Pill>
            <p className="mt-2.5 truncate text-sm font-semibold tracking-tight">{org.name}</p>
            <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/25 transition-colors group-hover:text-white/60" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function TimeBar({ label, hours, total }: { label: string; hours: number; total: number }) {
  const pct = total > 0 ? Math.round((hours / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="truncate text-white/80">{label}</span>
        <span className="text-white/45">{hours.toFixed(1)}h</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
