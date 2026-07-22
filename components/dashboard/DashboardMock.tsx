"use client";

import {
  LayoutGrid,
  Calendar,
  Wallet,
  Target,
  Sparkles,
  FolderKanban,
  BookOpen,
  TrendingUp,
  Clock,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

/* A self-contained, realistic LifeOS dashboard. Everything is real content —
   no lorem ipsum — laid out to feel like a shipping product. */

const navItems = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: Calendar, label: "Calendar" },
  { icon: Wallet, label: "Money" },
  { icon: Target, label: "Goals" },
  { icon: Sparkles, label: "Dreams" },
  { icon: FolderKanban, label: "Projects" },
  { icon: BookOpen, label: "Journal" },
  { icon: Clock, label: "Timeline" },
];

const schedule = [
  { time: "08:30", title: "Morning reflection", tag: "Journal", tone: "blue" },
  { time: "10:00", title: "Investor sync", tag: "Projects", tone: "violet" },
  { time: "13:30", title: "Portfolio review", tag: "Money", tone: "emerald" },
  { time: "18:00", title: "Family dinner", tag: "Life", tone: "amber" },
];

const goals = [
  { label: "Emergency fund", value: 82 },
  { label: "Run a marathon", value: 64 },
  { label: "Learn to sail", value: 38 },
];

const dreams = ["Live by the ocean", "Write a book", "See the northern lights"];

const timeline = [
  { year: "1994", label: "Born", done: true },
  { year: "2016", label: "First company", done: true },
  { year: "2024", label: "Bought a home", done: true },
  { year: "2031", label: "Sabbatical year", done: false },
];

const toneMap: Record<string, string> = {
  blue: "bg-accent",
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
};

export function DashboardMock() {
  return (
    <div className="flex h-full w-full select-none bg-[#060607] text-[10px] leading-tight text-white sm:text-[11px]">
      {/* Sidebar */}
      <aside className="hidden w-[19%] max-w-[190px] flex-col border-r border-white/8 bg-[#08080a] p-3 md:flex">
        <div className="mb-5 flex items-center gap-2 px-1">
          <Logo className="h-5 w-5" />
          <span className="text-[12px] font-semibold tracking-tight">LifeOS</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                  item.active
                    ? "bg-white/8 text-white"
                    : "text-white/45"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="font-medium">{item.label}</span>
              </div>
            );
          })}
        </nav>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/5 p-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-[10px] font-semibold">
            A
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">Alex Rivera</div>
            <div className="truncate text-white/40">Founding member</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold tracking-tight">Good morning, Alex</div>
            <div className="text-white/40">Wednesday, July 22 · 4 things need you today</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1.5 text-white/40 sm:flex">
              <Search className="h-3 w-3" />
              <span>Search your life…</span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/6">
              <Bell className="h-3.5 w-3.5 text-white/60" />
            </div>
          </div>
        </header>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-12 gap-3 overflow-hidden p-3 sm:p-4">
          {/* Net worth / financial overview */}
          <Card className="col-span-12 lg:col-span-5">
            <CardHead icon={Wallet} title="Financial overview" action="This month" />
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-white/40">Net worth</div>
                <div className="text-[20px] font-semibold tracking-tight">$248,910</div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-emerald-400/12 px-2 py-1 text-emerald-300">
                <ArrowUpRight className="h-3 w-3" />
                <span className="font-medium">+4.2%</span>
              </div>
            </div>
            <MiniChart />
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Stat label="Income" value="$12.4k" />
              <Stat label="Spending" value="$7.1k" />
              <Stat label="Saved" value="$5.3k" />
            </div>
          </Card>

          {/* Today's schedule */}
          <Card className="col-span-12 sm:col-span-6 lg:col-span-4">
            <CardHead icon={Calendar} title="Today" action="4 events" />
            <div className="mt-2 flex flex-col gap-1.5">
              {schedule.map((e) => (
                <div key={e.title} className="flex items-center gap-2.5 rounded-lg bg-white/4 px-2.5 py-2">
                  <span className={`h-6 w-0.5 rounded-full ${toneMap[e.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="text-white/40">{e.tag}</div>
                  </div>
                  <span className="tabular-nums text-white/55">{e.time}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Goals */}
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHead icon={Target} title="Goals" action="3 active" />
            <div className="mt-3 flex flex-col gap-3">
              {goals.map((g) => (
                <div key={g.label}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-white/70">{g.label}</span>
                    <span className="tabular-nums text-white/45">{g.value}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft"
                      style={{ width: `${g.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Dreams */}
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHead icon={Sparkles} title="Dreams" action="" />
            <div className="mt-2 flex flex-col gap-1.5">
              {dreams.map((d) => (
                <div key={d} className="flex items-center gap-2 rounded-lg bg-white/4 px-2.5 py-1.5">
                  <Sparkles className="h-3 w-3 text-accent-soft" />
                  <span className="truncate text-white/70">{d}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Life timeline */}
          <Card className="col-span-12 sm:col-span-6 lg:col-span-5">
            <CardHead icon={Clock} title="Life timeline" action="" />
            <div className="relative mt-4 flex items-center justify-between px-1">
              <span className="absolute left-0 right-0 top-[5px] h-px bg-white/10" />
              {timeline.map((t) => (
                <div key={t.year} className="relative flex flex-col items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full border ${
                      t.done
                        ? "border-accent bg-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                        : "border-white/30 bg-[#060607]"
                    }`}
                  />
                  <span className="tabular-nums font-medium text-white/70">{t.year}</span>
                  <span className="whitespace-nowrap text-white/40">{t.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* AI assistant */}
          <Card className="col-span-12 lg:col-span-4" glow>
            <CardHead icon={Sparkles} title="LifeOS AI" action="" />
            <p className="mt-2 text-white/70">
              You&apos;re on track to fully fund your emergency goal by October — two
              months early. Want me to redirect the surplus toward your sailing course?
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-full bg-white/6 px-3 py-2">
              <input
                readOnly
                value="Ask about your life…"
                className="min-w-0 flex-1 bg-transparent text-white/40 outline-none"
                aria-hidden
                tabIndex={-1}
              />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                <Send className="h-2.5 w-2.5 text-white" />
              </span>
            </div>
          </Card>

          {/* Journal + Projects strip */}
          <Card className="col-span-12 sm:col-span-6 lg:col-span-3">
            <CardHead icon={BookOpen} title="Journal" action="" />
            <p className="mt-2 line-clamp-3 text-white/60">
              &ldquo;Grateful for a slow morning. Reviewed the quarter — steady progress on
              what actually matters.&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 214-day streak
            </div>
          </Card>

          <Card className="col-span-12 sm:col-span-6 lg:col-span-5">
            <CardHead icon={FolderKanban} title="Projects" action="2 in progress" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MiniProject name="Launch LifeOS" pct={72} icon={TrendingUp} />
              <MiniProject name="Renovate studio" pct={45} icon={Plus} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---- Small building blocks ---- */

function Card({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/8 bg-white/[0.03] p-3 ${
        glow ? "shadow-[0_0_40px_-12px_rgba(59,130,246,0.5)]" : ""
      } ${className}`}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-60"
          style={{
            background:
              "radial-gradient(300px circle at 100% 0%, rgba(59,130,246,0.18), transparent 60%)",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function CardHead({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 font-medium">
        <Icon className="h-3.5 w-3.5 text-accent-soft" strokeWidth={1.75} />
        <span>{title}</span>
      </div>
      {action ? <span className="text-white/35">{action}</span> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/4 py-1.5">
      <div className="font-semibold">{value}</div>
      <div className="text-white/40">{label}</div>
    </div>
  );
}

function MiniChart() {
  const points = [18, 15, 22, 19, 27, 24, 33, 30, 38, 34, 44];
  const max = Math.max(...points);
  const w = 100;
  const h = 34;
  const step = w / (points.length - 1);
  const line = points
    .map((p, i) => `${i * step},${h - (p / max) * h}`)
    .join(" ");
  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
        <defs>
          <linearGradient id="dash-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#dash-area)" />
        <polyline
          points={line}
          fill="none"
          stroke="#60A5FA"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function MiniProject({
  name,
  pct,
  icon: Icon,
}: {
  name: string;
  pct: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg bg-white/4 p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-accent-soft" />
        <span className="truncate font-medium">{name}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-accent-soft" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
