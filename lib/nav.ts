import {
  LayoutGrid,
  UserCircle,
  Wallet,
  Target,
  FolderKanban,
  BookOpen,
  Brain,
  Settings,
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
  { key: "profile", href: "/dashboard/profile", icon: UserCircle },
  { key: "finance", href: "/dashboard/finance", icon: Wallet },
  { key: "goals", href: "/dashboard/goals", icon: Target },
  { key: "projects", href: "/dashboard/projects", icon: FolderKanban },
  { key: "journal", href: "/dashboard/journal", icon: BookOpen },
  { key: "ai", href: "/dashboard/ai", icon: Brain },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
];
