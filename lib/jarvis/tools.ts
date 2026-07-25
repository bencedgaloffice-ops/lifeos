/**
 * The tool registry — what Jarvis is actually allowed to do.
 *
 * This is the piece that turns Jarvis from something that *talks* about your
 * life into something that *acts* on it. Every capability is one entry here:
 * a name, a description the model reads to decide when to reach for it, a JSON
 * Schema for its arguments, and the permission tier it demands.
 *
 * Two rules hold the design together:
 *
 *  1. Reads are L1, writes are L2, structural changes are L3. The permission
 *     level lives on the tool definition, not in the executor, so a new tool
 *     cannot be added without someone deciding what trust it needs.
 *  2. The model never touches the database. It emits a tool name and arguments;
 *     the server executor validates them and runs the query under the user's
 *     own RLS. A hallucinated table name fails as a rejected tool call, not as
 *     a stray write.
 *
 * Adding a capability from here on is: append a definition, implement its case
 * in the executor. That is why this file matters more than its length suggests.
 */

import type { PermissionLevel } from "./types";

/** JSON Schema subset we use for tool arguments. */
type Schema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type JarvisTool = {
  name: string;
  description: string;
  input_schema: Schema;
  /** Trust required to run it. Reads 1, writes 2, structural 3. */
  level: PermissionLevel;
  /** Which specialists may use it. Empty means every agent. */
  agents?: AgentId[];
};

export type AgentId = "core" | "finance" | "home" | "health" | "projects" | "farm" | "marriage";

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });

/* ------------------------------------------------------------------ reads */

const READ_TOOLS: JarvisTool[] = [
  {
    name: "query_life_data",
    level: 1,
    description:
      "Read the user's own LifeOS data. Use this whenever a question depends on their real records rather than general knowledge — spending, upcoming events, kitchen stock, goals, habits, shifts. Returns rows as JSON. Prefer one broad call over several narrow ones.",
    input_schema: {
      type: "object",
      properties: {
        dataset: {
          type: "string",
          enum: [
            "transactions",
            "accounts",
            "calendar_events",
            "shifts",
            "kitchen_items",
            "shopping_list",
            "recipes",
            "goals",
            "habits",
            "projects",
            "nutrition",
            "documents",
            "vehicles",
            "organizations",
            "life_areas",
            "store_prices",
          ],
          description: "Which set of the user's records to read.",
        },
        since: str("Optional ISO date lower bound, e.g. 2026-07-01."),
        until: str("Optional ISO date upper bound."),
        search: str("Optional case-insensitive substring to filter names/titles by."),
        limit: num("Max rows, default 50, hard cap 200."),
      },
      required: ["dataset"],
    },
  },
  {
    name: "summarize_spending",
    level: 1,
    description:
      "Aggregate the user's transactions into totals by category and month. Use for 'how much did I spend', 'analyze my spending habits', or anything needing sums rather than raw rows.",
    input_schema: {
      type: "object",
      properties: {
        months: num("How many months back to cover. Default 3, max 24."),
        group_by: { type: "string", enum: ["category", "month", "both"], description: "Aggregation axis." },
      },
    },
    agents: ["core", "finance", "farm"],
  },
  {
    name: "recall_memory",
    level: 1,
    description:
      "Search long-term memory for what you already know about the user — preferences, goals, past decisions, facts they asked you to remember. Call this before answering anything personal, and before claiming you don't know something about them.",
    input_schema: {
      type: "object",
      properties: {
        about: str("What you're trying to remember, in a few words. Matched fuzzily."),
        limit: num("Max facts to return. Default 12."),
      },
      required: ["about"],
    },
  },
  {
    name: "web_search",
    level: 1,
    description:
      "Look something up online: current prices, product comparisons, company details, news, facts you are unsure of. Use it rather than guessing at anything time-sensitive. Returns snippets with their sources — always say where a claim came from.",
    input_schema: {
      type: "object",
      properties: {
        query: str("The search query."),
        depth: {
          type: "string",
          enum: ["quick", "research"],
          description: "'quick' for a single fact, 'research' for a comparison needing several sources.",
        },
      },
      required: ["query"],
    },
  },
];

/* ----------------------------------------------------------------- writes */

const WRITE_TOOLS: JarvisTool[] = [
  {
    name: "remember",
    level: 2,
    description:
      "Store a durable fact about the user: a preference, a goal, a constraint, a decision. Give a stable `key` so a later update overwrites rather than contradicts (e.g. key 'long_term_goal'). Do NOT store transient chatter — only what should still matter in six months.",
    input_schema: {
      type: "object",
      properties: {
        key: str("Stable slug identifying the fact, e.g. 'long_term_goal', 'coffee_preference'."),
        content: str("The fact, written as a full sentence in the third person."),
        importance: num("1–5. 5 is life-shaping, 1 is trivia. Default 3."),
      },
      required: ["key", "content"],
    },
  },
  {
    name: "add_shopping_items",
    level: 2,
    description: "Add one or more items to the kitchen shopping list. Skips anything already on it.",
    input_schema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "string" }, description: "Item names." },
        category: str("Optional grouping label."),
      },
      required: ["items"],
    },
    agents: ["core", "home", "health"],
  },
  {
    name: "create_calendar_event",
    level: 2,
    description:
      "Put something on the user's LifeOS calendar. Times must be ISO 8601. Set all_day for date-only entries. It syncs to Google on the next sync pass, so do not also try to create it there.",
    input_schema: {
      type: "object",
      properties: {
        title: str("Event title."),
        start_at: str("ISO start, e.g. 2026-08-02T09:00:00Z."),
        end_at: str("ISO end."),
        all_day: bool("True for a date-only entry."),
        location: str("Optional location."),
        description: str("Optional notes."),
        recurrence_rule: str("Optional RFC 5545 RRULE body, e.g. FREQ=WEEKLY;BYDAY=TU."),
      },
      required: ["title", "start_at", "end_at"],
    },
  },
  {
    name: "create_goal",
    level: 2,
    description: "Create a goal with an optional target date and measurable target.",
    input_schema: {
      type: "object",
      properties: {
        title: str("What the goal is."),
        description: str("Optional detail."),
        target_date: str("Optional ISO date."),
        category: str("Optional category label."),
      },
      required: ["title"],
    },
    agents: ["core", "finance", "projects", "farm", "health", "marriage"],
  },
  {
    name: "add_kitchen_item",
    level: 2,
    description:
      "Record food into the fridge, freezer or pantry. Use this after reading a photo of groceries or a receipt, one call per item.",
    input_schema: {
      type: "object",
      properties: {
        name: str("Item name."),
        location: { type: "string", enum: ["fridge", "freezer", "pantry"], description: "Where it goes." },
        quantity: str("Optional quantity, e.g. '1 L', '6 pcs'."),
        expires_at: str("Optional ISO expiry date."),
        category: str("Optional category."),
      },
      required: ["name", "location"],
    },
    agents: ["core", "home", "health"],
  },
  {
    name: "log_nutrition",
    level: 2,
    description: "Log a meal the user ate, with whatever nutrition figures are known.",
    input_schema: {
      type: "object",
      properties: {
        meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Which meal." },
        description: str("What they ate."),
        calories: num("Optional kcal."),
        protein_g: num("Optional protein in grams."),
      },
      required: ["meal", "description"],
    },
    agents: ["core", "health", "home"],
  },
];

/* -------------------------------------------------------- interface control */

const UI_TOOLS: JarvisTool[] = [
  {
    name: "navigate",
    level: 1,
    description:
      "Move the user's screen somewhere in LifeOS — open a module, or focus an object in the 3D kitchen. Use it when they ask to see something rather than to be told about it. Say what you opened.",
    input_schema: {
      type: "object",
      properties: {
        module: {
          type: "string",
          enum: [
            "overview", "map", "calendar", "finance", "goals", "projects", "vision", "legacy",
            "relationship", "habits", "protection", "journal", "kitchen", "nutrition",
            "profile", "ai", "jarvis", "settings", "business", "garage",
          ],
          description: "Which module to open.",
        },
        view: str("Optional sub-view, e.g. kitchen tabs: world | manager | chef | shopping | music."),
        focus: str("Optional 3D object to focus: fridge | freezer | pantry | island | oven | sink."),
      },
      required: ["module"],
    },
  },
];

export const JARVIS_TOOLS: JarvisTool[] = [...READ_TOOLS, ...WRITE_TOOLS, ...UI_TOOLS];

/** Tools a given specialist is allowed to reach for, at or below a trust tier. */
export function toolsFor(agent: AgentId, level: PermissionLevel): JarvisTool[] {
  return JARVIS_TOOLS.filter(
    (t) => t.level <= level && (!t.agents || t.agents.includes(agent)),
  );
}

export function findTool(name: string): JarvisTool | undefined {
  return JARVIS_TOOLS.find((t) => t.name === name);
}

/** Strip our own metadata — the API only wants name/description/input_schema. */
export function wireFormat(tools: JarvisTool[]) {
  return tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}
