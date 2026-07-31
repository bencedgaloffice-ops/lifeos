/**
 * The agentic loop — the single change that turns Jarvis into an assistant.
 *
 * Before this, lib/jarvis/llm.ts did one round trip: prompt in, text out. That
 * shape can *describe* your life but cannot look anything up or change
 * anything, which is why a long list of desired abilities (analysis, research,
 * actions, navigation, specialists) was really one missing capability, not
 * twenty.
 *
 * Here the model is given tools and allowed to keep going: it asks for data,
 * reads the result, decides what to do next, maybe writes something, and only
 * then answers. Every new ability from now on is a tool definition plus an
 * executor case — not new plumbing.
 *
 * Images are accepted on the first turn, which is what makes "what's in my
 * fridge" and "summarize this contract" work: Claude is multimodal, so vision
 * needs no separate service.
 *
 * This module is transport only. It never touches the database — it calls back
 * into an `execute` function supplied by the server action, which is where
 * authentication, permission gating and audit logging live. Keeping that split
 * means a hallucinated tool name is a rejected call, never a stray write.
 */

import { wireFormat, type JarvisTool } from "./tools";
import { callMessages, isAnthropicConfigured } from "@/lib/ai-core/anthropic";

/** Hard ceiling on tool round trips, so a confused model cannot loop forever. */
const MAX_STEPS = 8;

export type ImageInput = {
  /** Base64 payload without the data: prefix. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

/** What the executor hands back for one tool call. */
export type ToolOutcome = {
  /** Text the model sees as the tool's result. */
  content: string;
  ok: boolean;
};

export type AgentStep = { tool: string; input: unknown; ok: boolean; result: string };

export type AgentRun = {
  /** Jarvis's final spoken answer, or null if the call failed outright. */
  answer: string | null;
  /** Every tool call made, in order — the caller logs these. */
  steps: AgentStep[];
  /** Why it stopped: 'done' | 'step_limit' | 'error' | 'not_configured'. */
  stop: "done" | "step_limit" | "error" | "not_configured";
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

export function isAgentConfigured(): boolean {
  return isAnthropicConfigured();
}

/**
 * Run the loop.
 *
 * @param system   Persona + grounding facts (memory, profile, today's date).
 * @param history  Prior conversation turns, oldest first.
 * @param message  What the user just said.
 * @param tools    Only the tools this agent+trust level may use.
 * @param execute  Runs one tool. Supplied by the server action.
 * @param images   Optional attachments for the first turn.
 */
export async function runAgent({
  system,
  history,
  message,
  tools,
  execute,
  images,
  maxTokens = 1600,
}: {
  system: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  tools: JarvisTool[];
  execute: (name: string, input: unknown) => Promise<ToolOutcome>;
  images?: ImageInput[];
  maxTokens?: number;
}): Promise<AgentRun> {
  if (!isAgentConfigured()) return { answer: null, steps: [], stop: "not_configured" };

  /* First user turn: the message, plus any images ahead of it so the model has
     looked at them before it reads the instruction about them. */
  const firstTurn: ContentBlock[] = [
    ...(images ?? []).map(
      (img): ContentBlock => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    { type: "text", text: message },
  ];

  const messages: Message[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: firstTurn },
  ];

  const steps: AgentStep[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    // A tool round trip can be slow, so give it more headroom than a one-shot
    // chat call. Null back means the call failed after its retry — surface it
    // as an error stop rather than an empty answer.
    const data = await callMessages({
      system,
      messages,
      tools: wireFormat(tools),
      maxTokens,
      timeoutMs: 45_000,
    });
    if (!data) return { answer: null, steps, stop: "error" };

    const blocks = (data.content as ContentBlock[] | undefined) ?? [];
    const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");

    // No tools wanted — this is the answer.
    if (!toolUses.length) {
      const text = blocks
        .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { answer: text || null, steps, stop: "done" };
    }

    // Carry the assistant's turn forward verbatim, then answer every tool call
    // it made. The API requires one tool_result per tool_use, in one user turn.
    messages.push({ role: "assistant", content: blocks });

    const results: ContentBlock[] = [];
    for (const use of toolUses) {
      const outcome = await execute(use.name, use.input);
      steps.push({ tool: use.name, input: use.input, ok: outcome.ok, result: outcome.content });
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: outcome.content,
        ...(outcome.ok ? {} : { is_error: true }),
      });
    }
    messages.push({ role: "user", content: results });
  }

  /* Out of steps. Rather than returning nothing, ask for a plain answer with
     tools withheld — the model has the gathered data in context and can almost
     always still say something useful. */
  const data = await callMessages({
    system: `${system}\n\nYou have run out of tool calls. Answer now from what you already gathered, and say plainly if something is still missing.`,
    messages,
    maxTokens,
    timeoutMs: 30_000,
  });
  if (data) {
    const text = ((data.content as ContentBlock[] | undefined) ?? [])
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { answer: text || null, steps, stop: "step_limit" };
  }
  return { answer: null, steps, stop: "step_limit" };
}
