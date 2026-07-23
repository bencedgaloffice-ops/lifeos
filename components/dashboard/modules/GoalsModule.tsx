"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Target, Plus, Trash2, Minus } from "lucide-react";
import type { Goal } from "@/lib/types";
import { formatDate, relativeDays } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  ModuleHeader,
  Panel,
  Progress,
  Pill,
  EmptyState,
  Field,
  inputClass,
} from "@/components/dashboard/ui";
import { createGoal, updateGoalProgress, deleteGoal } from "@/app/dashboard/goals/actions";

export function GoalsModule({ goals }: { goals: Goal[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { t, tList } = useLocale();
  const categories = tList("goals.categories");

  const active = goals.filter((g) => g.status !== "completed");
  const done = goals.filter((g) => g.status === "completed");

  return (
    <div>
      <ModuleHeader
        icon={Target}
        title={t("goals.title")}
        subtitle={t("goals.subtitle")}
        accent="goals"
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" /> {t("goals.newGoal")}
          </button>
        }
      />

      {open && (
        <Panel className="mb-6">
          <form
            action={(fd) => {
              startTransition(() => createGoal(fd));
              setOpen(false);
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <Field label={t("goals.formGoal")}>
                <input name="title" required placeholder={t("goals.formGoalPlaceholder")} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("goals.formDescription")}>
                <input
                  name="description"
                  placeholder={t("goals.formDescriptionPlaceholder")}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label={t("goals.formCategory")}>
              <select name="category" className={inputClass} defaultValue={categories[0]}>
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-base">
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("goals.formTargetDate")}>
              <input type="date" name="target_date" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("goals.formStartingProgress")}>
                <input
                  type="number"
                  name="progress_percent"
                  min={0}
                  max={100}
                  defaultValue={0}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                {t("goals.create")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full glass px-5 py-2.5 text-sm text-white/70"
              >
                {t("goals.cancel")}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {goals.length === 0 ? (
        <EmptyState icon={Target} title={t("goals.noGoals")} hint={t("goals.noGoalsHint")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[...active, ...done].map((goal, i) => (
            <GoalCard key={goal.id} goal={goal} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, index }: { goal: Goal; index: number }) {
  const [pending, startTransition] = useTransition();
  const { t, locale } = useLocale();
  const step = (delta: number) =>
    startTransition(() => updateGoalProgress(goal.id, goal.progress_percent + delta));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Panel className="group h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              {goal.category && <Pill tone="accent">{goal.category}</Pill>}
              {goal.status === "completed" && <Pill tone="green">{t("goals.complete")}</Pill>}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{goal.title}</h3>
            {goal.description && (
              <p className="mt-1 text-sm leading-relaxed text-white/50">{goal.description}</p>
            )}
          </div>
          <form action={() => startTransition(() => deleteGoal(goal.id))}>
            <button
              className="text-white/30 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
              aria-label="Delete goal"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="tabular-nums font-medium text-white/70">
              {goal.progress_percent}%
            </span>
            {goal.target_date && (
              <span className="text-xs text-white/40">
                {formatDate(goal.target_date, undefined, locale)} · {relativeDays(goal.target_date, locale)}
              </span>
            )}
          </div>
          <Progress value={goal.progress_percent} />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => step(-10)}
              disabled={pending || goal.progress_percent <= 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/70 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Decrease progress"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => step(10)}
              disabled={pending || goal.progress_percent >= 100}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full glass text-white/70 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Increase progress"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-white/35">{t("goals.adjustProgress")}</span>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
