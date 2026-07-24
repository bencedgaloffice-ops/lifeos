"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Wallet,
  CalendarDays,
  Building2,
  HeartPulse,
  Car,
  ChefHat,
  FolderKanban,
  Target,
  Sparkles,
  ArrowUpRight,
  Clock,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { EarthCanvas } from "@/components/three/EarthCanvas";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatCurrency } from "@/lib/format";
import { MODULE_THEME, moduleGlow, type ModuleKey } from "@/lib/module-theme";
import type { OverviewData } from "@/components/dashboard/modules/OverviewModule";

/**
 * LIFEOS 3.0 — the Command Center.
 *
 * The spec's centerpiece: after entering, the user lands in a futuristic
 * personal command bridge — a realistic globe at the center of their world,
 * with floating holographic "system" panels (Wealth, Calendar, Business,
 * Health, Garage, Kitchen, Projects, Goals) orbiting it, and a Tesla-style
 * TODAY / LIFE STATUS / DECISIONS layer underneath where Jarvis surfaces the
 * few things that actually matter right now. Every panel is a real, live
 * readout of the user's own data and a door into that module.
 */

type PanelDef = {
  key: ModuleKey;
  href: string;
  icon: LucideIcon;
  labelKey: string;
  value: string;
  sub: string;
};

const panelFloat = (i: number) => ({
  animate: { y: [0, i % 2 === 0 ? -6 : -9, 0] },
  transition: { duration: 5 + (i % 4), repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.2 },
});

export function CommandCenter({ data }: { data: OverviewData }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const fc = (n: number) => formatCurrency(n, data.currency, { locale });
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n)}%`);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("commandCenter.greetingMorning") : hour < 18 ? t("commandCenter.greetingAfternoon") : t("commandCenter.greetingEvening");

  const panels: PanelDef[] = [
    {
      key: "finance",
      href: "/dashboard/finance",
      icon: Wallet,
      labelKey: "commandCenter.panels.wealth",
      value: fc(data.netWorth),
      sub: `${data.savingsRate >= 0 ? "+" : ""}${data.savingsRate}% ${t("commandCenter.savings")}`,
    },
    {
      key: "calendar",
      href: "/dashboard/calendar",
      icon: CalendarDays,
      labelKey: "commandCenter.panels.calendar",
      value: t("commandCenter.eventsToday", { n: data.todayCalendar.count }),
      sub: data.todayCalendar.nextTitle ?? t("commandCenter.clear"),
    },
    {
      key: "business",
      href: "/dashboard/business",
      icon: Building2,
      labelKey: "commandCenter.panels.business",
      value: fc(data.monthIncome),
      sub: t("commandCenter.thisMonth"),
    },
    {
      key: "nutrition",
      href: "/dashboard/nutrition",
      icon: HeartPulse,
      labelKey: "commandCenter.panels.health",
      value: pct(data.lifeScore.health),
      sub: t("commandCenter.vitals"),
    },
    {
      key: "garage",
      href: "/dashboard/business/garage",
      icon: Car,
      labelKey: "commandCenter.panels.garage",
      value: MODULE_THEME.garage.identity,
      sub: t("commandCenter.enter"),
    },
    {
      key: "kitchen",
      href: "/dashboard/kitchen",
      icon: ChefHat,
      labelKey: "commandCenter.panels.kitchen",
      value: `${data.tiles.kitchenItems}`,
      sub: t("commandCenter.itemsShopping", { n: data.tiles.shoppingItems }),
    },
    {
      key: "projects",
      href: "/dashboard/projects",
      icon: FolderKanban,
      labelKey: "commandCenter.panels.projects",
      value: `${data.activeProjects}`,
      sub: t("commandCenter.active"),
    },
    {
      key: "goals",
      href: "/dashboard/goals",
      icon: Target,
      labelKey: "commandCenter.panels.goals",
      value: `${data.activeGoals}`,
      sub: data.goalsAvg == null ? t("commandCenter.active") : `${data.goalsAvg}% ${t("commandCenter.avg")}`,
    },
  ];

  // Tesla "LIFE STATUS" — four core vitals of the whole life, as meters.
  const status: { labelKey: string; value: number | null; key: ModuleKey }[] = [
    { labelKey: "commandCenter.statusFinancial", value: data.lifeScore.money, key: "finance" },
    { labelKey: "commandCenter.statusPhysical", value: data.lifeScore.health, key: "nutrition" },
    { labelKey: "commandCenter.statusBusiness", value: data.lifeScore.productivity, key: "business" },
    { labelKey: "commandCenter.statusGoals", value: data.lifeScore.growth, key: "goals" },
  ];

  const decisions = data.missions.slice(0, 3);

  const GlobeCell = (
    <div className="relative order-first col-span-2 h-56 overflow-hidden rounded-3xl border border-white/10 bg-black/40 md:order-none md:col-span-1 md:h-auto">
      <div className="pointer-events-none absolute inset-0">
        <EarthCanvas />
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_60px_-10px_rgba(59,130,246,0.35)]" />
      <div className="pointer-events-none absolute bottom-3 left-0 right-0 text-center">
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/50">{t("commandCenter.core")}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Greeting / status line */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-white/40">{t("commandCenter.eyebrow")}</p>
          <h1 className="mt-1 font-display text-2xl text-white sm:text-3xl">
            {greeting}, <span className="text-accent-soft">{data.name}</span>.
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
            <Activity className="h-3.5 w-3.5 text-emerald-400" /> {t("commandCenter.online")}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-right">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/40">
            {t("commandCenter.level")} {data.progress.level}
          </p>
          <p className="font-display text-sm text-white/85">{data.progress.title}</p>
        </div>
      </motion.div>

      {/* The command bridge — globe centered, systems orbiting */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:grid-rows-3 md:h-[640px]">
        {panels.slice(0, 4).map((p, i) => (
          <SystemPanel key={p.key} p={p} i={i} onOpen={() => router.push(p.href)} label={t(p.labelKey)} enter={t("commandCenter.enter")} />
        ))}
        {GlobeCell}
        {panels.slice(4).map((p, i) => (
          <SystemPanel key={p.key} p={p} i={i + 4} onOpen={() => router.push(p.href)} label={t(p.labelKey)} enter={t("commandCenter.enter")} />
        ))}
      </div>

      {/* Jarvis command bar */}
      <button
        onClick={() => router.push("/dashboard/jarvis")}
        className="group flex w-full items-center gap-3 rounded-2xl border border-[#ff2d3f]/30 bg-[#ff2d3f]/[0.06] px-4 py-3 text-left transition hover:bg-[#ff2d3f]/[0.12]"
        style={{ boxShadow: moduleGlow("jarvis", 0.3) }}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff2d3f]/15 text-[#ff8b93]">
          <Sparkles className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium text-white/90">{t("commandCenter.jarvisTitle")}</span>
          <span className="block text-xs text-white/45">{t("commandCenter.jarvisHint")}</span>
        </span>
        <ArrowUpRight className="h-4 w-4 text-white/40 transition group-hover:text-white/80" />
      </button>

      {/* Tesla: TODAY / LIFE STATUS / DECISIONS */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* TODAY */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <SectionTitle icon={Clock}>{t("commandCenter.today")}</SectionTitle>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <p className="text-[0.6rem] uppercase tracking-wider text-white/40">{t("commandCenter.schedule")}</p>
              {data.todayCalendar.count > 0 || data.todayCalendar.nextTitle ? (
                <>
                  <p className="mt-1 text-sm text-white/85">{data.todayCalendar.nextTitle ?? t("commandCenter.eventsToday", { n: data.todayCalendar.count })}</p>
                  {data.todayCalendar.nextWhen && <p className="text-xs text-white/45">{data.todayCalendar.nextWhen}</p>}
                </>
              ) : (
                <p className="mt-1 text-sm text-white/45">{t("commandCenter.noEventsToday")}</p>
              )}
            </div>
            {data.missions[0] && (
              <div className="rounded-2xl bg-white/[0.03] p-3">
                <p className="text-[0.6rem] uppercase tracking-wider text-white/40">{t("commandCenter.focus")}</p>
                <p className="mt-1 text-sm text-white/85">{data.missions[0].title}</p>
                <p className="text-xs text-white/45">{data.missions[0].nextAction}</p>
              </div>
            )}
          </div>
        </div>

        {/* LIFE STATUS */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
          <SectionTitle icon={Activity}>{t("commandCenter.lifeStatus")}</SectionTitle>
          <div className="mt-4 space-y-4">
            {status.map((s) => {
              const color = MODULE_THEME[s.key].color;
              const v = s.value == null ? 0 : Math.max(0, Math.min(100, s.value));
              return (
                <div key={s.labelKey}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-white/60">{t(s.labelKey)}</span>
                    <span className="font-mono text-white/85">{s.value == null ? "—" : `${Math.round(s.value)}%`}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${v}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DECISIONS */}
        <div className="rounded-3xl border border-[#ff2d3f]/20 bg-[#ff2d3f]/[0.03] p-5">
          <SectionTitle icon={Sparkles} accent="#ff8b93">
            {t("commandCenter.decisions")}
          </SectionTitle>
          <p className="mt-2 text-xs text-white/45">{t("commandCenter.jarvisSays")}</p>
          <div className="mt-3 space-y-2">
            {decisions.length === 0 ? (
              <p className="text-sm text-white/45">{t("commandCenter.noPriorities")}</p>
            ) : (
              decisions.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => router.push(m.kind === "goal" ? "/dashboard/goals" : "/dashboard/projects")}
                  className="flex w-full items-start gap-3 rounded-2xl bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
                >
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#ff2d3f]/15 font-mono text-xs text-[#ff8b93]">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/85">{m.title}</span>
                    <span className="block truncate text-xs text-white/45">{m.nextAction}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemPanel({
  p,
  i,
  onOpen,
  label,
  enter,
}: {
  p: PanelDef;
  i: number;
  onOpen: () => void;
  label: string;
  enter: string;
}) {
  const theme = MODULE_THEME[p.key];
  const Icon = p.icon;
  return (
    <motion.button
      onClick={onOpen}
      {...panelFloat(i)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex min-h-[110px] flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-3.5 text-left backdrop-blur-md md:min-h-[0]"
      style={{ boxShadow: moduleGlow(p.key, 0.28) }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ background: theme.color }}
      />
      <div className="flex items-center justify-between">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${theme.color}22`, color: theme.soft }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-white/25 transition group-hover:text-white/70" />
      </div>
      <div>
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
        <p className="truncate font-display text-base text-white/90">{p.value}</p>
        <p className="truncate text-[0.7rem] text-white/45">{p.sub}</p>
      </div>
    </motion.button>
  );
}

function SectionTitle({ icon: Icon, children, accent }: { icon: LucideIcon; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: accent ?? "rgba(255,255,255,0.55)" }} />
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/60">{children}</h2>
    </div>
  );
}
