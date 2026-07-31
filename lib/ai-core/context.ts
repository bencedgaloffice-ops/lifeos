/**
 * The shared grounding builder.
 *
 * Every agent that talks — chat or Executive briefing — needs the same opening
 * facts: who the user is, what we already remember about them, and what day it
 * is. That assembly lived inline in the chat server action; pulling it here
 * means one definition of "how Jarvis is grounded", so a change to the persona
 * rules or the memory budget lands everywhere at once instead of drifting
 * between the chat path and each new agent.
 *
 * The persona brief is passed in already resolved, so this module never has to
 * import the persona list — keeping the dependency arrow pointing one way
 * (agents depend on the kernel, never the reverse).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BASE_RULES = [
  "How you work:",
  "- You have tools. Use them. Never guess at something you could look up, and never claim you cannot see the user's data — you can, via query_life_data.",
  "- Call recall_memory before answering anything personal.",
  "- When you act (create, add, log), do it and then say plainly what you did.",
  "- Cite the source for anything you found online.",
  "- Be direct and brief. This is often read aloud, so avoid lists of more than four items, markdown tables, and long preambles.",
  "- If you genuinely cannot do something, say so in one sentence and offer the nearest thing you can do.",
];

export type Grounding = {
  /** The full system prompt: identity + brief + rules + facts. */
  system: string;
  /** The user's display name, for greetings and the base reply shell. */
  displayName: string;
  currency: string;
};

/**
 * Build the grounding for an agent.
 *
 * @param brief   The persona brief, already resolved (caller falls back to the
 *                core brief). Passed in so this stays independent of the
 *                persona registry.
 * @param locale  "en" | "hu" — controls the reply-language instruction only;
 *                the prompt itself stays English so the model reasons in one
 *                language and answers in the user's.
 */
export async function buildGrounding(
  supabase: SupabaseClient,
  userId: string,
  { brief, locale = "en", now = new Date() }: { brief: string; locale?: "en" | "hu"; now?: Date },
): Promise<Grounding> {
  const [{ data: profile }, { data: topFacts }] = await Promise.all([
    supabase.from("profiles").select("display_name, preferred_currency").eq("id", userId).maybeSingle(),
    supabase.from("ai_memory").select("key, content").order("importance", { ascending: false }).limit(14),
  ]);

  const displayName = (profile as { display_name?: string } | null)?.display_name || "Bence";
  const currency = (profile as { preferred_currency?: string } | null)?.preferred_currency || "HUF";

  const facts = ((topFacts as { key: string | null; content: string }[]) ?? [])
    .map((f) => `- ${f.content}`)
    .join("\n");

  const system = [
    "You are Jarvis, the AI core of LifeOS — a personal operating system for one person's whole life.",
    brief,
    "",
    ...BASE_RULES,
    "",
    `Today is ${now.toISOString().slice(0, 10)}.`,
    `The user is ${displayName}. Currency: ${currency}. Reply in ${locale === "hu" ? "Hungarian" : "English"}.`,
    facts ? `\nWhat you already know about them:\n${facts}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, displayName, currency };
}
