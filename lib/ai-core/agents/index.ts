/**
 * Registration point for every AI Core agent.
 *
 * Importing this module executes each agent's defineAgent() call as a side
 * effect, putting it in the registry. The heartbeat cron imports this once, so
 * "add an agent" means "add a file here and re-export it below" — never a change
 * to the cron.
 *
 * The six specialist personas share their id, label and brief with the chat
 * router (lib/jarvis/agents) so the assistant that answers you and the agent
 * that works for you in the background are the same character. The Executive
 * agent joins in Phase 4.
 */

export { financeAgent } from "./finance";
export { homeAgent } from "./home";
export { healthAgent } from "./health";
export { projectsAgent } from "./projects";
export { farmAgent } from "./farm";
export { marriageAgent } from "./marriage";
