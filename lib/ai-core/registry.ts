/**
 * The agent registry.
 *
 * One list of every agent LifeOS runs, keyed by id. The kernel iterates it to
 * decide who reacts to an event and whose scheduled job is due; the chat path
 * looks up a persona's brief here. Registering an agent is the only step
 * needed to make it part of the system — there is no second place to wire it
 * in, which is the whole point of a registry.
 *
 * Phase 1 ships the mechanism with no agents on it yet: the 6 personas migrate
 * onto defineAgent in Phase 3, and the Executive agent joins in Phase 4. Until
 * then this is inert scaffolding that changes no behaviour.
 */

import type { AgentDefinition, Cadence, AiEvent } from "./types";

const REGISTRY = new Map<string, AgentDefinition>();

/** Register an agent. Later registration of the same id wins, so a test or a
 * plugin can override a built-in without editing it. */
export function defineAgent(def: AgentDefinition): AgentDefinition {
  REGISTRY.set(def.id, def);
  return def;
}

export function getAgent(id: string): AgentDefinition | undefined {
  return REGISTRY.get(id);
}

export function listAgents(): AgentDefinition[] {
  return [...REGISTRY.values()];
}

/** Agents subscribed to a given event type. */
export function agentsFor(eventType: string): AgentDefinition[] {
  return listAgents().filter((a) => a.subscriptions?.includes(eventType));
}

/** Agents whose scheduled cadence matches, for the heartbeat to consider. */
export function scheduledAgents(cadence: Cadence): AgentDefinition[] {
  return listAgents().filter((a) => a.schedule === cadence && typeof a.run === "function");
}

/** Convenience the heartbeat uses: who should wake for this batch of events. */
export function reactorsFor(events: AiEvent[]): AgentDefinition[] {
  const types = new Set(events.map((e) => e.type));
  return listAgents().filter(
    (a) => typeof a.run === "function" && a.subscriptions?.some((s) => types.has(s)),
  );
}
