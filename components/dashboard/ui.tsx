"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_REGISTRY, PICKABLE_ICON_NAMES, CATEGORY_COLOR_SWATCHES, resolveIcon } from "@/lib/icon-registry";
import { moduleTheme, moduleGlow, type ModuleKey } from "@/lib/module-theme";

/** Glass panel used across all modules. Pass a module `accent` to tint the
 * top hairline and glow with that module's identity color instead of blue. */
export function Panel({
  className,
  children,
  glow = false,
  accent,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: boolean;
  accent?: ModuleKey;
}) {
  const theme = moduleTheme(accent);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl glass p-6 shadow-glass",
        glow && !theme && "shadow-glow-sm",
        className,
      )}
      style={glow && theme ? { boxShadow: `${moduleGlow(accent)}, 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -20px rgba(0,0,0,0.7)` } : undefined}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${theme ? `${theme.color}55` : "rgba(255,255,255,0.2)"}, transparent)`,
        }}
      />
      {children}
    </div>
  );
}

export function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  accent?: ModuleKey;
}) {
  const theme = moduleTheme(accent);
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl glass-strong"
          style={{
            color: theme?.soft,
            boxShadow: theme ? moduleGlow(accent) : undefined,
          }}
        >
          <Icon className={cn("h-5 w-5", !theme && "text-accent-soft")} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/45">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  moduleAccent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  /** Highlights the value in the default blue accent. Ignored if moduleAccent is set. */
  accent?: boolean;
  /** Tints the value in a specific module's identity color instead of blue. */
  moduleAccent?: ModuleKey;
}) {
  const theme = moduleTheme(moduleAccent);
  return (
    <Panel className="p-5">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.75rem]",
          !theme && accent && "text-accent-soft",
        )}
        style={theme ? { color: theme.soft } : undefined}
      >
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-white/45">{hint}</div>}
    </Panel>
  );
}

/** Tabular-figure numeric readout (JetBrains Mono) — use for every currency
 * amount, stat, date/time readout, and percentage across the app so figures
 * align and read as precise, technical data rather than body text. */
export function Numeral({
  children,
  className,
  size = "inherit",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  size?: "inherit" | "sm" | "lg";
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        size === "sm" && "text-xs",
        size === "lg" && "text-2xl sm:text-[1.75rem]",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/** Thin wrapper around ModuleHeader that also washes the section in the
 * module's identity color — the "entering a different room" ambient tint.
 * Adopt this one module at a time; modules that don't use it keep the
 * current neutral blue look unchanged. */
export function ModuleShell({
  accent,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  accent: ModuleKey;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = moduleTheme(accent)!;
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-10 -z-10 h-72 opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(ellipse 60% 60% at 30% 0%, ${theme.color}33, transparent 70%)`,
        }}
      />
      <ModuleHeader icon={icon} title={title} subtitle={subtitle} action={action} accent={accent} />
      {children}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${clamped}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft"
      />
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "green" | "amber";
}) {
  const tones = {
    neutral: "bg-white/6 text-white/60",
    accent: "bg-accent/15 text-accent-soft",
    green: "bg-emerald-400/12 text-emerald-300",
    amber: "bg-amber-400/12 text-amber-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-hairline px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl glass text-white/40">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-white/70">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-white/40">{hint}</p>}
    </div>
  );
}

/** A labelled form field wrapping an input/textarea/select. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-white/45">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-2.5 text-[0.95rem] text-white placeholder-white/25 outline-none transition-colors focus:border-accent/60 focus:bg-white/[0.05]";

/** Small circular progress ring — used by the Life Score overview. */
export function ScoreRing({
  value,
  label,
  size = 84,
  strokeWidth = 6,
}: {
  value: number | null;
  label: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#score-ring-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: value === null ? circumference : offset }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
          <defs>
            <linearGradient id="score-ring-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#60A5FA" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums tracking-tight">
            {value === null ? "—" : Math.round(clamped)}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-white/55">{label}</span>
    </div>
  );
}

/** Small dot marking a calendar item as synced from Google Calendar. */
export function GoogleSyncDot({ className }: { className?: string }) {
  return (
    <span
      title="Google Calendar"
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: "#4285F4" }}
    />
  );
}

/** Pill-group view switcher — the active option slides via layout animation. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1 rounded-full glass p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            value === opt.value ? "text-black" : "text-white/55 hover:text-white/80",
          )}
        >
          {value === opt.value && (
            <motion.span
              layoutId={`segmented-${className ?? "default"}`}
              className="absolute inset-0 rounded-full bg-white"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative z-10">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Icon + color picker used by Life Categories and every event form. */
export function CategoryPicker({
  icon,
  color,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState<"icon" | "color" | null>(null);
  const SelectedIcon = resolveIcon(icon);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(open === "icon" ? null : "icon")}
          className="flex h-11 w-11 items-center justify-center rounded-xl glass-strong transition-transform hover:-translate-y-0.5"
          style={{ color }}
        >
          <SelectedIcon className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <AnimatePresence>
          {open === "icon" && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-13 z-20 grid w-64 grid-cols-6 gap-1 rounded-2xl glass-strong p-3 shadow-glass"
            >
              {PICKABLE_ICON_NAMES.map((name) => {
                const IconOpt = ICON_REGISTRY[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onIconChange(name);
                      setOpen(null);
                    }}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10",
                      icon === name && "bg-accent/20 text-accent-soft",
                    )}
                  >
                    <IconOpt className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(open === "color" ? null : "color")}
          className="flex h-11 w-11 items-center justify-center rounded-xl glass-strong"
        >
          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
        </button>
        <AnimatePresence>
          {open === "color" && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-13 z-20 grid w-56 grid-cols-5 gap-2 rounded-2xl glass-strong p-3 shadow-glass"
            >
              {CATEGORY_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    onColorChange(swatch);
                    setOpen(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: swatch }}
                >
                  {color === swatch && <Check className="h-4 w-4 text-black/70" strokeWidth={2.5} />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
