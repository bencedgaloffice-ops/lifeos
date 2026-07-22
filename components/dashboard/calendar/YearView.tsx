"use client";

import { useMemo } from "react";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel } from "@/components/dashboard/ui";
import { dayKey, dominantColor, itemsOnDay } from "@/components/dashboard/calendar/utils";

export function YearView({
  anchor,
  items,
  onSelectMonth,
}: {
  anchor: Date;
  items: CalendarItem[];
  onSelectMonth: (month: number) => void;
}) {
  const { t, locale } = useLocale();
  const year = anchor.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);

  const yearItems = useMemo(
    () => items.filter((it) => new Date(it.start).getFullYear() === year),
    [items, year],
  );

  const busiestMonth = useMemo(() => {
    const counts = months.map((m) => yearItems.filter((it) => new Date(it.start).getMonth() === m).length);
    const max = Math.max(...counts, 0);
    const idx = counts.indexOf(max);
    return max > 0 ? idx : null;
  }, [yearItems]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-white/45">{t("calendar.year.eventsThisYear", { n: yearItems.length })}</p>
        {busiestMonth !== null && (
          <p className="text-sm text-white/45">
            {t("calendar.year.busiestMonth")}:{" "}
            <span className="text-white/80">
              {new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { month: "long" }).format(new Date(year, busiestMonth, 1))}
            </span>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m) => (
          <MiniMonth key={m} year={year} month={m} items={yearItems} onSelect={() => onSelectMonth(m)} locale={locale} />
        ))}
      </div>

      <p className="text-center text-xs text-white/30">{t("calendar.year.legendHint")}</p>
    </div>
  );
}

export function MiniMonth({
  year,
  month,
  items,
  onSelect,
  locale,
}: {
  year: number;
  month: number;
  items: CalendarItem[];
  onSelect: () => void;
  locale: string;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlank = first.getDay();
  const monthLabel = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", { month: "long" }).format(first);

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlank }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  return (
    <button onClick={onSelect} className="text-left">
      <Panel className="p-4 transition-transform hover:-translate-y-0.5">
        <p className="mb-2.5 text-sm font-medium text-white/80">{monthLabel}</p>
        <div className="grid grid-cols-7 gap-[3px]">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const dayItems = itemsOnDay(items, d).filter((it) => dayKey(new Date(it.start)) === dayKey(d));
            const color = dominantColor(dayItems);
            return (
              <div
                key={i}
                className="aspect-square rounded-[2px]"
                style={{
                  backgroundColor: color ? `${color}${dayItems.length > 2 ? "" : "80"}` : "rgba(255,255,255,0.05)",
                }}
                title={`${dayItems.length}`}
              />
            );
          })}
        </div>
      </Panel>
    </button>
  );
}
