"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { translations, type Locale } from "./translations";

const COOKIE_NAME = "lifeos_locale";

function readValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ""));
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dot-path key to a string, with optional {{var}} interpolation. */
  t: (path: string, vars?: Record<string, string | number>) => string;
  /** Translate a dot-path key that resolves to a string array. */
  tList: (path: string) => string[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      document.cookie = `${COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const value =
        readValue(translations[locale], path) ?? readValue(translations.en, path);
      if (typeof value === "string") return interpolate(value, vars);
      return path;
    },
    [locale],
  );

  const tList = useCallback(
    (path: string): string[] => {
      const value =
        readValue(translations[locale], path) ?? readValue(translations.en, path);
      return Array.isArray(value) ? (value as string[]) : [];
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t, tList }), [locale, setLocale, t, tList]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

export function getLocaleCookieName() {
  return COOKIE_NAME;
}
