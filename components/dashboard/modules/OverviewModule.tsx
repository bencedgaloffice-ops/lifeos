"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target, Wallet, FolderKanban, CalendarDays, BookOpen, Sparkles, ArrowRight, Salad, ChefHat,
  Landmark, Bot, Rocket, ChevronRight, Zap, Lock,
  Trophy, CircleCheck, Briefcase, Home, ShieldCheck, Hexagon, TrendingUp, Coins, Gem, PiggyBank, Milestone, Flame,
  Image as ImageIcon, HeartHandshake, Repeat,
  type LucideIcon,
} from "lucide-react";
import { Panel, Progress, Pill, ScoreRing, Numeral } from "@/components/dashboard/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { LifeProgress, Mission } from "@/lib/gamification/types";
import { MODULE_THEME, type ModuleKey } from "@/lib/module-theme";
import { cn } from "@/lib/utils";

type AchievementView = {
  key: string; title: string; description: string; icon: string;
  tier: "bronze" | "gold"; unlocked: boolean; unlockedAt: string | null;
};

export type OverviewData = {
  name: string;
  currency: string;
  onboarded: boolean;
  mission: string | null;
  netWorth: number;
  savingsRate: number;
  monthIncome: number;
  monthSpending: number;
  goalsAvg: number | null;
  activeGoals: number;
  activeProjects: number;
  journalCount: number;
  todayCalendar: { count: number; nextTitle: string | null; nextWhen: string | null };
  latestJournal: { title: string | null; body: string | null; date: string } | null;
  lifeScore: {
    health: number | null;
    money: number;
    growth: number | null;
    productivity: number | null;
    relationshipsNote: string | null;
  };
  progress: LifeProgress;
  missions: Mission[];
  achievements: AchievementView[];
  tiles: {
    shifts: number;
    kitchenItems: number;
    shoppingItems: number;
    consistencyDays: number;
    calorieTarget: number | null;
    dreams: number;
    milestones: number;
  };
};

const ACH_ICONS: Record<string, LucideIcon> = {
  Target, CircleCheck, Trophy, Rocket, FolderKanban, Briefcase, Home, ShieldCheck,
  Hexagon, TrendingUp, Coins, Gem, PiggyBank, BookOpen, Sparkles, Milestone, Flame,
};

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 } }),
};

export function OverviewModule({ data }: { data: OverviewData }) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, data.currency, { locale });
  const p = data.progress;
  const unlockedCount = data.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      {/* Onboarding nudge */}
      {!data.onboarded && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/dashboard/profile">
            <Panel glow className="flex items-center justify-between gap-4 transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl glass-strong text-accent-soft">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("overview.nudgeTitle")}</p>
                  <p className="text-xs text-white/45">{t("overview.nudgeHint")}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/50" />
            </Panel>
          </Link>
        </motion.div>
      )}

      {/* Command header */}
      <motion.div variants={fade} initial="hidden" animate="visible">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent-soft/80">
          {t("command.eyebrow")}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-[2.25rem]">
          {t("command.greeting", { name: data.name.split(" ")[0] })}
        </h1>
        {data.mission ? (
          <p className="mt-1.5 max-w-2xl text-sm text-white/50">“{data.mission}”</p>
        ) : (
          <p className="mt-1.5 text-sm text-white/45">{t("overview.missionFallback")}</p>
        )}
      </motion.div>

      {/* Life Level hero */}
      <motion.div variants={fade} initial="hidden" animate="visible" custom={1}>
        <LifeLevelHero progress={p} netWorth={fc(data.netWorth)} netWorthLabel={t("overview.statNetWorth")} t={t} />
      </motion.div>

      {/* Missions */}
      <motion.section variants={fade} initial="hidden" animate="visible" custom={2}>
        <SectionHeader icon={Rocket} title={t("command.missions")} href="/dashboard/goals" />
        {data.missions.length === 0 ? (
          <Panel><p className="py-3 text-sm text-white/45">{t("command.missionsEmpty")}</p></Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.missions.map((m) => (
              <MissionCard key={m.id} mission={m} nextLabel={t("command.next")} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Life areas */}
      <motion.section variants={fade} initial="hidden" animate="visible" custom={3}>
        <SectionHeader icon={Zap} title={t("command.areas")} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <AreaTile icon={CalendarDays} href="/dashboard/calendar" label={t("nav.calendar.label")} moduleKey="calendar"
            stat={data.todayCalendar.count > 0 ? t("command.eventsToday", { n: data.todayCalendar.count }) : t("command.clearToday")} />
          <AreaTile icon={Wallet} href="/dashboard/finance" label={t("nav.finance.label")} moduleKey="finance" statNode={<Numeral>{fc(data.netWorth)}</Numeral>} />
          <AreaTile icon={Target} href="/dashboard/goals" label={t("nav.goals.label")} moduleKey="goals"
            stat={data.goalsAvg === null ? t("command.noneYet") : `${data.goalsAvg}% · ${data.activeGoals}`} />
          <AreaTile icon={FolderKanban} href="/dashboard/projects" label={t("nav.projects.label")} moduleKey="projects"
            stat={t("command.inMotion", { n: data.activeProjects })} />
          <AreaTile icon={Salad} href="/dashboard/nutrition" label={t("nav.nutrition.label")} moduleKey="nutrition"
            stat={t("command.daysLogged", { n: data.tiles.consistencyDays })} />
          <AreaTile icon={ChefHat} href="/dashboard/kitchen" label={t("nav.kitchen.label")} moduleKey="kitchen"
            stat={t("command.toBuy", { n: data.tiles.shoppingItems })} />
          <AreaTile icon={Landmark} href="/dashboard/legacy" label={t("nav.legacy.label")} moduleKey="legacy"
            stat={t("command.dreamsMilestones", { d: data.tiles.dreams, m: data.tiles.milestones })} />
          <AreaTile icon={ImageIcon} href="/dashboard/vision" label={t("nav.vision.label")} moduleKey="vision" />
          <AreaTile icon={HeartHandshake} href="/dashboard/relationship" label={t("nav.relationship.label")} moduleKey="relationship" />
          <AreaTile icon={Repeat} href="/dashboard/habits" label={t("nav.habits.label")} moduleKey="habits" />
          <AreaTile icon={Briefcase} href="/dashboard/business" label={t("nav.businessOverview.label")} moduleKey="business" />
          <AreaTile icon={Bot} href="/dashboard/jarvis" label={t("nav.jarvis.label")} moduleKey="jarvis" stat={t("command.systemOnline")} />
        </div>
      </motion.section>

      {/* Achievements */}
      <motion.section variants={fade} initial="hidden" animate="visible" custom={4}>
        <SectionHeader icon={Trophy} title={t("command.achievements")} accent="gold"
          trailing={<span className="text-xs font-medium text-gold-soft">{t("command.unlockedCount", { u: unlockedCount, total: data.achievements.length })}</span>} />
        <Panel>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.achievements.map((a) => (
              <AchievementBadge key={a.key} a={a} lockedLabel={t("command.locked")} />
            ))}
          </div>
        </Panel>
      </motion.section>

      {/* Life Score + Journal */}
      <motion.section variants={fade} initial="hidden" animate="visible" custom={5} className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h3 className="mb-5 text-sm font-semibold">{t("lifeScore.title")}</h3>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-wrap gap-6">
              <ScoreRing value={data.lifeScore.health} label={t("lifeScore.health")} />
              <ScoreRing value={data.lifeScore.money} label={t("lifeScore.money")} />
              <ScoreRing value={data.lifeScore.growth} label={t("lifeScore.growth")} />
              <ScoreRing value={data.lifeScore.productivity} label={t("lifeScore.productivity")} />
            </div>
            <div className="max-w-xs">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">{t("lifeScore.relationships")}</p>
              {data.lifeScore.relationshipsNote ? (
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{data.lifeScore.relationshipsNote}</p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-white/40">{t("lifeScore.relationshipsHint")}</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent-soft" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold">{t("overview.journalTitle")}</h3>
            </div>
            <Link href="/dashboard/journal" className="text-white/30 transition-colors hover:text-white" aria-label="Open journal">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {data.latestJournal ? (
            <div>
              <p className="text-xs text-white/40">
                {formatDate(data.latestJournal.date, undefined, locale)} · {data.journalCount} {t("overview.entriesSuffix")}
              </p>
              {data.latestJournal.title && <p className="mt-1.5 text-sm font-medium">{data.latestJournal.title}</p>}
              <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-white/60">{data.latestJournal.body}</p>
            </div>
          ) : (
            <p className="py-4 text-sm text-white/40">{t("overview.emptyJournal")}</p>
          )}
        </Panel>
      </motion.section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LifeLevelHero({
  progress, netWorth, netWorthLabel, t,
}: {
  progress: LifeProgress; netWorth: string; netWorthLabel: string;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  const toNext = Math.max(0, progress.nextLevelXp - progress.xp);
  const maxContribution = Math.max(1, ...progress.contributions.map((c) => c.xp));

  return (
    <Panel className="relative overflow-hidden" glow>
      {/* Gold ambience */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 50% 70% at 12% 0%, rgba(231,178,76,0.14), transparent 60%)" }} />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Level identity */}
        <div className="flex items-center gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/5 shadow-glow-gold">
            <Numeral className="text-3xl font-bold gradient-text-gold">{progress.level}</Numeral>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-soft/80">{t("command.level")}</p>
            <p className="font-display text-2xl font-semibold tracking-tight text-white">{progress.title}</p>
            <p className="mt-0.5 text-xs text-white/45">
              {t("command.xpTotal", { xp: progress.xp })} · {t("command.xpToNext", { n: toNext, lvl: progress.level + 1 })}
            </p>
          </div>
        </div>

        {/* Net worth stat */}
        <div className="lg:text-right">
          <p className="text-xs uppercase tracking-wider text-white/40">{netWorthLabel}</p>
          <Numeral className="block text-2xl font-semibold tracking-tight text-white sm:text-3xl">{netWorth}</Numeral>
        </div>
      </div>

      {/* XP bar */}
      <div className="relative mt-6">
        <div className="mb-1.5 flex justify-between text-xs text-white/45">
          <span>{t("command.progress")}</span>
          <Numeral className="text-gold-soft">{progress.progressPct}%</Numeral>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.progressPct}%` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #B8860B, #E7B24C 55%, #F5D58A)" }}
          />
        </div>
      </div>

      {/* XP breakdown */}
      {progress.contributions.length > 0 && (
        <div className="relative mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
          {progress.contributions.map((c) => (
            <div key={c.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/55">{t(`command.contrib.${c.label.toLowerCase()}`)}</span>
                <Numeral className="text-white/40">{c.xp}</Numeral>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/6">
                <div className="h-full rounded-full bg-gold/60" style={{ width: `${(c.xp / maxContribution) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SectionHeader({
  icon: Icon, title, href, trailing, accent = "accent",
}: {
  icon: LucideIcon; title: string; href?: string; trailing?: React.ReactNode; accent?: "accent" | "gold";
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent === "gold" ? "text-gold-soft" : "text-accent-soft")} strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">{title}</h2>
      </div>
      {trailing}
      {href && !trailing && (
        <Link href={href} className="text-white/30 transition-colors hover:text-white" aria-label={title}>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function MissionCard({ mission, nextLabel }: { mission: Mission; nextLabel: string }) {
  const href = mission.kind === "goal" ? "/dashboard/goals" : "/dashboard/projects";
  return (
    <Link href={href}>
      <motion.div whileHover={{ y: -3 }} className="group h-full rounded-2xl border border-hairline bg-white/[0.02] p-4 transition-colors hover:border-accent/30">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {mission.kind === "goal" ? <Target className="h-3.5 w-3.5 text-accent-soft" /> : <FolderKanban className="h-3.5 w-3.5 text-accent-soft" />}
            {mission.category && <Pill tone="accent">{mission.category}</Pill>}
          </div>
          <span className="tabular-nums text-xs text-white/45">{mission.progress}%</span>
        </div>
        <p className="mb-2.5 line-clamp-1 text-sm font-medium text-white/90">{mission.title}</p>
        <Progress value={mission.progress} />
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/50">
          <ChevronRight className="h-3 w-3 text-accent-soft" />
          <span className="text-white/40">{nextLabel}:</span>
          <span className="truncate text-white/60">{mission.nextAction}</span>
        </div>
      </motion.div>
    </Link>
  );
}

function AreaTile({
  icon: Icon, href, label, stat = "", statNode, moduleKey,
}: {
  icon: LucideIcon; href: string; label: string; stat?: string; statNode?: React.ReactNode; moduleKey: ModuleKey;
}) {
  const theme = MODULE_THEME[moduleKey];
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -4 }}
        className="group relative h-full overflow-hidden rounded-2xl border p-4 transition-colors"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: `${theme.color}26` }}
      >
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl glass" style={{ color: theme.soft }}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-white/85">{label}</p>
        <p className="mt-0.5 truncate text-xs" style={{ color: `${theme.soft}CC` }}>{statNode ?? stat}</p>
        <ArrowRight className="absolute right-3 top-3 h-3.5 w-3.5 text-white/0 transition-all group-hover:text-white/40" />
      </motion.div>
    </Link>
  );
}

function AchievementBadge({ a, lockedLabel }: { a: AchievementView; lockedLabel: string }) {
  const Icon = ACH_ICONS[a.icon] ?? Trophy;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all",
        a.unlocked ? "border-gold/25 bg-gold/[0.06]" : "border-hairline bg-white/[0.015]",
      )}
      title={a.unlocked ? a.description : lockedLabel}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          a.unlocked ? "bg-gold/15 text-gold-soft shadow-glow-gold" : "bg-white/5 text-white/25",
        )}
      >
        {a.unlocked ? <Icon className="h-5 w-5" strokeWidth={1.75} /> : <Lock className="h-4 w-4" />}
      </div>
      <span className={cn("text-[0.7rem] font-medium leading-tight", a.unlocked ? "text-white/80" : "text-white/35")}>
        {a.title}
      </span>
    </div>
  );
}
