/**
 * The command intent engine.
 *
 * A transcript comes in; a {@link JarvisCommand} comes out — classified into a
 * routing bucket, tagged with the trust level it needs, and carrying any
 * extracted arguments. This is deliberately a fast, deterministic rule engine
 * (no network round-trip for the common cases); anything it can't classify
 * falls through to a grounded "chat" command that the rule-based companion on
 * the server answers from the user's real data.
 *
 * New LifeOS modules register their navigation + verbs here and immediately
 * become voice-addressable.
 */

import type { JarvisCommand, PermissionLevel } from "./types";

/* ---- Navigation targets (module → route + spoken aliases) ------------- */

type NavTarget = { route: string; label: string; aliases: string[] };

export const NAV_TARGETS: NavTarget[] = [
  { route: "/dashboard", label: "Dashboard", aliases: ["dashboard", "home", "overview", "főoldal", "kezdőlap"] },
  { route: "/dashboard/calendar", label: "Calendar", aliases: ["calendar", "schedule", "naptár", "shifts", "icsb"] },
  { route: "/dashboard/finance", label: "Finance", aliases: ["finance", "money", "budget", "wealth", "pénz", "pénzügy"] },
  { route: "/dashboard/goals", label: "Goals", aliases: ["goals", "goal", "cél", "célok"] },
  { route: "/dashboard/projects", label: "Projects", aliases: ["projects", "project", "projekt", "projektek"] },
  { route: "/dashboard/kitchen", label: "Kitchen", aliases: ["kitchen", "fridge", "pantry", "shopping", "konyha", "hűtő"] },
  { route: "/dashboard/nutrition", label: "Nutrition", aliases: ["nutrition", "meals", "food", "protein", "diet", "táplálkozás"] },
  { route: "/dashboard/legacy", label: "Legacy", aliases: ["legacy", "dreams", "milestones", "örökség", "álmok"] },
  { route: "/dashboard/protection", label: "Protection", aliases: ["protection", "documents", "security", "védelem", "dokumentumok"] },
  { route: "/dashboard/journal", label: "Journal", aliases: ["journal", "diary", "napló"] },
  { route: "/dashboard/profile", label: "Profile", aliases: ["profile", "profil"] },
  { route: "/dashboard/ai", label: "AI Companion", aliases: ["companion", "assistant page", "ai page"] },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/** Strip a leading verb like "open", "go to", "show" so we can read the target. */
function stripNavVerb(s: string): string {
  return s.replace(/^(open|go to|goto|show|take me to|navigate to|launch|display|nyisd meg|mutasd|menj)\s+/i, "").trim();
}

function cmd(partial: Omit<JarvisCommand, "args"> & { args?: Record<string, string> }): JarvisCommand {
  return { args: {}, ...partial };
}

/**
 * Parse a raw transcript into a runnable command.
 * `level` is the *required* trust, checked by the caller against the session.
 */
export function parseCommand(raw: string): JarvisCommand {
  const text = normalize(raw);

  /* ---- System / meta ---- */
  if (/^(lock|log ?out|sign ?out|stand down|go to sleep|that's all|nevermind|never mind)\b/.test(text)) {
    return cmd({ kind: "system", level: 1, label: "Stand down", intent: "system.sleep" });
  }
  if (/\b(backup|back up)\b/.test(text)) {
    return cmd({ kind: "system", level: 2, label: "Back up LifeOS", intent: "system.backup" });
  }
  if (/\b(command palette|palette|spotlight|search everything)\b/.test(text)) {
    return cmd({ kind: "system", level: 1, label: "Command palette", intent: "system.palette" });
  }

  /* ---- Permission phrases ---- */
  if (/\bi allow it\b/.test(text)) {
    return cmd({ kind: "system", level: 1, label: "Elevate to Operator", intent: "system.elevate" });
  }
  if (/\b(developer mode|dev mode|developer access)\b/.test(text)) {
    return cmd({ kind: "system", level: 1, label: "Developer mode", intent: "system.developer" });
  }

  /* ---- Navigation ---- */
  if (/^(open|go to|goto|show|take me to|navigate to|launch|display|nyisd meg|mutasd|menj)\b/.test(text)) {
    const target = stripNavVerb(text);
    const match = NAV_TARGETS.find((t) => t.aliases.some((a) => target === a || target.includes(a)));
    if (match) {
      return cmd({ kind: "navigate", level: 1, label: `Open ${match.label}`, intent: "navigate", args: { route: match.route, label: match.label } });
    }
  }

  /* ---- Writes (Operator, L2) ----
     Ordered most-specific first: the "goal / reminder / journal / remember"
     verbs are checked before the generic "add X → shopping list" catch-all,
     otherwise "add a reminder to call mum" would be misread as a grocery. */
  let m: RegExpMatchArray | null;

  // Note: transcripts are normalized (punctuation stripped), so match the
  // spoken forms — "note that …", "journal …" — not "note: …".
  if ((m = text.match(/^(?:create|add|new|set)\s+(?:a\s+)?goal\s+(?:to\s+)?(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: `Create goal “${m[1]}”`, intent: "goal.create", args: { title: m[1] } });
  }
  if ((m = text.match(/^(?:create|add|set|make)\s+(?:a\s+)?reminder\s+(?:to\s+)?(.+)$/)) ||
      (m = text.match(/^remind me to\s+(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: "Create reminder", intent: "reminder.create", args: { title: m[1] } });
  }
  // Memory before journal so "note down that …" / "keep in mind …" win.
  if ((m = text.match(/^(?:remember|note down|keep in mind)\s+(?:that\s+)?(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: "Remember that", intent: "memory.add", args: { text: m[1] } });
  }
  if ((m = text.match(/^(?:add|new|create)\s+(?:a\s+)?journal\s+(?:entry\s+)?(.+)$/)) ||
      (m = text.match(/^(?:journal|note)\s+(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: "Add journal entry", intent: "journal.add", args: { text: m[1] } });
  }
  if ((m = text.match(/^(?:add|buy|put)\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?(?:shopping|shopping list|list)$/)) ||
      (m = text.match(/^(?:add|buy)\s+(.+?)\s+to\s+shopping$/))) {
    return cmd({ kind: "write", level: 2, label: `Add ${m[1]} to shopping list`, intent: "shopping.add", args: { name: m[1] } });
  }
  if ((m = text.match(/^add\s+(.+?)\s+to\s+(?:the\s+)?(?:kitchen|fridge|pantry|freezer)$/))) {
    return cmd({ kind: "write", level: 2, label: `Add ${m[1]} to kitchen`, intent: "kitchen.add", args: { name: m[1] } });
  }
  if ((m = text.match(/^(?:remove|delete|take off)\s+(.+?)\s+from\s+(?:the\s+)?(?:shopping|list|kitchen|fridge)$/)) ||
      (m = text.match(/^(?:remove|delete)\s+(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: `Remove ${m[1]}`, intent: "shopping.remove", confirm: true, args: { name: m[1] } });
  }
  // Bare "add milk" / "buy eggs" → shopping list (the most common intent).
  if ((m = text.match(/^(?:add|buy)\s+(.+)$/))) {
    return cmd({ kind: "write", level: 2, label: `Add ${m[1]} to shopping list`, intent: "shopping.add", args: { name: m[1] } });
  }

  /* ---- Developer (L3) ---- */
  if (/\b(change (the )?theme|edit widget|edit layout|generate (a )?component|build (a )?module|new dashboard|move this card|hide this section)\b/.test(text)) {
    return cmd({ kind: "developer", level: 3, label: "Developer action", intent: "developer.generic", args: { request: raw } });
  }

  /* ---- Web answers (L1) → general knowledge "from online" ---- */
  const PERSONAL = /\b(my|mine|im|our|schedule|calendar|budget|money|spent|spend|saving|savings|goal|goals|project|projects|kitchen|fridge|pantry|shopping|journal|protein|calorie|nutrition|shift|icsb|dream|milestone|document|reminder|profile|weight|habit)\b/;
  // Explicit web triggers — the topic (not the phrase) is checked for personal words,
  // so "tell me about …" isn't blocked by the "me" it contains.
  if ((m = text.match(/^(?:search(?: the web)?(?: for)?|google|look up|look for|tell me about|explain|what do you know about)\s+(.+)$/))) {
    if (!PERSONAL.test(m[1]) && !/\b(i|me|we)\b/.test(m[1])) {
      return cmd({ kind: "read", level: 1, label: "Search the web", intent: "web.query", args: { query: m[1] } });
    }
  }
  // General-knowledge questions that aren't about the user's own LifeOS data.
  const GENERAL = /^(?:what|whats|who|where|when|why|how|which|define|is|are|does|do|can|was|were)\b/;
  if (GENERAL.test(text) && !PERSONAL.test(text) && !/\b(i|me|we)\b/.test(text)) {
    return cmd({ kind: "read", level: 1, label: "Web answer", intent: "web.query", args: { query: raw } });
  }

  /* ---- Reads (L1) → answered from the user's data on the server ---- */
  return cmd({ kind: "read", level: 1, label: "Answer", intent: "read.query", args: { query: raw } });
}
