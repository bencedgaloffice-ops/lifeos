/** Formatting helpers shared across the dashboard. Locale-aware. */

import type { Locale } from "@/lib/i18n/translations";

const intlLocale: Record<Locale, string> = { en: "en-US", hu: "hu-HU" };

export function formatCurrency(
  amount: number,
  currency = "USD",
  opts: { compact?: boolean; locale?: Locale } = {},
): string {
  try {
    return new Intl.NumberFormat(intlLocale[opts.locale ?? "en"], {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact ? 1 : 0,
    }).format(amount);
  } catch {
    // Fall back gracefully for unusual currency codes.
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
  locale: Locale = "en",
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale[locale], opts).format(d);
}

const relativeStrings: Record<
  Locale,
  { today: string; tomorrow: string; yesterday: string; inDays: (n: number) => string; daysAgo: (n: number) => string }
> = {
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    yesterday: "Yesterday",
    inDays: (n) => `in ${n} days`,
    daysAgo: (n) => `${n} days ago`,
  },
  hu: {
    today: "Ma",
    tomorrow: "Holnap",
    yesterday: "Tegnap",
    inDays: (n) => `${n} nap múlva`,
    daysAgo: (n) => `${n} napja`,
  },
};

export function relativeDays(target: string | null | undefined, locale: Locale = "en"): string {
  if (!target) return "";
  const d = new Date(target);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const s = relativeStrings[locale];
  if (days === 0) return s.today;
  if (days === 1) return s.tomorrow;
  if (days === -1) return s.yesterday;
  if (days > 0) return s.inDays(days);
  return s.daysAgo(Math.abs(days));
}

/** Returns the i18n key (`shell.morning` etc.) for the current time of day. */
export function greetingKey(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "shell.morning";
  if (h < 18) return "shell.afternoon";
  return "shell.evening";
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "LO";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "LO";
}
