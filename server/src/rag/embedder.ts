// ═══════════════════════════════════════════════════════════════
// Embedder — Generate vector embeddings for RAG
//
// Uses Google text-embedding-004 (free via Gemini API key) as
// primary, with Groq embedding fallback.
// ═══════════════════════════════════════════════════════════════

import { VECTOR_DIM } from "./collections.js";

// ── Embedding cache (in-memory, per-process) ─────────────────
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 500;

/** Generate embedding for a single text string */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length < 5) {
        return new Array(VECTOR_DIM).fill(0);
    }

    // Check cache
    const cacheKey = text.substring(0, 200).toLowerCase().trim();
    const cached = embeddingCache.get(cacheKey);
    if (cached) return cached;

    // Truncate to ~8000 chars to stay within model limits
    const truncated = text.substring(0, 8000);

    // Try Google text-embedding-004
    try {
        const embedding = await embedViaGoogle(truncated);
        if (embedding && embedding.length === VECTOR_DIM) {
            cacheEmbedding(cacheKey, embedding);
            return embedding;
        }
    } catch (err: any) {
        console.warn("[Embedder] Google embedding failed:", err.message);
    }

    // Fallback: generate a deterministic pseudo-embedding from text hash
    // This is a last-resort so the pipeline doesn't break
    console.warn("[Embedder] All providers failed — using hash-based fallback");
    const fallback = hashEmbedding(truncated);
    cacheEmbedding(cacheKey, fallback);
    return fallback;
}

/** Generate embeddings for multiple texts (batched) */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(t => generateEmbedding(t))
        );
        results.push(...batchResults);
    }

    return results;
}

// ── Google text-embedding-004 ─────────────────────────────────
async function embedViaGoogle(text: string): Promise<number[] | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "models/text-embedding-004",
                content: { parts: [{ text }] },
            }),
            signal: AbortSignal.timeout(15000),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Google Embedding ${res.status}: ${err.error?.message || "unknown"}`);
    }

    const data = await res.json();
    return data?.embedding?.values || null;
}

// ── Hash-based fallback (deterministic, low quality) ──────────
function hashEmbedding(text: string): number[] {
    const embedding = new Array(VECTOR_DIM).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        for (let j = 0; j < word.length; j++) {
            const idx = (word.charCodeAt(j) * 31 + i * 7 + j) % VECTOR_DIM;
            embedding[idx] += 1.0 / words.length;
        }
    }

    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (norm > 0) {
        for (let i = 0; i < VECTOR_DIM; i++) {
            embedding[i] /= norm;
        }
    }

    return embedding;
}

// ── Cache management ──────────────────────────────────────────
function cacheEmbedding(key: string, embedding: number[]): void {
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest entries
        const keys = [...embeddingCache.keys()];
        for (let i = 0; i < 50 && i < keys.length; i++) {
            embeddingCache.delete(keys[i]);
        }
    }
    embeddingCache.set(key, embedding);
}
