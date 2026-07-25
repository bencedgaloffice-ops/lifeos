/**
 * The specialist agents.
 *
 * The "multi-agent brain" is one reasoning core wearing different hats, not six
 * separate models. What actually differs between a Finance agent and a Farm
 * agent is (a) which tools they can reach for and (b) what they consider
 * relevant and how they talk about it. Both of those are cheap to vary and easy
 * to reason about; running six independent models would cost six times as much
 * and share no context, which is worse at the thing that matters — knowing the
 * whole of someone's life at once.
 *
 * The router below is deliberately keyword-based rather than a model call: it
 * runs in microseconds, is free, and picking a persona wrongly costs nothing
 * because `core` has the widest tool access anyway.
 */

import type { AgentId } from "./tools";

export type AgentProfile = {
  id: AgentId;
  /** Shown in the UI so the user can see which specialist answered. */
  label: string;
  /** Appended to the base system prompt. */
  brief: string;
  /** Words that route to this specialist. */
  triggers: RegExp;
};

export const AGENTS: AgentProfile[] = [
  {
    id: "finance",
    label: "Finance",
    brief:
      "You are the finance specialist. Ground every claim in the user's real transactions and accounts — never estimate a figure you could look up. Amounts are in Hungarian forints unless the record says otherwise. When you spot a pattern, say what it costs per month and per year, because the annual number is the one that changes behaviour. Flag risk plainly; do not soften a bad trend.",
    triggers:
      /\b(money|spend|spent|spending|budget|cost|price|income|salary|invest|save|saving|debt|loan|tax|profit|revenue|expense|afford|pénz|költ|bevétel|kiadás|megtakarít|hitel|adó|fizetés)\b/i,
  },
  {
    id: "home",
    label: "Home",
    brief:
      "You are the home and kitchen specialist. You care about what is actually in the fridge, freezer and pantry, what is about to expire, and what that means for tonight's dinner and this week's shop. Prefer using food up over buying more. Hungarian chains: Lidl and ALDI cheapest on staples, Penny close behind, Tesco and Auchan widest range, SPAR the priciest convenience option, METRO wholesale.",
    triggers:
      /\b(kitchen|fridge|freezer|pantry|food|cook|cooking|recipe|meal|dinner|lunch|breakfast|grocer|groceries|shopping list|expire|expiring|store|lidl|tesco|aldi|spar|penny|auchan|metro|konyha|hűtő|kamra|étel|recept|vacsora|bevásárl)\b/i,
  },
  {
    id: "health",
    label: "Health",
    brief:
      "You are the health specialist. Work from the user's logged nutrition, habits and weight history. Be encouraging but honest about gaps. You are not a doctor: for anything clinical, say so and recommend they see one rather than guessing.",
    triggers:
      /\b(health|weight|calorie|calories|protein|nutrition|diet|exercise|workout|train|training|sleep|habit|fitness|egészség|súly|kalória|edzés|alvás|szokás)\b/i,
  },
  {
    id: "projects",
    label: "Operations",
    brief:
      "You are the operations specialist. You track active work, deadlines and what is blocked. Be concrete about next actions — a task with no owner and no date is not a plan. Surface the thing most likely to slip.",
    triggers:
      /\b(project|task|deadline|milestone|build|ship|launch|blocked|backlog|todo|projekt|feladat|határidő)\b/i,
  },
  {
    id: "farm",
    label: "Farm",
    brief:
      "You are the agriculture specialist, covering the Somogy land and the beekeeping operation. You think in seasons, yields, input costs and grant deadlines. Hungarian and EU agricultural subsidy timing matters — flag it when relevant. Be realistic about what a season can produce.",
    triggers:
      /\b(farm|farming|land|somogy|bee|bees|beekeep|honey|hive|harvest|crop|soil|livestock|solar|grant|subsidy|farm|méhész|méz|kaptár|termés|föld|gazdaság|támogatás)\b/i,
  },
  {
    id: "marriage",
    label: "Relationship",
    brief:
      "You are the relationship specialist. You hold anniversaries, shared plans and commitments made to Niki. Be warm and specific — a remembered detail is worth more than a general sentiment. Never be flippant about the relationship, and never invent a memory you do not have on record.",
    triggers:
      /\b(niki|wife|marriage|married|relationship|anniversary|date night|wedding|feleség|házasság|évforduló|esküvő|kapcsolat)\b/i,
  },
];

export const CORE_BRIEF =
  "You are the generalist core. Answer across every part of the user's life, and hand off implicitly by reaching for whichever data the question actually needs.";

/**
 * Pick the specialist for a message. Whichever profile has the most trigger
 * hits wins; ties and misses fall back to the core, which has the broadest
 * tool access — so a wrong guess degrades to "slightly less focused", never to
 * "cannot answer".
 */
export function route(message: string): AgentId {
  let best: AgentId = "core";
  let bestScore = 0;
  for (const agent of AGENTS) {
    const hits = message.match(new RegExp(agent.triggers.source, "gi"))?.length ?? 0;
    if (hits > bestScore) {
      bestScore = hits;
      best = agent.id;
    }
  }
  return best;
}

export function briefFor(agent: AgentId): string {
  return AGENTS.find((a) => a.id === agent)?.brief ?? CORE_BRIEF;
}

export function labelFor(agent: AgentId): string {
  return AGENTS.find((a) => a.id === agent)?.label ?? "Core";
}
