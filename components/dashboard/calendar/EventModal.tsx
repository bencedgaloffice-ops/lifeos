"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, ExternalLink, Repeat } from "lucide-react";
import type { CalendarItem, LifeArea } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { inputClass } from "@/components/dashboard/ui";
import { resolveIcon } from "@/lib/icon-registry";
import { upsertCalendarEvent, deleteCalendarEvent } from "@/app/dashboard/calendar/actions";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type CreateDefaults = { date: string; startTime?: string };

export function EventModal({
  open,
  onClose,
  item,
  createDefaults,
  lifeAreas,
}: {
  open: boolean;
  onClose: () => void;
  item: CalendarItem | null;
  createDefaults: CreateDefaults | null;
  lifeAreas: LifeArea[];
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [repeats, setRepeats] = useState(parseRepeatsKind(item?.recurrenceRule));
  const [byDay, setByDay] = useState<number[]>(parseByDay(item?.recurrenceRule));
  const [scopeChoice, setScopeChoice] = useState<"save" | "delete" | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  if (!open) return null;

  const isEvent = !item || item.kind === "event";
  const isRecurring = Boolean(item?.recurrenceRule);
  const linkedModuleKey = item && item.kind !== "event" && item.kind !== "shift" ? item.kind : null;

  const startDate = item ? item.start.slice(0, 10) : createDefaults?.date ?? new Date().toISOString().slice(0, 10);
  const startTime = item && !item.allDay ? item.start.slice(11, 16) : createDefaults?.startTime ?? "09:00";
  const endTime = item && !item.allDay ? item.end.slice(11, 16) : "10:00";

  function handleSubmit(formData: FormData) {
    if (isRecurring && !scopeChoice) {
      setPendingFormData(formData);
      setScopeChoice("save");
      return;
    }
    formData.set("scope", "series");
    if (item) {
      formData.set("id", item.sourceId);
      formData.set("occurrence_start", item.start);
    }
    startTransition(async () => {
      await upsertCalendarEvent(formData);
      onClose();
    });
  }

  function handleDeleteScope(scope: "future" | "series") {
    if (!item) return;
    startTransition(async () => {
      await deleteCalendarEvent(item.sourceId, scope, item.start);
      onClose();
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl glass-strong p-6 shadow-glass"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {!isEvent ? (
            <InfoCard item={item!} onClose={onClose} linkedModuleKey={linkedModuleKey} t={t} />
          ) : scopeChoice ? (
            <ScopeChooser
              t={t}
              mode={scopeChoice}
              onPick={(scope) => {
                if (scopeChoice === "delete") {
                  handleDeleteScope(scope);
                  return;
                }
                if (pendingFormData) {
                  pendingFormData.set("scope", scope);
                  pendingFormData.set("id", item!.sourceId);
                  pendingFormData.set("occurrence_start", item!.start);
                  startTransition(async () => {
                    await upsertCalendarEvent(pendingFormData);
                    onClose();
                  });
                }
              }}
              onCancel={() => setScopeChoice(null)}
            />
          ) : (
            <form id="event-modal-form" action={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">
                {item ? t("calendar.event.edit") : t("calendar.event.new")}
              </h2>

              <input
                name="title"
                defaultValue={item?.title ?? ""}
                placeholder={t("calendar.event.titlePlaceholder")}
                required
                className={inputClass + " text-base font-medium"}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                    {t("calendar.event.category")}
                  </label>
                  <LifeAreaSelect name="life_area_id" lifeAreas={lifeAreas} defaultValue={item?.lifeAreaId ?? ""} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                    {t("calendar.event.priority")}
                  </label>
                  <select name="priority" defaultValue={item?.priority ?? ""} className={inputClass}>
                    <option value="" className="bg-base">{t("calendar.event.priorityNone")}</option>
                    <option value="low" className="bg-base">{t("calendar.event.priorityLow")}</option>
                    <option value="medium" className="bg-base">{t("calendar.event.priorityMedium")}</option>
                    <option value="high" className="bg-base">{t("calendar.event.priorityHigh")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                    {t("calendar.event.date")}
                  </label>
                  <input type="date" name="date" defaultValue={startDate} required className={inputClass} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                    {t("calendar.event.startTime")}
                  </label>
                  <input type="time" name="start_time" defaultValue={startTime} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                    {t("calendar.event.endTime")}
                  </label>
                  <input type="time" name="end_time" defaultValue={endTime} className={inputClass} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/60">
                <input type="checkbox" name="all_day" defaultChecked={item?.allDay ?? false} className="h-4 w-4 rounded accent-accent" />
                {t("calendar.event.allDay")}
              </label>

              <input
                name="location"
                defaultValue={item?.location ?? ""}
                placeholder={t("calendar.event.locationPlaceholder")}
                className={inputClass}
              />

              <textarea
                name="description"
                defaultValue={item?.description ?? ""}
                placeholder={t("calendar.event.description")}
                rows={2}
                className={inputClass + " resize-none"}
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
                  {t("calendar.event.reminder")}
                </label>
                <select name="reminder_minutes_before" defaultValue={item?.reminderMinutesBefore ?? ""} className={inputClass}>
                  <option value="" className="bg-base">{t("calendar.event.reminderNone")}</option>
                  <option value="0" className="bg-base">{t("calendar.event.reminderAtStart")}</option>
                  {[5, 15, 30, 60, 1440].map((n) => (
                    <option key={n} value={n} className="bg-base">
                      {t("calendar.event.reminderMinutes", { n })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-hairline p-3.5">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/45">
                  <Repeat className="h-3.5 w-3.5" />
                  {t("calendar.event.repeats")}
                </div>
                <select
                  name="repeats"
                  value={repeats}
                  onChange={(e) => setRepeats(e.target.value)}
                  className={inputClass}
                >
                  <option value="none" className="bg-base">{t("calendar.event.repeatsNone")}</option>
                  <option value="daily" className="bg-base">{t("calendar.event.repeatsDaily")}</option>
                  <option value="weekly" className="bg-base">{t("calendar.event.repeatsWeekly")}</option>
                  <option value="monthly" className="bg-base">{t("calendar.event.repeatsMonthly")}</option>
                  <option value="yearly" className="bg-base">{t("calendar.event.repeatsYearly")}</option>
                </select>

                {repeats === "weekly" && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-white/45">{t("calendar.event.repeatsOnDays")}</p>
                    <div className="flex gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <label key={d}>
                          <input
                            type="checkbox"
                            name="byDay"
                            value={d}
                            checked={byDay.includes(d)}
                            onChange={(e) =>
                              setByDay((prev) => (e.target.checked ? [...prev, d] : prev.filter((x) => x !== d)))
                            }
                            className="peer sr-only"
                          />
                          <span className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xs font-medium text-white/50 transition-colors peer-checked:bg-accent peer-checked:text-white hover:bg-white/10">
                            {WEEKDAY_LABELS[d]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {repeats !== "none" && (
                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs text-white/45">{t("calendar.event.repeatsUntil")}</label>
                    <input type="date" name="repeats_until" className={inputClass} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {item && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => (isRecurring ? setScopeChoice("delete") : handleDeleteScope("series"))}
                      className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("calendar.event.delete")}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full px-4 py-2 text-sm text-white/55 transition-colors hover:text-white"
                  >
                    {t("calendar.event.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {t("calendar.event.save")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function LifeAreaSelect({
  name,
  lifeAreas,
  defaultValue,
}: {
  name: string;
  lifeAreas: LifeArea[];
  defaultValue: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={inputClass}>
      <option value="" className="bg-base">—</option>
      {lifeAreas.map((area) => (
        <option key={area.id} value={area.id} className="bg-base">
          {area.name}
        </option>
      ))}
    </select>
  );
}

function InfoCard({
  item,
  onClose,
  linkedModuleKey,
  t,
}: {
  item: CalendarItem;
  onClose: () => void;
  linkedModuleKey: string | null;
  t: (key: string, vars?: Record<string, any>) => string;
}) {
  const Icon = resolveIcon(item.icon);
  const moduleHref: Record<string, string> = {
    goal: "/dashboard/goals",
    project: "/dashboard/projects",
    document: "/dashboard/protection",
    responsibility: "/dashboard/protection",
    milestone: "/dashboard/legacy",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl glass-strong" style={{ color: item.color }}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{item.title}</h2>
          <p className="text-xs text-white/45">
            {new Date(item.start).toLocaleDateString()} · {item.allDay ? t("calendar.event.allDay") : new Date(item.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>
      {item.description && <p className="text-sm text-white/65">{item.description}</p>}
      {linkedModuleKey && (
        <>
          <p className="text-xs text-white/40">
            {t("calendar.event.linkedHint", { module: t(`calendar.linked.${linkedModuleKey}`) })}
          </p>
          <a
            href={moduleHref[linkedModuleKey]}
            className="inline-flex items-center gap-1.5 rounded-full glass-strong px-4 py-2 text-sm font-medium text-accent-soft transition-transform hover:-translate-y-0.5"
          >
            {t("calendar.event.openIn", { module: t(`calendar.linked.${linkedModuleKey}`) })}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      )}
      {item.kind === "shift" && (
        <a
          href="/dashboard/calendar?focus=icsb"
          className="inline-flex items-center gap-1.5 rounded-full glass-strong px-4 py-2 text-sm font-medium text-accent-soft transition-transform hover:-translate-y-0.5"
        >
          {t("calendar.event.openIn", { module: t("calendar.focus.icsb") })}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <div className="flex justify-end">
        <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-white/55 transition-colors hover:text-white">
          {t("calendar.event.cancel")}
        </button>
      </div>
    </div>
  );
}

function ScopeChooser({
  t,
  mode,
  onPick,
  onCancel,
}: {
  t: (key: string) => string;
  mode: "save" | "delete";
  onPick: (scope: "future" | "series") => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">
        {mode === "save" ? t("calendar.event.updateScope") : t("calendar.event.deleteScope")}
      </p>
      <div className="space-y-2">
        <button
          onClick={() => onPick("future")}
          className="w-full rounded-xl glass-strong px-4 py-3 text-left text-sm transition-colors hover:bg-white/10"
        >
          {t("calendar.event.scopeFuture")}
        </button>
        <button
          onClick={() => onPick("series")}
          className="w-full rounded-xl glass-strong px-4 py-3 text-left text-sm transition-colors hover:bg-white/10"
        >
          {t("calendar.event.scopeSeries")}
        </button>
      </div>
      <button onClick={onCancel} className="text-sm text-white/45 transition-colors hover:text-white">
        {t("calendar.event.cancel")}
      </button>
    </div>
  );
}

function parseRepeatsKind(rule: string | null | undefined): string {
  if (!rule) return "none";
  const m = rule.match(/FREQ=(\w+)/);
  return m ? m[1].toLowerCase() : "none";
}

function parseByDay(rule: string | null | undefined): number[] {
  if (!rule) return [];
  const m = rule.match(/BYDAY=([\w,]+)/);
  if (!m) return [];
  const codes: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return m[1].split(",").map((c) => codes[c]).filter((n) => n !== undefined);
}
