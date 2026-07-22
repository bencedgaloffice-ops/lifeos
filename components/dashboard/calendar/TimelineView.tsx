"use client";

import { useState } from "react";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Segmented } from "@/components/dashboard/ui";
import { resolveIcon } from "@/lib/icon-registry";
import { itemsOnDay, dayKey } from "@/components/dashboard/calendar/utils";
import { updateEventDate, rescheduleLinkedItem } from "@/app/dashboard/calendar/actions";

type Density = "compact" | "comfortable" | "expanded";
const DENSITY_PX: Record<Density, number> = { compact: 32, comfortable: 48, expanded: 72 };

const BANDS = [
  { key: "morning", start: 6, end: 12 },
  { key: "afternoon", start: 12, end: 17 },
  { key: "evening", start: 17, end: 21 },
  { key: "night", start: 21, end: 30 }, // wraps past midnight visually
];

function assignLanes(items: CalendarItem[]): { item: CalendarItem; lane: number }[] {
  const sorted = [...items].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const laneEnds: number[] = [];
  const placed: { item: CalendarItem; lane: number }[] = [];
  for (const item of sorted) {
    const start = new Date(item.start).getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = new Date(item.end).getTime();
    placed.push({ item, lane });
  }
  return placed;
}

export function TimelineView({ anchor, items, onOpenItem }: { anchor: Date; items: CalendarItem[]; onOpenItem: (item: CalendarItem) => void }) {
  const { t } = useLocale();
  const [density, setDensity] = useState<Density>("comfortable");
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const pxPerHour = DENSITY_PX[density];

  const dayItems = itemsOnDay(items, anchor).filter((it) => !it.allDay);
  const laned = assignLanes(dayItems);
  const laneCount = Math.max(1, ...laned.map((l) => l.lane + 1));
  const rowHeight = Math.max(36, pxPerHour * 0.8);

  function handleDrop(e: React.DragEvent, hour: number) {
    e.preventDefault();
    setDragOverHour(null);
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    const dragged: { sourceTable: string; sourceId: string; occurrenceDate: string; occurrenceTime?: string } = JSON.parse(payload);
    const time = `${String(hour).padStart(2, "0")}:00`;
    const newMoment = `${dayKey(anchor)}T${time}`;
    if (dragged.sourceTable === "calendar_events") {
      updateEventDate(dragged.sourceId, `${dragged.occurrenceDate}T${dragged.occurrenceTime ?? "00:00"}`, newMoment);
    } else {
      rescheduleLinkedItem(dragged.sourceTable, dragged.sourceId, dayKey(anchor));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Segmented
          value={density}
          onChange={setDensity}
          className="timeline-density"
          options={[
            { value: "compact", label: t("calendar.timeline.densityCompact") },
            { value: "comfortable", label: t("calendar.timeline.densityComfortable") },
            { value: "expanded", label: t("calendar.timeline.densityExpanded") },
          ]}
        />
      </div>

      <div className="overflow-x-auto rounded-3xl glass p-4 shadow-glass">
        <div style={{ width: 24 * pxPerHour, minWidth: "100%" }}>
          {/* Band labels */}
          <div className="relative mb-1 h-5">
            {BANDS.map((b) => (
              <div
                key={b.key}
                className="absolute top-0 text-[0.65rem] uppercase tracking-wider text-white/35"
                style={{ left: Math.max(0, b.start % 24) * pxPerHour }}
              >
                {t(`calendar.timeline.${b.key}`)}
              </div>
            ))}
          </div>

          {/* Hour ruler + drop targets */}
          <div className="relative flex border-b border-hairline/50 pb-1">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverHour(h);
                }}
                onDragLeave={() => setDragOverHour((v) => (v === h ? null : v))}
                onDrop={(e) => handleDrop(e, h)}
                className="shrink-0 border-l border-hairline/30 text-center text-[0.6rem] text-white/30 transition-colors"
                style={{
                  width: pxPerHour,
                  backgroundColor: dragOverHour === h ? "rgba(59,130,246,0.12)" : undefined,
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Lanes */}
          <div className="relative mt-2" style={{ height: laneCount * (rowHeight + 6) }}>
            {laned.map(({ item, lane }) => {
              const start = new Date(item.start);
              const end = new Date(item.end);
              const startHour = start.getHours() + start.getMinutes() / 60;
              const endHour = Math.max(startHour + 0.34, end.getHours() + end.getMinutes() / 60);
              const Icon = resolveIcon(item.icon);
              return (
                <button
                  key={item.id}
                  draggable={item.editable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({
                        sourceTable: item.sourceTable,
                        sourceId: item.sourceId,
                        occurrenceDate: dayKey(start),
                        occurrenceTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
                      }),
                    );
                  }}
                  onClick={() => onOpenItem(item)}
                  className="absolute overflow-hidden rounded-lg px-2 py-1 text-left text-[0.7rem] font-medium shadow-glass transition-transform hover:-translate-y-0.5"
                  style={{
                    left: startHour * pxPerHour,
                    width: (endHour - startHour) * pxPerHour - 4,
                    top: lane * (rowHeight + 6),
                    height: rowHeight,
                    backgroundColor: `${item.color}33`,
                    color: item.color,
                    borderLeft: `2px solid ${item.color}`,
                  }}
                >
                  <span className="flex items-center gap-1 truncate text-white/90">
                    <Icon className="h-3 w-3 shrink-0" />
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
