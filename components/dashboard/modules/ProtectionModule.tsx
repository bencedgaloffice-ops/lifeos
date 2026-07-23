"use client";

import { useEffect, useState, useTransition } from "react";
import { ShieldCheck, FileText, ListChecks, KeyRound, Plus, Trash2, Check, Search, Loader2 } from "lucide-react";
import type { Document, Responsibility, SecurityNote, Organization } from "@/lib/types";
import { formatDate, relativeDays } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  ModuleHeader,
  Panel,
  Pill,
  EmptyState,
  Field,
  inputClass,
} from "@/components/dashboard/ui";
import {
  createDocument,
  deleteDocument,
  searchDocuments,
  createResponsibility,
  toggleResponsibility,
  deleteResponsibility,
  createSecurityNote,
  deleteSecurityNote,
} from "@/app/dashboard/protection/actions";

type Props = {
  documents: Document[];
  responsibilities: Responsibility[];
  notes: SecurityNote[];
  organizations: Organization[];
};

function expiryTone(dateStr: string | null): "amber" | "green" | null {
  if (!dateStr) return null;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "amber";
  if (days <= 30) return "amber";
  return null;
}

export function ProtectionModule({ documents, responsibilities, notes, organizations }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [openDoc, setOpenDoc] = useState(false);
  const [openResp, setOpenResp] = useState(false);
  const [openNote, setOpenNote] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Document[] | null>(null);
  const [searching, setSearching] = useState(false);

  const activeResponsibilities = responsibilities.filter((r) => !r.completed);
  const doneResponsibilities = responsibilities.filter((r) => r.completed);

  // Debounced real full-text search (documents.search_vector, GIN-indexed) —
  // falls back to the server-fetched list once the query is cleared.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      startTransition(async () => {
        const results = await searchDocuments(q);
        setSearchResults(results as Document[]);
        setSearching(false);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, startTransition]);

  const filteredDocuments = searchResults ?? documents;

  return (
    <div>
      <ModuleHeader icon={ShieldCheck} title={t("protection.title")} subtitle={t("protection.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Documents */}
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-accent-soft" /> {t("protection.documentsTitle")}
            </h3>
            <button
              onClick={() => setOpenDoc((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> {t("protection.addDocument")}
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("protection.searchPlaceholder")}
              className={inputClass + " pl-10 pr-10"}
            />
            {searching && (
              <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/30" />
            )}
          </div>

          {openDoc && (
            <form
              action={(fd) => {
                startTransition(() => createDocument(fd));
                setOpenDoc(false);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4"
            >
              <Field label={t("protection.formDocTitle")}>
                <input name="title" required placeholder={t("protection.formDocTitlePlaceholder")} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("protection.formCategory")}>
                  <input name="category" className={inputClass} />
                </Field>
                <Field label={t("protection.formExpiresAt")}>
                  <input type="date" name="expires_at" className={inputClass} />
                </Field>
              </div>
              <Field label={t("protection.formTags")}>
                <input name="tags" placeholder={t("protection.formTagsPlaceholder")} className={inputClass} />
              </Field>
              {organizations.length > 0 && (
                <Field label={t("protection.formOrganization")}>
                  <select name="organization_id" defaultValue="" className={inputClass}>
                    <option value="" className="bg-base">{t("protection.formOrganizationNone")}</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id} className="bg-base">{o.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <FormButtons onCancel={() => setOpenDoc(false)} t={t} />
            </form>
          )}

          {filteredDocuments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={query ? t("protection.noSearchResults") : t("protection.noDocuments")}
              hint={query ? undefined : t("protection.noDocumentsHint")}
            />
          ) : (
            <div className="divide-y divide-hairline">
              {filteredDocuments.map((d) => {
                const tone = expiryTone(d.expires_at);
                return (
                  <div key={d.id} className="group flex items-center gap-3 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-accent-soft">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.title}</p>
                      {d.expires_at && (
                        <p className="text-xs text-white/40">
                          {t("protection.expiresPrefix")} {formatDate(d.expires_at, undefined, locale)} · {relativeDays(d.expires_at, locale)}
                        </p>
                      )}
                      {d.tags?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {d.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-white/6 px-2 py-0.5 text-[0.65rem] text-white/50">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {tone && (
                      <Pill tone={tone}>
                        {new Date(d.expires_at!) < new Date() ? t("protection.expired") : t("protection.expiringSoon")}
                      </Pill>
                    )}
                    <form action={() => startTransition(() => deleteDocument(d.id))}>
                      <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Responsibilities */}
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4 text-accent-soft" /> {t("protection.responsibilitiesTitle")}
            </h3>
            <button
              onClick={() => setOpenResp((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> {t("protection.addResponsibility")}
            </button>
          </div>

          {openResp && (
            <form
              action={(fd) => {
                startTransition(() => createResponsibility(fd));
                setOpenResp(false);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4"
            >
              <Field label={t("protection.formRespTitle")}>
                <input name="title" required placeholder={t("protection.formRespTitlePlaceholder")} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("protection.formDueDate")}>
                  <input type="date" name="due_date" className={inputClass} />
                </Field>
                <Field label={t("protection.formRecurrence")}>
                  <select name="recurrence" className={inputClass} defaultValue="">
                    <option value="" className="bg-base">{t("protection.recurrenceNone")}</option>
                    <option value="monthly" className="bg-base">{t("protection.recurrenceMonthly")}</option>
                    <option value="yearly" className="bg-base">{t("protection.recurrenceYearly")}</option>
                  </select>
                </Field>
              </div>
              <FormButtons onCancel={() => setOpenResp(false)} t={t} />
            </form>
          )}

          {responsibilities.length === 0 ? (
            <EmptyState icon={ListChecks} title={t("protection.noResponsibilities")} hint={t("protection.noResponsibilitiesHint")} />
          ) : (
            <div className="divide-y divide-hairline">
              {[...activeResponsibilities, ...doneResponsibilities].map((r) => {
                const overdue = r.due_date && !r.completed && new Date(r.due_date) < new Date();
                return (
                  <div key={r.id} className="group flex items-center gap-3 py-3">
                    <button
                      onClick={() => startTransition(() => toggleResponsibility(r.id, !r.completed))}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        r.completed ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/25 text-transparent hover:border-white/50"
                      }`}
                      aria-label={t("protection.markDone")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${r.completed ? "text-white/40 line-through" : ""}`}>{r.title}</p>
                      {r.due_date && (
                        <p className="text-xs text-white/40">{formatDate(r.due_date, undefined, locale)}</p>
                      )}
                    </div>
                    {overdue && <Pill tone="amber">{t("protection.overdue")}</Pill>}
                    <form action={() => startTransition(() => deleteResponsibility(r.id))}>
                      <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Security notes */}
      <Panel className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-accent-soft" /> {t("protection.securityTitle")}
            </h3>
            <p className="mt-1 text-xs text-white/40">{t("protection.securityHint")}</p>
          </div>
          <button
            onClick={() => setOpenNote((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("protection.addNote")}
          </button>
        </div>

        {openNote && (
          <form
            action={(fd) => {
              startTransition(() => createSecurityNote(fd));
              setOpenNote(false);
            }}
            className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("protection.formNoteLabel")}>
              <input name="label" required placeholder={t("protection.formNoteLabelPlaceholder")} className={inputClass} />
            </Field>
            <Field label={t("protection.formNoteValue")}>
              <input name="value" required className={inputClass} />
            </Field>
            <FormButtons className="sm:col-span-2" onCancel={() => setOpenNote(false)} t={t} />
          </form>
        )}

        {notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">{t("protection.noNotes")}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {notes.map((n) => (
              <div key={n.id} className="group flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs text-white/40">{n.label}</p>
                  <p className="truncate text-sm font-medium">{n.value}</p>
                </div>
                <form action={() => startTransition(() => deleteSecurityNote(n.id))}>
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
  );
}

function FormButtons({
  className = "",
  onCancel,
  t,
}: {
  className?: string;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
        {t("protection.save")}
      </button>
      <button type="button" onClick={onCancel} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
        {t("protection.cancel")}
      </button>
    </div>
  );
}
