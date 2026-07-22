"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EarthCanvas } from "@/components/three/EarthCanvas";
import { Logo } from "@/components/ui/Logo";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { easePremium } from "@/lib/motion";

/**
 * The public entrance to LifeOS. No marketing — a black void, a slowly
 * rotating Earth, and a single door into the system.
 */
export function Landing() {
  const { t } = useLocale();

  return (
    <main className="relative h-[100svh] w-full overflow-hidden bg-base">
      {/* The Earth — centerpiece of the whole experience */}
      <div className="absolute inset-0">
        <EarthCanvas />
      </div>

      {/* Cinematic vignette to seat the globe in deep space */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(5,5,5,0.5) 80%), linear-gradient(180deg, rgba(5,5,5,0.6) 0%, transparent 22%, transparent 60%, #050505 100%)",
        }}
      />

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: easePremium, delay: 0.3 }}
        className="absolute left-1/2 top-8 z-10 flex -translate-x-1/2 items-center gap-2.5"
      >
        <Logo className="h-6 w-6" />
        <span className="text-sm font-semibold tracking-[0.08em] text-white/80">
          LifeOS
        </span>
      </motion.div>

      {/* Language switch */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute right-5 top-6 z-10 sm:right-8 sm:top-8"
      >
        <LanguageSwitch />
      </motion.div>

      {/* The single door */}
      <div className="absolute inset-x-0 bottom-[16vh] z-10 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: easePremium, delay: 1 }}
        >
          <Link
            href="/dashboard"
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
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
