import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainEvents, markProcessed } from "@/lib/ai-core/events";
import { reactorsFor, scheduledAgents } from "@/lib/ai-core/registry";
import { runAgentJob, dueCadences } from "@/lib/ai-core/dispatch";
import { backfillEmbeddings } from "@/lib/ai-core/memory";
import "@/lib/ai-core/agents"; // side effect: register every agent

export const maxDuration = 60;

/**
 * The AI Core heartbeat.
 *
 * This is the kernel's clock and its event drain in one scheduled pass. On each
 * fire it:
 *   1. drains every user's unprocessed ai_events and dispatches them to the
 *      agents subscribed to those event types, then marks them processed;
 *   2. runs the scheduled agents whose cadence is due today (see dueCadences).
 *
 * It runs under the service-role client because a cron has no request session,
 * so it passes user_id explicitly to every kernel call — the same shape the
 * google-sync cron already uses.
 *
 * Cadence is deliberately set by vercel.json, not here. Ships daily (Hobby-safe,
 * two crons total); bumping to hourly is a one-line schedule change once the
 * project is on a plan that allows it — the date-based cadence gating already
 * handles either frequency correctly.
 *
 * Phase 2 note: with an empty registry this pass drains and marks events (they
 * remain as rows for the activity feed) and runs nothing. Registering agents in
 * Phase 3 lights it up with no change to this file.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const cadences = dueCadences(now);
  // The Executive curates what the specialists produced this pass, so it must
  // run after them regardless of registration or cadence order.
  const scheduled = cadences
    .flatMap((c) => scheduledAgents(c))
    .sort((a, b) => (a.id === "executive" ? 1 : 0) - (b.id === "executive" ? 1 : 0));

  // Users to consider: anyone with pending events (reactive) plus everyone with
  // a profile (scheduled). For a single-user install these collapse to one.
  const [{ data: pending }, { data: profiles }] = await Promise.all([
    supabase.from("ai_events").select("user_id").is("processed_at", null),
    supabase.from("profiles").select("id"),
  ]);

  const eventUsers = new Set(((pending as { user_id: string }[]) ?? []).map((r) => r.user_id));
  const allUsers = new Set<string>([
    ...eventUsers,
    ...((profiles as { id: string }[]) ?? []).map((p) => p.id),
  ]);

  let eventsHandled = 0;
  let recommendations = 0;

  for (const userId of allUsers) {
    // Reactive: drain this user's events and wake their subscribers.
    if (eventUsers.has(userId)) {
      const events = await drainEvents(supabase, userId);
      if (events.length) {
        for (const agent of reactorsFor(events)) {
          // Give each reacting agent the batch context; it reads current state.
          recommendations += await runAgentJob(supabase, userId, agent, "event", events[events.length - 1]);
        }
        await markProcessed(supabase, events.map((e) => e.id));
        eventsHandled += events.length;
      }
    }

    // Scheduled: run every due agent for this user.
    for (const agent of scheduled) {
      recommendations += await runAgentJob(supabase, userId, agent, "schedule");
    }
  }

  // Give embeddings to any memory rows still missing them (no-op without a
  // provider key). Global, since an embedding is a property of the text.
  const embedded = await backfillEmbeddings(supabase, 32);

  return NextResponse.json({
    users: allUsers.size,
    cadences,
    scheduledAgents: scheduled.map((a) => a.id),
    eventsHandled,
    recommendations,
    embedded,
  });
}
