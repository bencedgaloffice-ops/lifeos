import type { LucideIcon } from "lucide-react";
import {
  CalendarDays, Wallet, Target, FolderKanban, Image as ImageIcon, Landmark,
  HeartHandshake, Repeat, ShieldCheck, BookOpen, ChefHat, Salad,
  Briefcase, Building2, Car, Brain, Bot,
} from "lucide-react";
import { MODULE_THEME, type ModuleKey } from "@/lib/module-theme";

export type NavPinDef = {
  key: string;
  href: string;
  icon: LucideIcon;
  moduleKey: ModuleKey;
};

/** Every "page on the sides" (the sidebar's modules), reimagined as a ring
 * of clickable portals orbiting Hungary on the home map — so navigating
 * LifeOS can happen entirely from the map, not just the sidebar. Excludes
 * Overview (this screen's own "Stats" tab), Profile, and Settings, which
 * stay sidebar/account-only rather than "places" on the map. */
export const NAV_PIN_DEFS: NavPinDef[] = [
  { key: "calendar", href: "/dashboard/calendar", icon: CalendarDays, moduleKey: "calendar" },
  { key: "finance", href: "/dashboard/finance", icon: Wallet, moduleKey: "finance" },
  { key: "goals", href: "/dashboard/goals", icon: Target, moduleKey: "goals" },
  { key: "projects", href: "/dashboard/projects", icon: FolderKanban, moduleKey: "projects" },
  { key: "vision", href: "/dashboard/vision", icon: ImageIcon, moduleKey: "vision" },
  { key: "legacy", href: "/dashboard/legacy", icon: Landmark, moduleKey: "legacy" },
  { key: "relationship", href: "/dashboard/relationship", icon: HeartHandshake, moduleKey: "relationship" },
  { key: "habits", href: "/dashboard/habits", icon: Repeat, moduleKey: "habits" },
  { key: "protection", href: "/dashboard/protection", icon: ShieldCheck, moduleKey: "protection" },
  { key: "journal", href: "/dashboard/journal", icon: BookOpen, moduleKey: "journal" },
  { key: "kitchen", href: "/dashboard/kitchen", icon: ChefHat, moduleKey: "kitchen" },
  { key: "nutrition", href: "/dashboard/nutrition", icon: Salad, moduleKey: "nutrition" },
  { key: "businessOverview", href: "/dashboard/business", icon: Briefcase, moduleKey: "business" },
  { key: "organizations", href: "/dashboard/business/organizations", icon: Building2, moduleKey: "business" },
  { key: "garage", href: "/dashboard/business/garage", icon: Car, moduleKey: "garage" },
  { key: "ai", href: "/dashboard/ai", icon: Brain, moduleKey: "ai" },
  { key: "jarvis", href: "/dashboard/jarvis", icon: Bot, moduleKey: "jarvis" },
];

export type NavPinPosition = NavPinDef & { x: number; z: number; color: string; soft: string };

/** Lays every module pin out on an evenly-spaced ring around Hungary's
 * landmass, starting due north and going clockwise — a radial menu that
 * orbits the country rather than sitting inside it (real locations are the
 * only pins that live on Hungary itself). */
export function layoutNavPins(radius: number): NavPinPosition[] {
  const n = NAV_PIN_DEFS.length;
  return NAV_PIN_DEFS.map((def, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const theme = MODULE_THEME[def.moduleKey];
    return {
      ...def,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      color: theme.color,
      soft: theme.soft,
    };
  });
}
