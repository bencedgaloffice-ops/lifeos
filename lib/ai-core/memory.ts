/**
 * Long-term memory access, semantic where possible.
 *
 * Two entry points: backfillEmbeddings, which the heartbeat calls to give
 * embeddings to any memory rows that lack them, and recall, which finds the
 * facts most relevant to a query. recall tries nearest-neighbour search via the
 * match_ai_memory function first and falls back to the trigram/importance
 * approach when embeddings aren't configured or the query can't be embedded —
 * so it always returns something useful, just less precisely without a key.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmbeddingsConfigured, embedQuery, embedDocuments } from "./embeddings";

export type MemoryHit = { id: string; key: string | null; content: string; importance: number | null };

/**
 * Give embeddings to rows that don't have them yet. Global (embeddings are a
 * property of the text, not the user) and best-effort; the heartbeat runs it on
 * a service-role client. No-op without a provider key.
 */
export async function backfillEmbeddings(supabase: SupabaseClient, limit = 32): Promise<number> {
  if (!isEmbeddingsConfigured()) return 0;
  const { data } = await supabase
    .from("ai_memory")
    .select("id, content")
    .is("embedding", null)
    .limit(limit);
  const rows = ((data as { id: string; content: string }[]) ?? []).filter((r) => r.content?.trim());
  if (!rows.length) return 0;

  const vectors = await embedDocuments(rows.map((r) => r.content));
  if (!vectors) return 0;

  let done = 0;
  await Promise.all(
    rows.map(async (r, i) => {
      const { error } = await supabase.from("ai_memory").update({ embedding: vectors[i] }).eq("id", r.id);
      if (!error) done++;
    }),
  );
  return done;
}

/**
 * Facts relevant to `about`, semantic-first with a trigram fallback.
 * @param userId  Passed explicitly so this is correct under the service-role
 *                client too; under a user session RLS already scopes it.
 */
export async function recall(
  supabase: SupabaseClient,
  userId: string,
  about: string,
  limit = 12,
): Promise<MemoryHit[]> {
  // Semantic path.
  if (isEmbeddingsConfigured() && about.trim()) {
    const q = await embedQuery(about);
    if (q) {
      const { data, error } = await supabase.rpc("match_ai_memory", {
        query_embedding: q,
        match_user: userId,
        match_count: limit,
      });
      if (!error && (data as MemoryHit[])?.length) {
        return (data as MemoryHit[]).map((m) => ({ id: m.id, key: m.key, content: m.content, importance: m.importance }));
      }
    }
  }

  // Fallback: substring match, then top up with the most important facts so
  // recall never comes back empty just because the phrasing missed.
  const [{ data: matched }, { data: important }] = await Promise.all([
    supabase
      .from("ai_memory")
      .select("id, key, content, importance")
      .eq("user_id", userId)
      .ilike("content", `%${about}%`)
      .order("importance", { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from("ai_memory")
      .select("id, key, content, importance")
      .eq("user_id", userId)
      .order("importance", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  const seen = new Set<string>();
  const out: MemoryHit[] = [];
  for (const r of [...((matched as MemoryHit[]) ?? []), ...((important as MemoryHit[]) ?? [])]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.slice(0, limit);
}
