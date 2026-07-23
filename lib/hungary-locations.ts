import type { LucideIcon } from "lucide-react";
import { LayoutGrid, CalendarDays, Wallet, Sparkles, Home, ShieldCheck, Tractor, Hexagon, Landmark, Shield, PartyPopper, Car } from "lucide-react";
import type { ModuleKey } from "@/lib/module-theme";

export type LocationSubItem = {
  key: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  moduleKey: ModuleKey;
};

export type LocationCluster = {
  key: string;
  /** Real longitude/latitude — the same coordinate space as life_map_locations. */
  lon: number;
  lat: number;
  nameKey: string;
  previewKey: string;
  icon: LucideIcon;
  color: string;
  items: LocationSubItem[];
  /** Vertical offset for the floating name pill, in world units above the
   * marker — Budapest and Diósd sit only ~9km apart in real coordinates, so
   * Budapest's label is raised to keep the two from overlapping. */
  labelOffsetY?: number;
};

/**
 * The five real places LifeOS's sections live on the map, per the "Hungary
 * command center" design — replaces the earlier generic orbiting nav-pin
 * ring with clusters anchored to where they actually mean something
 * geographically. Coordinates are real (Budapest, Diósd, Kaposvár/Somogy,
 * Siófok/Balaton, Hegyeshalom on the Austria/Germany route); the specific
 * section→place assignment is a deliberate editorial choice, not a data fact.
 */
export const LOCATION_CLUSTERS: LocationCluster[] = [
  {
    key: "budapest",
    lon: 19.0402,
    lat: 47.4979,
    nameKey: "budapest",
    previewKey: "budapestPreview",
    icon: LayoutGrid,
    color: "#3B82F6",
    labelOffsetY: 1.6,
    items: [
      { key: "dashboard", labelKey: "dashboard", href: "/dashboard", icon: LayoutGrid, moduleKey: "overview" },
      { key: "calendar", labelKey: "calendar", href: "/dashboard/calendar", icon: CalendarDays, moduleKey: "calendar" },
      { key: "money", labelKey: "money", href: "/dashboard/finance", icon: Wallet, moduleKey: "finance" },
    ],
  },
  {
    key: "diosd",
    lon: 18.868,
    lat: 47.394,
    nameKey: "diosd",
    previewKey: "diosdPreview",
    icon: Home,
    color: "#F5A15E",
    items: [
      { key: "personal", labelKey: "personalLife", href: "/dashboard/journal", icon: Sparkles, moduleKey: "journal" },
      { key: "home", labelKey: "home", href: "/dashboard/kitchen", icon: Home, moduleKey: "kitchen" },
      { key: "documents", labelKey: "documents", href: "/dashboard/protection", icon: ShieldCheck, moduleKey: "protection" },
    ],
  },
  {
    key: "somogy",
    lon: 17.797,
    lat: 46.359,
    nameKey: "somogy",
    previewKey: "somogyPreview",
    icon: Tractor,
    color: "#10B981",
    items: [
      { key: "farming", labelKey: "farming", href: "/dashboard/business/organizations", icon: Tractor, moduleKey: "business" },
      { key: "beekeeping", labelKey: "beekeeping", href: "/dashboard/business/organizations", icon: Hexagon, moduleKey: "business" },
      { key: "heritage", labelKey: "galHeritage", href: "/dashboard/legacy", icon: Landmark, moduleKey: "legacy" },
    ],
  },
  {
    key: "balaton",
    lon: 18.0525,
    lat: 46.9057,
    nameKey: "balaton",
    previewKey: "balatonPreview",
    icon: Shield,
    color: "#38BDF8",
    items: [
      { key: "security", labelKey: "securityWork", href: "/dashboard/calendar", icon: Shield, moduleKey: "calendar" },
      { key: "events", labelKey: "events", href: "/dashboard/vision", icon: PartyPopper, moduleKey: "vision" },
    ],
  },
  {
    key: "germany",
    lon: 17.1264,
    lat: 47.9139,
    nameKey: "germany",
    previewKey: "germanyPreview",
    icon: Car,
    color: "#9BB0C4",
    items: [
      { key: "garage", labelKey: "myGarage", href: "/dashboard/business/garage", icon: Car, moduleKey: "garage" },
    ],
  },
];
