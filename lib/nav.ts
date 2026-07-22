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
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export const dashboardNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid, description: "Your life at a glance" },
  { label: "My Profile", href: "/dashboard/profile", icon: UserCircle, description: "Who you are & where you're going" },
  { label: "Finance", href: "/dashboard/finance", icon: Wallet, description: "Wealth & cash flow" },
  { label: "Goals", href: "/dashboard/goals", icon: Target, description: "What you're building toward" },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban, description: "The work of your life" },
  { label: "Journal", href: "/dashboard/journal", icon: BookOpen, description: "Your journey, remembered" },
  { label: "AI Companion", href: "/dashboard/ai", icon: Brain, description: "Understands your life" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, description: "Password & preferences" },
];
