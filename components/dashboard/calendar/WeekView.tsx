"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";
import { weekDays, isSameDay, dayKey } from "@/components/dashboard/calendar/utils";
import { rescheduleLinkedItem, updateEventDate } from "@/app/dashboard/calendar/actions";

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_HEIGHT = 56;

export function WeekView({
  anchor,
  items,
  onOpenItem,
  onQuickAdd,
}: {
  anchor: Date;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  onQuickAdd: (date: string, time: string) => void;
}) {
  const { t, locale } = useLocale();
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const days = weekDays(anchor);
  const today = new Date();
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  const allDayByDay = new Map<string, CalendarItem[]>();
  const timedByDay = new Map<string, CalendarItem[]>();
  for (const day of days) {
    const key = dayKey(day);
    allDayByDay.set(key, []);
    timedByDay.set(key, []);
  }
  for (const it of items) {
    const start = new Date(it.start);
    const key = dayKey(start);
    if (!timedByDay.has(key)) continue;
    if (it.allDay) allDayByDay.get(key)!.push(it);
    else timedByDay.get(key)!.push(it);
  }

  function slotTime(hour: number, half: 0 | 1) {
    return `${String(hour).padStart(2, "0")}:${half ? "30" : "00"}`;
  }

  function handleDrop(e: React.DragEvent, key: string, time: string) {
    e.preventDefault();
    setDragOverSlot(null);
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    const dragged: { sourceTable: string; sourceId: string; occurrenceDate: string; occurrenceTime?: string } = JSON.parse(payload);
    const newDateTime = `${key}T${time}`;
    if (dragged.sourceTable === "calendar_events") {
      updateEventDate(dragged.sourceId, `${dragged.occurrenceDate}T${dragged.occurrenceTime ?? "00:00"}`, newDateTime);
    } else {
      rescheduleLinkedItem(dragged.sourceTable, dragged.sourceId, key);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl glass shadow-glass">
      <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-hairline">
        <div />
        {days.map((day) => (
          <div key={dayKey(day)} className="px-2 py-2.5 text-center">
            <p className="text-[0.65rem] uppercase tracking-wider text-white/40">
              {new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { weekday: "short" }).format(day)}
            </p>
            <span
              className={cn(
                "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                isSameDay(day, today) ? "bg-white text-black" : "text-white/70",
              )}
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* All-day strip */}
      <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-hairline/60">
        <div className="px-2 py-1.5 text-right text-[0.6rem] text-white/30">{t("calendar.week.allDay")}</div>
        {days.map((day) => {
          const key = dayKey(day);
          return (
            <div key={key} className="space-y-1 px-1 py-1.5">
              {(allDayByDay.get(key) ?? []).map((it) => {
                const Icon = resolveIcon(it.icon);
                return (
                  <button
                    key={it.id}
                    onClick={() => onOpenItem(it)}
                    className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[0.65rem] font-medium"
                    style={{ backgroundColor: `${it.color}22`, color: it.color }}
                  >
                    <Icon className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate text-white/80">{it.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[52px_repeat(7,1fr)] overflow-y-auto" style={{ maxHeight: 620 }}>
        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-hairline/40 pr-2 text-right text-[0.65rem] text-white/30">
              {h}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = dayKey(day);
          const dayItems = timedByDay.get(key) ?? [];
          return (
            <div key={key} className="relative border-l border-hairline/40">
              {hours.map((h) =>
                [0, 1].map((half) => {
                  const time = slotTime(h, half as 0 | 1);
                  const slotId = `${key}T${time}`;
                  return (
                    <div
                      key={slotId}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverSlot(slotId);
                      }}
                      onDragLeave={() => setDragOverSlot((s) => (s === slotId ? null : s))}
                      onDrop={(e) => handleDrop(e, key, time)}
                      onClick={() => onQuickAdd(key, time)}
                      className={cn(
                        "border-b border-hairline/20 transition-colors hover:bg-white/[0.03]",
                        dragOverSlot === slotId && "bg-accent/15",
                      )}
                      style={{ height: HOUR_HEIGHT / 2 }}
                    />
                  );
                }),
              )}

              {dayItems.map((it) => {
                const start = new Date(it.start);
                const end = new Date(it.end);
                const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
                const durMins = Math.max(20, (end.getTime() - start.getTime()) / 60000);
                const top = (startMins / 60) * HOUR_HEIGHT;
                const height = (durMins / 60) * HOUR_HEIGHT;
                const Icon = resolveIcon(it.icon);
                return (
                  <motion.button
                    key={it.id}
                    layout
                    draggable={it.editable}
                    onDragStart={(e) => {
                      (e as unknown as React.DragEvent).dataTransfer?.setData(
                        "application/json",
                        JSON.stringify({
                          sourceTable: it.sourceTable,
                          sourceId: it.sourceId,
                          occurrenceDate: dayKey(start),
                          occurrenceTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
                        }),
                      );
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenItem(it);
                    }}
                    className="absolute left-0.5 right-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[0.65rem] font-medium shadow-glass"
                    style={{ top, height, backgroundColor: `${it.color}33`, color: it.color, borderLeft: `2px solid ${it.color}` }}
                  >
                    <span className="flex items-center gap-1 truncate text-white/90">
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      {it.title}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
