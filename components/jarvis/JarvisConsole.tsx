"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mic, Send, Settings2, Command, ShieldCheck, Sparkles, CircleDot,
  CalendarDays, Wallet, Target, FolderKanban, ChefHat, Salad, BookOpen, Landmark, ShieldCheck as ShieldIcon, UserCircle,
} from "lucide-react";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { PERMISSION_LABELS, type JarvisStatus } from "@/lib/jarvis/types";
import { JarvisOrbCanvas } from "./JarvisOrbCanvas";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<JarvisStatus, string> = {
  idle: "Standing by",
  waking: "Waking",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  denied: "Access denied",
};

const CAPABILITIES = [
  { icon: CalendarDays, label: "Calendar", route: "/dashboard/calendar", desc: "Schedule, shifts & reminders" },
  { icon: Wallet, label: "Finance", route: "/dashboard/finance", desc: "Spending, savings & wealth" },
  { icon: Target, label: "Goals", route: "/dashboard/goals", desc: "Create & track progress" },
  { icon: FolderKanban, label: "Projects", route: "/dashboard/projects", desc: "Deadlines & momentum" },
  { icon: ChefHat, label: "Kitchen", route: "/dashboard/kitchen", desc: "Fridge, pantry & shopping" },
  { icon: Salad, label: "Nutrition", route: "/dashboard/nutrition", desc: "Meals, protein & energy" },
  { icon: Landmark, label: "Legacy", route: "/dashboard/legacy", desc: "Dreams & milestones" },
  { icon: ShieldIcon, label: "Protection", route: "/dashboard/protection", desc: "Documents & duties" },
  { icon: BookOpen, label: "Journal", route: "/dashboard/journal", desc: "Reflect & remember" },
  { icon: UserCircle, label: "Profile", route: "/dashboard/profile", desc: "Who you are" },
];

const EXAMPLES = [
  "What's my schedule today?",
  "How much have I spent this month?",
  "How much protein have I eaten today?",
  "Add milk to my shopping list",
  "Create goal run a half marathon",
  "Remind me to call the accountant",
  "Open the calendar",
  "Add journal today was productive",
];

export function JarvisConsole() {
  const j = useJarvis();
  const router = useRouter();
  const [text, setText] = useState("");
  const active = j.status !== "idle";

  return (
    <div>
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#ff2d3f]/30 bg-[#ff2d3f]/10 text-[#ff8b93]" style={{ boxShadow: "0 0 30px -8px rgba(255,45,63,0.6)" }}>
            <CircleDot className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Jarvis</h1>
            <p className="mt-0.5 text-sm text-white/45">Your LifeOS intelligence — voice, command &amp; control.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => j.setPaletteOpen(true)} className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white/70 transition-colors hover:text-white">
            <Command className="h-4 w-4" /> Palette
          </button>
          <button onClick={() => j.setSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-white/70 transition-colors hover:text-white">
            <Settings2 className="h-4 w-4" /> Settings
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Orb + controls */}
        <div className="space-y-4 lg:col-span-2">
          <div className="relative overflow-hidden rounded-3xl border border-[#ff2d3f]/15 p-6" style={{ background: "rgba(10,6,7,0.6)" }}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,45,63,0.12), transparent 70%)" }}
            />
            <div className="relative mx-auto aspect-square w-full max-w-[300px]" style={{ filter: `drop-shadow(0 0 40px rgba(255,45,63,${active ? 0.5 : 0.3}))` }}>
              <JarvisOrbCanvas status={j.status} accent={j.settings.accent} reducedMotion={j.settings.reducedMotion} />
            </div>
            <div className="relative mt-2 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={cn("relative flex h-2 w-2")}>
                  <span className={cn("absolute inline-flex h-full w-full rounded-full bg-[#ff2d3f] opacity-75", active && "animate-ping")} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff2d3f]" />
                </span>
                <span className="text-sm font-medium text-white/80">{STATUS_LABEL[j.status]}</span>
                <span className="rounded-full bg-[#ff2d3f]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#ff8b93]">
                  L{j.level} · {PERMISSION_LABELS[j.level]}
                </span>
              </div>
              <button
                onClick={j.activate}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                  j.listening ? "bg-[#ff2d3f] text-white" : "bg-[#ff2d3f]/15 text-[#ff8b93] hover:bg-[#ff2d3f]/25",
                )}
              >
                <Mic className="h-4 w-4" /> {j.listening ? "Listening…" : "Talk to Jarvis"}
              </button>
              <p className="text-center text-xs text-white/35">
                Say <span className="text-white/60">“Hello Jarvis”</span> or press <kbd className="rounded border border-white/15 px-1 text-[0.65rem]">⌘K</kbd>
                {!j.voiceSupported && <span className="mt-1 block text-amber-300/70">Voice input isn’t supported in this browser — type below.</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="lg:col-span-3">
          <div className="flex h-full min-h-[440px] flex-col overflow-hidden rounded-3xl border border-white/10" style={{ background: "rgba(10,6,7,0.5)" }}>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {j.transcript.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Sparkles className="h-6 w-6 text-[#ff8b93]" />
                  <p className="text-sm text-white/55">Ask me anything about your life, or give a command.</p>
                  <p className="max-w-sm text-xs text-white/35">I reason over your real LifeOS data and can act on it once you unlock Operator access.</p>
                </div>
              ) : (
                j.transcript.map((line) => (
                  <div key={line.id} className={line.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        line.role === "user" ? "rounded-br-md bg-[#ff2d3f]/85 text-white" : "rounded-bl-md bg-white/8 text-white/85",
                      )}
                    >
                      {line.text}
                    </div>
                  </div>
                ))
              )}
              {j.interim && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#ff2d3f]/40 px-4 py-2.5 text-sm text-white/80">{j.interim}</div>
                </div>
              )}
            </div>

            {/* Quick commands */}
            <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
              {EXAMPLES.slice(0, 4).map((ex) => (
                <button key={ex} onClick={() => j.runText(ex)} className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white">
                  {ex}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); j.runText(text); setText(""); }} className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
              <button type="button" onClick={j.activate} className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors", j.listening ? "bg-[#ff2d3f] text-white" : "bg-white/8 text-white/60 hover:text-white")} aria-label="Talk">
                <Mic className="h-4 w-4" />
              </button>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Jarvis or type a command…" className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white placeholder-white/30 outline-none" />
              <button type="submit" disabled={!text.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff2d3f] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-white/40">What I can reach</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.label}
              whileHover={{ y: -3 }}
              onClick={() => router.push(c.route)}
              className="rounded-2xl border border-white/10 p-4 text-left transition-colors hover:border-[#ff2d3f]/30"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <Icon className="h-5 w-5 text-[#ff8b93]" strokeWidth={1.75} />
              <p className="mt-2.5 text-sm font-medium text-white/90">{c.label}</p>
              <p className="text-xs text-white/40">{c.desc}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Example commands + permissions */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 p-6 lg:col-span-2" style={{ background: "rgba(255,255,255,0.02)" }}>
          <h3 className="mb-3 text-sm font-semibold text-white/80">Try saying</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => j.runText(ex)} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-left text-sm text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#ff8b93]" />
                {ex}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-[#ff2d3f]/15 p-6" style={{ background: "rgba(255,45,63,0.03)" }}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80"><ShieldCheck className="h-4 w-4 text-[#ff8b93]" /> Access</h3>
          <p className="text-2xl font-semibold text-white">Level {j.level}</p>
          <p className="text-sm text-white/50">{PERMISSION_LABELS[j.level]}</p>
          <div className="mt-3 space-y-1.5 text-xs text-white/45">
            <p>L1 · Ask questions, read, navigate</p>
            <p>L2 · Create &amp; edit — say “I allow it”</p>
            <p>L3 · Developer — enable in settings</p>
          </div>
          <button onClick={() => j.setSettingsOpen(true)} className="mt-4 w-full rounded-xl bg-[#ff2d3f]/15 px-4 py-2 text-sm text-[#ff8b93] transition-colors hover:bg-[#ff2d3f]/25">
            Manage permissions
          </button>
        </div>
      </div>
    </div>
  );
}
