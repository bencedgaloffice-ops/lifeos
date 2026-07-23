"use client";

import { useState, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Send, Sparkles, Plus, Trash2, Loader2 } from "lucide-react";
import type { AiMemory } from "@/lib/types";
import { AISphereCanvas } from "@/components/three/AISphereCanvas";
import { ModuleHeader, Panel, Field, inputClass } from "@/components/dashboard/ui";
import { askCompanion, saveMemory, deleteMemory } from "@/app/dashboard/ai/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type Insight = { label: string; value: string };
type Msg = { role: "user" | "ai"; text: string };

export function AICompanion({
  insights,
  memories,
  greeting,
}: {
  insights: Insight[];
  memories: AiMemory[];
  greeting: string;
}) {
  const { t, tList, locale } = useLocale();
  const suggestions = tList("ai.suggestions");
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", text: greeting }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [, startTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || thinking) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setThinking(true);
    try {
      const reply = await askCompanion(question, locale);
      setMessages((m) => [...m, { role: "ai", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: t("auth.errorGeneric") }]);
    } finally {
      setThinking(false);
      requestAnimationFrame(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <div>
      <ModuleHeader
        icon={Brain}
        title={t("ai.title")}
        subtitle={t("ai.subtitle")}
        accent="ai"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Sphere + insights */}
        <div className="space-y-4 lg:col-span-2">
          <Panel className="relative overflow-hidden">
            <div className="relative mx-auto aspect-square w-full max-w-[240px]">
              <AISphereCanvas />
            </div>
            <p className="mt-2 text-center text-sm text-white/55">{t("ai.sphereCaption")}</p>
          </Panel>

          <Panel>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-accent-soft" /> {t("ai.understands")}
            </h3>
            {insights.length === 0 ? (
              <p className="text-sm text-white/40">{t("ai.noInsights")}</p>
            ) : (
              <div className="space-y-2.5">
                {insights.map((ins) => (
                  <div key={ins.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white/50">{ins.label}</span>
                    <span className="text-right font-medium text-white/85">{ins.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Conversation */}
        <div className="space-y-4 lg:col-span-3">
          <Panel className="flex h-[440px] flex-col">
            <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white"
                          : "max-w-[85%] rounded-2xl rounded-bl-md glass px-4 py-2.5 text-sm leading-relaxed text-white/80"
                      }
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {thinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md glass px-4 py-2.5 text-sm text-white/50">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("ai.thinking")}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full glass px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="mt-3 flex items-center gap-2 rounded-full glass px-2 py-1.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("ai.askPlaceholder")}
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white placeholder-white/30 outline-none"
              />
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </Panel>

          {/* Teach / memories */}
          <Panel>
            <h3 className="mb-3 text-sm font-semibold">{t("ai.teachTitle")}</h3>
            <form
              action={(fd) => startTransition(() => saveMemory(fd))}
              className="flex items-center gap-2"
            >
              <input
                name="content"
                placeholder={t("ai.teachPlaceholder")}
                className={inputClass}
              />
              <button
                className="inline-flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-white px-3 text-black transition-transform hover:-translate-y-0.5"
                aria-label="Save memory"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
            {memories.length > 0 && (
              <div className="mt-4 space-y-2">
                {memories.map((mem) => (
                  <div key={mem.id} className="group flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white/70">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-soft" />
                    <span className="flex-1">{mem.content}</span>
                    <form action={() => deleteMemory(mem.id)}>
                      <button className="text-white/25 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100" aria-label="Delete memory">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
