"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { locales, localeLabels } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

/** Compact EN / HU pill toggle. Used on the landing page, lock screen, and Settings. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full glass p-1 text-xs",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "rounded-full px-3 py-1.5 font-medium transition-colors duration-300",
            locale === l ? "bg-white text-black" : "text-white/50 hover:text-white",
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
      <span className="sr-only">{localeLabels[locale]}</span>
    </div>
  );
}
