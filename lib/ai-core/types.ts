/**
 * Shared types for the AI Core kernel.
 *
 * These describe the contracts every agent and every kernel service speaks in:
 * the durable event, the recommendation an agent produces, the notification a
 * user sees, and the run record left for observability — plus the agent
 * framework itself (definition + context + result).
 *
 * Nothing here imports a database client or a model; these are plain data
 * shapes so both server code and pure logic can depend on them without pulling
 * the world in.
 */

/** A durable domain event. Written by server actions, drained by the heartbeat.
 * `type` is a stable PascalCase name, e.g. "ExpenseAdded", "GoalCompleted". */
export type AiEvent = {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
};

/** What an agent produces instead of computing signals inline. `dedupe_key`
 * lets a later run overwrite the same suggestion rather than stacking copies. */
export type Recommendation = {
  id: string;
  user_id: string;
  agent: string;
  kind: string | null;
  title: string;
  body: string | null;
  /** 0–1. How sure the agent is. Surfaced in the UI so trust can be learned. */
  confidence: number;
  /** 0–100. Combined with confidence to rank what the user sees first. */
  urgency: number;
  action: { route?: string; tool?: string; args?: Record<string, unknown> } | null;
  dedupe_key: string | null;
  status: "open" | "acted" | "dismissed" | "expired";
  created_at: string;
  updated_at: string;
};

/** The shape an agent hands back — the store fills in ids and timestamps. */
export type RecommendationDraft = {
  kind?: string;
  title: string;
  body?: string;
  confidence?: number;
  urgency?: number;
  action?: Recommendation["action"];
  /** Stable within (agent) so re-runs update rather than duplicate. */
  dedupe_key?: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  source: string;
  title: string;
  body: string | null;
  route: string | null;
  read_at: string | null;
  created_at: string;
};

export type AgentRunRecord = {
  agent: string;
  trigger: "schedule" | "event" | "chat";
  ok: boolean;
  tokens?: number | null;
  ms?: number | null;
  detail?: string | null;
};

/* --------------------------------------------------------- agent framework */

/** How often an agent's scheduled job wants to run. The heartbeat cron decides
 * whether a cadence is "due" based on the last run — so an agent asks for
 * "daily" without owning a timer. */
export type Cadence = "hourly" | "daily" | "weekly" | "monthly";

/** Everything an agent's run() is handed. Kept deliberately small: a client
 * already scoped to the user by RLS, who the user is, when now is, and why the
 * agent was invoked. Agents read through the client and return drafts; they do
 * not write recommendations themselves — the kernel does, so dedup and logging
 * happen in one place. */
export type AgentContext = {
  userId: string;
  now: Date;
  trigger: "schedule" | "event" | "chat";
  /** The event that woke the agent, when trigger is "event". */
  event?: AiEvent;
  /** Grounding string (profile, memory, date) built by lib/ai-core/context. */
  grounding: string;
};

/** A registered agent. The 6 personas migrate onto this in Phase 3; the
 * Executive agent is one of these too. */
export type AgentDefinition = {
  id: string;
  label: string;
  /** Persona text appended to the base system prompt for chat. */
  brief: string;
  /** Event types this agent reacts to, e.g. ["ExpenseAdded"]. */
  subscriptions?: string[];
  /** How often its scheduled job runs, if any. */
  schedule?: Cadence;
  /** Produce recommendations from the user's current state. Optional: some
   * agents are chat-only and never run on a schedule. */
  run?: (ctx: AgentContext, deps: AgentDeps) => Promise<RecommendationDraft[]>;
};

/** Dependencies handed to run() — the DB client and nothing more for now.
 * Typed loosely to avoid a hard import of @supabase/supabase-js here. */
export type AgentDeps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
};
