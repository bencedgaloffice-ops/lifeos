"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sliders, Mic, KeyRound, Brain, ShieldCheck, Lock, Plug, Palette, Terminal, Activity, Volume2, Plus, Trash2,
} from "lucide-react";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { pickVoice } from "@/lib/jarvis/speech";
import { PERMISSION_LABELS } from "@/lib/jarvis/types";
import { cn } from "@/lib/utils";

type Tab =
  | "general" | "voice" | "wake" | "permissions" | "memory"
  | "privacy" | "integrations" | "developer" | "appearance" | "diagnostics";

const TABS: { id: Tab; label: string; icon: typeof Sliders }[] = [
  { id: "general", label: "General", icon: Sliders },
  { id: "voice", label: "Voice", icon: Volume2 },
  { id: "wake", label: "Wake Word", icon: Mic },
  { id: "permissions", label: "Permissions", icon: KeyRound },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "developer", label: "Developer", icon: Terminal },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
];

const ACCENTS = ["#ff2d3f", "#ff5e3a", "#ff2d78", "#e11d48", "#f43f5e", "#dc2626"];

export function JarvisSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
          />
          <div className="pointer-events-none fixed inset-0 z-[81] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex h-[min(680px,90vh)] w-[min(920px,94vw)] overflow-hidden rounded-3xl border border-[#ff2d3f]/20"
            style={{ background: "rgba(10,6,7,0.92)", boxShadow: "0 40px 120px -30px rgba(255,45,63,0.35)" }}
          >
            {/* Tab rail */}
            <div className="hidden w-52 shrink-0 flex-col border-r border-white/10 p-3 sm:flex">
              <div className="flex items-center gap-2 px-2 py-3">
                <div className="h-2 w-2 rounded-full bg-[#ff2d3f] shadow-[0_0_12px_#ff2d3f]" />
                <span className="text-sm font-semibold tracking-wide text-white">AI Settings</span>
              </div>
              <div className="mt-1 flex flex-col gap-0.5 overflow-y-auto">
                {TABS.map((tItem) => {
                  const Icon = tItem.icon;
                  return (
                    <button
                      key={tItem.id}
                      onClick={() => setTab(tItem.id)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        tab === tItem.id ? "bg-[#ff2d3f]/15 text-white" : "text-white/50 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                      {tItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  {/* Mobile tab select */}
                  <select
                    value={tab}
                    onChange={(e) => setTab(e.target.value as Tab)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white sm:hidden"
                  >
                    {TABS.map((tItem) => (
                      <option key={tItem.id} value={tItem.id} className="bg-black">{tItem.label}</option>
                    ))}
                  </select>
                  <h2 className="hidden text-lg font-semibold capitalize text-white sm:block">
                    {TABS.find((x) => x.id === tab)?.label}
                  </h2>
                </div>
                <button onClick={onClose} className="rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <Section tab={tab} />
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Reusable controls                                                  */
/* ------------------------------------------------------------------ */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white/90">{label}</p>
        {hint && <p className="text-xs text-white/40">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-[#ff2d3f]" : "bg-white/15")}
      role="switch"
      aria-checked={on}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

function Slider({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#ff2d3f]"
      style={{ accentColor: "#ff2d3f" }}
    />
  );
}

const selectClass = "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-[#ff2d3f]/50";

/* ------------------------------------------------------------------ */
/*  Sections                                                           */
/* ------------------------------------------------------------------ */

function Section({ tab }: { tab: Tab }) {
  const j = useJarvis();
  const { settings, updateSettings } = j;
  const [voices, setVoices] = useState<{ uri: string; name: string; lang: string }[]>([]);
  const [wakeDraft, setWakeDraft] = useState("");
  const [devConfirm, setDevConfirm] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang })));
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const activeVoiceName = useMemo(() => {
    const v = pickVoice(settings);
    return v?.name ?? "System default";
  }, [settings]);

  switch (tab) {
    case "general":
      return (
        <div className="divide-y divide-white/5">
          <Row label="Enable Jarvis" hint="Master switch for the AI companion."><Toggle on={settings.enabled} onChange={(v) => updateSettings({ enabled: v })} /></Row>
          <Row label="Always listening" hint="Passively wait for the wake word.">
            <Toggle on={settings.alwaysListening} onChange={(v) => updateSettings({ alwaysListening: v })} />
          </Row>
          <Row label="Response length">
            <select className={selectClass} value={settings.responseLength} onChange={(e) => updateSettings({ responseLength: e.target.value as typeof settings.responseLength })}>
              <option value="concise" className="bg-black">Concise</option>
              <option value="balanced" className="bg-black">Balanced</option>
              <option value="detailed" className="bg-black">Detailed</option>
            </select>
          </Row>
          <Row label="Sound effects" hint="Spoken replies and cues."><Toggle on={settings.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} /></Row>
        </div>
      );

    case "voice":
      return (
        <div className="divide-y divide-white/5">
          <Row label="Voice provider" hint="Browser voice needs no key. Others require credentials.">
            <select className={selectClass} value={settings.voiceProvider} onChange={(e) => updateSettings({ voiceProvider: e.target.value as typeof settings.voiceProvider })}>
              <option value="browser" className="bg-black">Browser (built-in)</option>
              <option value="openai" className="bg-black" disabled>OpenAI TTS — add key</option>
              <option value="elevenlabs" className="bg-black" disabled>ElevenLabs — add key</option>
              <option value="piper" className="bg-black" disabled>Piper — self-host</option>
            </select>
          </Row>
          <Row label="Voice" hint={`Active: ${activeVoiceName}`}>
            <select className={cn(selectClass, "max-w-[12rem]")} value={settings.voiceURI ?? ""} onChange={(e) => updateSettings({ voiceURI: e.target.value || null })}>
              <option value="" className="bg-black">Auto (British male)</option>
              {voices.map((v) => (
                <option key={v.uri} value={v.uri} className="bg-black">{v.name} · {v.lang}</option>
              ))}
            </select>
          </Row>
          <Row label={`Speed · ${settings.rate.toFixed(2)}×`}><Slider value={settings.rate} min={0.5} max={1.6} step={0.05} onChange={(v) => updateSettings({ rate: v })} /></Row>
          <Row label={`Pitch · ${settings.pitch.toFixed(2)}`}><Slider value={settings.pitch} min={0.4} max={1.6} step={0.05} onChange={(v) => updateSettings({ pitch: v })} /></Row>
          <Row label={`Volume · ${Math.round(settings.volume * 100)}%`}><Slider value={settings.volume} min={0} max={1} step={0.05} onChange={(v) => updateSettings({ volume: v })} /></Row>
          <Row label="Language">
            <select className={selectClass} value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
              <option value="en-GB" className="bg-black">English (UK)</option>
              <option value="en-US" className="bg-black">English (US)</option>
              <option value="hu-HU" className="bg-black">Magyar</option>
            </select>
          </Row>
          <div className="pt-4">
            <button
              onClick={() => j.speak("Good evening. All systems are online and standing by.")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff2d3f]/15 px-4 py-2 text-sm font-medium text-[#ff8b93] transition-colors hover:bg-[#ff2d3f]/25"
            >
              <Volume2 className="h-4 w-4" /> Test voice
            </button>
          </div>
        </div>
      );

    case "wake":
      return (
        <div>
          <p className="mb-3 text-sm text-white/50">Say any of these to wake the companion.</p>
          <div className="space-y-2">
            {settings.wakeWords.map((w) => (
              <div key={w} className="flex items-center justify-between rounded-xl bg-white/5 px-3.5 py-2.5">
                <span className="text-sm text-white/85">“{w}”</span>
                <button
                  onClick={() => updateSettings({ wakeWords: settings.wakeWords.filter((x) => x !== w) })}
                  className="text-white/30 hover:text-[#ff5561]"
                  aria-label="Remove wake word"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={wakeDraft}
              onChange={(e) => setWakeDraft(e.target.value)}
              placeholder="Add a wake phrase…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#ff2d3f]/50"
            />
            <button
              onClick={() => {
                const v = wakeDraft.trim().toLowerCase();
                if (v && !settings.wakeWords.includes(v)) updateSettings({ wakeWords: [...settings.wakeWords, v] });
                setWakeDraft("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff2d3f]/15 px-3 text-sm text-[#ff8b93] hover:bg-[#ff2d3f]/25"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["hello jarvis", "good morning", "lifeos", "computer", "assistant"].map((preset) => (
              <button
                key={preset}
                onClick={() => !settings.wakeWords.includes(preset) && updateSettings({ wakeWords: [...settings.wakeWords, preset] })}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55 hover:border-[#ff2d3f]/40 hover:text-white"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>
      );

    case "permissions":
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">Current access</p>
            <p className="mt-1 text-xl font-semibold text-white">
              Level {j.level} · {PERMISSION_LABELS[j.level]}
            </p>
          </div>
          <PermRow n={1} title="Assistant" desc="Answer questions, read your data, open pages." active={j.level >= 1} />
          <PermRow n={2} title="Operator" desc="Create & edit goals, calendar, kitchen, journal…" active={j.level >= 2}
            action={j.level >= 2
              ? <button onClick={j.lockDown} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15">Lock</button>
              : <button onClick={j.elevateToOperator} className="rounded-lg bg-[#ff2d3f]/20 px-3 py-1.5 text-xs text-[#ff8b93] hover:bg-[#ff2d3f]/30">Unlock (“I allow it”)</button>} />
          <PermRow n={3} title="Developer" desc="Layouts, widgets, theme, new modules." active={settings.developerUnlocked}
            action={<Toggle on={settings.developerUnlocked} onChange={(v) => j.setDeveloperUnlocked(v)} />} />
          <p className="text-xs text-white/40">Elevated sessions expire automatically after 15 minutes of inactivity.</p>
        </div>
      );

    case "memory":
      return (
        <div className="divide-y divide-white/5">
          <Row label="Remember conversations" hint="Keep context between exchanges."><Toggle on={settings.rememberConversations} onChange={(v) => updateSettings({ rememberConversations: v })} /></Row>
          <div className="py-4">
            <p className="text-sm text-white/60">Jarvis reasons over your Calendar, Finance, Goals, Projects, Kitchen, Nutrition, Journal, Legacy and Protection modules, plus anything you explicitly teach it.</p>
            <button onClick={() => { j.setPaletteOpen(false); j.runText("open ai page"); }} className="mt-3 rounded-xl bg-white/8 px-4 py-2 text-sm text-white hover:bg-white/12">
              Open memory & teaching
            </button>
          </div>
        </div>
      );

    case "privacy":
      return (
        <div className="divide-y divide-white/5">
          <Row label="Store transcripts" hint="Off by default — nothing leaves this device."><Toggle on={settings.storeTranscripts} onChange={(v) => updateSettings({ storeTranscripts: v })} /></Row>
          <div className="py-4 text-sm leading-relaxed text-white/55">
            Voice recognition and speech run in your browser. Commands touch your LifeOS data only through authenticated,
            row-level-secured actions. No audio is uploaded with the built-in provider.
          </div>
        </div>
      );

    case "integrations": {
      const items = [
        { name: "Browser Speech", status: "Active", ok: true },
        { name: "OpenAI TTS / Whisper", status: "Add API key", ok: false },
        { name: "ElevenLabs", status: "Add API key", ok: false },
        { name: "Picovoice Porcupine", status: "Add access key", ok: false },
      ];
      return (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.name} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
              <span className="text-sm text-white/85">{it.name}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs", it.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-white/45")}>{it.status}</span>
            </div>
          ))}
          <p className="pt-2 text-xs text-white/40">Cloud providers activate automatically once their keys are added to the environment.</p>
        </div>
      );
    }

    case "developer":
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#ff2d3f]/25 bg-[#ff2d3f]/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-[#ff8b93]"><ShieldCheck className="h-4 w-4" /> Developer mode</p>
            <p className="mt-1 text-xs text-white/50">Unlocks layout editing, widget generation, theme control and module scaffolding. Never activates by accident.</p>
          </div>
          {!settings.developerUnlocked ? (
            <div>
              <p className="mb-2 text-sm text-white/60">Type <span className="font-mono text-[#ff8b93]">ENABLE DEVELOPER</span> to confirm.</p>
              <div className="flex gap-2">
                <input value={devConfirm} onChange={(e) => setDevConfirm(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 font-mono text-sm text-white outline-none focus:border-[#ff2d3f]/50" placeholder="ENABLE DEVELOPER" />
                <button
                  disabled={devConfirm.trim().toUpperCase() !== "ENABLE DEVELOPER"}
                  onClick={() => { j.setDeveloperUnlocked(true); setDevConfirm(""); }}
                  className="rounded-xl bg-[#ff2d3f]/20 px-4 text-sm text-[#ff8b93] transition-colors hover:bg-[#ff2d3f]/30 disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => j.setDeveloperUnlocked(false)} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15">
              Disable developer mode
            </button>
          )}
        </div>
      );

    case "appearance":
      return (
        <div className="divide-y divide-white/5">
          <div className="py-4">
            <p className="mb-3 text-sm font-medium text-white/90">Orb accent</p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ accent: c })}
                  className={cn("h-9 w-9 rounded-full border-2 transition-transform hover:scale-110", settings.accent === c ? "border-white" : "border-transparent")}
                  style={{ backgroundColor: c, boxShadow: `0 0 18px -2px ${c}` }}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
          </div>
          <Row label="Reduced motion" hint="Calmer orb, minimal animation."><Toggle on={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} /></Row>
        </div>
      );

    case "diagnostics":
      return <Diagnostics />;
  }
}

function PermRow({ n, title, desc, active, action }: { n: number; title: string; desc: string; active: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 p-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold", active ? "bg-[#ff2d3f]/20 text-[#ff8b93]" : "bg-white/8 text-white/40")}>L{n}</div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-white/45">{desc}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function Diagnostics() {
  const j = useJarvis();
  const [rows, setRows] = useState<{ label: string; value: string; ok: boolean }[]>([]);

  useEffect(() => {
    const w = typeof window !== "undefined" ? window : undefined;
    const rec = !!(w && ((w as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || (w as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition));
    const tts = !!(w && "speechSynthesis" in w);
    const voices = tts ? w!.speechSynthesis.getVoices().length : 0;
    setRows([
      { label: "Speech recognition", value: rec ? "Available" : "Unsupported", ok: rec },
      { label: "Speech synthesis", value: tts ? "Available" : "Unsupported", ok: tts },
      { label: "Installed voices", value: String(voices), ok: voices > 0 },
      { label: "Companion status", value: j.status, ok: true },
      { label: "Permission level", value: `L${j.level}`, ok: true },
      { label: "Listening", value: j.listening ? "Yes" : "No", ok: true },
    ]);
  }, [j.status, j.level, j.listening]);

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5">
          <span className="text-sm text-white/70">{r.label}</span>
          <span className={cn("flex items-center gap-1.5 text-sm", r.ok ? "text-emerald-300" : "text-[#ff8b93]")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", r.ok ? "bg-emerald-400" : "bg-[#ff5561]")} />
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
