"use client";

import { useEffect, useState, useTransition } from "react";
import { Cloud, Plus } from "lucide-react";
import type { CalendarItem, HabitEntry } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, inputClass, GoogleSyncDot } from "@/components/dashboard/ui";
import { resolveIcon } from "@/lib/icon-registry";
import { formatTime, itemsOnDay } from "@/components/dashboard/calendar/utils";
import { upsertHabitEntry } from "@/app/dashboard/calendar/actions";

export function TodayView({
  items,
  habitToday,
  onOpenItem,
  onQuickAdd,
}: {
  items: CalendarItem[];
  habitToday: HabitEntry | null;
  onOpenItem: (item: CalendarItem) => void;
  onQuickAdd: (date: string) => void;
}) {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(new Date());
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const todayItems = itemsOnDay(items, today).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const priorityItems = todayItems.filter((it) => it.priority === "high");
  const dateLabel = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Panel glow>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">{dateLabel}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{timeLabel}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full glass px-4 py-2 text-xs text-white/40">
              <Cloud className="h-3.5 w-3.5" />
              {t("calendar.today.weatherPlaceholder")}
            </div>
          </div>
        </Panel>

        {priorityItems.length > 0 && (
          <Panel>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-white/45">
              {t("calendar.today.priorityTitle")}
            </h3>
            <div className="space-y-2">
              {priorityItems.map((it) => (
                <ScheduleRow key={it.id} item={it} onOpen={() => onOpenItem(it)} />
              ))}
            </div>
          </Panel>
        )}

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-white/45">
              {t("calendar.today.scheduleTitle")}
            </h3>
            <button
              onClick={() => onQuickAdd(today.toISOString().slice(0, 10))}
              className="flex h-7 w-7 items-center justify-center rounded-full glass-strong text-white/50 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {todayItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">{t("calendar.today.noEvents")}</p>
          ) : (
            <div className="space-y-2">
              {todayItems.map((it) => (
                <ScheduleRow key={it.id} item={it} onOpen={() => onOpenItem(it)} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <h3 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/45">
          {t("calendar.today.habitsTitle")}
        </h3>
        <form
          action={(fd) => {
            fd.set("entry_date", today.toISOString().slice(0, 10));
            startTransition(async () => {
              await upsertHabitEntry(fd);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            });
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <ToggleField name="bible_study" label={t("calendar.today.bibleStudy")} defaultChecked={habitToday?.bible_study} />
            <ToggleField name="workout" label={t("calendar.today.workout")} defaultChecked={habitToday?.workout} />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
              {t("calendar.today.water")} ({t("calendar.today.waterUnit")})
            </span>
            <input type="number" name="water_ml" step="50" defaultValue={habitToday?.water_ml ?? ""} className={inputClass} />
          </label>

          <SliderField name="mood" label={t("calendar.today.mood")} max={5} defaultValue={habitToday?.mood} />
          <SliderField name="energy" label={t("calendar.today.energy")} max={10} defaultValue={habitToday?.energy} />
          <SliderField name="focus_score" label={t("calendar.today.focusScore")} max={10} defaultValue={habitToday?.focus_score} />

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">
              {t("calendar.today.habitsNote")}
            </span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={habitToday?.notes ?? ""}
              placeholder={t("calendar.today.habitsNotePlaceholder")}
              className={inputClass + " resize-none"}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saved ? t("calendar.today.saved") : t("calendar.today.save")}
          </button>
        </form>
      </Panel>
    </div>
  );
}

function ScheduleRow({ item, onOpen }: { item: CalendarItem; onOpen: () => void }) {
  const Icon = resolveIcon(item.icon);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.color}22`, color: item.color }}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-white/85">
          {item.title}
          {item.fromGoogle && <GoogleSyncDot />}
        </p>
        <p className="text-xs text-white/40">{item.allDay ? "—" : formatTime(item.start)}</p>
      </div>
    </button>
  );
}

function ToggleField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex flex-1 items-center justify-between gap-2 rounded-xl glass px-3.5 py-2.5">
      <span className="text-sm text-white/70">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 rounded accent-accent" />
    </label>
  );
}

function SliderField({ name, label, max, defaultValue }: { name: string; label: string; max: number; defaultValue?: number | null }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/45">{label}</span>
      <input
        type="range"
        name={name}
        min={1}
        max={max}
        defaultValue={defaultValue ?? Math.ceil(max / 2)}
        className="w-full accent-accent"
      />
    </label>
  );
}
