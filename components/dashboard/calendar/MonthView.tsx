"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";
import { monthMatrix, itemsOnDay, isSameDay, dayKey } from "@/components/dashboard/calendar/utils";
import { rescheduleLinkedItem, updateEventDate } from "@/app/dashboard/calendar/actions";

const MAX_VISIBLE = 3;

export function MonthView({
  anchor,
  items,
  onOpenItem,
  onQuickAdd,
}: {
  anchor: Date;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  onQuickAdd: (date: string) => void;
}) {
  const { t, locale } = useLocale();
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const weeks = monthMatrix(anchor);
  const today = new Date();
  const weekdayLabels = weekdayShortLabels(locale);

  return (
    <div className="overflow-hidden rounded-3xl glass shadow-glass">
      <div className="grid grid-cols-7 border-b border-hairline">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-white/40">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, today);
          const key = dayKey(day);
          const dayItems = itemsOnDay(items, day).filter((it) => isSameDay(new Date(it.start), day));
          const isDragOver = dragOverDay === key;

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDay(key);
              }}
              onDragLeave={() => setDragOverDay((d) => (d === key ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                const payload = e.dataTransfer.getData("application/json");
                if (!payload) return;
                const dragged: { sourceTable: string; sourceId: string; occurrenceDate: string } = JSON.parse(payload);
                if (dragged.sourceTable === "calendar_events") {
                  updateEventDate(dragged.sourceId, dragged.occurrenceDate, key);
                } else {
                  rescheduleLinkedItem(dragged.sourceTable, dragged.sourceId, key);
                }
              }}
              onClick={() => dayItems.length === 0 && onQuickAdd(key)}
              className={cn(
                "group relative min-h-[108px] border-b border-r border-hairline/60 p-2 transition-colors last:border-r-0",
                !inMonth && "opacity-35",
                isDragOver && "bg-accent/10",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-white text-black" : "text-white/55",
                  )}
                >
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAdd(key);
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Plus className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                </button>
              </div>

              <div className="space-y-1">
                {dayItems.slice(0, MAX_VISIBLE).map((it) => {
                  const Icon = resolveIcon(it.icon);
                  return (
                    <motion.button
                      key={it.id}
                      layout
                      draggable={it.editable}
                      onDragStart={(e) => {
                        (e as unknown as React.DragEvent).dataTransfer?.setData(
                          "application/json",
                          JSON.stringify({ sourceTable: it.sourceTable, sourceId: it.sourceId, occurrenceDate: it.start.slice(0, 10) }),
                        );
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenItem(it);
                      }}
                      whileHover={{ x: 2 }}
                      className="flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-left text-[0.7rem] font-medium transition-colors"
                      style={{ backgroundColor: `${it.color}22`, color: it.color }}
                    >
                      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
                      <span className="truncate text-white/85">{it.title}</span>
                    </motion.button>
                  );
                })}
                {dayItems.length > MAX_VISIBLE && (
                  <p className="px-1.5 text-[0.65rem] text-white/35">
                    {t("calendar.month.more", { n: dayItems.length - MAX_VISIBLE })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function weekdayShortLabels(locale: string): string[] {
  const base = new Date(2024, 0, 7); // a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { weekday: "short" }).format(d);
  });
}
