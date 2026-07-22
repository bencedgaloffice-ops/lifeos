"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Target,
  Wallet,
  FolderKanban,
  CalendarDays,
  Bell,
  BookOpen,
  Sparkles,
  ArrowRight,
  Plus,
  Trash2,
  TrendingUp,
  Heart,
} from "lucide-react";
import { Panel, StatCard, Progress, Pill, Field, inputClass } from "@/components/dashboard/ui";
import { formatCurrency, formatDate, relativeDays } from "@/lib/format";
import { createEvent, deleteEvent } from "@/app/dashboard/actions";

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
  reminders: { id: string; title: string; when: string; kind: string; deletable: boolean }[];
  growth: { label: string; value: string }[];
  latestJournal: { title: string | null; body: string | null; date: string } | null;
};

export function OverviewModule({ data }: { data: OverviewData }) {
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

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
                  <p className="text-sm font-semibold">Set up your Life Profile</p>
                  <p className="text-xs text-white/45">Tell LifeOS who you are — it&apos;s the foundation of everything.</p>
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
          Your life, <span className="gradient-text-accent">in one place.</span>
        </h1>
        {data.mission ? (
          <p className="mt-1.5 max-w-2xl text-sm text-white/50">“{data.mission}”</p>
        ) : (
          <p className="mt-1.5 text-sm text-white/45">A complete snapshot of where you are and where you&apos;re going.</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net worth" value={formatCurrency(data.netWorth, data.currency)} accent hint="Savings + investments" />
        <StatCard label="Savings rate" value={`${data.savingsRate}%`} hint="This month" />
        <StatCard label="Goal momentum" value={data.goalsAvg === null ? "—" : `${data.goalsAvg}%`} hint={`${data.activeGoals} active`} />
        <StatCard label="Active projects" value={String(data.activeProjects)} hint="In motion" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Goals */}
        <OverviewCard icon={Target} title="Goals" href="/dashboard/goals" className="lg:col-span-2">
          {data.goals.length === 0 ? (
            <Empty text="No goals yet — add what you're building toward." />
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
        <OverviewCard icon={Wallet} title="Finance" href="/dashboard/finance">
          <div className="space-y-3">
            <Row label="Income · month" value={formatCurrency(data.monthIncome, data.currency)} />
            <Row label="Spending · month" value={formatCurrency(data.monthSpending, data.currency)} />
            <Row label="Net worth" value={formatCurrency(data.netWorth, data.currency)} accent />
            <div className="pt-1">
              <div className="mb-1.5 flex justify-between text-xs text-white/45">
                <span>Savings rate</span>
                <span>{data.savingsRate}%</span>
              </div>
              <Progress value={data.savingsRate} />
            </div>
          </div>
        </OverviewCard>

        {/* Reminders / calendar */}
        <OverviewCard
          icon={CalendarDays}
          title="Calendar & reminders"
          href="/dashboard"
          className="lg:col-span-2"
          action={
            <button
              onClick={(e) => {
                e.preventDefault();
                setAddOpen((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs text-white/70 transition-colors hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          }
        >
          {addOpen && (
            <form
              action={(fd) => {
                startTransition(() => createEvent(fd));
                setAddOpen(false);
              }}
              className="mb-4 grid gap-3 rounded-2xl bg-white/[0.03] p-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Field label="What & when">
                  <input name="title" required placeholder="Portfolio review" className={inputClass} />
                </Field>
              </div>
              <Field label="Date">
                <input type="date" name="date" defaultValue={today} className={inputClass} />
              </Field>
              <Field label="Time (optional)">
                <input type="time" name="time" className={inputClass} />
              </Field>
              <div className="sm:col-span-2">
                <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">Add to calendar</button>
              </div>
            </form>
          )}
          {data.reminders.length === 0 ? (
            <Empty text="Nothing scheduled. Add a reminder to stay ahead." />
          ) : (
            <div className="divide-y divide-hairline">
              {data.reminders.map((r) => (
                <div key={r.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/6 text-accent-soft">
                    {r.kind === "event" ? <CalendarDays className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1 truncate text-sm text-white/80">{r.title}</span>
                  <span className="text-xs text-white/40">{r.when}</span>
                  {r.deletable && (
                    <form action={() => deleteEvent(r.id)}>
                      <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </OverviewCard>

        {/* Personal growth */}
        <OverviewCard icon={Heart} title="Personal growth" href="/dashboard/profile">
          {data.growth.length === 0 ? (
            <Empty text="Define your health, learning and growth goals in your profile." />
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
        <OverviewCard icon={FolderKanban} title="Projects" href="/dashboard/projects" className="lg:col-span-2">
          {data.projects.length === 0 ? (
            <Empty text="No active projects. Start one to see it here." />
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
                    {p.deadline && <span>{relativeDays(p.deadline)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </OverviewCard>

        {/* Journal */}
        <OverviewCard icon={BookOpen} title="Journal" href="/dashboard/journal">
          {data.latestJournal ? (
            <div>
              <p className="text-xs text-white/40">
                {formatDate(data.latestJournal.date)} · {data.journalCount} entries
              </p>
              {data.latestJournal.title && (
                <p className="mt-1.5 text-sm font-medium">{data.latestJournal.title}</p>
              )}
              <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-white/60">
                {data.latestJournal.body}
              </p>
            </div>
          ) : (
            <Empty text="Your journey, remembered. Write your first entry." />
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
