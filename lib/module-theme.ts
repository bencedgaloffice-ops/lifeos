/**
 * Per-module color identity for the LifeOS redesign. Each life/business
 * domain gets its own accent instead of the single global blue — used by
 * the `accent` prop on Panel/ModuleHeader/StatCard/ModuleShell so a module
 * can tint its icon chip, glow, and headline gradient without touching the
 * neutral glass surface everything else sits on.
 *
 * Kept as plain hex + inline styles (not Tailwind utility classes) since
 * Tailwind's JIT scanner can't see dynamically-built class names — this is
 * the standard safe pattern for a runtime-selectable theme color.
 */
export type ModuleKey =
  | "overview"
  | "calendar"
  | "finance"
  | "goals"
  | "projects"
  | "vision"
  | "legacy"
  | "relationship"
  | "habits"
  | "protection"
  | "journal"
  | "kitchen"
  | "nutrition"
  | "business"
  | "ai"
  | "jarvis"
  | "settings"
  | "map";

export type ModuleTheme = {
  /** The module's signature color. */
  color: string;
  /** A lighter tint for text-on-glass (roughly +20% lightness). */
  soft: string;
  /** The room/environment identity name shown in the module header. */
  identity: string;
};

export const MODULE_THEME: Record<ModuleKey, ModuleTheme> = {
  overview: { color: "#3B82F6", soft: "#60A5FA", identity: "Mission Control" },
  calendar: { color: "#38BDF8", soft: "#7DD3FC", identity: "Life Timeline" },
  finance: { color: "#E7B24C", soft: "#F5D58A", identity: "Wealth Command Center" },
  goals: { color: "#FBBF24", soft: "#FDE68A", identity: "Vision Deck" },
  projects: { color: "#8B5CF6", soft: "#C4B5FD", identity: "Operations" },
  vision: { color: "#FBBF24", soft: "#FDE68A", identity: "Vision Deck" },
  legacy: { color: "#F5A15E", soft: "#FBCB94", identity: "Heritage Archive" },
  relationship: { color: "#F472B6", soft: "#F9A8D4", identity: "Us" },
  habits: { color: "#14B8A6", soft: "#5EEAD4", identity: "Rhythms" },
  protection: { color: "#EF4444", soft: "#FCA5A5", identity: "The Vault" },
  journal: { color: "#F5A15E", soft: "#FBCB94", identity: "Memory Vault" },
  kitchen: { color: "#F97316", soft: "#FDBA74", identity: "Smart Home System" },
  nutrition: { color: "#84CC16", soft: "#BEF264", identity: "Vitals" },
  business: { color: "#10B981", soft: "#6EE7B7", identity: "Business Operations Center" },
  ai: { color: "#22D3EE", soft: "#67E8F9", identity: "AI Companion" },
  jarvis: { color: "#ff2d3f", soft: "#ff8b93", identity: "AI Core" },
  settings: { color: "#9CA3AF", soft: "#D1D5DB", identity: "Settings" },
  map: { color: "#67E8F9", soft: "#A5F3FC", identity: "Life Map" },
};

export function moduleTheme(key: ModuleKey | undefined | null): ModuleTheme | null {
  if (!key) return null;
  return MODULE_THEME[key] ?? null;
}

/** A soft glow box-shadow string sized like the existing shadow-glow-sm token. */
export function moduleGlow(key: ModuleKey | undefined | null, strength = 0.45): string | undefined {
  const theme = moduleTheme(key);
  if (!theme) return undefined;
  const rgb = hexToRgb(theme.color);
  if (!rgb) return undefined;
  return `0 0 40px -8px rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
