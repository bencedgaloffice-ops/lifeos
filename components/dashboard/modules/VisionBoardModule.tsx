"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Image as ImageIcon, Plus, Trash2, X, Calendar, Target, LayoutGrid, Move } from "lucide-react";
import type { VisionCard, Goal, Organization } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ModuleHeader, Panel, EmptyState, Field, inputClass, Progress, Segmented } from "@/components/dashboard/ui";
import { createVisionCard, deleteVisionCard, updateVisionCardPosition } from "@/app/dashboard/vision/actions";
import { CATEGORY_COLOR_SWATCHES } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";

type Props = {
  cards: VisionCard[];
  goals: Goal[];
  organizations: Organization[];
};

type Filter = "all" | "personal" | "business" | string;
type Mode = "board" | "canvas";

export function VisionBoardModule({ cards, goals, organizations }: Props) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [mode, setMode] = useState<Mode>("board");
  const [category, setCategory] = useState<"personal" | "business">("personal");
  const [scrub, setScrub] = useState(100);
  const [active, setActive] = useState<VisionCard | null>(null);

  const orgColor = (orgId: string | null) => {
    if (!orgId) return "#3B82F6";
    const idx = organizations.findIndex((o) => o.id === orgId);
    return CATEGORY_COLOR_SWATCHES[idx % CATEGORY_COLOR_SWATCHES.length] ?? "#3B82F6";
  };

  const goalById = (id: string | null) => goals.find((g) => g.id === id) ?? null;

  const targetDates = cards.map((c) => c.target_date).filter(Boolean) as string[];
  const minDate = targetDates.length ? Math.min(...targetDates.map((d) => new Date(d).getTime())) : null;
  const maxDate = targetDates.length ? Math.max(...targetDates.map((d) => new Date(d).getTime())) : null;
  const hasTimeline = minDate !== null && maxDate !== null && minDate !== maxDate;

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filter === "business" && c.category !== "business") return false;
      if (filter === "personal" && c.category !== "personal") return false;
      if (filter !== "all" && filter !== "personal" && filter !== "business" && c.organization_id !== filter) return false;
      if (hasTimeline && c.target_date) {
        const time = new Date(c.target_date).getTime();
        const cutoff = minDate! + ((maxDate! - minDate!) * scrub) / 100;
        if (time > cutoff) return false;
      }
      return true;
    });
  }, [cards, filter, scrub, hasTimeline, minDate, maxDate]);

  const filterPills: { value: Filter; label: string }[] = [
    { value: "all", label: t("vision.filterAll") },
    { value: "personal", label: t("vision.filterPersonal") },
    { value: "business", label: t("vision.filterBusiness") },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <div>
      <ModuleHeader
        icon={ImageIcon}
        title={t("nav.vision.label")}
        subtitle={t("vision.subtitle")}
        accent="vision"
        action={
          <div className="flex items-center gap-2">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "board", label: t("vision.modeBoard") },
                { value: "canvas", label: t("vision.modeCanvas") },
              ]}
              className="vision-mode"
            />
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> {t("vision.addCard")}
            </button>
          </div>
        }
      />

      {open && (
        <Panel className="mb-5">
          <form
            action={(fd) => {
              startTransition(() => createVisionCard(fd));
              setOpen(false);
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label={t("vision.formTitle")}>
              <input name="title" required className={inputClass} />
            </Field>
            <Field label={t("vision.formImageUrl")}>
              <input name="image_url" placeholder="https://…" className={inputClass} />
            </Field>
            <Field label={t("vision.formCategory")}>
              <select
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as "personal" | "business")}
                className={inputClass}
              >
                <option value="personal" className="bg-base">{t("vision.filterPersonal")}</option>
                <option value="business" className="bg-base">{t("vision.filterBusiness")}</option>
              </select>
            </Field>
            {category === "business" && (
              <Field label={t("vision.formOrganization")}>
                <select name="organization_id" className={inputClass} defaultValue="">
                  <option value="" className="bg-base">{t("vision.formOrganizationNone")}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id} className="bg-base">{o.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("vision.formGoal")}>
              <select name="goal_id" className={inputClass} defaultValue="">
                <option value="" className="bg-base">{t("vision.formGoalNone")}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id} className="bg-base">{g.title}</option>
                ))}
              </select>
            </Field>
            <Field label={t("vision.formTargetDate")}>
              <input type="date" name="target_date" className={inputClass} />
            </Field>
            <Field label={t("vision.formNotes")}>
              <textarea name="notes" rows={2} className={inputClass + " resize-none sm:col-span-2"} />
            </Field>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
                {t("vision.save")}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full glass px-5 py-2.5 text-sm text-white/70">
                {t("vision.cancel")}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Floating filter pills */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filterPills.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setFilter(pill.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              filter === pill.value ? "bg-white text-black" : "glass text-white/55 hover:text-white/85",
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Timeline scrubber */}
      {hasTimeline && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl glass px-4 py-3">
          <Calendar className="h-4 w-4 shrink-0 text-white/40" />
          <input
            type="range"
            min={0}
            max={100}
            value={scrub}
            onChange={(e) => setScrub(Number(e.target.value))}
            className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-[#3B82F6]"
          />
          <span className="shrink-0 text-xs text-white/45">
            {formatDate(new Date(minDate! + ((maxDate! - minDate!) * scrub) / 100), undefined, locale)}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t("vision.empty")} hint={t("vision.emptyHint")} />
      ) : mode === "board" ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          <AnimatePresence>
            {filtered.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                goal={goalById(card.goal_id)}
                accent={card.category === "business" ? orgColor(card.organization_id) : "#F5A15E"}
                locale={locale}
                onOpen={() => setActive(card)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <CanvasBoard
          cards={filtered}
          goalById={goalById}
          orgColor={orgColor}
          locale={locale}
          onOpen={setActive}
          hint={t("vision.canvasHint")}
        />
      )}

      {/* Expanded detail view */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl glass-strong shadow-glass"
            >
              <button
                onClick={() => setActive(null)}
                className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
              {active.image_url && (
                <div className="h-56 w-full bg-cover bg-center" style={{ backgroundImage: `url(${active.image_url})` }} />
              )}
              <div className="p-6">
                <h3 className="text-xl font-semibold tracking-tight">{active.title}</h3>
                {active.target_date && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                    <Calendar className="h-3.5 w-3.5" /> {formatDate(active.target_date, undefined, locale)}
                  </p>
                )}
                {goalById(active.goal_id) && (
                  <div className="mt-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
                      <Target className="h-3.5 w-3.5" /> {goalById(active.goal_id)!.title}
                    </p>
                    <Progress value={active.progress_override ?? goalById(active.goal_id)!.progress_percent} />
                  </div>
                )}
                {active.notes && <p className="mt-4 text-sm leading-relaxed text-white/60">{active.notes}</p>}
                <button
                  onClick={() => {
                    startTransition(() => deleteVisionCard(active.id));
                    setActive(null);
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-4 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("vision.delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A photo-first masonry card: clean image at rest, details fade/slide in on
 * hover, with a subtle cursor-driven tilt for a bit of depth. */
function BoardCard({
  card,
  goal,
  accent,
  locale,
  onOpen,
}: {
  card: VisionCard;
  goal: Goal | null;
  accent: string;
  locale: "en" | "hu";
  onOpen: () => void;
}) {
  const progress = card.progress_override ?? goal?.progress_percent ?? null;
  const rotateX = useSpring(0, { stiffness: 300, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 25 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 8);
    rotateX.set(-py * 8);
  }
  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onOpen}
      style={{ rotateX, rotateY, transformPerspective: 800, borderColor: `${accent}55` }}
      className="group relative mb-4 block w-full cursor-pointer overflow-hidden rounded-3xl border break-inside-avoid"
    >
      <div
        className="relative flex min-h-[180px] w-full items-end overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: card.image_url
            ? `url(${card.image_url})`
            : `linear-gradient(135deg, ${accent}33, rgba(5,5,5,0.9))`,
          aspectRatio: card.image_url ? "3 / 4" : undefined,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 group-hover:opacity-0"
        />
        <span className="pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-full shadow-glow-sm" style={{ backgroundColor: accent }} />
        <div className="relative z-10 w-full translate-y-2 p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="text-sm font-semibold tracking-tight text-white">{card.title}</p>
          {card.target_date && <p className="mt-0.5 text-xs text-white/60">{formatDate(card.target_date, undefined, locale)}</p>}
          {progress !== null && (
            <div className="mt-2">
              <Progress value={progress} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Freeform draggable canvas — cards keep a persisted free position and
 * layer order; scroll to pan, hold Ctrl/⌘ + scroll (or pinch) to zoom. */
function CanvasBoard({
  cards,
  goalById,
  orgColor,
  locale,
  onOpen,
  hint,
}: {
  cards: VisionCard[];
  goalById: (id: string | null) => Goal | null;
  orgColor: (id: string | null) => string;
  locale: "en" | "hu";
  onOpen: (card: VisionCard) => void;
  hint: string;
}) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [topZ, setTopZ] = useState(cards.length + 1);

  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs text-white/35">
        <Move className="h-3.5 w-3.5" /> {hint}
      </p>
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative h-[70vh] w-full overflow-auto rounded-3xl border border-hairline bg-white/[0.015]"
      >
        <div
          className="relative"
          style={{ width: 2400, height: 1600, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        >
          {cards.map((card, i) => (
            <CanvasCard
              key={card.id}
              card={card}
              index={i}
              goal={goalById(card.goal_id)}
              accent={card.category === "business" ? orgColor(card.organization_id) : "#F5A15E"}
              locale={locale}
              onOpen={() => onOpen(card)}
              bringToFront={() => setTopZ((z) => z + 1)}
              topZ={topZ}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CanvasCard({
  card,
  index,
  goal,
  accent,
  locale,
  onOpen,
  bringToFront,
  topZ,
}: {
  card: VisionCard;
  index: number;
  goal: Goal | null;
  accent: string;
  locale: "en" | "hu";
  onOpen: () => void;
  bringToFront: () => void;
  topZ: number;
}) {
  const [, startTransition] = useTransition();
  const progress = card.progress_override ?? goal?.progress_percent ?? null;
  const hasStoredPosition = card.position_x !== 0 || card.position_y !== 0;
  const fallbackX = 40 + (index % 5) * 260;
  const fallbackY = 40 + Math.floor(index / 5) * 240;
  const x = useMotionValue(hasStoredPosition ? card.position_x : fallbackX);
  const y = useMotionValue(hasStoredPosition ? card.position_y : fallbackY);
  const [z, setZ] = useState(card.z_index || index);
  const [dragging, setDragging] = useState(false);

  function handleDragEnd() {
    setDragging(false);
    startTransition(() => updateVisionCardPosition(card.id, x.get(), y.get(), z));
  }

  return (
    <motion.div
      drag
      dragMomentum
      dragElastic={0.15}
      onDragStart={() => {
        setDragging(true);
        bringToFront();
        setZ((v) => v + 1);
      }}
      onDragEnd={handleDragEnd}
      onClick={() => !dragging && onOpen()}
      style={{ x, y, zIndex: dragging ? topZ + 1 : z, width: card.width || 240, borderColor: `${accent}55` }}
      whileDrag={{ scale: 1.04 }}
      className="absolute cursor-grab overflow-hidden rounded-2xl border shadow-glass active:cursor-grabbing"
    >
      <div
        className="relative flex h-[200px] w-full items-end overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: card.image_url
            ? `url(${card.image_url})`
            : `linear-gradient(135deg, ${accent}33, rgba(5,5,5,0.9))`,
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <span className="pointer-events-none absolute right-3 top-3 h-2.5 w-2.5 rounded-full shadow-glow-sm" style={{ backgroundColor: accent }} />
        <div className="relative z-10 w-full p-3.5">
          <p className="text-sm font-semibold tracking-tight text-white">{card.title}</p>
          {card.target_date && <p className="mt-0.5 text-xs text-white/60">{formatDate(card.target_date, undefined, locale)}</p>}
          {progress !== null && (
            <div className="mt-2">
              <Progress value={progress} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
