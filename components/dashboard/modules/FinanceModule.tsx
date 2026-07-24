"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  Plus,
  Trash2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Target,
  Landmark,
  PiggyBank,
  CreditCard,
  Banknote,
  RefreshCcw,
  Home,
  Car,
  Building2,
  Box,
  type LucideIcon,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  ModuleHeader,
  Panel,
  StatCard,
  EmptyState,
  Field,
  inputClass,
  Numeral,
  Segmented,
} from "@/components/dashboard/ui";
import { TreasuryDashboard } from "@/components/dashboard/finance/TreasuryDashboard";
import {
  createTransaction,
  deleteTransaction,
  createAccount,
  deleteAccount,
  createBudget,
  deleteBudget,
  createRecurring,
  deleteRecurring,
  addInvestment,
  deleteInvestment,
  createAsset,
  deleteAsset,
} from "@/app/dashboard/finance/actions";

type Props = {
  currency: string;
  holderName: string | null;
  netWorth: number;
  businessNet: number;
  accountsTotal: number;
  monthIncome: number;
  monthSpending: number;
  savingsRate: number;
  portfolioValue: number;
  financialGoal: string | null;
  categoryData: { name: string; value: number }[];
  series: { label: string; income: number; expense: number }[];
  accounts: { id: string; name: string; type: string; balance: number }[];
  assets: { id: string; name: string; category: "property" | "vehicle" | "business" | "other"; value: number }[];
  budgets: { id: string; name: string; limit: number; spent: number }[];
  recurring: { id: string; name: string; amount: number; type: "in" | "out"; frequency: string; nextDate: string }[];
  trend: { date: string; value: number }[];
  recent: { id: string; amount: number; direction: "in" | "out"; label: string; occurred_at: string }[];
  holdings: { id: string; symbol: string; value: number }[];
};

const assetIcons: Record<string, LucideIcon> = {
  property: Home,
  vehicle: Car,
  business: Building2,
  other: Box,
};

const accountIcons: Record<string, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
};

export function FinanceModule(props: Props) {
  const { currency } = props;
  const { t, locale } = useLocale();
  const [openForm, setOpenForm] = useState<null | "tx" | "account" | "asset" | "budget" | "recurring">(null);
  const [view, setView] = useState<"treasury" | "classic">("treasury");
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const fc = (n: number) => formatCurrency(n, currency, { locale });

  return (
    <div>
      <div className="mb-5 flex items-center justify-end">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "treasury", label: t("treasury.viewTreasury") },
            { value: "classic", label: t("treasury.viewClassic") },
          ]}
        />
      </div>

      {view === "treasury" ? (
        <TreasuryDashboard
          currency={props.currency}
          holderName={props.holderName}
          netWorth={props.netWorth}
          accountsTotal={props.accountsTotal}
          portfolioValue={props.portfolioValue}
          businessNet={props.businessNet}
          savingsRate={props.savingsRate}
          accounts={props.accounts}
          assets={props.assets}
          trend={props.trend}
        />
      ) : (
      <div>
      <ModuleHeader
        icon={Wallet}
        title={t("finance.title")}
        subtitle={t("finance.subtitle")}
        accent="finance"
        action={
          <button
            onClick={() => setOpenForm(openForm === "tx" ? null : "tx")}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> {t("finance.addTransaction")}
          </button>
        }
      />

      {openForm === "tx" && (
        <Panel className="mb-6">
          <form
            action={(fd) => {
              startTransition(() => createTransaction(fd));
              setOpenForm(null);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label={t("finance.formType")}>
              <select name="direction" className={inputClass} defaultValue="out">
                <option value="out" className="bg-base">{t("finance.expense")}</option>
                <option value="in" className="bg-base">{t("finance.income")}</option>
              </select>
            </Field>
            <Field label={`${t("finance.formAmount")} (${currency})`}>
              <input type="number" name="amount" step="0.01" min="0" required placeholder="0" className={inputClass} />
            </Field>
            {props.accounts.length > 0 && (
              <Field label={t("finance.accountsTitle")}>
                <select name="account_id" className={inputClass} defaultValue={props.accounts[0].id}>
                  {props.accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-base">{a.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("finance.formCategory")}>
              <input name="category" placeholder={t("finance.formCategoryPlaceholder")} className={inputClass} />
            </Field>
            <Field label={t("finance.formDate")}>
              <input type="date" name="occurred_at" defaultValue={today} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("finance.formNote")}>
                <input name="description" placeholder={t("finance.formNotePlaceholder")} className={inputClass} />
              </Field>
            </div>
            <FormButtons onCancel={() => setOpenForm(null)} save={t("finance.save")} cancel={t("finance.cancel")} />
          </form>
        </Panel>
      )}

      {/* ==== Hero: premium balance card + stats ==== */}
      <div className="grid gap-4 lg:grid-cols-5">
        <BalanceCard
          className="lg:col-span-2"
          label={t("finance.cardBalanceLabel")}
          holder={props.holderName || t("finance.cardHolderFallback")}
          amount={fc(props.accountsTotal)}
          accounts={props.accounts.length}
          noCard={t("finance.noCard")}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
          <StatCard label={t("finance.statNetWorth")} value={fc(props.netWorth)} moduleAccent="finance" />
          <StatCard
            label={t("finance.statSavingsRate")}
            value={`${props.savingsRate}%`}
            hint={
              props.savingsRate >= 20
                ? t("finance.hintStrong")
                : props.savingsRate >= 0
                  ? t("finance.hintBuilding")
                  : t("finance.hintOverspending")
            }
          />
          <StatCard label={t("finance.statIncome")} value={fc(props.monthIncome)} />
          <StatCard label={t("finance.statSpending")} value={fc(props.monthSpending)} />
          <Link href="/dashboard/business" className="transition-transform hover:-translate-y-0.5">
            <StatCard
              label={t("finance.statBusinessNet")}
              value={fc(props.businessNet)}
              moduleAccent="business"
              hint={t("finance.statBusinessNetHint")}
            />
          </Link>
        </div>
      </div>

      {/* ==== Accounts ==== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHead
            title={t("finance.accountsTitle")}
            action={
              <SmallAdd
                label={t("finance.addAccount")}
                onClick={() => setOpenForm(openForm === "account" ? null : "account")}
              />
            }
          />
          {openForm === "account" && (
            <form
              action={(fd) => {
                startTransition(() => createAccount(fd));
                setOpenForm(null);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-3"
            >
              <Field label={t("finance.formAccountName")}>
                <input name="name" required placeholder={t("finance.formAccountNamePlaceholder")} className={inputClass} />
              </Field>
              <Field label={t("finance.formAccountType")}>
                <select name="type" className={inputClass} defaultValue="checking">
                  <option value="checking" className="bg-base">{t("finance.typeChecking")}</option>
                  <option value="savings" className="bg-base">{t("finance.typeSavings")}</option>
                  <option value="credit" className="bg-base">{t("finance.typeCredit")}</option>
                  <option value="cash" className="bg-base">{t("finance.typeCash")}</option>
                  <option value="investment" className="bg-base">{t("finance.typeInvestment")}</option>
                </select>
              </Field>
              <Field label={`${t("finance.formStartingBalance")} (${currency})`}>
                <input type="number" name="balance" step="0.01" placeholder="0" className={inputClass} />
              </Field>
              <FormButtons
                className="sm:col-span-3"
                onCancel={() => setOpenForm(null)}
                save={t("finance.save")}
                cancel={t("finance.cancel")}
              />
            </form>
          )}
          {props.accounts.length === 0 ? (
            <EmptyState icon={Landmark} title={t("finance.noAccounts")} hint={t("finance.noAccountsHint")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {props.accounts.map((a) => {
                const Icon = accountIcons[a.type] ?? Landmark;
                return (
                  <div
                    key={a.id}
                    className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/12 text-gold-soft">
                        <Icon className="h-4 w-4" />
                      </span>
                      <form action={() => startTransition(() => deleteAccount(a.id))}>
                        <button className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                    <p className="mt-3 truncate text-sm text-white/60">{a.name}</p>
                    <p className={`font-mono text-lg font-semibold tabular-nums tracking-tight ${a.balance < 0 ? "text-red-300" : ""}`}>
                      {fc(a.balance)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* ==== Net worth trend ==== */}
        <Panel className="lg:col-span-2">
          <SectionHead title={t("finance.netWorthTrendTitle")} />
          {props.trend.length < 2 ? (
            <p className="py-10 text-center text-sm text-white/40">{t("finance.noTrendYet")}</p>
          ) : (
            <TrendChart trend={props.trend} />
          )}
        </Panel>
      </div>

      {/* ==== Assets ==== */}
      <div className="mt-4">
        <Panel>
          <SectionHead
            title={t("finance.assetsTitle")}
            action={
              <SmallAdd
                label={t("finance.addAsset")}
                onClick={() => setOpenForm(openForm === "asset" ? null : "asset")}
              />
            }
          />
          {openForm === "asset" && (
            <form
              action={(fd) => {
                startTransition(() => createAsset(fd));
                setOpenForm(null);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-3"
            >
              <Field label={t("finance.formAssetName")}>
                <input name="name" required placeholder={t("finance.formAssetNamePlaceholder")} className={inputClass} />
              </Field>
              <Field label={t("finance.formAssetCategory")}>
                <select name="category" className={inputClass} defaultValue="property">
                  <option value="property" className="bg-base">{t("finance.assetProperty")}</option>
                  <option value="vehicle" className="bg-base">{t("finance.assetVehicle")}</option>
                  <option value="business" className="bg-base">{t("finance.assetBusiness")}</option>
                  <option value="other" className="bg-base">{t("finance.assetOther")}</option>
                </select>
              </Field>
              <Field label={`${t("finance.formEstimatedValue")} (${currency})`}>
                <input type="number" name="estimated_value" step="0.01" min="0" required placeholder="0" className={inputClass} />
              </Field>
              <FormButtons
                className="sm:col-span-3"
                onCancel={() => setOpenForm(null)}
                save={t("finance.save")}
                cancel={t("finance.cancel")}
              />
            </form>
          )}
          {props.assets.length === 0 ? (
            <EmptyState icon={Home} title={t("finance.noAssets")} hint={t("finance.noAssetsHint")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {props.assets.map((a) => {
                const Icon = assetIcons[a.category] ?? Box;
                return (
                  <div
                    key={a.id}
                    className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-white/[0.05] to-white/[0.015] p-4 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/12 text-gold-soft">
                        <Icon className="h-4 w-4" />
                      </span>
                      <form action={() => startTransition(() => deleteAsset(a.id))}>
                        <button className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                    <p className="mt-3 truncate text-sm text-white/60">{a.name}</p>
                    <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">{fc(a.value)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ==== Cash flow + categories ==== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("finance.cashFlowTitle")}</h3>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> {t("finance.income")}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" /> {t("finance.expense")}</span>
            </div>
          </div>
          <CashFlowChart series={props.series} fc={fc} />
        </Panel>

        <Panel className="lg:col-span-2">
          <SectionHead title={t("finance.categoriesTitle")} />
          {props.categoryData.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">{t("finance.noSpending")}</p>
          ) : (
            <div className="space-y-3">
              {props.categoryData.map((c) => {
                const max = props.categoryData[0].value || 1;
                return (
                  <div key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate text-white/70">{c.name}</span>
                      <Numeral className="text-white/50">{fc(c.value)}</Numeral>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-soft" style={{ width: `${(c.value / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ==== Budgets + recurring ==== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionHead
            title={t("finance.budgetsTitle")}
            action={
              <SmallAdd
                label={t("finance.addBudget")}
                onClick={() => setOpenForm(openForm === "budget" ? null : "budget")}
              />
            }
          />
          {openForm === "budget" && (
            <form
              action={(fd) => {
                startTransition(() => createBudget(fd));
                setOpenForm(null);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
            >
              <Field label={t("finance.formBudgetName")}>
                <input name="name" required placeholder={t("finance.formBudgetNamePlaceholder")} className={inputClass} />
              </Field>
              <Field label={`${t("finance.formMonthlyLimit")} (${currency})`}>
                <input type="number" name="monthly_limit" step="0.01" min="0" required placeholder="0" className={inputClass} />
              </Field>
              <FormButtons
                className="sm:col-span-2"
                onCancel={() => setOpenForm(null)}
                save={t("finance.save")}
                cancel={t("finance.cancel")}
              />
            </form>
          )}
          {props.budgets.length === 0 ? (
            <EmptyState icon={Target} title={t("finance.noBudgets")} hint={t("finance.noBudgetsHint")} />
          ) : (
            <div className="space-y-4">
              {props.budgets.map((b) => {
                const pct = Math.min(100, Math.round((b.spent / (b.limit || 1)) * 100));
                const over = b.spent > b.limit;
                return (
                  <div key={b.id} className="group">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-white/75">{b.name}</span>
                      <span className="flex items-center gap-2">
                        <span className={`font-mono tabular-nums ${over ? "text-red-300" : "text-white/50"}`}>
                          {fc(b.spent)} / {fc(b.limit)}
                        </span>
                        <form action={() => startTransition(() => deleteBudget(b.id))}>
                          <button className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          over
                            ? "bg-gradient-to-r from-red-400 to-red-300"
                            : pct > 80
                              ? "bg-gradient-to-r from-amber-400 to-amber-300"
                              : "bg-gradient-to-r from-accent to-accent-soft"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHead
            title={t("finance.recurringTitle")}
            action={
              <SmallAdd
                label={t("finance.addRecurring")}
                onClick={() => setOpenForm(openForm === "recurring" ? null : "recurring")}
              />
            }
          />
          {openForm === "recurring" && (
            <form
              action={(fd) => {
                startTransition(() => createRecurring(fd));
                setOpenForm(null);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
            >
              <Field label={t("finance.formRecurringName")}>
                <input name="name" required placeholder={t("finance.formRecurringNamePlaceholder")} className={inputClass} />
              </Field>
              <Field label={`${t("finance.formAmount")} (${currency})`}>
                <input type="number" name="amount" step="0.01" min="0" required placeholder="0" className={inputClass} />
              </Field>
              <Field label={t("finance.formType")}>
                <select name="type" className={inputClass} defaultValue="out">
                  <option value="out" className="bg-base">{t("finance.expense")}</option>
                  <option value="in" className="bg-base">{t("finance.income")}</option>
                </select>
              </Field>
              <Field label={t("finance.formFrequency")}>
                <select name="frequency" className={inputClass} defaultValue="monthly">
                  <option value="weekly" className="bg-base">{t("finance.freqWeekly")}</option>
                  <option value="monthly" className="bg-base">{t("finance.freqMonthly")}</option>
                  <option value="yearly" className="bg-base">{t("finance.freqYearly")}</option>
                </select>
              </Field>
              <Field label={t("finance.formNextDate")}>
                <input type="date" name="next_date" defaultValue={today} className={inputClass} />
              </Field>
              <FormButtons
                className="sm:col-span-2"
                onCancel={() => setOpenForm(null)}
                save={t("finance.save")}
                cancel={t("finance.cancel")}
              />
            </form>
          )}
          {props.recurring.length === 0 ? (
            <EmptyState icon={RefreshCcw} title={t("finance.noRecurring")} hint={t("finance.noRecurringHint")} />
          ) : (
            <div className="divide-y divide-hairline">
              {props.recurring.map((r) => (
                <div key={r.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-gold-soft">
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-white/40">
                      {t(`finance.freq${r.frequency.charAt(0).toUpperCase()}${r.frequency.slice(1)}`)} · {formatDate(r.nextDate, undefined, locale)}
                    </p>
                  </div>
                  <span className={`font-mono tabular-nums text-sm font-medium ${r.type === "in" ? "text-emerald-300" : "text-white/80"}`}>
                    {r.type === "in" ? "+" : "−"}{fc(r.amount)}
                  </span>
                  <form action={() => startTransition(() => deleteRecurring(r.id))}>
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

      {props.financialGoal && (
        <Panel className="mt-4 flex items-center gap-3">
          <Target className="h-4 w-4 shrink-0 text-gold-soft" />
          <p className="text-sm text-white/70">
            <span className="text-white/40">{t("finance.financialGoalPrefix")}</span>
            {props.financialGoal}
          </p>
        </Panel>
      )}

      {/* ==== Transactions + investments ==== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHead title={t("finance.transactionsTitle")} />
          {props.recent.length === 0 ? (
            <EmptyState icon={Wallet} title={t("finance.noTransactions")} hint={t("finance.noTransactionsHint")} />
          ) : (
            <div className="divide-y divide-hairline">
              {props.recent.map((tx) => (
                <div key={tx.id} className="group flex items-center gap-3 py-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      tx.direction === "in" ? "bg-emerald-400/12 text-emerald-300" : "bg-white/6 text-white/60"
                    }`}
                  >
                    {tx.direction === "in" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.label}</p>
                    <p className="text-xs text-white/40">{formatDate(tx.occurred_at, undefined, locale)}</p>
                  </div>
                  <span className={`font-mono tabular-nums text-sm font-medium ${tx.direction === "in" ? "text-emerald-300" : "text-white/80"}`}>
                    {tx.direction === "in" ? "+" : "−"}{fc(tx.amount)}
                  </span>
                  <form action={() => startTransition(() => deleteTransaction(tx.id))}>
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
            <h3 className="text-sm font-semibold">{t("finance.investmentsTitle")}</h3>
            <span className="font-mono tabular-nums text-sm text-gold-soft">{fc(props.portfolioValue)}</span>
          </div>
          <form action={(fd) => startTransition(() => addInvestment(fd))} className="mb-4 flex gap-2">
            <input name="symbol" required placeholder={t("finance.formSymbol")} className={inputClass} />
            <input name="value" type="number" step="0.01" min="0" required placeholder={t("finance.formValue")} className={inputClass + " max-w-[7rem]"} />
            <button className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-gold px-3 text-black transition-transform hover:-translate-y-0.5" aria-label="Add investment">
              <Plus className="h-4 w-4" />
            </button>
          </form>
          {props.holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/40">{t("finance.noHoldings")}</p>
          ) : (
            <div className="divide-y divide-hairline">
              {props.holdings.map((h) => (
                <div key={h.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-gold-soft">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{h.symbol}</span>
                  <span className="font-mono tabular-nums text-sm text-white/70">{fc(h.value)}</span>
                  <form action={() => startTransition(() => deleteInvestment(h.id))}>
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
      )}
    </div>
  );
}

/* ---- Building blocks ---- */

function BalanceCard({
  className = "",
  label,
  holder,
  amount,
  accounts,
  noCard,
}: {
  className?: string;
  label: string;
  holder: string;
  amount: string;
  accounts: number;
  noCard: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-3xl p-6 shadow-glow-gold ${className}`}
      style={{
        background:
          "linear-gradient(135deg, #1a1408 0%, #241d0f 45%, #14100a 100%)",
        border: "1px solid rgba(231,178,76,0.25)",
      }}
    >
      {/* sheen + texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 85% 0%, rgba(231,178,76,0.28), transparent 55%), radial-gradient(80% 60% at 10% 100%, rgba(231,178,76,0.12), transparent 60%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">{label}</p>
          <span className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded-full bg-gold/70" />
            <span className="-ml-3 h-6 w-6 rounded-full bg-white/25 backdrop-blur" />
          </span>
        </div>
        <div>
          <Numeral className="block text-3xl font-semibold tracking-tight sm:text-4xl">{amount}</Numeral>
          {accounts === 0 && <p className="mt-1 text-xs text-white/40">{noCard}</p>}
        </div>
        <div className="flex items-end justify-between">
          <p className="text-sm font-medium tracking-wide text-white/75">{holder}</p>
          <p className="font-mono text-xs tracking-[0.3em] text-white/35">•••• {String(1000 + accounts * 137).slice(-4)}</p>
        </div>
      </div>
    </motion.div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-semibold">{title}</h3>
      {action}
    </div>
  );
}

function SmallAdd({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
    >
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function FormButtons({
  className = "",
  onCancel,
  save,
  cancel,
}: {
  className?: string;
  onCancel: () => void;
  save: string;
  cancel: string;
}) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <button type="submit" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5">
        {save}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
        {cancel}
      </button>
    </div>
  );
}

function TrendChart({ trend }: { trend: { date: string; value: number }[] }) {
  const w = 100;
  const h = 40;
  const values = trend.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (trend.length - 1);
  const pts = trend.map((p, i) => `${i * step},${h - ((p.value - min) / range) * (h - 6) - 3}`);
  const line = pts.join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-36 w-full">
      <defs>
        <linearGradient id="nw-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E7B24C" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E7B24C" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#nw-area)" />
      <polyline
        points={line}
        fill="none"
        stroke="#F5D58A"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CashFlowChart({
  series,
  fc,
}: {
  series: { label: string; income: number; expense: number }[];
  fc: (n: number) => string;
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
              className="w-full max-w-[14px] rounded-t-md bg-gradient-to-t from-gold-deep/70 to-gold-soft"
              title={fc(s.income)}
            />
            <motion.div
              initial={{ height: 0 }}
              whileInView={{ height: `${(s.expense / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="w-full max-w-[14px] rounded-t-md bg-white/20"
              title={fc(s.expense)}
            />
          </div>
          <span className="text-xs text-white/40">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
