"use client";

import { useState, useTransition } from "react";
import { HeartHandshake, Plus, Trash2, Pencil, Check } from "lucide-react";
import type { Relationship, WeddingTask, Milestone } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, StatCard, Pill, EmptyState, Field, inputClass } from "@/components/dashboard/ui";
import {
  updateRelationship,
  createWeddingTask,
  updateWeddingTaskStatus,
  deleteWeddingTask,
  createSharedMilestone,
  deleteSharedMilestone,
} from "@/app/dashboard/relationship/actions";

type Props = {
  relationship: Relationship | null;
  weddingTasks: WeddingTask[];
  sharedMilestones: Milestone[];
};

export function RelationshipModule({ relationship, weddingTasks, sharedMilestones }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(!relationship?.partner_name);
  const [openTask, setOpenTask] = useState(false);
  const [openMilestone, setOpenMilestone] = useState(false);

  const doneCount = weddingTasks.filter((w) => w.status === "done").length;

  return (
    <div>
      <ModuleHeader icon={HeartHandshake} title={t("nav.relationship.label")} subtitle={t("relationship.subtitle")} accent="relationship" />

      <Panel className="mb-4" glow>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{relationship?.partner_name || t("relationship.formPartnerName")}</h3>
          <button
            onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("relationship.edit")}
          </button>
        </div>

        {editing ? (
          <form
            action={(fd) => {
              startTransition(() => updateRelationship(fd));
              setEditing(false);
            }}
            className="grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("relationship.formPartnerName")}>
              <input name="partner_name" defaultValue={relationship?.partner_name ?? ""} className={inputClass} />
            </Field>
            <Field label={t("relationship.formStartDate")}>
              <input type="date" name="relationship_start_date" defaultValue={relationship?.relationship_start_date ?? ""} className={inputClass} />
            </Field>
            <Field label={t("relationship.formEngagementDate")}>
              <input type="date" name="engagement_date" defaultValue={relationship?.engagement_date ?? ""} className={inputClass} />
            </Field>
            <Field label={t("relationship.formWeddingDate")}>
              <input type="date" name="wedding_date" defaultValue={relationship?.wedding_date ?? ""} className={inputClass} />
            </Field>
            <Field label={t("relationship.formNotes")}>
              <textarea name="notes" defaultValue={relationship?.notes ?? ""} rows={2} className={inputClass + " resize-none sm:col-span-2"} />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                {t("relationship.save")}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("relationship.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label={t("relationship.since")} value={relationship?.relationship_start_date ? formatDate(relationship.relationship_start_date, undefined, locale) : "—"} moduleAccent="relationship" />
            <StatCard label={t("relationship.engaged")} value={relationship?.engagement_date ? formatDate(relationship.engagement_date, undefined, locale) : "—"} moduleAccent="relationship" />
            <StatCard label={t("relationship.wedding")} value={relationship?.wedding_date ? formatDate(relationship.wedding_date, undefined, locale) : "—"} moduleAccent="relationship" />
          </div>
        )}
      </Panel>

      {/* Wedding planning */}
      {relationship && (
        <Panel className="mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {t("relationship.weddingPlanningTitle")}{" "}
              {weddingTasks.length > 0 && <span className="text-xs font-normal text-white/40">({doneCount}/{weddingTasks.length})</span>}
            </h3>
            <button
              onClick={() => setOpenTask((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> {t("relationship.addTask")}
            </button>
          </div>

          {openTask && (
            <form
              action={(fd) => {
                startTransition(() => createWeddingTask(relationship.id, fd));
                setOpenTask(false);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
            >
              <Field label={t("relationship.formTaskTitle")}>
                <input name="title" required className={inputClass} />
              </Field>
              <Field label={t("relationship.formDueDate")}>
                <input type="date" name="due_date" className={inputClass} />
              </Field>
              <div className="flex gap-3 sm:col-span-2">
                <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                  {t("relationship.save")}
                </button>
                <button type="button" onClick={() => setOpenTask(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                  {t("relationship.cancel")}
                </button>
              </div>
            </form>
          )}

          {weddingTasks.length === 0 ? (
            <EmptyState icon={HeartHandshake} title={t("relationship.noTasks")} />
          ) : (
            <div className="divide-y divide-hairline">
              {weddingTasks.map((w) => (
                <div key={w.id} className="group flex items-center gap-3 py-3">
                  <button
                    onClick={() => startTransition(() => updateWeddingTaskStatus(w.id, w.status === "done" ? "todo" : "done"))}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      w.status === "done" ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/25 text-transparent hover:border-white/50"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${w.status === "done" ? "text-white/40 line-through" : ""}`}>{w.title}</p>
                    {w.due_date && <p className="text-xs text-white/40">{formatDate(w.due_date, undefined, locale)}</p>}
                  </div>
                  <form action={() => startTransition(() => deleteWeddingTask(w.id))}>
                    <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Shared milestones */}
      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("relationship.sharedMilestonesTitle")}</h3>
          <button
            onClick={() => setOpenMilestone((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("relationship.addMilestone")}
          </button>
        </div>

        {openMilestone && (
          <form
            action={(fd) => {
              startTransition(() => createSharedMilestone(fd));
              setOpenMilestone(false);
            }}
            className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("relationship.formMilestoneTitle")}>
              <input name="title" required className={inputClass} />
            </Field>
            <Field label={t("relationship.formDate")}>
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                {t("relationship.save")}
              </button>
              <button type="button" onClick={() => setOpenMilestone(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("relationship.cancel")}
              </button>
            </div>
          </form>
        )}

        {sharedMilestones.length === 0 ? (
          <EmptyState icon={HeartHandshake} title={t("relationship.noMilestones")} />
        ) : (
          <div className="relative space-y-3 pl-4">
            <span aria-hidden className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-px bg-gradient-to-b from-accent/50 via-hairline to-transparent" />
            {sharedMilestones.map((m) => (
              <div key={m.id} className="group relative flex items-center gap-3">
                <span className="absolute -left-4 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
                <div className="flex-1 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-white/40">{formatDate(m.date, undefined, locale)}</p>
                </div>
                <form action={() => startTransition(() => deleteSharedMilestone(m.id))}>
                  <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
        <Pill tone="neutral">{t("relationship.linkedHint")}</Pill>
      </Panel>
    </div>
  );
}
