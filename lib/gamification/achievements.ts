/**
 * Achievement catalog — every badge unlocks strictly from real LifeOS data, so
 * an award always reflects something the user genuinely did. Icons are stored
 * as lucide-react names and resolved in the UI.
 */

import type { AchievementDef, LifeSnapshot } from "./types";

export const ACHIEVEMENTS: AchievementDef[] = [
  // Goals
  { key: "first_goal", title: "First Goal", description: "Set your first goal in LifeOS.", icon: "Target", tier: "bronze", test: (s) => s.goalsTotal >= 1 },
  { key: "goal_achiever", title: "Goal Achiever", description: "Complete your first goal.", icon: "CircleCheck", tier: "gold", test: (s) => s.goalsCompleted >= 1 },
  { key: "goal_master", title: "Goal Master", description: "Complete five goals.", icon: "Trophy", tier: "gold", test: (s) => s.goalsCompleted >= 5 },
  // Projects / building
  { key: "founder", title: "Founder", description: "Start your first project.", icon: "Rocket", tier: "gold", test: (s) => s.projectsTotal >= 1 },
  { key: "serial_builder", title: "Serial Builder", description: "Have three projects in motion.", icon: "FolderKanban", tier: "gold", test: (s) => s.projectsTotal >= 3 },
  { key: "entrepreneur", title: "Entrepreneur", description: "Complete a project end to end.", icon: "Briefcase", tier: "gold", test: (s) => s.projectsCompleted >= 1 },
  // Life areas
  { key: "first_property", title: "First Property", description: "Add a property to your assets.", icon: "Home", tier: "gold", test: (s) => s.assetsPropertyCount >= 1 },
  { key: "security_professional", title: "Security Professional", description: "Log an ICSB security shift.", icon: "ShieldCheck", tier: "gold", test: (s) => s.shiftsCount >= 1 },
  { key: "beekeeper", title: "Beekeeper", description: "Run an apiary or log a honey harvest.", icon: "Hexagon", tier: "gold", test: (s) => s.apiaryCount >= 1 || s.honeyHarvestCount >= 1 },
  // Wealth
  { key: "wealth_builder", title: "Wealth Builder", description: "Reach a positive net worth.", icon: "TrendingUp", tier: "bronze", test: (s) => s.netWorth > 0 },
  { key: "five_figures", title: "Five Figures", description: "Grow net worth past 10,000.", icon: "Coins", tier: "gold", test: (s) => s.netWorth >= 10_000 },
  { key: "six_figures", title: "Six Figures", description: "Grow net worth past 100,000.", icon: "Gem", tier: "gold", test: (s) => s.netWorth >= 100_000 },
  { key: "disciplined_saver", title: "Disciplined Saver", description: "Save 20%+ of your income this month.", icon: "PiggyBank", tier: "gold", test: (s) => s.savingsRate >= 20 },
  // Growth / reflection
  { key: "chronicler", title: "Chronicler", description: "Write ten journal entries.", icon: "BookOpen", tier: "bronze", test: (s) => s.journalCount >= 10 },
  { key: "dreamer", title: "Dreamer", description: "Add a dream to your vision board.", icon: "Sparkles", tier: "bronze", test: (s) => s.dreamsCount >= 1 },
  { key: "milestone_maker", title: "Milestone Maker", description: "Record a life milestone.", icon: "Milestone", tier: "bronze", test: (s) => s.milestonesCount >= 1 },
  { key: "consistent", title: "Consistent", description: "Log habits seven days running.", icon: "Flame", tier: "gold", test: (s) => s.consistencyDays >= 7 },
  // Life Map
  { key: "cartographer", title: "Cartographer", description: "Place your first location on the Life Map.", icon: "MapPin", tier: "bronze", test: (s) => s.mapLocationsCount >= 1 },
  { key: "world_builder", title: "World Builder", description: "Chart five locations on your Life Map.", icon: "Globe2", tier: "gold", test: (s) => s.mapLocationsCount >= 5 },
];

/** Keys of every achievement currently satisfied by the snapshot. */
export function evaluateAchievements(s: LifeSnapshot): string[] {
  return ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.key);
}
