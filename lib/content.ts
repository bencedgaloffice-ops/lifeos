import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Wallet,
  Target,
  Sparkles,
  FolderKanban,
  BookOpen,
  TrendingUp,
  FileText,
  Brain,
  Clock,
  Shield,
  HeartHandshake,
  Landmark,
} from "lucide-react";

export type Pillar = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const pillars: Pillar[] = [
  {
    title: "Protection",
    description:
      "Safeguard what matters — your documents, your health, your family, your peace of mind. Everything secured in one place.",
    icon: Shield,
  },
  {
    title: "Provision",
    description:
      "Command your money, investments, and daily plans. Make confident decisions with your whole financial life in view.",
    icon: HeartHandshake,
  },
  {
    title: "Legacy",
    description:
      "Capture memories, chart dreams, and build the story you leave behind. A life designed on purpose, remembered forever.",
    icon: Landmark,
  },
];

export type ModuleItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const modules: ModuleItem[] = [
  {
    title: "Calendar",
    description: "Every commitment, one intelligent timeline.",
    icon: Calendar,
  },
  {
    title: "Money",
    description: "Cash flow, budgets, and net worth at a glance.",
    icon: Wallet,
  },
  {
    title: "Goals",
    description: "Turn intentions into measurable progress.",
    icon: Target,
  },
  {
    title: "Dreams",
    description: "Give your someday a place to live and grow.",
    icon: Sparkles,
  },
  {
    title: "Projects",
    description: "Move the work of your life forward, together.",
    icon: FolderKanban,
  },
  {
    title: "Journal",
    description: "Reflect, record, and understand your days.",
    icon: BookOpen,
  },
  {
    title: "Investments",
    description: "Watch your wealth compound over decades.",
    icon: TrendingUp,
  },
  {
    title: "Documents",
    description: "Wills, records, and essentials, always in reach.",
    icon: FileText,
  },
  {
    title: "AI",
    description: "A companion that understands your whole life.",
    icon: Brain,
  },
  {
    title: "Timeline",
    description: "Your entire life, from origin to horizon.",
    icon: Clock,
  },
];

export type Step = {
  number: string;
  title: string;
  description: string;
};

export const steps: Step[] = [
  {
    number: "01",
    title: "Collect",
    description:
      "Bring every thread of your life into one place — calendars, accounts, notes, dreams, and documents. LifeOS becomes the single source of truth.",
  },
  {
    number: "02",
    title: "Organize",
    description:
      "Watch scattered information arrange itself into a clear, connected system. Money, goals, and memories finally speak the same language.",
  },
  {
    number: "03",
    title: "Build",
    description:
      "Act with intention. Set direction, track progress, and design the life you actually want — one deliberate decision at a time.",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
};

export const testimonials: Testimonial[] = [
  {
    quote:
      "For the first time, my entire life has one home. I open LifeOS in the morning and I know exactly where I stand — money, goals, family, everything.",
    name: "Elena Márquez",
    role: "Founder, Atlas Studio",
    initials: "EM",
  },
  {
    quote:
      "It doesn't feel like software. It feels like the operating system my life was always missing. The clarity is genuinely life-changing.",
    name: "Daniel Osei",
    role: "Physician & Investor",
    initials: "DO",
  },
  {
    quote:
      "I've tried every productivity app. LifeOS is the only one that connected the dots between who I am today and who I want to become.",
    name: "Sofia Lindqvist",
    role: "Product Lead, Northwind",
    initials: "SL",
  },
  {
    quote:
      "The timeline view made me cry, honestly. Seeing my whole journey — past memories and future dreams — in one place changed how I plan.",
    name: "Marcus Bell",
    role: "Author & Educator",
    initials: "MB",
  },
];

export type PlanFeature = string;

export const pricing = {
  name: "LifeOS Founders",
  price: "$18",
  cadence: "/ month",
  note: "Early access pricing — locked forever for founding members.",
  features: [
    "Unlimited life modules",
    "AI life assistant",
    "Bank-grade encryption",
    "Life timeline & memories",
    "Financial & investment tracking",
    "Priority human support",
  ] as PlanFeature[],
};

export const navLinks = [
  { label: "System", href: "#system" },
  { label: "Modules", href: "#modules" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Intelligence", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
];
