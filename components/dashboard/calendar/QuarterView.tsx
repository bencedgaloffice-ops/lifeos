"use client";

import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { MiniMonth } from "@/components/dashboard/calendar/YearView";

export function QuarterView({
  anchor,
  items,
  onSelectMonth,
}: {
  anchor: Date;
  items: CalendarItem[];
  onSelectMonth: (year: number, month: number) => void;
}) {
  const { locale } = useLocale();
  const startMonth = Math.floor(anchor.getMonth() / 3) * 3;
  const months = [startMonth, startMonth + 1, startMonth + 2];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {months.map((m) => (
        <MiniMonth
          key={m}
          year={anchor.getFullYear()}
          month={m}
          items={items}
          onSelect={() => onSelectMonth(anchor.getFullYear(), m)}
          locale={locale}
        />
      ))}
    </div>
  );
}
