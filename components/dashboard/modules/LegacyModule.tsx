"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Landmark, Sparkles, Clock, Target, FolderKanban, Plus, Trash2 } from "lucide-react";
import type { Dream, Milestone, Goal, Project } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Progress, EmptyState, Field, inputClass } from "@/components/dashboard/ui";
import { createDream, deleteDream, createMilestone, deleteMilestone } from "@/app/dashboard/legacy/actions";

type Props = {
  dreams: Dream[];
  milestones: Milestone[];
  goals: Goal[];
  projects: Project[];
};

export function LegacyModule({ dreams, milestones, goals, projects }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [openDream, setOpenDream] = useState(false);
  const [openMilestone, setOpenMilestone] = useState(false);

  return (
    <div>
      <ModuleHeader icon={Landmark} title={t("legacy.title")} subtitle={t("legacy.subtitle")} />

      {/* Dreams — vision board */}
      <Panel className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-accent-soft" /> {t("legacy.dreamsTitle")}
          </h3>
          <button
            onClick={() => setOpenDream((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("legacy.addDream")}
          </button>
        </div>

        {openDream && (
          <form
            action={(fd) => {
              startTransition(() => createDream(fd));
              setOpenDream(false);
            }}
            className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4"
          >
            <Field label={t("legacy.formDreamTitle")}>
              <input name="title" required placeholder={t("legacy.formDreamTitlePlaceholder")} className={inputClass} />
            </Field>
            <Field label={t("legacy.formDescription")}>
              <textarea name="description" rows={2} placeholder={t("legacy.formDescriptionPlaceholder")} className={inputClass + " resize-none"} />
            </Field>
            <div className="flex gap-3">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                {t("legacy.save")}
              </button>
              <button type="button" onClick={() => setOpenDream(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("legacy.cancel")}
              </button>
            </div>
          </form>
        )}

        {dreams.length === 0 ? (
          <EmptyState icon={Sparkles} title={t("legacy.noDreams")} hint={t("legacy.noDreamsHint")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dreams.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-hairline bg-gradient-to-br from-accent/10 to-white/[0.02] p-4"
              >
                <Sparkles className="h-4 w-4 text-accent-soft" />
                <p className="mt-2 text-sm font-semibold tracking-tight">{d.title}</p>
                {d.description && <p className="mt-1 text-xs leading-relaxed text-white/50">{d.description}</p>}
                <form action={() => startTransition(() => deleteDream(d.id))}>
                  <button className="absolute right-3 top-3 text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </motion.div>
            ))}
          </div>
        )}
      </Panel>

      {/* Milestones — life timeline */}
      <Panel className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-accent-soft" /> {t("legacy.milestonesTitle")}
          </h3>
          <button
            onClick={() => setOpenMilestone((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("legacy.addMilestone")}
          </button>
        </div>

        {openMilestone && (
          <form
            action={(fd) => {
              startTransition(() => createMilestone(fd));
              setOpenMilestone(false);
            }}
            className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
          >
            <Field label={t("legacy.formMilestoneTitle")}>
              <input name="title" required placeholder={t("legacy.formMilestoneTitlePlaceholder")} className={inputClass} />
            </Field>
            <Field label={t("legacy.formDate")}>
              <input type="date" name="date" required className={inputClass} />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                {t("legacy.save")}
              </button>
              <button type="button" onClick={() => setOpenMilestone(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("legacy.cancel")}
              </button>
            </div>
          </form>
        )}

        {milestones.length === 0 ? (
          <EmptyState icon={Clock} title={t("legacy.noMilestones")} hint={t("legacy.noMilestonesHint")} />
        ) : (
          <div className="relative space-y-3 pl-4">
            <span aria-hidden className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-px bg-gradient-to-b from-accent/50 via-hairline to-transparent" />
            {milestones.map((m) => (
              <div key={m.id} className="group relative flex items-center gap-3">
                <span className="absolute -left-4 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-glow-sm" />
                <div className="flex-1 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-white/40">{formatDate(m.date, undefined, locale)}</p>
                </div>
                <form action={() => startTransition(() => deleteMilestone(m.id))}>
                  <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Active work in service of legacy */}
      <Panel>
        <h3 className="text-sm font-semibold">{t("legacy.activeWorkTitle")}</h3>
        <p className="mt-1 text-xs text-white/40">{t("legacy.activeWorkHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
              <Target className="h-3.5 w-3.5" /> {t("nav.goals.label")}
            </div>
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate text-white/80">{g.title}</span>
                    <span className="text-white/45">{g.progress_percent}%</span>
                  </div>
                  <Progress value={g.progress_percent} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
              <FolderKanban className="h-3.5 w-3.5" /> {t("nav.projects.label")}
            </div>
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
          </div>
        </div>
      </Panel>
    </div>
  );
}
