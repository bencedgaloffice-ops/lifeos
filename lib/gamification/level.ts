/**
 * Life Level & XP — derived purely from real LifeOS data.
 *
 * XP is a weighted sum of genuine progress (completed goals & projects, live
 * progress on the active ones, savings, net-worth milestones, journaling,
 * habit consistency, and unlocked achievements). The level curve grows so each
 * level costs a little more than the last, and rank titles change in bands so
 * the identity evolves ("Explorer" → "Builder" → "Founder" → "Luminary").
 */

import type { LifeProgress, LifeSnapshot } from "./types";

/** Rank bands: [minLevel, title]. Level ~12 lands on "Builder". */
const TITLE_BANDS: [number, string][] = [
  [1, "Explorer"],
  [4, "Apprentice"],
  [7, "Pathfinder"],
  [10, "Builder"],
  [14, "Architect"],
  [18, "Founder"],
  [23, "Visionary"],
  [29, "Luminary"],
];

export function titleForLevel(level: number): string {
  let title = TITLE_BANDS[0][1];
  for (const [min, name] of TITLE_BANDS) {
    if (level >= min) title = name;
  }
  return title;
}

/** Cumulative XP required to *reach* level n (level 1 = 0 XP). */
function xpToReachLevel(n: number): number {
  let total = 0;
  for (let i = 1; i < n; i++) total += 300 + (i - 1) * 180;
  return total;
}

function levelForXp(xp: number): number {
  let n = 1;
  while (xpToReachLevel(n + 1) <= xp) n++;
  return n;
}

const clampPos = (n: number) => Math.max(0, n);

export function computeLifeProgress(s: LifeSnapshot): LifeProgress {
  const activeGoals = clampPos(s.goalsTotal - s.goalsCompleted);
  const activeProjects = clampPos(s.projectsTotal - s.projectsCompleted);

  const goalsXp = Math.round(
    s.goalsCompleted * 140 + (s.goalsAvgProgress / 100) * Math.min(activeGoals, 8) * 90,
  );
  const projectsXp = Math.round(
    s.projectsCompleted * 160 + (s.projectsAvgProgress / 100) * Math.min(activeProjects, 6) * 90,
  );
  const journalXp = Math.min(s.journalCount, 60) * 10;
  const savingsXp = Math.min(clampPos(s.savingsRate) * 4, 400);
  const netWorthXp = s.netWorth > 0 ? Math.round(clampPos(Math.log10(s.netWorth)) * 120) : 0;
  const habitsXp = Math.min(s.consistencyDays, 14) * 18;
  const achievementsXp = s.achievementsUnlocked * 180;

  const contributions = [
    { label: "Goals", xp: goalsXp },
    { label: "Projects", xp: projectsXp },
    { label: "Wealth", xp: netWorthXp + savingsXp },
    { label: "Habits", xp: habitsXp },
    { label: "Reflection", xp: journalXp },
    { label: "Achievements", xp: achievementsXp },
  ].filter((c) => c.xp > 0);

  const xp = contributions.reduce((sum, c) => sum + c.xp, 0);
  const level = levelForXp(xp);
  const levelStartXp = xpToReachLevel(level);
  const nextLevelXp = xpToReachLevel(level + 1);
  const levelSpan = nextLevelXp - levelStartXp;
  const intoLevel = xp - levelStartXp;
  const progressPct = levelSpan > 0 ? Math.round((intoLevel / levelSpan) * 100) : 0;

  return {
    xp,
    level,
    title: titleForLevel(level),
    levelStartXp,
    nextLevelXp,
    intoLevel,
    levelSpan,
    progressPct,
    contributions,
  };
}
