"use client";

import { useState, useTransition } from "react";
import { Repeat, Plus, Trash2, Check } from "lucide-react";
import type { Habit, HabitLog } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, EmptyState, Field, inputClass } from "@/components/dashboard/ui";
import { createHabit, deleteHabit, toggleHabitLog } from "@/app/dashboard/habits/actions";
import { cn } from "@/lib/utils";

type Props = {
  habits: Habit[];
  logs: HabitLog[];
};

function lastSevenDays(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

export function HabitsModule({ habits, logs }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const days = lastSevenDays();
  const dayLabels = days.map((d) =>
    new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { weekday: "short" }).format(new Date(d + "T00:00:00")),
  );

  const isDone = (habitId: string, date: string) => logs.some((l) => l.habit_id === habitId && l.log_date === date && l.completed);

  return (
    <div>
      <ModuleHeader
        icon={Repeat}
        title={t("nav.habits.label")}
        subtitle={t("habits.subtitle")}
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("habits.addHabit")}
          </button>
        }
      />

      {open && (
        <form
          action={(fd) => {
            startTransition(() => createHabit(fd));
            setOpen(false);
          }}
          className="mb-5 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-3"
        >
          <Field label={t("habits.formName")}>
            <input name="name" required placeholder={t("habits.formNamePlaceholder")} className={inputClass} />
          </Field>
          <Field label={t("habits.formCadence")}>
            <select name="cadence" defaultValue="daily" className={inputClass}>
              <option value="daily" className="bg-base">{t("habits.cadenceDaily")}</option>
              <option value="weekly" className="bg-base">{t("habits.cadenceWeekly")}</option>
              <option value="custom" className="bg-base">{t("habits.cadenceCustom")}</option>
            </select>
          </Field>
          <Field label={t("habits.formTarget")}>
            <input type="number" name="target_per_period" min={1} defaultValue={1} className={inputClass} />
          </Field>
          <div className="flex gap-3 sm:col-span-3">
            <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
              {t("habits.save")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
              {t("habits.cancel")}
            </button>
          </div>
        </form>
      )}

      <Panel>
        {habits.length === 0 ? (
          <EmptyState icon={Repeat} title={t("habits.noHabits")} hint={t("habits.noHabitsHint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">{t("habits.habit")}</th>
                  {dayLabels.map((label, i) => (
                    <th key={days[i]} className="pb-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">{label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => (
                  <tr key={h.id} className="group border-t border-hairline">
                    <td className="py-3 pr-4 text-sm font-medium text-white/85">{h.name}</td>
                    {days.map((d) => {
                      const done = isDone(h.id, d);
                      return (
                        <td key={d} className="py-3 text-center">
                          <button
                            onClick={() => startTransition(() => toggleHabitLog(h.id, d, !done))}
                            className={cn(
                              "mx-auto flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                              done ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-white/15 text-transparent hover:border-white/40",
                            )}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-3 pl-2">
                      <button
                        onClick={() => startTransition(() => deleteHabit(h.id))}
                        className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
