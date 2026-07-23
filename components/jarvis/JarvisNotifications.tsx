"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ShieldCheck, ShieldX, Info, TriangleAlert } from "lucide-react";
import { useJarvis } from "@/lib/jarvis/useJarvis";
import type { JarvisNotificationTone } from "@/lib/jarvis/types";
import { cn } from "@/lib/utils";

const TONE_META: Record<
  JarvisNotificationTone,
  { icon: typeof Info; ring: string; text: string; glow: string }
> = {
  info: { icon: Info, ring: "border-white/15", text: "text-white/80", glow: "rgba(255,255,255,0.12)" },
  success: { icon: Check, ring: "border-emerald-400/30", text: "text-emerald-200", glow: "rgba(52,211,153,0.35)" },
  warning: { icon: TriangleAlert, ring: "border-amber-400/30", text: "text-amber-200", glow: "rgba(251,191,36,0.35)" },
  granted: { icon: ShieldCheck, ring: "border-[#ff2d3f]/40", text: "text-white", glow: "rgba(255,45,63,0.5)" },
  denied: { icon: ShieldX, ring: "border-[#ff2d3f]/50", text: "text-white", glow: "rgba(255,45,63,0.6)" },
};

/**
 * Two presentations from one notification stream:
 *  • granted / denied  → a centred cinematic permission banner
 *  • everything else    → small holographic corner toasts
 */
export function JarvisNotifications() {
  const { notifications, dismissNotification } = useJarvis();

  const banners = notifications.filter((n) => n.tone === "granted" || n.tone === "denied");
  const toasts = notifications.filter((n) => n.tone !== "granted" && n.tone !== "denied");
  const banner = banners[banners.length - 1];

  return (
    <>
      {/* Cinematic permission banner */}
      <div className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-6 py-4 backdrop-blur-xl",
                banner.tone === "granted" ? "border-[#ff2d3f]/40" : "border-[#ff2d3f]/60",
              )}
              style={{
                background: "rgba(10,4,5,0.72)",
                boxShadow: `0 0 60px -10px ${TONE_META[banner.tone].glow}`,
              }}
            >
              {banner.tone === "granted" ? (
                <ShieldCheck className="h-6 w-6 text-[#ff5561]" />
              ) : (
                <ShieldX className="h-6 w-6 text-[#ff5561]" />
              )}
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[#ff8b93]">
                  {banner.tone === "granted" ? "Access" : "Blocked"}
                </p>
                <p className="text-base font-semibold text-white">{banner.title}</p>
                {banner.body && <p className="text-xs text-white/55">{banner.body}</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Corner toasts */}
      <div className="pointer-events-none fixed bottom-28 right-5 z-[65] flex w-[min(20rem,calc(100vw-2.5rem))] flex-col gap-2 sm:right-8">
        <AnimatePresence initial={false}>
          {toasts.map((n) => {
            const meta = TONE_META[n.tone];
            const Icon = meta.icon;
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, x: 30, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 backdrop-blur-xl",
                  meta.ring,
                )}
                style={{ background: "rgba(10,6,7,0.7)", boxShadow: `0 8px 40px -12px ${meta.glow}` }}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.text)} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", meta.text)}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-white/50">{n.body}</p>}
                </div>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-white/30 transition-colors hover:text-white/70"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}
