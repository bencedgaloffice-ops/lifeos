"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Plus,
  Trash2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Target,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ModuleHeader,
  Panel,
  StatCard,
  EmptyState,
  Field,
  inputClass,
} from "@/components/dashboard/ui";
import {
  createTransaction,
  deleteTransaction,
  addInvestment,
  deleteInvestment,
} from "@/app/dashboard/finance/actions";

type Props = {
  currency: string;
  netWorth: number;
  monthIncome: number;
  monthSpending: number;
  savingsRate: number;
  portfolioValue: number;
  financialGoal: string | null;
  categoryData: { name: string; value: number }[];
  series: { label: string; income: number; expense: number }[];
  recent: { id: string; amount: number; direction: "in" | "out"; label: string; occurred_at: string }[];
  holdings: { id: string; symbol: string; value: number }[];
};

export function FinanceModule(props: Props) {
  const { currency } = props;
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ModuleHeader
        icon={Wallet}
        title="Finance"
        subtitle="Your wealth, in full view."
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> Add transaction
          </button>
        }
      />

      {open && (
        <Panel className="mb-6">
          <form
            action={(fd) => {
              startTransition(() => createTransaction(fd));
              setOpen(false);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Type">
              <select name="direction" className={inputClass} defaultValue="out">
                <option value="out" className="bg-base">Expense</option>
                <option value="in" className="bg-base">Income</option>
              </select>
            </Field>
            <Field label={`Amount (${currency})`}>
              <input type="number" name="amount" step="0.01" min="0" required placeholder="0" className={inputClass} />
            </Field>
            <Field label="Category">
              <input name="category" placeholder="Housing, Food, Salary…" className={inputClass} />
            </Field>
            <Field label="Date">
              <input type="date" name="occurred_at" defaultValue={today} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note (optional)">
                <input name="description" placeholder="Details" className={inputClass} />
              </Field>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                Save
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net worth" value={formatCurrency(props.netWorth, currency)} accent hint="Savings + investments" />
        <StatCard label="Income · this month" value={formatCurrency(props.monthIncome, currency)} />
        <StatCard label="Spending · this month" value={formatCurrency(props.monthSpending, currency)} />
        <StatCard
          label="Savings rate"
          value={`${props.savingsRate}%`}
          hint={props.savingsRate >= 20 ? "Strong" : props.savingsRate >= 0 ? "Building" : "Overspending"}
        />
      </div>

      {/* Charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cash flow · 6 months</h3>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" /> Expense</span>
            </div>
          </div>
          <CashFlowChart series={props.series} currency={currency} />
        </Panel>

        <Panel className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">Spending by category</h3>
          {props.categoryData.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">No spending logged this month.</p>
          ) : (
            <div className="space-y-3">
              {props.categoryData.map((c) => {
                const max = props.categoryData[0].value || 1;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-white/70">{c.name}</span>
                      <span className="tabular-nums text-white/50">{formatCurrency(c.value, currency)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft" style={{ width: `${(c.value / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {props.financialGoal && (
        <Panel className="mt-4 flex items-center gap-3">
          <Target className="h-4 w-4 shrink-0 text-accent-soft" />
          <p className="text-sm text-white/70">
            <span className="text-white/40">Financial goal · </span>
            {props.financialGoal}
          </p>
        </Panel>
      )}

      {/* Transactions + Investments */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <h3 className="mb-4 text-sm font-semibold">Recent transactions</h3>
          {props.recent.length === 0 ? (
            <EmptyState icon={Wallet} title="No transactions yet" hint="Add income or an expense to begin tracking." />
          ) : (
            <div className="divide-y divide-hairline">
              {props.recent.map((t) => (
                <div key={t.id} className="group flex items-center gap-3 py-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      t.direction === "in" ? "bg-emerald-400/12 text-emerald-300" : "bg-white/6 text-white/60"
                    }`}
                  >
                    {t.direction === "in" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-white/40">{formatDate(t.occurred_at)}</p>
                  </div>
                  <span className={`tabular-nums text-sm font-medium ${t.direction === "in" ? "text-emerald-300" : "text-white/80"}`}>
                    {t.direction === "in" ? "+" : "−"}
                    {formatCurrency(t.amount, currency)}
                  </span>
                  <form action={() => deleteTransaction(t.id)}>
                    <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Investments</h3>
            <span className="tabular-nums text-sm text-accent-soft">{formatCurrency(props.portfolioValue, currency)}</span>
          </div>
          <form action={addInvestment} className="mb-4 flex gap-2">
            <input name="symbol" required placeholder="Symbol / name" className={inputClass} />
            <input name="value" type="number" step="0.01" min="0" required placeholder="Value" className={inputClass + " max-w-[7rem]"} />
            <button className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-accent px-3 text-white transition-transform hover:-translate-y-0.5" aria-label="Add investment">
              <Plus className="h-4 w-4" />
            </button>
          </form>
          {props.holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">No holdings yet.</p>
          ) : (
            <div className="divide-y divide-hairline">
              {props.holdings.map((h) => (
                <div key={h.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-accent-soft">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{h.symbol}</span>
                  <span className="tabular-nums text-sm text-white/70">{formatCurrency(h.value, currency)}</span>
                  <form action={() => deleteInvestment(h.id)}>
                    <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CashFlowChart({
  series,
  currency,
}: {
  series: { label: string; income: number; expense: number }[];
  currency: string;
}) {
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  return (
    <div className="flex h-48 items-end justify-between gap-3">
      {series.map((s) => (
        <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-40 w-full items-end justify-center gap-1.5">
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(s.income / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-accent/60 to-accent-soft"
              title={`Income: ${formatCurrency(s.income, currency)}`}
            />
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(s.expense / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="w-full max-w-[14px] rounded-t-md bg-white/20"
              title={`Expense: ${formatCurrency(s.expense, currency)}`}
            />
          </div>
          <span className="text-xs text-white/40">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
