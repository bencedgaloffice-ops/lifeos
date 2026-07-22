"use client";

import { useMemo, useState } from "react";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel, Segmented, EmptyState, GoogleSyncDot } from "@/components/dashboard/ui";
import { resolveIcon } from "@/lib/icon-registry";
import { formatTime } from "@/components/dashboard/calendar/utils";
import { CalendarDays } from "lucide-react";

type Range = 7 | 30 | 90;

export function AgendaView({
  items,
  onOpenItem,
  searchQuery,
}: {
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  searchQuery?: string;
}) {
  const { t, locale } = useLocale();
  const [range, setRange] = useState<Range>(7);

  const filtered = useMemo(() => {
    const now = new Date();
    const query = searchQuery?.trim().toLowerCase();

    if (query) {
      return items
        .filter((it) => it.title.toLowerCase().includes(query) || it.description?.toLowerCase().includes(query))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }

    const end = new Date(now.getTime() + range * 86_400_000);
    return items
      .filter((it) => new Date(it.start) >= now && new Date(it.start) <= end)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [items, range, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of filtered) {
      const key = new Date(it.start).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-5">
      {!searchQuery && (
        <div className="flex justify-end">
          <Segmented
            value={String(range)}
            onChange={(v) => setRange(Number(v) as Range)}
            options={[
              { value: "7", label: t("calendar.agenda.range7") },
              { value: "30", label: t("calendar.agenda.range30") },
              { value: "90", label: t("calendar.agenda.range90") },
            ]}
          />
        </div>
      )}

      {grouped.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={searchQuery ? t("calendar.search.noResults") : t("calendar.agenda.empty")}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateStr, dayItems]) => (
            <Panel key={dateStr} className="p-4">
              <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-white/40">
                {new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).format(new Date(dateStr))}
              </p>
              <div className="space-y-1.5">
                {dayItems.map((it) => {
                  const Icon = resolveIcon(it.icon);
                  return (
                    <button
                      key={it.id}
                      onClick={() => onOpenItem(it)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${it.color}22`, color: it.color }}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </div>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm text-white/80">
                        {it.title}
                        {it.fromGoogle && <GoogleSyncDot />}
                      </span>
                      <span className="shrink-0 text-xs text-white/40">{it.allDay ? "—" : formatTime(it.start)}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
