"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EarthCanvas } from "@/components/three/EarthCanvas";
import { FinancialParticles } from "@/components/landing/FinancialParticles";
import { JarvisRoot } from "@/components/jarvis/JarvisRoot";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { easePremium } from "@/lib/motion";
import { beginEnter, resetEnter } from "@/lib/landing/enterSignal";

/**
 * The public entrance to LifeOS. No marketing — a black void, a slowly
 * rotating Earth, and a single door into the system. Pressing "Enter LifeOS"
 * dives the camera into the globe while a light burst carries you through to
 * the dashboard.
 */
export function Landing() {
  const { t } = useLocale();
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  // Clear any stale warp state if the user navigates back to the landing page.
  useEffect(() => {
    resetEnter();
    router.prefetch("/dashboard");
  }, [router]);

  function enter() {
    if (entering) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push("/dashboard");
      return;
    }
    beginEnter(); // tell the globe canvas to dive in
    setEntering(true);
    window.setTimeout(() => router.push("/dashboard"), 1450);
  }

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-base">
      {/* The Earth — centerpiece of the whole experience */}
      <div className="absolute inset-0">
        <EarthCanvas />
      </div>

      {/* Elegant financial ambience, confined to the far edges */}
      <FinancialParticles />

      {/* Cinematic vignette to seat the globe in deep space */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(5,5,5,0.5) 80%), linear-gradient(180deg, rgba(5,5,5,0.6) 0%, transparent 22%, transparent 60%, #050505 100%)",
        }}
      />

      {/* Language switch — fades out during the warp */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: entering ? 0 : 1 }}
        transition={{ duration: entering ? 0.4 : 1, delay: entering ? 0 : 0.5 }}
        className="absolute right-5 top-6 z-10 sm:right-8 sm:top-8"
      >
        <LanguageSwitch />
      </motion.div>

      {/* Brand mark + the single door — both live in the black void below the globe */}
      <motion.div
        animate={{ opacity: entering ? 0 : 1, y: entering ? 20 : 0 }}
        transition={{ duration: entering ? 0.5 : 0, ease: easePremium }}
        className="absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-5 sm:bottom-10"
      >
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: easePremium, delay: 0.6 }}
          className="font-display text-sm font-semibold tracking-[0.08em] text-white/70"
        >
          Gál-LifeOS
        </motion.span>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: easePremium, delay: 1 }}
        >
          <button
            type="button"
            onClick={enter}
            aria-label={t("landing.enter")}
            className="group relative inline-flex items-center gap-3 rounded-full px-9 py-4 text-[0.95rem] font-medium text-white transition-all duration-500 ease-premium hover:-translate-y-0.5"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(20px) saturate(140%)",
              WebkitBackdropFilter: "blur(20px) saturate(140%)",
            }}
          >
            {/* Blue glow ring */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100"
              style={{ boxShadow: "0 0 50px -6px rgba(59,130,246,0.7)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            <span className="relative z-10">{t("landing.enter")}</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </motion.div>

      {/* Warp overlay — a light burst that blooms from the globe's core and
          fades into deep space as the dashboard loads underneath. */}
      <AnimatePresence>
        {entering && (
          <motion.div
            key="warp"
            aria-hidden
            className="pointer-events-none absolute inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Expanding light burst — blooms from the globe's core as the
                camera arrives, peaking bright and blue-white by mid-warp. */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-[45vmax] w-[45vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ scale: 0.12, opacity: 0 }}
              animate={{ scale: [0.12, 1.6, 4], opacity: [0, 0.95, 1] }}
              transition={{ duration: 1.45, ease: [0.4, 0, 0.5, 1], times: [0, 0.5, 1] }}
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(191,219,254,0.8) 22%, rgba(96,165,250,0.4) 42%, transparent 68%)",
              }}
            />
            {/* Radiating streaks for a sense of speed. */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.45, times: [0, 0.55, 1] }}
              style={{
                background:
                  "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.06) 0deg, transparent 2deg 8deg)",
                maskImage: "radial-gradient(circle, transparent 8%, #000 60%)",
                WebkitMaskImage: "radial-gradient(circle, transparent 8%, #000 60%)",
              }}
            />
            {/* Final settle to deep base so the next screen emerges from black. */}
            <motion.div
              className="absolute inset-0 bg-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 1.05, ease: "easeIn" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice access — a compact Jarvis orb in the lower-right corner */}
      {!entering && <JarvisRoot variant="landing" />}
    </main>
  );
}
