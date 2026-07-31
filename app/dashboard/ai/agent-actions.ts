"use server";

/**
 * The server side of the Jarvis agent: the only place tools actually run.
 *
 * lib/jarvis/agent.ts is pure transport — it knows how to talk to the model but
 * has no database access. Everything privileged happens here:
 *
 *   • the user is re-authenticated server-side on every call
 *   • the requested trust level is checked against each tool's own requirement
 *   • queries run through the user's Supabase client, so RLS is the real
 *     boundary even if a tool were somehow tricked into asking for someone
 *     else's rows
 *   • every call is written to jarvis_actions, successful or not
 *
 * That last point matters most. An assistant permitted to write to your
 * calendar, your goals and your kitchen has to leave a trail of what it did.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/translations";
import type { PermissionLevel } from "@/lib/jarvis/types";
import { runAgent, isAgentConfigured, type ImageInput, type ToolOutcome } from "@/lib/jarvis/agent";
import { toolsFor, findTool, type AgentId } from "@/lib/jarvis/tools";
import { route, briefFor, labelFor, CORE_BRIEF } from "@/lib/jarvis/agents";
import { recall } from "@/lib/ai-core/memory";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** A screen change Jarvis asked for, handed back for the client to perform. */
export type UiDirective = { module: string; view?: string; focus?: string };

export type JarvisReply = {
  answer: string | null;
  agent: AgentId;
  agentLabel: string;
  /** Tool names actually run, for the transcript. */
  used: string[];
  directive: UiDirective | null;
  stop: "done" | "step_limit" | "error" | "not_configured" | "denied";
};

/* ------------------------------------------------------------- data reads */

/** Which table backs each dataset name, and which column to date-filter on. */
const DATASETS: Record<string, { table: string; dateCol?: string; nameCol?: string; select?: string }> = {
  transactions: {
    table: "transactions",
    dateCol: "occurred_at",
    nameCol: "description",
    // Category lives in budget_categories, so embed its name rather than
    // returning a bare uuid the model can do nothing with.
    select: "*, budget_categories(name)",
  },
  accounts: { table: "accounts", nameCol: "name" },
  calendar_events: { table: "calendar_events", dateCol: "start_at", nameCol: "title" },
  shifts: { table: "shifts", dateCol: "start_at" },
  kitchen_items: { table: "kitchen_items", dateCol: "expires_at", nameCol: "name" },
  shopping_list: { table: "shopping_list_items", nameCol: "name" },
  recipes: { table: "recipes", nameCol: "name" },
  goals: { table: "goals", nameCol: "title" },
  habits: { table: "habits", nameCol: "name" },
  projects: { table: "projects", nameCol: "name" },
  nutrition: { table: "nutrition_entries", dateCol: "logged_at", nameCol: "description" },
  documents: { table: "documents", nameCol: "title" },
  vehicles: { table: "garage_vehicles", nameCol: "model" },
  organizations: { table: "organizations", nameCol: "name" },
  life_areas: { table: "life_areas", nameCol: "name" },
  store_prices: { table: "store_prices", nameCol: "item_name" },
};

type Args = Record<string, unknown>;
const s = (a: Args, k: string): string | null => (typeof a[k] === "string" && a[k] ? (a[k] as string) : null);
const n = (a: Args, k: string): number | null => (Number.isFinite(Number(a[k])) ? Number(a[k]) : null);

async function readDataset(supabase: SupabaseClient, args: Args): Promise<ToolOutcome> {
  const name = s(args, "dataset") ?? "";
  const spec = DATASETS[name];
  if (!spec) {
    return { ok: false, content: `Unknown dataset "${name}". Valid: ${Object.keys(DATASETS).join(", ")}.` };
  }

  let q = supabase.from(spec.table).select(spec.select ?? "*").limit(Math.min(200, n(args, "limit") ?? 50));
  const since = s(args, "since");
  const until = s(args, "until");
  const search = s(args, "search");
  if (spec.dateCol && since) q = q.gte(spec.dateCol, since);
  if (spec.dateCol && until) q = q.lte(spec.dateCol, until);
  if (spec.nameCol && search) q = q.ilike(spec.nameCol, `%${search}%`);
  if (spec.dateCol) q = q.order(spec.dateCol, { ascending: false, nullsFirst: false });

  const { data, error } = await q;
  if (error) return { ok: false, content: `Query failed: ${error.message}` };
  if (!data?.length) return { ok: true, content: `No ${name} records match.` };
  return { ok: true, content: JSON.stringify(data) };
}

async function summarizeSpending(supabase: SupabaseClient, args: Args): Promise<ToolOutcome> {
  const months = Math.min(24, Math.max(1, n(args, "months") ?? 3));
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, occurred_at, direction, budget_categories(name)")
    .gte("occurred_at", from.toISOString())
    .limit(2000);
  if (error) return { ok: false, content: `Query failed: ${error.message}` };
  if (!data?.length) return { ok: true, content: "No transactions in that period." };

  const rows = data as unknown as {
    amount: number;
    occurred_at: string;
    direction: string | null;
    budget_categories: { name: string } | { name: string }[] | null;
  }[];
  const byCategory = new Map<string, number>();
  const byMonth = new Map<string, { in: number; out: number }>();

  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    // `direction` is the authoritative signal; sign of amount is the fallback.
    const income = r.direction ? r.direction === "income" : amt > 0;
    const embedded = Array.isArray(r.budget_categories) ? r.budget_categories[0] : r.budget_categories;
    const cat = embedded?.name ?? "uncategorised";
    if (!income) byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(amt));
    const m = r.occurred_at.slice(0, 7);
    const bucket = byMonth.get(m) ?? { in: 0, out: 0 };
    if (income) bucket.in += Math.abs(amt);
    else bucket.out += Math.abs(amt);
    byMonth.set(m, bucket);
  }

  const group = s(args, "group_by") ?? "both";
  const out: Record<string, unknown> = { months, transactions: rows.length };
  if (group !== "month") {
    out.by_category = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({ category, total: Math.round(total) }));
  }
  if (group !== "category") {
    out.by_month = [...byMonth.entries()]
      .sort()
      .map(([month, v]) => ({ month, income: Math.round(v.in), spent: Math.round(v.out), net: Math.round(v.in - v.out) }));
  }
  return { ok: true, content: JSON.stringify(out) };
}

/* ---------------------------------------------------------------- memory */

async function recallMemory(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const about = s(args, "about") ?? "";
  const limit = Math.min(40, n(args, "limit") ?? 12);

  // Semantic-first recall with a trigram/importance fallback — one definition
  // in lib/ai-core/memory, shared with any future agent. Falls back cleanly
  // when no embeddings provider is configured.
  const facts = await recall(supabase, userId, about, limit);
  if (!facts.length) return { ok: true, content: "Nothing remembered about that yet." };

  // Mark what was actually referenced, so recall can rank by usefulness later.
  void supabase
    .from("ai_memory")
    .update({ last_used_at: new Date().toISOString() })
    .in("id", facts.map((f) => f.id))
    .then(() => undefined);

  return {
    ok: true,
    content: JSON.stringify(facts.map((f) => ({ key: f.key, fact: f.content, importance: f.importance }))),
  };
}

async function remember(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const key = s(args, "key");
  const content = s(args, "content");
  if (!key || !content) return { ok: false, content: "Both key and content are required." };
  const importance = Math.min(5, Math.max(1, n(args, "importance") ?? 3));

  const { error } = await supabase
    .from("ai_memory")
    .upsert(
      { user_id: userId, key, content, importance, memory_type: "fact", source: "jarvis" },
      { onConflict: "user_id,key" },
    );
  if (error) return { ok: false, content: `Could not save: ${error.message}` };
  revalidatePath("/dashboard/ai");
  return { ok: true, content: `Remembered under "${key}".` };
}

/* ----------------------------------------------------------- web research */

/**
 * Web lookup with the keyless providers already proven in this codebase.
 *
 * Honest limitation: DuckDuckGo's Instant Answer API and Wikipedia are good for
 * facts and definitions and useless for "compare these five products". Set
 * BRAVE_SEARCH_API_KEY (free tier available) and this becomes genuine search
 * with no other code change — the branch below is already wired for it.
 */
async function webSearch(args: Args): Promise<ToolOutcome> {
  const query = s(args, "query");
  if (!query) return { ok: false, content: "A query is required." };

  const get = async (url: string, headers?: Record<string, string>) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "LifeOS-Jarvis/1.0", Accept: "application/json", ...headers },
        cache: "no-store",
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Real search, when a key is present.
  if (process.env.BRAVE_SEARCH_API_KEY) {
    const brave = (await get(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`, {
      "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
    })) as { web?: { results?: { title?: string; url?: string; description?: string }[] } } | null;
    const hits = brave?.web?.results ?? [];
    if (hits.length) {
      return {
        ok: true,
        content: JSON.stringify(
          hits.map((h) => ({ title: h.title, url: h.url, snippet: h.description })),
        ),
      };
    }
  }

  const found: { source: string; text: string; url?: string }[] = [];

  const ddg = (await get(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
  )) as { Answer?: string; AbstractText?: string; Definition?: string; AbstractURL?: string } | null;
  const snippet = (ddg?.Answer || ddg?.AbstractText || ddg?.Definition || "").trim();
  if (snippet) found.push({ source: "DuckDuckGo", text: snippet.slice(0, 900), url: ddg?.AbstractURL });

  const search = (await get(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=2&origin=*`,
  )) as { query?: { search?: { title?: string }[] } } | null;
  for (const hit of search?.query?.search?.slice(0, 2) ?? []) {
    if (!hit.title) continue;
    const page = (await get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
    )) as { extract?: string; type?: string; content_urls?: { desktop?: { page?: string } } } | null;
    if (page?.extract && page.type !== "disambiguation") {
      found.push({
        source: `Wikipedia: ${hit.title}`,
        text: page.extract.slice(0, 900),
        url: page.content_urls?.desktop?.page,
      });
    }
  }

  if (!found.length) {
    return {
      ok: true,
      content:
        "No usable result. These keyless sources only cover encyclopedic facts — say plainly that you could not verify this online rather than guessing.",
    };
  }
  return { ok: true, content: JSON.stringify(found) };
}

/* ---------------------------------------------------------------- writes */

async function addShoppingItems(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const raw = Array.isArray(args.items) ? args.items : [];
  const names = raw.map((x) => String(x).trim()).filter(Boolean);
  if (!names.length) return { ok: false, content: "No items given." };

  const { data: existing } = await supabase.from("shopping_list_items").select("name").eq("checked", false);
  const already = new Set(((existing as { name: string }[]) ?? []).map((i) => i.name.trim().toLowerCase()));
  const fresh = names.filter((x) => !already.has(x.toLowerCase()));
  if (!fresh.length) return { ok: true, content: "All of those were already on the list." };

  const { error } = await supabase
    .from("shopping_list_items")
    .insert(fresh.map((name) => ({ user_id: userId, name, category: s(args, "category") })));
  if (error) return { ok: false, content: `Could not add: ${error.message}` };
  revalidatePath("/dashboard/kitchen");
  return { ok: true, content: `Added: ${fresh.join(", ")}.` };
}

async function createCalendarEvent(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const title = s(args, "title");
  const start = s(args, "start_at");
  const end = s(args, "end_at");
  if (!title || !start || !end) return { ok: false, content: "title, start_at and end_at are required." };

  const { error } = await supabase.from("calendar_events").insert({
    user_id: userId,
    title,
    description: s(args, "description"),
    location: s(args, "location"),
    start_at: start,
    end_at: end,
    all_day: args.all_day === true,
    recurrence_rule: s(args, "recurrence_rule"),
    source: "manual",
  });
  if (error) return { ok: false, content: `Could not create: ${error.message}` };
  revalidatePath("/dashboard/calendar");
  return { ok: true, content: `Created "${title}". It will sync to Google on the next pass.` };
}

async function createGoal(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const title = s(args, "title");
  if (!title) return { ok: false, content: "A title is required." };
  const { error } = await supabase.from("goals").insert({
    user_id: userId,
    title,
    description: s(args, "description"),
    target_date: s(args, "target_date"),
    category: s(args, "category"),
  });
  if (error) return { ok: false, content: `Could not create: ${error.message}` };
  revalidatePath("/dashboard/goals");
  return { ok: true, content: `Goal "${title}" created.` };
}

async function addKitchenItem(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const name = s(args, "name");
  const location = s(args, "location");
  if (!name || !location || !["fridge", "freezer", "pantry"].includes(location)) {
    return { ok: false, content: "name and a location of fridge, freezer or pantry are required." };
  }
  const { error } = await supabase.from("kitchen_items").insert({
    user_id: userId,
    name,
    location,
    quantity: s(args, "quantity"),
    category: s(args, "category"),
    expires_at: s(args, "expires_at"),
  });
  if (error) return { ok: false, content: `Could not add: ${error.message}` };
  revalidatePath("/dashboard/kitchen");
  return { ok: true, content: `Added ${name} to the ${location}.` };
}

async function logNutrition(supabase: SupabaseClient, userId: string, args: Args): Promise<ToolOutcome> {
  const meal = s(args, "meal");
  const description = s(args, "description");
  if (!meal || !description) return { ok: false, content: "meal and description are required." };
  const { error } = await supabase.from("nutrition_entries").insert({
    user_id: userId,
    meal,
    description,
    calories: n(args, "calories"),
    protein_g: n(args, "protein_g"),
  });
  if (error) return { ok: false, content: `Could not log: ${error.message}` };
  revalidatePath("/dashboard/nutrition");
  return { ok: true, content: `Logged ${meal}: ${description}.` };
}

/* ------------------------------------------------------------ entry point */

/**
 * Ask Jarvis something, and let it act.
 *
 * @param level  The caller's current trust tier from the permission engine.
 *               Tools above it are withheld from the model entirely, so it
 *               never proposes an action it is not allowed to take.
 */
export async function askJarvis(
  message: string,
  {
    level = 1,
    locale = "en",
    images,
    agent: forcedAgent,
  }: { level?: PermissionLevel; locale?: Locale; images?: ImageInput[]; agent?: AgentId } = {},
): Promise<JarvisReply> {
  const chosen: AgentId = forcedAgent ?? route(message);
  const base: JarvisReply = {
    answer: null,
    agent: chosen,
    agentLabel: labelFor(chosen),
    used: [],
    directive: null,
    stop: "done",
  };

  if (!isAgentConfigured()) return { ...base, stop: "not_configured" };
  if (!message.trim()) return { ...base, stop: "denied" };

  const { supabase, user } = await requireUser();

  /* Grounding: who they are, what we remember, what day it is. Loaded up front
     rather than left to a tool call, because a persona that has to look up the
     user's name before it can greet them does not feel like an assistant. */
  const [{ data: profile }, { data: topFacts }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("display_name, preferred_currency").eq("id", user.id).maybeSingle(),
    supabase.from("ai_memory").select("key, content").order("importance", { ascending: false }).limit(14),
    supabase.from("jarvis_messages").select("role, content").order("created_at", { ascending: false }).limit(10),
  ]);

  const facts = ((topFacts as { key: string | null; content: string }[]) ?? [])
    .map((f) => `- ${f.content}`)
    .join("\n");
  const history = (((recent as { role: "user" | "assistant"; content: string }[]) ?? []).reverse());

  const system = [
    "You are Jarvis, the AI core of LifeOS — a personal operating system for one person's whole life.",
    briefFor(chosen) || CORE_BRIEF,
    "",
    "How you work:",
    "- You have tools. Use them. Never guess at something you could look up, and never claim you cannot see the user's data — you can, via query_life_data.",
    "- Call recall_memory before answering anything personal.",
    "- When you act (create, add, log), do it and then say plainly what you did.",
    "- Cite the source for anything you found online.",
    "- Be direct and brief. This is often read aloud, so avoid lists of more than four items, markdown tables, and long preambles.",
    "- If you genuinely cannot do something, say so in one sentence and offer the nearest thing you can do.",
    "",
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    `The user is ${profile?.display_name || "Bence"}. Currency: ${profile?.preferred_currency || "HUF"}. Reply in ${locale === "hu" ? "Hungarian" : "English"}.`,
    facts ? `\nWhat you already know about them:\n${facts}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let directive: UiDirective | null = null;
  const logs: { tool: string; input: unknown; ok: boolean; result: string; required: number }[] = [];

  /** Execute one tool, gating on its declared trust level. */
  const execute = async (name: string, input: unknown): Promise<ToolOutcome> => {
    const tool = findTool(name);
    if (!tool) {
      return { ok: false, content: `No such tool "${name}".` };
    }
    if (tool.level > level) {
      const outcome = {
        ok: false,
        content: `Blocked: "${name}" needs permission level ${tool.level} and this session is level ${level}. Tell the user what you wanted to do and that they can unlock it by saying "I allow it".`,
      };
      logs.push({ tool: name, input, ok: false, result: outcome.content, required: tool.level });
      return outcome;
    }

    const args = (input ?? {}) as Args;
    let outcome: ToolOutcome;
    switch (name) {
      case "query_life_data":
        outcome = await readDataset(supabase, args);
        break;
      case "summarize_spending":
        outcome = await summarizeSpending(supabase, args);
        break;
      case "recall_memory":
        outcome = await recallMemory(supabase, user.id, args);
        break;
      case "web_search":
        outcome = await webSearch(args);
        break;
      case "remember":
        outcome = await remember(supabase, user.id, args);
        break;
      case "add_shopping_items":
        outcome = await addShoppingItems(supabase, user.id, args);
        break;
      case "create_calendar_event":
        outcome = await createCalendarEvent(supabase, user.id, args);
        break;
      case "create_goal":
        outcome = await createGoal(supabase, user.id, args);
        break;
      case "add_kitchen_item":
        outcome = await addKitchenItem(supabase, user.id, args);
        break;
      case "log_nutrition":
        outcome = await logNutrition(supabase, user.id, args);
        break;
      case "navigate": {
        const module = s(args, "module");
        if (!module) {
          outcome = { ok: false, content: "A module is required." };
          break;
        }
        // The server cannot move the user's screen; hand the intent back and let
        // the client route. Last one wins if several are requested.
        directive = { module, view: s(args, "view") ?? undefined, focus: s(args, "focus") ?? undefined };
        outcome = { ok: true, content: `Opening ${module}${directive.view ? ` (${directive.view})` : ""}.` };
        break;
      }
      default:
        outcome = { ok: false, content: `"${name}" is registered but not implemented.` };
    }

    logs.push({ tool: name, input, ok: outcome.ok, result: outcome.content.slice(0, 2000), required: tool.level });
    return outcome;
  };

  const run = await runAgent({
    system,
    history,
    message,
    tools: toolsFor(chosen, level),
    execute,
    images,
  });

  /* Persist: the audit trail, then the conversation turn. Both are best-effort —
     a logging failure must not swallow an answer the user is waiting on. */
  if (logs.length) {
    await supabase
      .from("jarvis_actions")
      .insert(
        logs.map((l) => ({
          user_id: user.id,
          tool: l.tool,
          input: l.input as object,
          result: l.result,
          ok: l.ok,
          required_level: l.required,
          agent: chosen,
        })),
      )
      .then(({ error }) => {
        if (error) console.error("jarvis_actions insert failed", error.message);
      });
  }
  if (run.answer) {
    await supabase
      .from("jarvis_messages")
      .insert([
        { user_id: user.id, role: "user", content: message, agent: chosen },
        { user_id: user.id, role: "assistant", content: run.answer, agent: chosen },
      ])
      .then(({ error }) => {
        if (error) console.error("jarvis_messages insert failed", error.message);
      });
  }

  return {
    ...base,
    answer: run.answer,
    used: run.steps.map((st) => st.tool),
    directive,
    stop: run.stop,
  };
}

/** Recent tool calls, for an activity log in the UI. */
export async function recentJarvisActions(limit = 30) {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("jarvis_actions")
    .select("id, tool, ok, result, agent, required_level, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, limit));
  return data ?? [];
}

/** Wipe conversation history (memory facts are kept — those are deliberate). */
export async function clearJarvisConversation() {
  const { supabase } = await requireUser();
  await supabase.from("jarvis_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  revalidatePath("/dashboard/jarvis");
}
