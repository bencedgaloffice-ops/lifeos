"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Palette } from "lucide-react";
import type { Apiary, CalendarItem, HabitEntry, HoneyHarvestLog, LifeArea, Shift } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Segmented } from "@/components/dashboard/ui";
import { MonthView } from "@/components/dashboard/calendar/MonthView";
import { WeekView } from "@/components/dashboard/calendar/WeekView";
import { TodayView } from "@/components/dashboard/calendar/TodayView";
import { QuarterView } from "@/components/dashboard/calendar/QuarterView";
import { YearView } from "@/components/dashboard/calendar/YearView";
import { TimelineView } from "@/components/dashboard/calendar/TimelineView";
import { AgendaView } from "@/components/dashboard/calendar/AgendaView";
import { SearchBar } from "@/components/dashboard/calendar/SearchBar";
import { EventModal } from "@/components/dashboard/calendar/EventModal";
import { CategoryManager } from "@/components/dashboard/calendar/CategoryManager";
import { ICSBPanel } from "@/components/dashboard/calendar/ICSBPanel";
import { BeekeepingPanel } from "@/components/dashboard/calendar/BeekeepingPanel";
import { ReminderBell } from "@/components/dashboard/calendar/ReminderBell";

type View = "today" | "week" | "month" | "quarter" | "year" | "timeline" | "agenda";

export function CalendarModule({
  items,
  lifeAreas,
  shifts,
  apiaries,
  harvestLog,
  habitToday,
  habitRecent,
  icsbHourlyRate,
  displayName,
  currency,
}: {
  items: CalendarItem[];
  lifeAreas: LifeArea[];
  shifts: Shift[];
  apiaries: Apiary[];
  harvestLog: HoneyHarvestLog[];
  habitToday: HabitEntry | null;
  habitRecent: { entry_date: string; bible_study: boolean; workout: boolean }[];
  icsbHourlyRate: number | null;
  displayName: string | null;
  currency: string;
}) {
  const { t } = useLocale();
  const [view, setView] = useState<View>("today");
  const [focus, setFocus] = useState<"all" | "icsb" | "beekeeping">("all");
  const [anchor, setAnchor] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<CalendarItem | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{ date: string; startTime?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const viewOptions = useMemo(
    () => [
      { value: "today" as View, label: t("calendar.views.today") },
      { value: "week" as View, label: t("calendar.views.week") },
      { value: "month" as View, label: t("calendar.views.month") },
      { value: "quarter" as View, label: t("calendar.views.quarter") },
      { value: "year" as View, label: t("calendar.views.year") },
      { value: "timeline" as View, label: t("calendar.views.timeline") },
      { value: "agenda" as View, label: t("calendar.views.agenda") },
    ],
    [t],
  );

  function openItem(item: CalendarItem) {
    setActiveItem(item);
    setCreateDefaults(null);
    setModalOpen(true);
  }

  function quickAdd(date: string, time?: string) {
    setActiveItem(null);
    setCreateDefaults({ date, startTime: time });
    setModalOpen(true);
  }

  function step(delta: number) {
    setAnchor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + delta);
      else if (view === "week") next.setDate(next.getDate() + delta * 7);
      else if (view === "quarter") next.setMonth(next.getMonth() + delta * 3);
      else if (view === "year") next.setFullYear(next.getFullYear() + delta);
      else next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const anchorLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions =
      view === "month" || view === "quarter"
        ? { month: "long", year: "numeric" }
        : view === "year"
          ? { year: "numeric" }
          : { month: "short", day: "numeric", year: "numeric" };
    return new Intl.DateTimeFormat(undefined, opts).format(anchor);
  }, [anchor, view]);

  const dateAnchoredViews: View[] = ["week", "month", "quarter", "year", "timeline"];
  const showingSearch = searchQuery.trim().length > 0;

  const icsbAreaId = useMemo(() => lifeAreas.find((a) => a.name === "ICSB Security")?.id ?? null, [lifeAreas]);
  const beekeepingAreaId = useMemo(() => lifeAreas.find((a) => a.name === "Migratory Beekeeping")?.id ?? null, [lifeAreas]);

  const focusedItems = useMemo(() => {
    if (focus === "icsb") return items.filter((it) => it.kind === "shift" || it.lifeAreaId === icsbAreaId);
    if (focus === "beekeeping") return items.filter((it) => it.lifeAreaId === beekeepingAreaId);
    return items;
  }, [items, focus, icsbAreaId, beekeepingAreaId]);

  const focusOptions = [
    { value: "all" as const, label: t("calendar.focus.all") },
    { value: "icsb" as const, label: t("calendar.focus.icsb") },
    { value: "beekeeping" as const, label: t("calendar.focus.beekeeping") },
  ];

  return (
    <div>
      <ModuleHeader
        icon={CalendarDays}
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        action={
          <div className="flex items-center gap-2">
            <ReminderBell items={items} />
            <button
              onClick={() => setCategoriesOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full glass text-white/60 transition-colors hover:text-white"
              title={t("calendar.categories.title")}
            >
              <Palette className="h-4 w-4" />
            </button>
            <button
              onClick={() => quickAdd(new Date().toISOString().slice(0, 10))}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              {t("calendar.month.addEvent")}
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented value={focus} onChange={setFocus} options={focusOptions} className="focus-mode" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <Segmented value={view} onChange={setView} options={viewOptions} />
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        {!showingSearch && dateAnchoredViews.includes(view) && (
          <div className="flex items-center gap-3">
            <button onClick={() => step(-1)} className="flex h-8 w-8 items-center justify-center rounded-full glass text-white/60 hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-white/75">{anchorLabel}</span>
            <button onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center rounded-full glass text-white/60 hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-full glass px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white"
            >
              {t("calendar.views.today")}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={showingSearch ? "search" : view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {showingSearch ? (
            <AgendaView items={focusedItems} onOpenItem={openItem} searchQuery={searchQuery} />
          ) : (
            <>
              {view === "today" && (
                <TodayView items={focusedItems} habitToday={habitToday} onOpenItem={openItem} onQuickAdd={(d) => quickAdd(d)} />
              )}
              {view === "week" && (
                <WeekView anchor={anchor} items={focusedItems} onOpenItem={openItem} onQuickAdd={(d, tm) => quickAdd(d, tm)} />
              )}
              {view === "month" && (
                <MonthView anchor={anchor} items={focusedItems} onOpenItem={openItem} onQuickAdd={(d) => quickAdd(d)} />
              )}
              {view === "quarter" && (
                <QuarterView
                  anchor={anchor}
                  items={focusedItems}
                  onSelectMonth={(year, month) => {
                    setAnchor(new Date(year, month, 1));
                    setView("month");
                  }}
                />
              )}
              {view === "year" && (
                <YearView
                  anchor={anchor}
                  items={focusedItems}
                  onSelectMonth={(month) => {
                    setAnchor(new Date(anchor.getFullYear(), month, 1));
                    setView("month");
                  }}
                />
              )}
              {view === "timeline" && <TimelineView anchor={anchor} items={focusedItems} onOpenItem={openItem} />}
              {view === "agenda" && <AgendaView items={focusedItems} onOpenItem={openItem} />}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {focus === "icsb" && (
        <div className="mt-6">
          <ICSBPanel shifts={shifts} defaultRate={icsbHourlyRate} currency={currency} />
        </div>
      )}
      {focus === "beekeeping" && (
        <div className="mt-6">
          <BeekeepingPanel apiaries={apiaries} harvestLog={harvestLog} beekeepingItems={focusedItems} />
        </div>
      )}

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={activeItem}
        createDefaults={createDefaults}
        lifeAreas={lifeAreas}
      />
      <CategoryManager open={categoriesOpen} onClose={() => setCategoriesOpen(false)} lifeAreas={lifeAreas} />
    </div>
  );
}
