import {
  LayoutGrid,
  UserCircle,
  Wallet,
  Target,
  FolderKanban,
  BookOpen,
  Brain,
  Settings,
  ShieldCheck,
  Landmark,
  ChefHat,
  Salad,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  /** i18n key under `nav.` — label is `nav.<key>.label`, description `nav.<key>.description` */
  key: string;
  href: string;
  icon: LucideIcon;
};

export const dashboardNav: NavItem[] = [
  { key: "overview", href: "/dashboard", icon: LayoutGrid },
  { key: "calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { key: "protection", href: "/dashboard/protection", icon: ShieldCheck },
  { key: "finance", href: "/dashboard/finance", icon: Wallet },
  { key: "legacy", href: "/dashboard/legacy", icon: Landmark },
  { key: "goals", href: "/dashboard/goals", icon: Target },
  { key: "projects", href: "/dashboard/projects", icon: FolderKanban },
  { key: "kitchen", href: "/dashboard/kitchen", icon: ChefHat },
  { key: "nutrition", href: "/dashboard/nutrition", icon: Salad },
  { key: "journal", href: "/dashboard/journal", icon: BookOpen },
  { key: "profile", href: "/dashboard/profile", icon: UserCircle },
  { key: "ai", href: "/dashboard/ai", icon: Brain },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
];
