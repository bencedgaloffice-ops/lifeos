"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  Wallet,
  FolderKanban,
  CalendarDays,
  BookOpen,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Heart,
} from "lucide-react";
import { Panel, StatCard, Progress, Pill, ScoreRing } from "@/components/dashboard/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";

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
  goals: { id: string; title: string; progress: number; category: string | null }[];
  projects: { id: string; name: string; progress: number; deadline: string | null }[];
  todayCalendar: { count: number; nextTitle: string | null; nextWhen: string | null };
  growth: { label: string; value: string }[];
  latestJournal: { title: string | null; body: string | null; date: string } | null;
  lifeScore: {
    health: number | null;
    money: number;
    growth: number | null;
    productivity: number | null;
    relationshipsNote: string | null;
  };
};

export function OverviewModule({ data }: { data: OverviewData }) {
  const { t, locale } = useLocale();
  const fc = (n: number) => formatCurrency(n, data.currency, { locale });

  return (
    <div className="space-y-5">
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

      {/* Hero line */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("overview.heroTitle1")}
          <span className="gradient-text-accent">{t("overview.heroTitleAccent")}</span>
        </h1>
        {data.mission ? (
          <p className="mt-1.5 max-w-2xl text-sm text-white/50">“{data.mission}”</p>
        ) : (
          <p className="mt-1.5 text-sm text-white/45">{t("overview.missionFallback")}</p>
        )}
      </div>

      {/* Life Score */}
      <Panel>
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
        {data.lifeScore.health === null && (
          <p className="mt-4 text-xs text-white/35">{t("lifeScore.noHealthData")}</p>
        )}
      </Panel>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("overview.statNetWorth")} value={fc(data.netWorth)} accent hint={t("overview.hintSavingsInvestments")} />
        <StatCard label={t("overview.statSavingsRate")} value={`${data.savingsRate}%`} hint={t("overview.hintThisMonth")} />
        <StatCard
          label={t("overview.statGoalMomentum")}
          value={data.goalsAvg === null ? "—" : `${data.goalsAvg}%`}
          hint={`${data.activeGoals} ${t("overview.hintActiveSuffix")}`}
        />
        <StatCard label={t("overview.statActiveProjects")} value={String(data.activeProjects)} hint={t("overview.hintInMotion")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Goals */}
        <OverviewCard icon={Target} title={t("overview.goalsTitle")} href="/dashboard/goals" className="lg:col-span-2">
          {data.goals.length === 0 ? (
            <Empty text={t("overview.emptyGoals")} />
          ) : (
            <div className="space-y-4">
              {data.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm">
                      {g.category && <Pill tone="accent">{g.category}</Pill>}
                      <span className="font-medium text-white/85">{g.title}</span>
                    </span>
                    <span className="tabular-nums text-sm text-white/50">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} />
                </div>
              ))}
            </div>
          )}
        </OverviewCard>

        {/* Finance snapshot */}
        <OverviewCard icon={Wallet} title={t("overview.financeTitle")} href="/dashboard/finance">
          <div className="space-y-3">
            <Row label={t("overview.rowIncome")} value={fc(data.monthIncome)} />
            <Row label={t("overview.rowSpending")} value={fc(data.monthSpending)} />
            <Row label={t("overview.rowNetWorth")} value={fc(data.netWorth)} accent />
            <div className="pt-1">
              <div className="mb-1.5 flex justify-between text-xs text-white/45">
                <span>{t("overview.statSavingsRate")}</span>
                <span>{data.savingsRate}%</span>
              </div>
              <Progress value={data.savingsRate} />
            </div>
          </div>
        </OverviewCard>

        {/* Today — compact link into the full Calendar module */}
        <OverviewCard icon={CalendarDays} title={t("overview.calendarTitle")} href="/dashboard/calendar" className="lg:col-span-2">
          {data.todayCalendar.count === 0 ? (
            <Empty text={t("overview.emptyToday")} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/70">{t("overview.todayCount", { n: data.todayCalendar.count })}</p>
              {data.todayCalendar.nextTitle && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/40">{t("overview.nextUp")}</p>
                  <p className="mt-1 text-sm font-medium text-white/85">
                    {data.todayCalendar.nextTitle}
                    {data.todayCalendar.nextWhen && <span className="ml-2 text-xs font-normal text-white/40">{data.todayCalendar.nextWhen}</span>}
                  </p>
                </div>
              )}
            </div>
          )}
          <Link
            href="/dashboard/calendar"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-soft transition-colors hover:text-accent"
          >
            {t("overview.openCalendar")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </OverviewCard>

        {/* Personal growth */}
        <OverviewCard icon={Heart} title={t("overview.growthTitle")} href="/dashboard/profile">
          {data.growth.length === 0 ? (
            <Empty text={t("overview.emptyGrowth")} />
          ) : (
            <div className="space-y-3">
              {data.growth.map((g) => (
                <div key={g.label} className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-glow-sm" />
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/40">{g.label}</p>
                    <p className="text-sm text-white/80">{g.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OverviewCard>

        {/* Projects */}
        <OverviewCard icon={FolderKanban} title={t("overview.projectsTitle")} href="/dashboard/projects" className="lg:col-span-2">
          {data.projects.length === 0 ? (
            <Empty text={t("overview.emptyProjects")} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.projects.map((p) => (
                <div key={p.id} className="rounded-2xl bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-accent-soft" />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </div>
                  <Progress value={p.progress} />
                  <div className="mt-2 flex justify-between text-xs text-white/40">
                    <span>{p.progress}%</span>
                    {p.deadline && <span>{formatDate(p.deadline, undefined, locale)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OverviewCard>

        {/* Journal */}
        <OverviewCard icon={BookOpen} title={t("overview.journalTitle")} href="/dashboard/journal">
          {data.latestJournal ? (
            <div>
              <p className="text-xs text-white/40">
                {formatDate(data.latestJournal.date, undefined, locale)} · {data.journalCount}{" "}
                {t("overview.entriesSuffix")}
              </p>
              {data.latestJournal.title && (
                <p className="mt-1.5 text-sm font-medium">{data.latestJournal.title}</p>
              )}
              <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-white/60">
                {data.latestJournal.body}
              </p>
            </div>
          ) : (
            <Empty text={t("overview.emptyJournal")} />
          )}
        </OverviewCard>
      </div>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  href,
  children,
  className,
  action,
}: {
  icon: typeof Target;
  title: string;
  href: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className={className}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent-soft" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {action ?? (
          <Link href={href} className="text-white/30 transition-colors hover:text-white" aria-label={`Open ${title}`}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </Panel>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{label}</span>
      <span className={accent ? "font-medium text-accent-soft" : "font-medium text-white/85"}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-white/40">{text}</p>;
}
