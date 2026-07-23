/**
 * The gamification layer turns a user's *real* LifeOS data into a sense of
 * progression — a Life Level, active Missions, and earned Achievements.
 *
 * Everything here is deterministic and derived from a single {@link LifeSnapshot}
 * so it is always honest: nothing is awarded that the data doesn't back up.
 * (Achievements are additionally persisted so their first-unlock date sticks —
 * see the `achievements` table — but the *conditions* are still evaluated from
 * this snapshot.)
 */

export type LifeSnapshot = {
  // Goals
  goalsTotal: number;
  goalsCompleted: number;
  goalsAvgProgress: number; // 0..100 across active goals
  // Projects
  projectsTotal: number;
  projectsCompleted: number;
  projectsAvgProgress: number; // 0..100 across active projects
  // Journal / reflection
  journalCount: number;
  // Money
  savingsRate: number; // percent this month (can be negative)
  netWorth: number;
  // Habits / nutrition
  consistencyDays: number; // distinct logged days in the last 14
  // Life-area signals (for achievements)
  assetsPropertyCount: number;
  shiftsCount: number;
  apiaryCount: number;
  honeyHarvestCount: number;
  dreamsCount: number;
  milestonesCount: number;
  mapLocationsCount: number;
  // Feeds back into XP so unlocking achievements advances your level.
  achievementsUnlocked: number;
};

export type LifeProgress = {
  xp: number;
  level: number;
  /** Rank name for the current level band (e.g. "Builder"). */
  title: string;
  levelStartXp: number;
  nextLevelXp: number;
  intoLevel: number; // xp earned within the current level
  levelSpan: number; // xp between this level and the next
  progressPct: number; // 0..100 into the current level
  /** Where the XP came from — shown as the level breakdown. */
  contributions: { label: string; xp: number }[];
};

export type Mission = {
  id: string;
  title: string;
  kind: "goal" | "project";
  progress: number; // 0..100
  nextAction: string;
  category: string | null;
};

export type AchievementTier = "bronze" | "gold";

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  /** lucide-react icon name, resolved in the UI. */
  icon: string;
  tier: AchievementTier;
  test: (s: LifeSnapshot) => boolean;
};

export type AchievementView = AchievementDef & {
  unlocked: boolean;
  unlockedAt: string | null;
};
