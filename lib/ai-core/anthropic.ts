/**
 * The single Anthropic client — the one place LifeOS talks to the model.
 *
 * Before this, the exact same fetch-to-the-Messages-API lived three times: the
 * agent loop's main call and its step-limit fallback in lib/jarvis/agent.ts,
 * and the one-shot completion in lib/jarvis/llm.ts. Each carried its own copy
 * of the URL, the model id, the headers and the error handling — so changing
 * the model, or adding a timeout, meant editing three places and hoping they
 * stayed in sync. They already disagreed in spirit (one had no timeout at all).
 *
 * Everything routes through here now. There is exactly one model constant, one
 * set of headers, one timeout, and one retry policy. This module never throws:
 * a model hiccup returns null so every caller can fall back to its
 * deterministic path rather than surfacing a 500 to someone mid-sentence.
 *
 * This is the first primitive of lib/ai-core — the kernel the AI Core proposal
 * builds on. Adding streaming, prompt caching, or token accounting later
 * happens here, once, for every agent at the same time.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** The model the whole assistant runs on. Change it here, nowhere else. */
export const ANTHROPIC_MODEL = "claude-sonnet-5";

/** No key means no intelligence — every caller checks this and degrades. */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** A message in the Anthropic wire format. `content` is a string or an array
 * of content blocks; callers own the exact block shape they send and receive. */
export type AnthropicMessage = { role: "user" | "assistant"; content: unknown };

export type AnthropicTool = { name: string; description: string; input_schema: unknown };

export type MessagesRequest = {
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  /** Response token ceiling. Default 1024. */
  maxTokens?: number;
  /** Per-call timeout in ms. Default 30s — a hung request must not hang a
   * server action forever. */
  timeoutMs?: number;
};

/** The raw response. `content` is left untyped so each caller can narrow it to
 * its own block union (the agent loop wants tool_use blocks; askText wants
 * text) without this module knowing about either. */
export type MessagesResponse = {
  content?: unknown[];
  stop_reason?: string;
};

/**
 * Call the Messages API. Returns the parsed response, or null on any failure —
 * missing key, timeout, network error, non-2xx. Never throws.
 *
 * One retry is made on a transient failure (network error, 429, or 5xx),
 * because those are usually momentary and a single retry turns most of them
 * into a normal answer; anything else (a 400 from a malformed request) is
 * returned as null immediately rather than hammered.
 */
export async function callMessages(req: MessagesRequest): Promise<MessagesResponse | null> {
  if (!isAnthropicConfigured()) return null;

  const body = JSON.stringify({
    model: ANTHROPIC_MODEL,
    max_tokens: req.maxTokens ?? 1024,
    ...(req.system ? { system: req.system } : {}),
    ...(req.tools ? { tools: req.tools } : {}),
    messages: req.messages,
  });

  const attempt = async (): Promise<Response | null> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 30_000);
    try {
      return await fetch(API_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body,
      });
    } catch (err) {
      console.error("Anthropic call failed", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await attempt();
  if (!res || res.status === 429 || res.status >= 500) {
    if (res) console.warn(`Anthropic transient ${res.status} — retrying once`);
    await new Promise((r) => setTimeout(r, 600));
    res = await attempt();
  }

  if (!res) return null;
  if (!res.ok) {
    console.error("Anthropic API error", res.status, await res.text().catch(() => ""));
    return null;
  }
  return (await res.json()) as MessagesResponse;
}

/** Pull the concatenated text out of a response, or null if there is none. */
export function textOf(res: MessagesResponse | null): string | null {
  const text = (res?.content as { type: string; text?: string }[] | undefined)
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  return text || null;
}

/**
 * One-shot text completion: a system prompt and a single user message in, the
 * model's text out. The open-ended "chat" path uses this; the agentic loop
 * uses callMessages directly because it needs tools and multi-turn.
 */
export async function askText(system: string, userMessage: string, maxTokens = 400): Promise<string | null> {
  const res = await callMessages({
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens,
    timeoutMs: 20_000,
  });
  return textOf(res);
}
