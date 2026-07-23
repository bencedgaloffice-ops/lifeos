/**
 * The real intelligence behind Jarvis's conversational answers. Everything
 * else in the command engine (lib/jarvis/commands.ts) stays a fast,
 * deterministic rule-based parser on purpose — voice commands that write
 * data (add to shopping list, create a goal) need to be exact and instant,
 * not routed through a model call. This file is specifically for the
 * open-ended "read"/"chat" path, where genuine understanding matters more
 * than speed: askCompanion falls back to it when a question doesn't match
 * any of the rule-based keyword buckets, or takes it as the primary path
 * when configured. Requires ANTHROPIC_API_KEY — without it, every caller
 * keeps working exactly as it did before (pure rule-based), just without
 * the deeper reasoning.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Calls Claude with a system prompt (Jarvis's persona + real grounded data)
 * and a single user message. Returns null on any failure so callers can
 * fall back to the rule-based engine — a model hiccup should never break
 * the companion, just make it momentarily less clever. */
export async function askClaude(system: string, userMessage: string, maxTokens = 400): Promise<string | null> {
  if (!isAnthropicConfigured()) return null;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      console.error("Claude API error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((block) => block.type === "text")?.text;
    return text?.trim() || null;
  } catch (err) {
    console.error("Claude API call failed", err);
    return null;
  }
}
