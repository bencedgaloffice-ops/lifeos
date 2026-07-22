"use client";

import { useState, useTransition } from "react";
import { UserCircle, Check, Loader2, Sparkles, Wallet, Briefcase, Heart } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { ModuleHeader, Panel, Field, inputClass } from "@/components/dashboard/ui";
import { saveProfile } from "@/app/dashboard/profile/actions";

const currencies = ["USD", "EUR", "GBP", "HUF", "CHF", "JPY", "AUD", "CAD"];

export function ProfileModule({ profile }: { profile: Profile | null }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const v = (k: keyof Profile) => (profile?.[k] as string | number | null) ?? "";
  const arr = (k: keyof Profile) => {
    const val = profile?.[k];
    return Array.isArray(val) ? val.join(", ") : "";
  };

  return (
    <div>
      <ModuleHeader
        icon={UserCircle}
        title="My Life Profile"
        subtitle="The foundation your entire system is built on."
      />

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
        <Section icon={UserCircle} title="Personal" hint="Who you are.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input name="display_name" defaultValue={v("display_name")} placeholder="Alex Rivera" className={inputClass} />
            </Field>
            <Field label="Birthday">
              <input type="date" name="birthday" defaultValue={v("birthday")} className={inputClass} />
            </Field>
            <Field label="Location">
              <input name="location" defaultValue={v("location")} placeholder="Lisbon, Portugal" className={inputClass} />
            </Field>
            <Field label="Headline">
              <input name="headline" defaultValue={v("headline")} placeholder="Founder · builder · father" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Important life details">
                <textarea name="bio" defaultValue={v("bio")} rows={3} placeholder="Anything that defines this chapter of your life…" className={inputClass + " resize-none"} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Sparkles} title="Vision" hint="Where you're going.">
          <div className="grid gap-4">
            <Field label="Personal mission">
              <input name="mission" defaultValue={v("mission")} placeholder="To build things that outlive me." className={inputClass} />
            </Field>
            <Field label="Life goals & dreams">
              <textarea name="vision" defaultValue={v("vision")} rows={3} placeholder="The life you're intentionally building…" className={inputClass + " resize-none"} />
            </Field>
            <Field label="Core values (comma separated)">
              <input name="core_values" defaultValue={arr("core_values")} placeholder="Freedom, Family, Growth, Integrity" className={inputClass} />
            </Field>
          </div>
        </Section>

        <Section icon={Briefcase} title="Career" hint="What you do.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <input name="job_title" defaultValue={v("job_title")} placeholder="Product Designer" className={inputClass} />
            </Field>
            <Field label="Company">
              <input name="company" defaultValue={v("company")} placeholder="Atlas Studio" className={inputClass} />
            </Field>
            <Field label="Education">
              <input name="education" defaultValue={v("education")} placeholder="B.Sc. Computer Science" className={inputClass} />
            </Field>
            <Field label="Skills (comma separated)">
              <input name="skills" defaultValue={arr("skills")} placeholder="Design, Strategy, Coding" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Future plans">
                <textarea name="career_plans" defaultValue={v("career_plans")} rows={2} placeholder="Where your career is heading…" className={inputClass + " resize-none"} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Wallet} title="Financial baseline" hint="Your money, at a glance.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preferred currency">
              <select name="preferred_currency" defaultValue={String(v("preferred_currency") || "USD")} className={inputClass}>
                {currencies.map((c) => (
                  <option key={c} value={c} className="bg-base">{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Current savings">
              <input type="number" name="current_savings" step="0.01" defaultValue={v("current_savings")} placeholder="0" className={inputClass} />
            </Field>
            <Field label="Monthly income">
              <input type="number" name="monthly_income" step="0.01" defaultValue={v("monthly_income")} placeholder="0" className={inputClass} />
            </Field>
            <Field label="Monthly expenses">
              <input type="number" name="monthly_expenses" step="0.01" defaultValue={v("monthly_expenses")} placeholder="0" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Financial goal">
                <input name="financial_goal" defaultValue={v("financial_goal")} placeholder="Reach $250k net worth by 2030" className={inputClass} />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Heart} title="Growth & habits" hint="Who you're becoming.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Health goal">
              <input name="health_goal" defaultValue={v("health_goal")} placeholder="Run 3× a week" className={inputClass} />
            </Field>
            <Field label="Spiritual goal">
              <input name="spiritual_goal" defaultValue={v("spiritual_goal")} placeholder="Daily reflection" className={inputClass} />
            </Field>
            <Field label="Learning goal">
              <input name="learning_goal" defaultValue={v("learning_goal")} placeholder="Read 24 books a year" className={inputClass} />
            </Field>
            <Field label="Personal development focus">
              <input name="growth_focus" defaultValue={v("growth_focus")} placeholder="Patience & presence" className={inputClass} />
            </Field>
          </div>
        </Section>

        <div className="sticky bottom-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_10px_40px_-12px_rgba(59,130,246,0.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save profile"}
          </button>
          <span className="text-xs text-white/40">Your data is private and encrypted per-row.</span>
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
