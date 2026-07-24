"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { locales, localeLabels, type Locale } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

/** Flag + code language toggle with an animated sliding highlight. Used on the
 * landing page, lock screen, and Settings. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn("relative inline-flex items-center gap-1 rounded-full glass p-1 text-xs", className)}
      role="group"
      aria-label="Language"
    >
      {locales.map((l) => {
        const active = locale === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            aria-label={localeLabels[l]}
            title={localeLabels[l]}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors duration-300",
              active ? "text-black" : "text-white/55 hover:text-white",
            )}
          >
            {active && (
              <motion.span
                layoutId="lang-active"
                className="absolute inset-0 -z-10 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Flag locale={l} />
            <span>{l.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Small rounded flag chip — US flag for English, Hungarian tricolor for Hungarian. */
function Flag({ locale }: { locale: Locale }) {
  const common = "h-3 w-[1.15rem] flex-none overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/20";
  if (locale === "hu") {
    return (
      <span className={common} aria-hidden>
        <span className="flex h-full w-full flex-col">
          <span className="w-full flex-1" style={{ background: "#CD2A3E" }} />
          <span className="w-full flex-1 bg-white" />
          <span className="w-full flex-1" style={{ background: "#436F4D" }} />
        </span>
      </span>
    );
  }
  // United States
  return (
    <span className={common} aria-hidden>
      <svg viewBox="0 0 19 13" className="h-full w-full" preserveAspectRatio="none">
        <rect width="19" height="13" fill="#B22234" />
        {[1, 3, 5, 7, 9, 11].map((y) => (
          <rect key={y} y={y} width="19" height="1" fill="#fff" />
        ))}
        <rect width="8.5" height="7" fill="#3C3B6E" />
      </svg>
    </span>
  );
}
