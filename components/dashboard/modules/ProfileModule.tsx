"use client";

import { useState, useTransition } from "react";
import { UserCircle, Check, Loader2, Sparkles, Wallet, Briefcase, Heart } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, Field, inputClass } from "@/components/dashboard/ui";
import { saveProfile } from "@/app/dashboard/profile/actions";

const currencies = ["USD", "EUR", "GBP", "HUF", "CHF", "JPY", "AUD", "CAD"];

export function ProfileModule({ profile }: { profile: Profile | null }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const { t } = useLocale();

  const v = (k: keyof Profile) => (profile?.[k] as string | number | null) ?? "";
  const arr = (k: keyof Profile) => {
    const val = profile?.[k];
    return Array.isArray(val) ? val.join(", ") : "";
  };
  const ph = (k: string) => t(`profile.placeholders.${k}`);

  return (
    <div>
      <ModuleHeader icon={UserCircle} title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <form
        action={(fd) => {
          startTransition(async () => {
            await saveProfile(fd);
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          });
        }}
        className="space-y-5"
      >
        <Section icon={UserCircle} title={t("profile.personalTitle")} hint={t("profile.personalHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.name")}>
              <input name="display_name" defaultValue={v("display_name")} placeholder={ph("name")} className={inputClass} />
            </Field>
            <Field label={t("profile.birthday")}>
              <input type="date" name="birthday" defaultValue={v("birthday")} className={inputClass} />
            </Field>
            <Field label={t("profile.location")}>
              <input name="location" defaultValue={v("location")} placeholder={ph("location")} className={inputClass} />
            </Field>
            <Field label={t("profile.headline")}>
              <input name="headline" defaultValue={v("headline")} placeholder={ph("headline")} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("profile.bio")}>
                <textarea name="bio" defaultValue={v("bio")} rows={3} placeholder={ph("bio")} className={inputClass + " resize-none"} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Sparkles} title={t("profile.visionTitle")} hint={t("profile.visionHint")}>
          <div className="grid gap-4">
            <Field label={t("profile.mission")}>
              <input name="mission" defaultValue={v("mission")} placeholder={ph("mission")} className={inputClass} />
            </Field>
            <Field label={t("profile.vision")}>
              <textarea name="vision" defaultValue={v("vision")} rows={3} placeholder={ph("vision")} className={inputClass + " resize-none"} />
            </Field>
            <Field label={t("profile.coreValues")}>
              <input name="core_values" defaultValue={arr("core_values")} placeholder={ph("coreValues")} className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section icon={Briefcase} title={t("profile.careerTitle")} hint={t("profile.careerHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.jobTitle")}>
              <input name="job_title" defaultValue={v("job_title")} placeholder={ph("jobTitle")} className={inputClass} />
            </Field>
            <Field label={t("profile.company")}>
              <input name="company" defaultValue={v("company")} placeholder={ph("company")} className={inputClass} />
            </Field>
            <Field label={t("profile.education")}>
              <input name="education" defaultValue={v("education")} placeholder={ph("education")} className={inputClass} />
            </Field>
            <Field label={t("profile.skills")}>
              <input name="skills" defaultValue={arr("skills")} placeholder={ph("skills")} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("profile.careerPlans")}>
                <textarea name="career_plans" defaultValue={v("career_plans")} rows={2} placeholder={ph("careerPlans")} className={inputClass + " resize-none"} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Wallet} title={t("profile.financeTitle")} hint={t("profile.financeHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.currency")}>
              <select name="preferred_currency" defaultValue={String(v("preferred_currency") || "USD")} className={inputClass}>
                {currencies.map((c) => (
                  <option key={c} value={c} className="bg-base">{c}</option>
                ))}
              </select>
            </Field>
            <Field label={t("profile.currentSavings")}>
              <input type="number" name="current_savings" step="0.01" defaultValue={v("current_savings")} placeholder="0" className={inputClass} />
            </Field>
            <Field label={t("profile.monthlyIncome")}>
              <input type="number" name="monthly_income" step="0.01" defaultValue={v("monthly_income")} placeholder="0" className={inputClass} />
            </Field>
            <Field label={t("profile.monthlyExpenses")}>
              <input type="number" name="monthly_expenses" step="0.01" defaultValue={v("monthly_expenses")} placeholder="0" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("profile.financialGoal")}>
                <input name="financial_goal" defaultValue={v("financial_goal")} placeholder={ph("financialGoal")} className={inputClass} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Heart} title={t("profile.growthTitle")} hint={t("profile.growthHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("profile.healthGoal")}>
              <input name="health_goal" defaultValue={v("health_goal")} placeholder={ph("healthGoal")} className={inputClass} />
            </Field>
            <Field label={t("profile.spiritualGoal")}>
              <input name="spiritual_goal" defaultValue={v("spiritual_goal")} placeholder={ph("spiritualGoal")} className={inputClass} />
            </Field>
            <Field label={t("profile.learningGoal")}>
              <input name="learning_goal" defaultValue={v("learning_goal")} placeholder={ph("learningGoal")} className={inputClass} />
            </Field>
            <Field label={t("profile.growthFocus")}>
              <input name="growth_focus" defaultValue={v("growth_focus")} placeholder={ph("growthFocus")} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("lifeScore.relationships")}>
                <textarea
                  name="relationships_note"
                  defaultValue={v("relationships_note")}
                  rows={2}
                  placeholder={t("lifeScore.relationshipsPlaceholder")}
                  className={inputClass + " resize-none"}
                />
              </Field>
            </div>
          </div>
        </Section>

        <div className="sticky bottom-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_10px_40px_-12px_rgba(59,130,246,0.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? t("profile.saved") : t("profile.save")}
          </button>
          <span className="text-xs text-white/40">{t("profile.privacyHint")}</span>
        </div>
      </form>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-accent-soft">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-white/40">{hint}</p>
        </div>
      </div>
      {children}
    </Panel>
  );
}
