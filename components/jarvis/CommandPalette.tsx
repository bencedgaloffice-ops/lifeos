"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, Compass, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import { NAV_TARGETS } from "@/lib/jarvis/commands";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "AI commands" | "System";
  icon: typeof Compass;
  run: () => void;
};

/**
 * Spotlight-style command center. Opens on ⌘/Ctrl-K or a double-tap of Space,
 * and can hand any typed line straight to the companion's command engine.
 */
export function CommandPalette() {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, runText } = useJarvis();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSpace = useRef(0);

  // Global hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "Escape" && paletteOpen) setPaletteOpen(false);
      // Double-space (only when not typing in a field).
      if (e.code === "Space" && !typing && !paletteOpen) {
        const now = Date.now();
        if (now - lastSpace.current < 350) {
          e.preventDefault();
          setPaletteOpen(true);
        }
        lastSpace.current = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = NAV_TARGETS.map((t) => ({
      id: `nav-${t.route}`,
      label: t.label,
      hint: t.route,
      group: "Navigate",
      icon: Compass,
      run: () => router.push(t.route),
    }));
    const ai: Item[] = [
      { id: "ai-schedule", label: "What's my schedule today?", group: "AI commands", icon: Sparkles, run: () => runText("what's my schedule today") },
      { id: "ai-money", label: "How much have I spent this month?", group: "AI commands", icon: Sparkles, run: () => runText("how much money have I spent this month") },
      { id: "ai-protein", label: "How much protein today?", group: "AI commands", icon: Sparkles, run: () => runText("how much protein have I eaten today") },
      { id: "ai-goal", label: "Create a goal…", group: "AI commands", icon: Sparkles, run: () => runText("create goal") },
      { id: "ai-shopping", label: "Add to shopping list…", group: "AI commands", icon: Sparkles, run: () => runText("add") },
    ];
    const sys: Item[] = [
      { id: "sys-backup", label: "Back up LifeOS", group: "System", icon: SettingsIcon, run: () => runText("backup") },
    ];
    return [...nav, ...ai, ...sys];
  }, [router, runText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q) || it.hint?.toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of filtered) {
      if (!map.has(it.group)) map.set(it.group, []);
      map.get(it.group)!.push(it);
    }
    return map;
  }, [filtered]);

  const flat = filtered;

  function choose(item?: Item) {
    if (item) {
      item.run();
    } else if (query.trim()) {
      runText(query.trim()); // free-form → companion
    }
    setPaletteOpen(false);
  }

  return (
    <AnimatePresence>
      {paletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />
          <div className="pointer-events-none fixed inset-0 z-[91] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto w-[min(640px,94vw)] overflow-hidden rounded-2xl border border-[#ff2d3f]/20"
            style={{ background: "rgba(12,8,9,0.94)", boxShadow: "0 40px 120px -30px rgba(255,45,63,0.4)" }}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-4 w-4 text-white/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); choose(flat[active]); }
                }}
                placeholder="Search pages, ask Jarvis, run a command…"
                className="flex-1 bg-transparent py-3.5 text-[0.95rem] text-white placeholder-white/30 outline-none"
              />
              <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[0.65rem] text-white/40 sm:block">esc</kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <button onClick={() => choose()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5">
                  <Sparkles className="h-4 w-4 text-[#ff8b93]" />
                  <span className="text-sm text-white/80">Ask Jarvis: “{query}”</span>
                </button>
              ) : (
                [...grouped.entries()].map(([group, groupItems]) => (
                  <div key={group} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-[0.65rem] font-medium uppercase tracking-wider text-white/30">{group}</p>
                    {groupItems.map((it) => {
                      const idx = flat.indexOf(it);
                      const Icon = it.icon;
                      return (
                        <button
                          key={it.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => choose(it)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            active === idx ? "bg-[#ff2d3f]/15" : "hover:bg-white/5",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active === idx ? "text-[#ff8b93]" : "text-white/40")} />
                          <span className="flex-1 text-sm text-white/85">{it.label}</span>
                          {it.hint && <span className="text-xs text-white/25">{it.hint}</span>}
                          {active === idx && <CornerDownLeft className="h-3.5 w-3.5 text-white/40" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
