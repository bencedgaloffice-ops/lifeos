"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Volume2 } from "lucide-react";
import { getBriefing } from "@/app/dashboard/ai/briefing-actions";
import type { Signal } from "@/lib/jarvis/briefing";
import { useJarvis } from "@/lib/jarvis/useJarvis";

/**
 * Jarvis speaking first.
 *
 * Fetches the briefing once on mount and shows only what cleared the urgency
 * bar — which is often nothing, and nothing is the correct output when there is
 * nothing worth saying. Dismissals are remembered per signal id in
 * sessionStorage, so acknowledging something doesn't mean seeing it again on the
 * next navigation.
 *
 * It never speaks aloud unprompted. Audio that starts by itself is startling,
 * and browsers block it before a gesture anyway — so there's a button.
 */
export function JarvisBriefing() {
  const { speak } = useJarvis();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [spoken, setSpoken] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    try {
      const saved = sessionStorage.getItem("jarvis.briefing.dismissed");
      if (saved) setDismissed(new Set(JSON.parse(saved) as string[]));
    } catch {
      /* sessionStorage unavailable — dismissals just won't persist */
    }

    getBriefing()
      .then((b) => {
        setSignals(b.signals);
        setSpoken(b.spoken);
      })
      .catch(() => {
        /* A briefing is a nicety; failing to build one must stay silent. */
      });
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem("jarvis.briefing.dismissed", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const visible = signals.filter((s) => !dismissed.has(s.id));
  if (!visible.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border border-jarvis/25 bg-jarvis/[0.05] p-4"
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-jarvis" />
        <span className="text-[0.6rem] uppercase tracking-[0.25em] text-jarvis/80">Jarvis</span>
        {spoken && (
          <button
            onClick={() => speak(spoken)}
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] text-white/40 transition-colors hover:text-white/80"
            aria-label="Read this briefing aloud"
          >
            <Volume2 className="h-3 w-3" /> Read aloud
          </button>
        )}
      </div>

      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((s) => (
            <motion.li
              key={s.id}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-start gap-2 text-sm leading-relaxed text-white/75"
            >
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-jarvis/70" />
              {s.route ? (
                <Link href={s.route} className="min-w-0 flex-1 transition-colors hover:text-white">
                  {s.text}
                </Link>
              ) : (
                <span className="min-w-0 flex-1">{s.text}</span>
              )}
              <button
                onClick={() => dismiss(s.id)}
                className="flex-none text-white/20 opacity-0 transition-opacity hover:text-white/60 group-hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}
