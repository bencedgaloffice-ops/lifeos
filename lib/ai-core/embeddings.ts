/**
 * Text embeddings — the one piece of the AI Core that needs a provider LifeOS
 * doesn't already have. Anthropic has no embeddings API, so semantic memory
 * uses Voyage AI (Anthropic's recommended embeddings partner), reached the same
 * keyless-optional way as Brave search: gated behind an env var, and the whole
 * feature degrades gracefully to trigram recall when the key is absent.
 *
 * voyage-3.5-lite returns 1024-dimensional vectors, matching the ai_memory
 * column. Never throws — a failed embed returns null and the caller falls back.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export const EMBED_MODEL = "voyage-3.5-lite";
export const EMBED_DIMS = 1024;

export function isEmbeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

async function call(inputs: string[], inputType: "document" | "query"): Promise<number[][] | null> {
  if (!isEmbeddingsConfigured() || !inputs.length) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY!}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ input: inputs, model: EMBED_MODEL, input_type: inputType }),
    });
    if (!res.ok) {
      console.error("Voyage embeddings error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    const out = data.data?.map((d) => d.embedding);
    return out && out.length === inputs.length ? out : null;
  } catch (err) {
    console.error("Voyage embeddings call failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Embed one query string (asymmetric input_type for retrieval). */
export async function embedQuery(text: string): Promise<number[] | null> {
  const r = await call([text], "query");
  return r?.[0] ?? null;
}

/** Embed a batch of documents for storage. Returns null on any failure. */
export async function embedDocuments(texts: string[]): Promise<number[][] | null> {
  return call(texts, "document");
}
