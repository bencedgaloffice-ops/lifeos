"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Salad, Scale, Droplets, Plus, Trash2, Check, Loader2 } from "lucide-react";
import type { Profile, NutritionEntry, WeightLogEntry } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Progress, Field, inputClass } from "@/components/dashboard/ui";
import { saveNutritionProfile, logMeal, deleteMealEntry, logWeight } from "@/app/dashboard/nutrition/actions";

type Props = {
  profile: Profile | null;
  todayEntries: NutritionEntry[];
  weightLog: WeightLogEntry[];
  consistencyDays: number;
};

const meals = ["breakfast", "lunch", "dinner", "snack"] as const;

export function NutritionModule({ profile, todayEntries, weightLog, consistencyDays }: Props) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const [savingProfile, setSavingProfile] = useState(false);
  const [openMeal, setOpenMeal] = useState<null | (typeof meals)[number]>(null);
  const [openWeight, setOpenWeight] = useState(false);

  const v = (k: keyof Profile) => (profile?.[k] as string | number | null) ?? "";

  const totals = todayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein: acc.protein + Number(e.protein_g ?? 0),
      water: acc.water + (e.water_ml ?? 0),
    }),
    { calories: 0, protein: 0, water: 0 },
  );

  const calorieTarget = profile?.calorie_target ?? null;
  const proteinTarget = profile?.protein_target_g ?? null;

  return (
    <div>
      <ModuleHeader icon={Salad} title={t("nutrition.title")} subtitle={t("nutrition.subtitle")} accent="nutrition" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's totals + meal log */}
        <Panel className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold">{t("nutrition.todayTitle")}</h3>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-white/45">
                <span>{t("nutrition.formCalories")}</span>
                {calorieTarget && <span>{Math.round((totals.calories / calorieTarget) * 100)}%</span>}
              </div>
              <p className="mb-1.5 text-lg font-semibold tabular-nums">
                {calorieTarget
                  ? t("nutrition.caloriesOf", { consumed: totals.calories, target: calorieTarget })
                  : `${totals.calories} kcal`}
              </p>
              <Progress value={calorieTarget ? (totals.calories / calorieTarget) * 100 : 0} />
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-white/45">
                <span>{t("nutrition.formProtein")}</span>
                {proteinTarget && <span>{Math.round((totals.protein / proteinTarget) * 100)}%</span>}
              </div>
              <p className="mb-1.5 text-lg font-semibold tabular-nums">
                {proteinTarget
                  ? t("nutrition.proteinOf", { consumed: totals.protein, target: proteinTarget })
                  : `${totals.protein}g`}
              </p>
              <Progress value={proteinTarget ? (totals.protein / proteinTarget) * 100 : 0} />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
              <Droplets className="h-4 w-4 text-accent-soft" />
              <span className="text-sm tabular-nums">{totals.water}ml</span>
            </div>
          </div>

          <div className="space-y-4">
            {meals.map((meal) => {
              const entries = todayEntries.filter((e) => e.meal === meal);
              return (
                <div key={meal}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-white/45">
                      {t(`nutrition.${meal}`)}
                    </span>
                    <button
                      onClick={() => setOpenMeal(openMeal === meal ? null : meal)}
                      className="inline-flex items-center gap-1 rounded-full glass px-2.5 py-1 text-xs text-white/70 transition-colors hover:text-white"
                    >
                      <Plus className="h-3 w-3" /> {t("nutrition.logMeal")}
                    </button>
                  </div>

                  {openMeal === meal && (
                    <form
                      action={(fd) => {
                        fd.set("meal", meal);
                        startTransition(() => logMeal(fd));
                        setOpenMeal(null);
                      }}
                      className="mb-3 grid gap-2 rounded-2xl bg-white/[0.03] p-3.5 sm:grid-cols-2"
                    >
                      <div className="sm:col-span-2">
                        <Field label={t("nutrition.formMealDescription")}>
                          <input name="description" className={inputClass} />
                        </Field>
                      </div>
                      <Field label={t("nutrition.formCalories")}>
                        <input type="number" name="calories" min="0" className={inputClass} />
                      </Field>
                      <Field label={t("nutrition.formProtein")}>
                        <input type="number" name="protein_g" min="0" step="0.1" className={inputClass} />
                      </Field>
                      <Field label={t("nutrition.formCarbs")}>
                        <input type="number" name="carbs_g" min="0" step="0.1" className={inputClass} />
                      </Field>
                      <Field label={t("nutrition.formFat")}>
                        <input type="number" name="fat_g" min="0" step="0.1" className={inputClass} />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label={t("nutrition.formWater")}>
                          <input type="number" name="water_ml" min="0" className={inputClass} />
                        </Field>
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
                        <button type="submit" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
                          {t("nutrition.logMeal")}
                        </button>
                        <button type="button" onClick={() => setOpenMeal(null)} className="rounded-full glass px-4 py-2 text-sm text-white/70">
                          {t("nutrition.cancel")}
                        </button>
                      </div>
                    </form>
                  )}

                  {entries.length === 0 ? (
                    <p className="text-sm text-white/30">{t("nutrition.noMeals")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map((e) => (
                        <div key={e.id} className="group flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-white/75">{e.description || t(`nutrition.${meal}`)}</span>
                          <span className="text-xs text-white/40">{e.calories ?? 0} kcal</span>
                          <form action={() => startTransition(() => deleteMealEntry(e.id))}>
                            <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Targets + consistency */}
        <div className="space-y-4">
          <Panel>
            <h3 className="mb-4 text-sm font-semibold">{t("nutrition.profileTitle")}</h3>
            <form
              action={(fd) => {
                setSavingProfile(true);
                startTransition(async () => {
                  await saveNutritionProfile(fd);
                  setSavingProfile(false);
                });
              }}
              className="grid gap-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("nutrition.formHeight")}>
                  <input type="number" name="height_cm" step="0.1" defaultValue={v("height_cm")} className={inputClass} />
                </Field>
                <Field label={t("nutrition.formWeight")}>
                  <input type="number" name="weight_kg" step="0.1" defaultValue={v("weight_kg")} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("nutrition.formTargetWeight")}>
                  <input type="number" name="target_weight_kg" step="0.1" defaultValue={v("target_weight_kg")} className={inputClass} />
                </Field>
                <Field label={t("nutrition.formCalorieTarget")}>
                  <input type="number" name="calorie_target" defaultValue={v("calorie_target")} className={inputClass} />
                </Field>
              </div>
              <Field label={t("nutrition.formProteinTarget")}>
                <input type="number" name="protein_target_g" defaultValue={v("protein_target_g")} className={inputClass} />
              </Field>
              <Field label={t("nutrition.formFitnessGoal")}>
                <input name="fitness_goal" defaultValue={v("fitness_goal")} placeholder={t("nutrition.formFitnessGoalPlaceholder")} className={inputClass} />
              </Field>
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("nutrition.save")}
              </button>
            </form>
          </Panel>

          <Panel>
            <h3 className="mb-2 text-sm font-semibold">{t("nutrition.consistencyTitle")}</h3>
            <p className="mb-3 text-xs text-white/40">{t("nutrition.consistencyHint")}</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tabular-nums tracking-tight">{consistencyDays}</span>
              <span className="mb-1 text-sm text-white/40">/ 14</span>
            </div>
            <Progress value={(consistencyDays / 14) * 100} className="mt-3" />
          </Panel>
        </div>
      </div>

      {/* Weight trend */}
      <Panel className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4 text-accent-soft" /> {t("nutrition.weightTitle")}
          </h3>
          <button
            onClick={() => setOpenWeight((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> {t("nutrition.logWeight")}
          </button>
        </div>

        {openWeight && (
          <form
            action={(fd) => {
              startTransition(() => logWeight(fd));
              setOpenWeight(false);
            }}
            className="mb-4 flex items-end gap-3"
          >
            <Field label={t("nutrition.formWeightValue")}>
              <input type="number" name="weight_kg" step="0.1" required className={inputClass} />
            </Field>
            <input type="hidden" name="logged_date" value={new Date().toISOString().slice(0, 10)} />
            <button className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-white">
              {t("nutrition.save")}
            </button>
          </form>
        )}

        {weightLog.length < 2 ? (
          <p className="py-10 text-center text-sm text-white/40">{t("nutrition.noWeightData")}</p>
        ) : (
          <WeightChart entries={weightLog} />
        )}
      </Panel>
    </div>
  );
}

function WeightChart({ entries }: { entries: WeightLogEntry[] }) {
  const w = 100;
  const h = 40;
  const values = entries.map((e) => e.weight_kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (entries.length - 1);
  const pts = entries.map((e, i) => `${i * step},${h - ((e.weight_kg - min) / range) * (h - 6) - 3}`);
  const line = pts.join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-36 w-full">
      <defs>
        <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#weight-area)" />
      <motion.polyline
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        points={line}
        fill="none"
        stroke="#60A5FA"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
