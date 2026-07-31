/**
 * The open-ended "chat" completion path for Jarvis.
 *
 * The command engine (lib/jarvis/commands.ts) stays a fast, deterministic
 * rule-based parser on purpose — voice commands that write data (add to
 * shopping list, create a goal) must be exact and instant, not routed through
 * a model call. This module is for the other case: the open-ended read/chat
 * question where genuine understanding matters more than speed. askCompanion
 * falls back to it when a question matches none of the rule-based keyword
 * buckets. Without ANTHROPIC_API_KEY every caller keeps working exactly as it
 * did before (pure rule-based), just without the deeper reasoning.
 *
 * As of the AI Core consolidation this is a thin shim: the HTTP call, the model
 * id, the timeout and the retry policy now live once in lib/ai-core/anthropic.
 * The exports here are kept stable because five call sites import
 * { askClaude, isAnthropicConfigured } from this path — the shim is what lets
 * that stay true while the plumbing moves to one place.
 */

import { askText } from "@/lib/ai-core/anthropic";

export { isAnthropicConfigured } from "@/lib/ai-core/anthropic";

/**
 * Call Claude with a system prompt (Jarvis's persona + real grounded data) and
 * a single user message. Returns null on any failure so callers can fall back
 * to the rule-based engine — a model hiccup should never break the companion,
 * just make it momentarily less clever.
 */
export async function askClaude(system: string, userMessage: string, maxTokens = 400): Promise<string | null> {
  return askText(system, userMessage, maxTokens);
}
