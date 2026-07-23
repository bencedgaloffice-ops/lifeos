"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import type { JournalEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  ModuleHeader,
  Panel,
  EmptyState,
  Field,
  inputClass,
} from "@/components/dashboard/ui";
import { createEntry, deleteEntry } from "@/app/dashboard/journal/actions";

export function JournalModule({ entries }: { entries: JournalEntry[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { t, tList } = useLocale();
  const moods = tList("journal.moods");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ModuleHeader
        icon={BookOpen}
        title={t("journal.title")}
        subtitle={t("journal.subtitle")}
        accent="journal"
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> {t("journal.newEntry")}
          </button>
        }
      />

      {open && (
        <Panel className="mb-6">
          <form
            action={(fd) => {
              startTransition(() => createEntry(fd));
              setOpen(false);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label={t("journal.formTitle")}>
              <input name="title" placeholder={t("journal.formTitlePlaceholder")} className={inputClass} />
            </Field>
            <Field label={t("journal.formDate")}>
              <input type="date" name="entry_date" defaultValue={today} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("journal.formBody")}>
                <textarea
                  name="body"
                  required
                  rows={5}
                  placeholder={t("journal.formBodyPlaceholder")}
                  className={inputClass + " resize-none"}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("journal.formMood")}>
                <select name="mood" className={inputClass} defaultValue={moods[0]}>
                  {moods.map((m) => (
                    <option key={m} value={m} className="bg-base">
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                {t("journal.save")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full glass px-5 py-2.5 text-sm text-white/70"
              >
                {t("journal.cancel")}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("journal.noEntries")}
          hint={t("journal.noEntriesHint")}
        />
      ) : (
        <div className="relative space-y-4 pl-4">
          <span
            aria-hidden
            className="absolute left-0 top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-accent/50 via-hairline to-transparent"
          />
          {entries.map((entry, i) => (
            <Entry
              key={entry.id}
              entry={entry}
              index={i}
              onDelete={(id) => startTransition(() => deleteEntry(id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Entry({
  entry,
  index,
  onDelete,
}: {
  entry: JournalEntry;
  index: number;
  onDelete: (id: string) => void;
}) {
  const { locale } = useLocale();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      className="relative"
    >
      <span className="absolute -left-4 top-6 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
      <Panel className="group">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
              <span>{formatDate(entry.entry_date, undefined, locale)}</span>
              {entry.mood && <span className="text-white/55">· {entry.mood}</span>}
            </div>
            {entry.title && (
              <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{entry.title}</h3>
            )}
          </div>
          <button
            onClick={() => onDelete(entry.id)}
            className="text-white/30 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
            aria-label="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-white/70">
          {entry.body}
        </p>
      </Panel>
    </motion.div>
  );
}
