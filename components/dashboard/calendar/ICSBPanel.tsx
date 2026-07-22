"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import type { Shift } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, StatCard, inputClass, EmptyState } from "@/components/dashboard/ui";
import { formatCurrency } from "@/lib/format";
import { createShift, deleteShift, saveDefaultHourlyRate } from "@/app/dashboard/calendar/actions";

const SHIFT_TYPES = ["morning", "afternoon", "night", "holiday", "vacation", "training"] as const;

export function ICSBPanel({ shifts, defaultRate, currency }: { shifts: Shift[]; defaultRate: number | null; currency: string }) {
  const { t, locale } = useLocale();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  const now = new Date();
  const thisMonthShifts = useMemo(
    () =>
      shifts.filter((s) => {
        const d = new Date(s.start_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }),
    [shifts],
  );

  const hoursWorked = thisMonthShifts.reduce((sum, s) => sum + (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 3_600_000, 0);
  const estimatedSalary = thisMonthShifts.reduce((sum, s) => {
    const hours = (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 3_600_000;
    const rate = s.hourly_rate ?? defaultRate ?? 0;
    return sum + hours * rate;
  }, 0);

  const breakdown = SHIFT_TYPES.map((type) => ({
    type,
    count: thisMonthShifts.filter((s) => s.shift_type === type).length,
  })).filter((b) => b.count > 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("calendar.icsb.hoursThisMonth")} value={hoursWorked.toFixed(1)} />
        <StatCard label={t("calendar.icsb.estimatedSalary")} value={formatCurrency(estimatedSalary, currency, { compact: true, locale })} accent />
        <StatCard label={t("calendar.icsb.shiftsThisMonth")} value={String(thisMonthShifts.length)} />
      </div>

      {breakdown.length > 0 && (
        <Panel className="p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/45">{t("calendar.icsb.breakdown")}</p>
          <div className="flex flex-wrap gap-2">
            {breakdown.map((b) => (
              <span key={b.type} className="rounded-full bg-white/6 px-3 py-1.5 text-xs text-white/70">
                {t(`calendar.icsb.${b.type}`)} · {b.count}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel className="p-4">
        <form
          action={(fd) => startTransition(() => saveDefaultHourlyRate(fd))}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
              {t("calendar.icsb.defaultRate")}
            </span>
            <input type="number" name="icsb_hourly_rate" step="0.01" defaultValue={defaultRate ?? ""} className={inputClass} />
          </label>
          <button type="submit" disabled={pending} className="rounded-full glass-strong px-4 py-2.5 text-sm font-medium text-white/80">
            {t("calendar.icsb.save")}
          </button>
        </form>
      </Panel>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-white/45">{t("calendar.icsb.title")}</h3>
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full glass-strong text-white/60 hover:text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {adding && (
          <form
            action={(fd) => {
              startTransition(async () => {
                await createShift(fd);
                setAdding(false);
              });
            }}
            className="mb-4 grid grid-cols-2 gap-3 rounded-2xl glass p-4 sm:grid-cols-3"
          >
            <select name="shift_type" required className={inputClass}>
              {SHIFT_TYPES.map((type) => (
                <option key={type} value={type} className="bg-base">
                  {t(`calendar.icsb.${type}`)}
                </option>
              ))}
            </select>
            <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
            <input type="number" name="hourly_rate" step="0.01" placeholder={t("calendar.icsb.hourlyRate")} className={inputClass} />
            <input type="time" name="start_time" defaultValue="08:00" className={inputClass} />
            <input type="time" name="end_time" defaultValue="16:00" className={inputClass} />
            <input name="notes" placeholder={t("calendar.icsb.notes")} className={inputClass} />
            <div className="col-span-full flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="rounded-full px-3 py-1.5 text-xs text-white/50 hover:text-white">
                {t("calendar.icsb.cancel")}
              </button>
              <button type="submit" className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black">
                {t("calendar.icsb.save")}
              </button>
            </div>
          </form>
        )}

        {shifts.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={t("calendar.icsb.noShifts")} />
        ) : (
          <div className="space-y-1.5">
            {shifts.slice(0, 20).map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-white/60">{t(`calendar.icsb.${s.shift_type}`)}</span>
                <span className="flex-1 truncate text-sm text-white/75">
                  {new Date(s.start_at).toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US")}
                </span>
                <span className="text-xs text-white/40">
                  {((new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 3_600_000).toFixed(1)}h
                </span>
                <button onClick={() => startTransition(() => deleteShift(s.id))} className="text-white/30 hover:text-red-300">
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
