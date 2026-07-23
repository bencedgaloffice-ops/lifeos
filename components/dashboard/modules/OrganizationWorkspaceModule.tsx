"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Briefcase,
  ArrowLeft,
  Wallet,
  FolderKanban,
  BadgeCheck,
  Hexagon,
  ShoppingBag,
  Landmark,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import type {
  Organization,
  Transaction,
  Project,
  OrgLicense,
  Apiary,
  Hive,
  HiveInspection,
  HoneyHarvestLog,
  Product,
  Customer,
  Order,
  OrderItem,
  GrantApplication,
  GrantCorrespondence,
  MasterplanPhase,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, StatCard, Pill, Progress, EmptyState, Field, inputClass, Segmented } from "@/components/dashboard/ui";
import { updateOrganization } from "@/app/dashboard/business/actions";
import {
  createOrgTransaction,
  deleteOrgTransaction,
  createLicense,
  deleteLicense,
  createApiary,
  createHive,
  updateHiveStatus,
  deleteHive,
  createInspection,
  deleteInspection,
  createHarvest,
  deleteHarvest,
  createProduct,
  deleteProduct,
  createCustomer,
  deleteCustomer,
  createOrder,
  deleteOrder,
  updateGrantStatus,
  createGrantApplication,
  createCorrespondence,
  deleteCorrespondence,
  createMasterplanPhase,
  updateMasterplanPhaseStatus,
  deleteMasterplanPhase,
} from "@/app/dashboard/business/[orgId]/actions";

type Props = {
  organization: Organization;
  transactions: Transaction[];
  projects: Project[];
  licenses: OrgLicense[];
  apiaries: Apiary[];
  hives: Hive[];
  inspections: HiveInspection[];
  harvests: HoneyHarvestLog[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  grants: GrantApplication[];
  correspondence: GrantCorrespondence[];
  masterplan: MasterplanPhase[];
  currency: string;
};

type Tab = "overview" | "financials" | "projects" | "licenses" | "beekeeping" | "sales" | "grant";

export function OrganizationWorkspaceModule(props: Props) {
  const { organization, transactions, projects, licenses, apiaries, hives, harvests, products, grants, currency } = props;
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  const income = transactions.filter((tx) => tx.direction === "in").reduce((s, tx) => s + Number(tx.amount), 0);
  const expense = transactions.filter((tx) => tx.direction === "out").reduce((s, tx) => s + Number(tx.amount), 0);
  const net = income - expense;
  const totalHarvestKg = harvests.reduce((s, h) => s + Number(h.quantity_kg), 0);

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: t("business.tabs.overview") },
    { value: "financials", label: t("business.tabs.financials") },
    { value: "projects", label: t("business.tabs.projects") },
    { value: "licenses", label: t("business.tabs.licenses") },
    { value: "beekeeping", label: t("business.tabs.beekeeping") },
    { value: "sales", label: t("business.tabs.sales") },
    { value: "grant", label: t("business.tabs.grant") },
  ];

  return (
    <div>
      <Link href="/dashboard/business/organizations" className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-white/80">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("business.backToOrgs")}
      </Link>

      <ModuleHeader
        icon={Briefcase}
        title={organization.name}
        subtitle={organization.description ?? t(`business.type.${organization.type ?? "own_business"}`)}
        action={
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("business.rename")}
          </button>
        }
      />

      {editing && (
        <form
          action={(fd) => {
            startTransition(() => updateOrganization(organization.id, fd));
            setEditing(false);
          }}
          className="mb-5 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
        >
          <Field label={t("business.formName")}>
            <input name="name" defaultValue={organization.name} required className={inputClass} />
          </Field>
          <Field label={t("business.formDescription")}>
            <input name="description" defaultValue={organization.description ?? ""} className={inputClass} />
          </Field>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
              {t("business.save")}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
              {t("business.cancel")}
            </button>
          </div>
        </form>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("business.statIncome")} value={formatCurrency(income, currency, { compact: true, locale })} />
        <StatCard label={t("business.statExpense")} value={formatCurrency(expense, currency, { compact: true, locale })} />
        <StatCard label={t("business.statNet")} value={formatCurrency(net, currency, { compact: true, locale })} accent={net >= 0} />
        <StatCard label={t("business.statProjects")} value={String(projects.length)} />
      </div>

      <Segmented value={tab} onChange={setTab} options={tabs} className="mb-5" />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-4 w-4 text-accent-soft" /> {t("business.tabs.licenses")}</h3>
            {licenses.length === 0 ? <p className="text-xs text-white/40">{t("business.emptyGeneric")}</p> : (
              <ul className="space-y-2 text-sm">
                {licenses.slice(0, 4).map((l) => <li key={l.id} className="flex items-center justify-between gap-2"><span className="truncate text-white/80">{l.name}</span><Pill tone={l.status === "active" ? "green" : "amber"}>{t(`business.licenseStatus.${l.status}`)}</Pill></li>)}
              </ul>
            )}
          </Panel>
          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Hexagon className="h-4 w-4 text-accent-soft" /> {t("business.tabs.beekeeping")}</h3>
            {apiaries.length === 0 ? <p className="text-xs text-white/40">{t("business.emptyGeneric")}</p> : (
              <p className="text-sm text-white/70">{t("business.hiveSummary", { hives: hives.length, kg: totalHarvestKg.toFixed(1) })}</p>
            )}
          </Panel>
          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-accent-soft" /> {t("business.tabs.grant")}</h3>
            {grants.length === 0 ? <p className="text-xs text-white/40">{t("business.emptyGeneric")}</p> : (
              <ul className="space-y-2 text-sm">
                {grants.map((g) => <li key={g.id} className="flex items-center justify-between gap-2"><span className="truncate text-white/80">{g.program_name}</span><Pill tone="accent">{t(`business.grantStatus.${g.status}`)}</Pill></li>)}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "financials" && <FinancialsTab {...props} startTransition={startTransition} />}
      {tab === "projects" && <ProjectsTab projects={projects} locale={locale} />}
      {tab === "licenses" && <LicensesTab {...props} startTransition={startTransition} />}
      {tab === "beekeeping" && <BeekeepingTab {...props} startTransition={startTransition} />}
      {tab === "sales" && <SalesTab {...props} startTransition={startTransition} />}
      {tab === "grant" && <GrantTab {...props} startTransition={startTransition} />}
    </div>
  );
}

/* ---------------- Financials ---------------- */

function FinancialsTab({ organization, transactions, currency: cur, startTransition }: Props & { startTransition: React.TransitionStartFunction }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-accent-soft" /> {t("business.tabs.financials")}</h3>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
          <Plus className="h-3.5 w-3.5" /> {t("business.addTransaction")}
        </button>
      </div>
      {open && (
        <form
          action={(fd) => {
            startTransition(() => createOrgTransaction(organization.id, organization.name, fd));
            setOpen(false);
          }}
          className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
        >
          <Field label={t("business.formAmount")}><input type="number" step="0.01" name="amount" required className={inputClass} /></Field>
          <Field label={t("business.formDirection")}>
            <select name="direction" defaultValue="in" className={inputClass}>
              <option value="in" className="bg-base">{t("business.income")}</option>
              <option value="out" className="bg-base">{t("business.expense")}</option>
            </select>
          </Field>
          <Field label={t("business.formDescription")}><input name="description" className={inputClass} /></Field>
          <Field label={t("business.formDate")}><input type="date" name="occurred_at" className={inputClass} /></Field>
          <FormButtons t={t} onCancel={() => setOpen(false)} className="sm:col-span-2" />
        </form>
      )}
      {transactions.length === 0 ? <EmptyState icon={Wallet} title={t("business.noTransactions")} /> : (
        <div className="divide-y divide-hairline">
          {transactions.map((tx) => (
            <div key={tx.id} className="group flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description || t(`business.${tx.direction === "in" ? "income" : "expense"}`)}</p>
                <p className="text-xs text-white/40">{formatDate(tx.occurred_at, undefined, locale)}</p>
              </div>
              <span className={tx.direction === "in" ? "text-sm font-medium text-emerald-300" : "text-sm font-medium text-white/70"}>
                {tx.direction === "in" ? "+" : "−"}{formatCurrency(Number(tx.amount), cur, { locale })}
              </span>
              <form action={() => startTransition(() => deleteOrgTransaction(organization.id, tx.id))}>
                <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Projects ---------------- */

function ProjectsTab({ projects, locale }: { projects: Project[]; locale: "en" | "hu" }) {
  const { t } = useLocale();
  return (
    <Panel>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold"><FolderKanban className="h-4 w-4 text-accent-soft" /> {t("business.tabs.projects")}</h3>
      {projects.length === 0 ? <EmptyState icon={FolderKanban} title={t("business.noProjects")} hint={t("business.noProjectsHint")} /> : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div key={p.id}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="truncate text-white/80">{p.name}</span>
                <span className="text-white/45">{p.progress_percent}%</span>
              </div>
              <Progress value={p.progress_percent} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-white/35">{t("business.linkProjectsHint")}</p>
    </Panel>
  );
}

/* ---------------- Licenses ---------------- */

function LicensesTab({ organization, licenses, startTransition }: Props & { startTransition: React.TransitionStartFunction }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-4 w-4 text-accent-soft" /> {t("business.tabs.licenses")}</h3>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
          <Plus className="h-3.5 w-3.5" /> {t("business.addLicense")}
        </button>
      </div>
      {open && (
        <form
          action={(fd) => {
            startTransition(() => createLicense(organization.id, fd));
            setOpen(false);
          }}
          className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
        >
          <Field label={t("business.formLicenseName")}><input name="name" required className={inputClass} /></Field>
          <Field label={t("business.formLicenseNumber")}><input name="license_number" className={inputClass} /></Field>
          <Field label={t("business.formIssuingBody")}><input name="issuing_body" className={inputClass} /></Field>
          <Field label={t("business.formExpiresAt")}><input type="date" name="expires_at" className={inputClass} /></Field>
          <FormButtons t={t} onCancel={() => setOpen(false)} className="sm:col-span-2" />
        </form>
      )}
      {licenses.length === 0 ? <EmptyState icon={BadgeCheck} title={t("business.noLicenses")} /> : (
        <div className="divide-y divide-hairline">
          {licenses.map((l) => (
            <div key={l.id} className="group flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.name}</p>
                <p className="text-xs text-white/40">{l.issuing_body} {l.license_number && `· ${l.license_number}`}{l.expires_at && ` · ${t("business.expiresPrefix")} ${formatDate(l.expires_at, undefined, locale)}`}</p>
              </div>
              <Pill tone={l.status === "active" ? "green" : "amber"}>{t(`business.licenseStatus.${l.status}`)}</Pill>
              <form action={() => startTransition(() => deleteLicense(organization.id, l.id))}>
                <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Beekeeping ---------------- */

function BeekeepingTab({ organization, apiaries, hives, inspections, harvests, startTransition }: Props & { startTransition: React.TransitionStartFunction }) {
  const { t, locale } = useLocale();
  const [openApiary, setOpenApiary] = useState(false);
  const [openHive, setOpenHive] = useState<string | null>(null);
  const [openInspection, setOpenInspection] = useState<string | null>(null);
  const [openHarvest, setOpenHarvest] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Hexagon className="h-4 w-4 text-accent-soft" /> {t("business.apiaries")}</h3>
          <button onClick={() => setOpenApiary((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("business.addApiary")}
          </button>
        </div>
        {openApiary && (
          <form
            action={(fd) => {
              startTransition(() => createApiary(organization.id, fd));
              setOpenApiary(false);
            }}
            className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("business.formName")}><input name="name" required className={inputClass} /></Field>
            <Field label={t("business.formLocation")}><input name="location_text" className={inputClass} /></Field>
            <FormButtons t={t} onCancel={() => setOpenApiary(false)} className="sm:col-span-2" />
          </form>
        )}
        {apiaries.length === 0 ? <EmptyState icon={Hexagon} title={t("business.noApiaries")} /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {apiaries.map((apiary) => {
              const apiaryHives = hives.filter((h) => h.apiary_id === apiary.id);
              const apiaryHarvests = harvests.filter((h) => h.apiary_id === apiary.id);
              return (
                <div key={apiary.id} className="rounded-2xl bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold">{apiary.name}</p>
                  {apiary.location_text && <p className="text-xs text-white/40">{apiary.location_text}</p>}

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-white/40">{t("business.hives")}</span>
                    <button onClick={() => setOpenHive(openHive === apiary.id ? null : apiary.id)} className="text-xs text-accent-soft hover:underline">
                      + {t("business.addHive")}
                    </button>
                  </div>
                  {openHive === apiary.id && (
                    <form
                      action={(fd) => {
                        startTransition(() => createHive(organization.id, apiary.id, fd));
                        setOpenHive(null);
                      }}
                      className="my-2 grid gap-2 rounded-xl bg-white/[0.03] p-3"
                    >
                      <input name="label" required placeholder={t("business.formHiveLabel")} className={inputClass} />
                      <select name="colony_status" defaultValue="stable" className={inputClass}>
                        {["thriving", "stable", "weak", "dead", "split"].map((s) => (
                          <option key={s} value={s} className="bg-base">{t(`business.colonyStatus.${s}`)}</option>
                        ))}
                      </select>
                      <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
                    </form>
                  )}

                  <div className="mt-2 space-y-2">
                    {apiaryHives.map((hive) => (
                      <div key={hive.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{hive.label}</span>
                          <select
                            defaultValue={hive.colony_status}
                            onChange={(e) => startTransition(() => updateHiveStatus(organization.id, hive.id, e.target.value))}
                            className="rounded-full bg-white/6 px-2 py-1 text-xs text-white/70"
                          >
                            {["thriving", "stable", "weak", "dead", "split"].map((s) => (
                              <option key={s} value={s} className="bg-base">{t(`business.colonyStatus.${s}`)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <button onClick={() => setOpenInspection(openInspection === hive.id ? null : hive.id)} className="text-xs text-accent-soft hover:underline">
                            + {t("business.addInspection")}
                          </button>
                          <button onClick={() => startTransition(() => deleteHive(organization.id, hive.id))} className="text-white/25 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {openInspection === hive.id && (
                          <form
                            action={(fd) => {
                              startTransition(() => createInspection(organization.id, hive.id, fd));
                              setOpenInspection(null);
                            }}
                            className="mt-2 grid gap-2 rounded-xl bg-white/[0.03] p-3"
                          >
                            <input type="date" name="inspection_date" className={inputClass} />
                            <textarea name="findings" rows={2} placeholder={t("business.formFindings")} className={inputClass + " resize-none"} />
                            <select name="varroa_load" defaultValue="none" className={inputClass}>
                              {["none", "low", "moderate", "high"].map((v) => (
                                <option key={v} value={v} className="bg-base">{t(`business.varroaLoad.${v}`)}</option>
                              ))}
                            </select>
                            <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" name="feeding_needed" /> {t("business.feedingNeeded")}</label>
                            <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" name="disease_flag" /> {t("business.diseaseFlag")}</label>
                            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
                          </form>
                        )}
                        {inspectionsForHive({ hiveId: hive.id, orgId: organization.id, startTransition, t, locale })}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-white/40">{t("business.harvests")}</span>
                    <button onClick={() => setOpenHarvest(openHarvest === apiary.id ? null : apiary.id)} className="text-xs text-accent-soft hover:underline">
                      + {t("business.addHarvest")}
                    </button>
                  </div>
                  {openHarvest === apiary.id && (
                    <form
                      action={(fd) => {
                        startTransition(() => createHarvest(organization.id, apiary.id, fd));
                        setOpenHarvest(null);
                      }}
                      className="my-2 grid gap-2 rounded-xl bg-white/[0.03] p-3"
                    >
                      <select name="hive_id" className={inputClass} defaultValue="">
                        <option value="" className="bg-base">{t("business.formHive")}</option>
                        {apiaryHives.map((h) => <option key={h.id} value={h.id} className="bg-base">{h.label}</option>)}
                      </select>
                      <input name="honey_type" placeholder={t("business.formHoneyType")} className={inputClass} />
                      <input type="number" step="0.1" name="quantity_kg" required placeholder={t("business.formQuantityKg")} className={inputClass} />
                      <input type="date" name="harvest_date" className={inputClass} />
                      <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
                    </form>
                  )}
                  {apiaryHarvests.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-white/60">
                      {apiaryHarvests.map((h) => (
                        <li key={h.id} className="group flex items-center justify-between">
                          <span>{h.honey_type ?? t("business.honey")} · {h.quantity_kg}kg · {formatDate(h.harvest_date, undefined, locale)}</span>
                          <button onClick={() => startTransition(() => deleteHarvest(organization.id, h.id))} className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );

  function inspectionsForHive({ hiveId }: { hiveId: string; orgId: string; startTransition: React.TransitionStartFunction; t: (k: string, v?: Record<string, string | number>) => string; locale: "en" | "hu" }) {
    const list = inspections.filter((i) => i.hive_id === hiveId);
    if (list.length === 0) return null;
    return (
      <ul className="mt-2 space-y-1 text-xs text-white/55">
        {list.map((i) => (
          <li key={i.id} className="group flex items-center justify-between gap-2">
            <span className="truncate">{formatDate(i.inspection_date, undefined, locale)} · {t(`business.varroaLoad.${i.varroa_load}`)}{i.feeding_needed ? ` · ${t("business.feedingNeeded")}` : ""}</span>
            <button onClick={() => startTransition(() => deleteInspection(organization.id, i.id))} className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
    );
  }
}

/* ---------------- Sales ---------------- */

function SalesTab({ organization, products, customers, orders, orderItems, currency, startTransition }: Props & { startTransition: React.TransitionStartFunction }) {
  const { t, locale } = useLocale();
  const [openProduct, setOpenProduct] = useState(false);
  const [openCustomer, setOpenCustomer] = useState(false);
  const [openOrder, setOpenOrder] = useState(false);

  const revenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-accent-soft" /> {t("business.products")}</h3>
            <button onClick={() => setOpenProduct((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> {t("business.addProduct")}
            </button>
          </div>
          {openProduct && (
            <form
              action={(fd) => {
                startTransition(() => createProduct(organization.id, fd));
                setOpenProduct(false);
              }}
              className="mb-4 grid gap-2 rounded-2xl bg-white/[0.03] p-4"
            >
              <input name="name" required placeholder={t("business.formProductName")} className={inputClass} />
              <select name="category" defaultValue="honey" className={inputClass}>
                <option value="honey" className="bg-base">{t("business.honey")}</option>
                <option value="wax" className="bg-base">{t("business.wax")}</option>
                <option value="other" className="bg-base">{t("business.other")}</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" name="price" placeholder={t("business.formPrice")} className={inputClass} />
                <input type="number" name="stock_qty" placeholder={t("business.formStock")} className={inputClass} />
              </div>
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
            </form>
          )}
          {products.length === 0 ? <EmptyState icon={ShoppingBag} title={t("business.noProducts")} /> : (
            <div className="divide-y divide-hairline">
              {products.map((p) => (
                <div key={p.id} className="group flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-white/40">{formatCurrency(Number(p.price), currency, { locale })} · {p.stock_qty} {p.unit}</p>
                  </div>
                  <button onClick={() => startTransition(() => deleteProduct(organization.id, p.id))} className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t("business.customers")}</h3>
            <button onClick={() => setOpenCustomer((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> {t("business.addCustomer")}
            </button>
          </div>
          {openCustomer && (
            <form
              action={(fd) => {
                startTransition(() => createCustomer(organization.id, fd));
                setOpenCustomer(false);
              }}
              className="mb-4 grid gap-2 rounded-2xl bg-white/[0.03] p-4"
            >
              <input name="name" required placeholder={t("business.formCustomerName")} className={inputClass} />
              <input name="contact_info" placeholder={t("business.formContact")} className={inputClass} />
              <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
            </form>
          )}
          {customers.length === 0 ? <EmptyState icon={ShoppingBag} title={t("business.noCustomers")} /> : (
            <div className="divide-y divide-hairline">
              {customers.map((c) => (
                <div key={c.id} className="group flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    {c.contact_info && <p className="truncate text-xs text-white/40">{c.contact_info}</p>}
                  </div>
                  <button onClick={() => startTransition(() => deleteCustomer(organization.id, c.id))} className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("business.orders")} <span className="ml-2 text-xs text-white/40">{t("business.revenueTotal")}: {formatCurrency(revenue, currency, { locale })}</span></h3>
          <button onClick={() => setOpenOrder((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("business.addOrder")}
          </button>
        </div>
        {openOrder && (
          <form
            action={(fd) => {
              startTransition(() => createOrder(organization.id, fd));
              setOpenOrder(false);
            }}
            className="mb-4 grid gap-2 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <select name="product_id" required className={inputClass}>
              <option value="" className="bg-base">{t("business.formProduct")}</option>
              {products.map((p) => <option key={p.id} value={p.id} className="bg-base">{p.name}</option>)}
            </select>
            <select name="customer_id" className={inputClass} defaultValue="">
              <option value="" className="bg-base">{t("business.formCustomerOptional")}</option>
              {customers.map((c) => <option key={c.id} value={c.id} className="bg-base">{c.name}</option>)}
            </select>
            <input type="number" name="quantity" required placeholder={t("business.formQuantity")} className={inputClass} />
            <input type="date" name="order_date" className={inputClass} />
            <FormButtons t={t} onCancel={() => setOpenOrder(false)} className="sm:col-span-2" />
          </form>
        )}
        {orders.length === 0 ? <EmptyState icon={ShoppingBag} title={t("business.noOrders")} /> : (
          <div className="divide-y divide-hairline">
            {orders.map((o) => {
              const items = orderItems.filter((oi) => oi.order_id === o.id);
              const product = products.find((p) => p.id === items[0]?.product_id);
              return (
                <div key={o.id} className="group flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product?.name ?? t("business.order")} × {items[0]?.quantity ?? 1}</p>
                    <p className="text-xs text-white/40">{formatDate(o.order_date, undefined, locale)}</p>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(Number(o.total_amount), currency, { locale })}</span>
                  <Pill tone={o.status === "fulfilled" ? "green" : o.status === "cancelled" ? "amber" : "neutral"}>{t(`business.orderStatus.${o.status}`)}</Pill>
                  <button onClick={() => startTransition(() => deleteOrder(organization.id, o.id))} className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Grant & masterplan ---------------- */

function GrantTab({ organization, grants, correspondence, masterplan, startTransition }: Props & { startTransition: React.TransitionStartFunction }) {
  const { t, locale } = useLocale();
  const [openGrant, setOpenGrant] = useState(false);
  const [openCorrespondence, setOpenCorrespondence] = useState<string | null>(null);
  const [openPhase, setOpenPhase] = useState(false);

  return (
    <div className="grid gap-4">
      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-accent-soft" /> {t("business.grantApplications")}</h3>
          <button onClick={() => setOpenGrant((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("business.addGrant")}
          </button>
        </div>
        {openGrant && (
          <form
            action={(fd) => {
              startTransition(() => createGrantApplication(organization.id, fd));
              setOpenGrant(false);
            }}
            className="mb-4 grid gap-2 rounded-2xl bg-white/[0.03] p-4"
          >
            <input name="program_name" required placeholder={t("business.formProgramName")} className={inputClass} />
            <input type="number" name="amount_requested" placeholder={t("business.formAmountRequested")} className={inputClass} />
            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
          </form>
        )}
        {grants.length === 0 ? <EmptyState icon={Landmark} title={t("business.noGrants")} /> : (
          <div className="space-y-3">
            {grants.map((g) => (
              <div key={g.id} className="rounded-2xl bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{g.program_name}</p>
                  <select
                    defaultValue={g.status}
                    onChange={(e) => startTransition(() => updateGrantStatus(organization.id, g.id, e.target.value))}
                    className="rounded-full bg-white/6 px-2 py-1 text-xs text-white/70"
                  >
                    {["draft", "submitted", "under_review", "approved", "rejected"].map((s) => (
                      <option key={s} value={s} className="bg-base">{t(`business.grantStatus.${s}`)}</option>
                    ))}
                  </select>
                </div>
                {g.amount_requested && <p className="mt-1 text-xs text-white/40">{formatCurrency(Number(g.amount_requested), undefined, { locale })}</p>}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-white/40">{t("business.correspondence")}</span>
                  <button onClick={() => setOpenCorrespondence(openCorrespondence === g.id ? null : g.id)} className="text-xs text-accent-soft hover:underline">
                    + {t("business.addCorrespondence")}
                  </button>
                </div>
                {openCorrespondence === g.id && (
                  <form
                    action={(fd) => {
                      startTransition(() => createCorrespondence(organization.id, g.id, fd));
                      setOpenCorrespondence(null);
                    }}
                    className="my-2 grid gap-2 rounded-xl bg-white/[0.03] p-3"
                  >
                    <input name="contact_name" placeholder={t("business.formContactName")} className={inputClass} />
                    <select name="direction" defaultValue="outgoing" className={inputClass}>
                      <option value="outgoing" className="bg-base">{t("business.outgoing")}</option>
                      <option value="incoming" className="bg-base">{t("business.incoming")}</option>
                    </select>
                    <input name="subject" required placeholder={t("business.formSubject")} className={inputClass} />
                    <textarea name="body" rows={2} placeholder={t("business.formBody")} className={inputClass + " resize-none"} />
                    <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
                  </form>
                )}
                {correspondence.filter((c) => c.grant_application_id === g.id).length > 0 && (
                  <ul className="mt-2 space-y-1.5 text-xs text-white/55">
                    {correspondence.filter((c) => c.grant_application_id === g.id).map((c) => (
                      <li key={c.id} className="group flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-2 py-1.5">
                        <span className="truncate">{c.direction === "incoming" ? "←" : "→"} {c.subject} {c.contact_name && `· ${c.contact_name}`}</span>
                        <button onClick={() => startTransition(() => deleteCorrespondence(organization.id, c.id))} className="text-white/20 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("business.masterplan")}</h3>
          <button onClick={() => setOpenPhase((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 hover:text-white">
            <Plus className="h-3.5 w-3.5" /> {t("business.addPhase")}
          </button>
        </div>
        {openPhase && (
          <form
            action={(fd) => {
              startTransition(() => createMasterplanPhase(organization.id, fd));
              setOpenPhase(false);
            }}
            className="mb-4 grid gap-2 rounded-2xl bg-white/[0.03] p-4"
          >
            <input name="title" required placeholder={t("business.formPhaseTitle")} className={inputClass} />
            <textarea name="description" rows={2} placeholder={t("business.formDescription")} className={inputClass + " resize-none"} />
            <input type="date" name="target_date" className={inputClass} />
            <button type="submit" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-white">{t("business.save")}</button>
          </form>
        )}
        {masterplan.length === 0 ? <EmptyState icon={Landmark} title={t("business.noPhases")} /> : (
          <div className="relative space-y-3 pl-4">
            <span aria-hidden className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-px bg-gradient-to-b from-accent/50 via-hairline to-transparent" />
            {masterplan.map((phase) => (
              <div key={phase.id} className="group relative flex items-start gap-3">
                <span className="absolute -left-4 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
                <div className="flex-1 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t("business.phase")} {phase.phase_number} — {phase.title}</p>
                    <select
                      defaultValue={phase.status}
                      onChange={(e) => startTransition(() => updateMasterplanPhaseStatus(organization.id, phase.id, e.target.value))}
                      className="rounded-full bg-white/6 px-2 py-1 text-xs text-white/70"
                    >
                      {["not_started", "in_progress", "done"].map((s) => (
                        <option key={s} value={s} className="bg-base">{t(`business.phaseStatus.${s}`)}</option>
                      ))}
                    </select>
                  </div>
                  {phase.description && <p className="mt-1 text-xs text-white/45">{phase.description}</p>}
                  {phase.target_date && <p className="mt-1 text-xs text-white/35">{formatDate(phase.target_date, undefined, locale)}</p>}
                </div>
                <button onClick={() => startTransition(() => deleteMasterplanPhase(organization.id, phase.id))} className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function FormButtons({ className = "", onCancel, t }: { className?: string; onCancel: () => void; t: (key: string) => string }) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
        {t("business.save")}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
        {t("business.cancel")}
      </button>
    </div>
  );
}
