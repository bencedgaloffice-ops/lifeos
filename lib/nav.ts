import {
  LayoutGrid,
  UserCircle,
  Wallet,
  Target,
  FolderKanban,
  BookOpen,
  Brain,
  Bot,
  Settings,
  ShieldCheck,
  Landmark,
  ChefHat,
  Salad,
  CalendarDays,
  Image as ImageIcon,
  HeartHandshake,
  Repeat,
  Briefcase,
  Building2,
  Car,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  /** i18n key under `nav.` — label is `nav.<key>.label`, description `nav.<key>.description` */
  key: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = "life" | "business";

/** Life — personal command center. */
export const lifeNav: NavItem[] = [
  { key: "overview", href: "/dashboard", icon: LayoutGrid },
  { key: "calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { key: "finance", href: "/dashboard/finance", icon: Wallet },
  { key: "goals", href: "/dashboard/goals", icon: Target },
  { key: "projects", href: "/dashboard/projects", icon: FolderKanban },
  { key: "vision", href: "/dashboard/vision", icon: ImageIcon },
  { key: "legacy", href: "/dashboard/legacy", icon: Landmark },
  { key: "relationship", href: "/dashboard/relationship", icon: HeartHandshake },
  { key: "habits", href: "/dashboard/habits", icon: Repeat },
  { key: "protection", href: "/dashboard/protection", icon: ShieldCheck },
  { key: "journal", href: "/dashboard/journal", icon: BookOpen },
  { key: "kitchen", href: "/dashboard/kitchen", icon: ChefHat },
  { key: "nutrition", href: "/dashboard/nutrition", icon: Salad },
  { key: "profile", href: "/dashboard/profile", icon: UserCircle },
];

/** Business — organizations hub. */
export const businessNav: NavItem[] = [
  { key: "businessOverview", href: "/dashboard/business", icon: Briefcase },
  { key: "organizations", href: "/dashboard/business/organizations", icon: Building2 },
  { key: "garage", href: "/dashboard/business/garage", icon: Car },
];

/** Utility items shown regardless of the active section. */
export const utilityNav: NavItem[] = [
  { key: "ai", href: "/dashboard/ai", icon: Brain },
  { key: "jarvis", href: "/dashboard/jarvis", icon: Bot },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
];

/** Kept for anything that still imports the old flat list. */
export const dashboardNav: NavItem[] = [...lifeNav, ...businessNav, ...utilityNav];

export function sectionForPath(pathname: string): NavSection {
  return pathname.startsWith("/dashboard/business") ? "business" : "life";
}
