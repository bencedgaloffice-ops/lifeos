/**
 * Missions — the user's active goals and projects, reframed as objectives with
 * a concrete "next action" cue. No new data: this is a lens over what already
 * exists, chosen to feel achievable (closest-to-done first).
 */

import type { Mission } from "./types";

type GoalIn = { id: string; title: string; progress: number; category: string | null; status?: string };
type ProjectIn = { id: string; name: string; progress: number; deadline: string | null; status?: string };

/** A progress-aware nudge toward the next step. */
export function nextActionFor(progress: number): string {
  if (progress <= 0) return "Kick it off — take the first step";
  if (progress < 34) return "Build early momentum";
  if (progress < 67) return "Push past the halfway mark";
  if (progress < 100) return "Final stretch — bring it home";
  return "Completed — claim the win";
}

export function buildMissions(goals: GoalIn[], projects: ProjectIn[], limit = 4): Mission[] {
  const goalMissions: Mission[] = goals
    .filter((g) => (g.status ?? "active") !== "completed")
    .map((g) => ({
      id: `goal-${g.id}`,
      title: g.title,
      kind: "goal" as const,
      progress: g.progress,
      nextAction: nextActionFor(g.progress),
      category: g.category,
    }));

  const projectMissions: Mission[] = projects
    .filter((p) => (p.status ?? "active") !== "completed")
    .map((p) => ({
      id: `project-${p.id}`,
      title: p.name,
      kind: "project" as const,
      progress: p.progress,
      nextAction: nextActionFor(p.progress),
      category: null,
    }));

  // Surface the ones nearest completion first — they feel most winnable — but
  // keep started-but-not-finished ahead of untouched (0%) ones.
  return [...goalMissions, ...projectMissions]
    .sort((a, b) => {
      const aStarted = a.progress > 0 ? 1 : 0;
      const bStarted = b.progress > 0 ? 1 : 0;
      if (aStarted !== bStarted) return bStarted - aStarted;
      return b.progress - a.progress;
    })
    .slice(0, limit);
}
