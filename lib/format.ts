/** Formatting helpers shared across the dashboard. */

export function formatCurrency(
  amount: number,
  currency = "USD",
  opts: { compact?: boolean } = {},
): string {
  try {
    return new Intl.NumberFormat("en-US", {
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
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function relativeDays(target: string | null | undefined): string {
  if (!target) return "";
  const d = new Date(target);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name) return "LO";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "LO";
}
