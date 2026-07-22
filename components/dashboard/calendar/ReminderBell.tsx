"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail } from "lucide-react";
import type { CalendarItem } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { resolveIcon } from "@/lib/icon-registry";
import { formatTime } from "@/components/dashboard/calendar/utils";

/** Real Notification API reminders — fires while LifeOS is open in this
 * browser tab. Not a background push service: no service worker, no push
 * server, nothing fires while the tab is closed. */
export function ReminderBell({ items }: { items: CalendarItem[] }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const in24h = now + 24 * 3_600_000;
    return items
      .filter((it) => it.reminderMinutesBefore !== null)
      .map((it) => ({ item: it, remindAt: new Date(it.start).getTime() - it.reminderMinutesBefore! * 60_000 }))
      .filter((r) => r.remindAt >= now - 60_000 && r.remindAt <= in24h)
      .sort((a, b) => a.remindAt - b.remindAt);
  }, [items]);

  useEffect(() => {
    const check = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = Date.now();
      for (const { item, remindAt } of upcoming) {
        if (notified.current.has(item.id)) continue;
        if (remindAt <= now) {
          new Notification(item.title, {
            body: item.allDay ? undefined : formatTime(item.start),
            tag: item.id,
          });
          notified.current.add(item.id);
        }
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [upcoming]);

  function requestPermission() {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setPermission);
  }

  function emailReminder(item: CalendarItem) {
    const subject = encodeURIComponent(item.title);
    const body = encodeURIComponent(
      `${item.title}\n${item.allDay ? "" : formatTime(item.start)}\n${item.description ?? ""}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full glass text-white/60 transition-colors hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {upcoming.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-20 w-80 rounded-2xl glass-strong p-4 shadow-glass"
          >
            <p className="mb-3 text-sm font-medium text-white/80">{t("calendar.reminders.title")}</p>

            {permission !== "granted" && (
              <button
                onClick={requestPermission}
                className="mb-3 w-full rounded-xl glass px-3 py-2 text-left text-xs text-white/60 transition-colors hover:text-white"
              >
                {permission === "denied" ? t("calendar.reminders.notificationsBlocked") : t("calendar.reminders.enableNotifications")}
              </button>
            )}
            <p className="mb-3 text-[0.65rem] text-white/35">{t("calendar.reminders.notificationsHint")}</p>

            {upcoming.length === 0 ? (
              <p className="py-4 text-center text-xs text-white/40">{t("calendar.reminders.none")}</p>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map(({ item }) => {
                  const Icon = resolveIcon(item.icon);
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}22`, color: item.color }}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-white/80">{item.title}</p>
                        <p className="text-[0.65rem] text-white/40">{item.allDay ? "—" : formatTime(item.start)}</p>
                      </div>
                      <button onClick={() => emailReminder(item)} className="text-white/30 hover:text-white" title={t("calendar.reminders.emailThis")}>
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
