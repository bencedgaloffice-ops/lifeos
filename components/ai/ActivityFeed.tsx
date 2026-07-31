"use client";

/**
 * The AI Activity Feed — the app's visible pulse.
 *
 * Three tiers, in order of how much they want the user's attention: the
 * notifications the Executive raised (act on or clear), the standing
 * suggestions the specialists produced (open or dismiss, each with the agent's
 * own confidence shown so trust can be learned), and a quiet trail of recent
 * agent runs so the system reads as alive rather than idle. When there's
 * genuinely nothing, it says so — silence is a valid state here.
 *
 * Self-fetching: it calls the feed server action on mount and after each action,
 * so it stays a drop-in with no props. All mutations are optimistic.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Bell, Sparkles, X, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Panel } from "@/components/dashboard/ui";
import {
  getActivityFeed,
  dismissRecommendation,
  actOnRecommendation,
  readNotification,
  readAllNotifications,
  type ActivityFeed as Feed,
} from "@/app/dashboard/ai/feed-actions";

export function ActivityFeed() {
  const { t } = useLocale();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [, start] = useTransition();

  const load = () => getActivityFeed().then(setFeed).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  if (!feed) return null;

  const unread = feed.notifications.filter((n) => !n.read_at);
  const hasAnything = unread.length || feed.recommendations.length || feed.runs.length;

  const optimistic = (fn: () => Promise<void>, mutate: (f: Feed) => Feed) => {
    setFeed((f) => (f ? mutate(f) : f));
    start(() => {
      fn().then(load);
    });
  };

  return (
    <Panel className="overflow-hidden">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white/90">{t("ai.feed.title")}</h3>
            <p className="text-[0.7rem] text-white/40">{t("ai.feed.subtitle")}</p>
          </div>
        </div>
        {unread.length > 1 && (
          <button
            onClick={() => optimistic(readAllNotifications, (f) => ({ ...f, notifications: f.notifications.map((n) => ({ ...n, read_at: new Date().toISOString() })) }))}
            className="text-[0.7rem] text-white/40 transition-colors hover:text-white/80"
          >
            {t("ai.feed.markAllRead")}
          </button>
        )}
      </div>

      {!hasAnything && <p className="py-6 text-center text-sm text-white/40">{t("ai.feed.empty")}</p>}

      {/* Notifications — the Executive's tap on the shoulder. */}
      <AnimatePresence initial={false}>
        {unread.map((n) => (
          <motion.div
            key={n.id}
            layout
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 flex items-start gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3"
          >
            <Bell className="mt-0.5 h-4 w-4 flex-none text-cyan-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/90">{n.title}</p>
              {n.body && <p className="mt-0.5 text-xs leading-relaxed text-white/55">{n.body}</p>}
              <div className="mt-1.5 flex items-center gap-3">
                {n.route && (
                  <Link
                    href={n.route}
                    onClick={() => optimistic(() => readNotification(n.id), (f) => marked(f, n.id))}
                    className="inline-flex items-center gap-0.5 text-[0.7rem] font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    {t("ai.feed.act")} <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
                <button
                  onClick={() => optimistic(() => readNotification(n.id), (f) => marked(f, n.id))}
                  className="text-[0.7rem] text-white/40 hover:text-white/70"
                >
                  {t("ai.feed.markRead")}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Suggestions — standing recommendations, each with its confidence. */}
      {feed.recommendations.length > 0 && (
        <p className="mb-2 mt-3 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">{t("ai.feed.recommendations")}</p>
      )}
      <AnimatePresence initial={false}>
        {feed.recommendations.map((r) => (
          <motion.div
            key={r.id}
            layout
            exit={{ opacity: 0, height: 0 }}
            className="group mb-2 rounded-2xl bg-white/[0.03] p-3"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 flex-none text-white/40" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/85">{r.title}</p>
                {r.body && <p className="mt-0.5 text-xs leading-relaxed text-white/50">{r.body}</p>}
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-cyan-400/70" style={{ width: `${Math.round(r.confidence * 100)}%` }} />
                    </span>
                    <span className="font-mono text-[0.6rem] text-white/35">
                      {Math.round(r.confidence * 100)}% {t("ai.feed.confidence")}
                    </span>
                  </span>
                  {r.action?.route && (
                    <Link
                      href={r.action.route}
                      onClick={() => optimistic(() => actOnRecommendation(r.id), (f) => withoutRec(f, r.id))}
                      className="inline-flex items-center gap-0.5 text-[0.7rem] font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      {t("ai.feed.act")} <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => optimistic(() => dismissRecommendation(r.id), (f) => withoutRec(f, r.id))}
                className="flex-none text-white/20 opacity-0 transition-opacity hover:text-white/60 group-hover:opacity-100"
                aria-label={t("ai.feed.dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Recent runs — the quiet proof of life. */}
      <p className="mb-2 mt-4 text-[0.6rem] uppercase tracking-[0.2em] text-white/30">{t("ai.feed.activity")}</p>
      {feed.runs.length === 0 ? (
        <p className="text-xs text-white/35">{t("ai.feed.noRuns")}</p>
      ) : (
        <ul className="space-y-1">
          {feed.runs.map((run) => (
            <li key={run.id} className="flex items-center gap-2 text-xs text-white/45">
              <span className={`h-1.5 w-1.5 flex-none rounded-full ${run.ok ? "bg-emerald-400/70" : "bg-red-400/70"}`} />
              <span className="font-medium capitalize text-white/60">{run.agent}</span>
              <span>{t("ai.feed.ranSuffix")}</span>
              {run.detail && <span className="truncate text-white/35">· {run.detail}</span>}
              <span className="ml-auto flex-none font-mono text-[0.6rem] text-white/25">{ago(run.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const marked = (f: Feed, id: string): Feed => ({
  ...f,
  notifications: f.notifications.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
});
const withoutRec = (f: Feed, id: string): Feed => ({ ...f, recommendations: f.recommendations.filter((r) => r.id !== id) });

/** Compact relative time, e.g. "3h", "2d". */
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}
