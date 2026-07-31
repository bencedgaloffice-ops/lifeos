/**
 * Registration point for every AI Core agent.
 *
 * Importing this module executes each agent's defineAgent() call as a side
 * effect, putting it in the registry. The heartbeat cron imports this once, so
 * "add an agent" never means "edit the cron" — it means "add a file here and
 * re-export it below".
 *
 * Phase 2 ships this empty: the mechanism (event log, heartbeat, dispatch) is
 * in place and verified with zero agents to dispatch to. The six specialist
 * personas register here in Phase 3, and the Executive agent in Phase 4.
 */

export {};
