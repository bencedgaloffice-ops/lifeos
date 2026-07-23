"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Settings2, X, Check, Loader2, ShieldCheck } from "lucide-react";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { PERMISSION_LABELS, type JarvisStatus } from "@/lib/jarvis/types";
import { JarvisOrbCanvas } from "./JarvisOrbCanvas";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<JarvisStatus, string> = {
  idle: "Standing by",
  waking: "Waking…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  denied: "Access denied",
};

export function JarvisWidget({ variant = "dashboard" }: { variant?: "dashboard" | "landing" }) {
  const j = useJarvis();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const draggedRef = useRef(false);

  const size = variant === "landing" ? 60 : 72;
  const active = j.status !== "idle";

  return (
    <>
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.08}
        onDragStart={() => { draggedRef.current = true; }}
        onDragEnd={() => { setTimeout(() => { draggedRef.current = false; }, 40); }}
        className="fixed bottom-6 right-5 z-[60] flex flex-col items-end gap-3 sm:right-8"
      >
        {/* Expanded conversation panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-[#ff2d3f]/20"
              style={{ background: "rgba(10,6,7,0.92)", boxShadow: "0 30px 90px -30px rgba(255,45,63,0.4)", backdropFilter: "blur(20px)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", active && "animate-ping", "bg-[#ff2d3f]")} />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff2d3f]" />
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-white">Jarvis</span>
                  <span className="rounded-full bg-[#ff2d3f]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#ff8b93]">
                    L{j.level} · {PERMISSION_LABELS[j.level]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => j.setSettingsOpen(true)} className="rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white" aria-label="AI settings">
                    <Settings2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Transcript */}
              <div className="max-h-64 space-y-2.5 overflow-y-auto px-4 py-3">
                {j.transcript.length === 0 && (
                  <p className="py-4 text-center text-xs text-white/40">
                    Say “Hello Jarvis”, tap the mic, or type a command.
                  </p>
                )}
                {j.transcript.map((line) => (
                  <div key={line.id} className={line.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        line.role === "user"
                          ? "rounded-br-md bg-[#ff2d3f]/85 text-white"
                          : "rounded-bl-md bg-white/8 text-white/85",
                      )}
                    >
                      {line.text}
                    </div>
                  </div>
                ))}
                {j.interim && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#ff2d3f]/40 px-3 py-2 text-sm text-white/80">{j.interim}</div>
                  </div>
                )}
                {(j.status === "thinking") && (
                  <div className="flex items-center gap-2 text-xs text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>
                )}
              </div>

              {/* Confirm bar */}
              {j.pendingConfirm && (
                <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-[#ff2d3f]/5 px-4 py-2.5">
                  <span className="text-xs text-white/70">{j.pendingConfirm.label}?</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => j.confirmPending(true)} className="inline-flex items-center gap-1 rounded-lg bg-[#ff2d3f]/25 px-2.5 py-1 text-xs text-[#ff8b93] hover:bg-[#ff2d3f]/35">
                      <Check className="h-3 w-3" /> Yes
                    </button>
                    <button onClick={() => j.confirmPending(false)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/15">No</button>
                  </div>
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={(e) => { e.preventDefault(); j.runText(text); setText(""); }}
                className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={j.activate}
                  className={cn(
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                    j.listening ? "bg-[#ff2d3f] text-white" : "bg-white/8 text-white/60 hover:text-white",
                  )}
                  aria-label="Talk to Jarvis"
                  title={j.voiceSupported ? "Talk" : "Voice unavailable in this browser"}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a command…"
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white placeholder-white/30 outline-none"
                />
                <button type="submit" disabled={!text.trim()} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff2d3f] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40" aria-label="Send">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status label */}
        <AnimatePresence>
          {(active || open) && (
            <motion.span
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-full bg-black/50 px-2.5 py-1 text-[0.7rem] font-medium text-[#ff8b93] backdrop-blur-sm"
            >
              {STATUS_LABEL[j.status]}
            </motion.span>
          )}
        </AnimatePresence>

        {/* The orb — voice access button */}
        <button
          onClick={() => { if (!draggedRef.current) setOpen((o) => !o); }}
          onDoubleClick={() => j.activate()}
          className="relative cursor-grab active:cursor-grabbing"
          style={{ width: size, height: size }}
          aria-label="Open Jarvis"
        >
          <div className="absolute inset-0" style={{ filter: `drop-shadow(0 0 22px rgba(255,45,63,${active ? 0.6 : 0.35}))` }}>
            <JarvisOrbCanvas status={j.status} accent={j.settings.accent} reducedMotion={j.settings.reducedMotion} />
          </div>
          {j.level >= 2 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff2d3f] text-white shadow-[0_0_10px_#ff2d3f]">
              <ShieldCheck className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </motion.div>
    </>
  );
}
