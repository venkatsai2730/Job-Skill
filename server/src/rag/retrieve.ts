// ═══════════════════════════════════════════════════════════════
// Retrieve — Semantic search facade for all Qdrant collections
//
// Each function performs cosine-similarity search and returns
// matching documents with scores. Returns empty arrays when
// USE_QDRANT_RAG is false.
// ═══════════════════════════════════════════════════════════════

import { USE_QDRANT_RAG } from "../config/featureFlags.js";
import { getQdrantClient } from "./qdrantClient.js";
import { COLLECTIONS } from "./collections.js";
import { generateEmbedding } from "./embedder.js";

// ── Types ─────────────────────────────────────────────────────
export interface RetrievalResult {
    id: string;
    score: number;
    text: string;
    metadata: Record<string, any>;
}

// ═══════════════════════════════════════════════════════════════
// Retrieval Functions
// ═══════════════════════════════════════════════════════════════

/** Find semantically similar job descriptions */
export async function retrieveSimilarJobs(
    queryText: string,
    topK: number = 10,
    filters?: { location?: string; skills?: string[] }
): Promise<RetrievalResult[]> {
    return searchCollection(COLLECTIONS.JOB_DESCRIPTIONS, queryText, topK, buildJobFilter(filters));
}

/** Find similar resume chunks (e.g., for peer comparison) */
export async function retrieveResumeChunks(
    queryText: string,
    topK: number = 5,
    userId?: string
): Promise<RetrievalResult[]> {
    const filter = userId
        ? { must_not: [{ key: "user_id", match: { value: userId } }] }
        : undefined;
    return searchCollection(COLLECTIONS.RESUMES_CHUNKS, queryText, topK, filter);
}

/** Retrieve relevant career memories for a user */
export async function retrieveCareerMemory(
    queryText: string,
    userId: string,
    topK: number = 10
): Promise<RetrievalResult[]> {
    const filter = {
        must: [{ key: "user_id", match: { value: userId } }],
    };
    return searchCollection(COLLECTIONS.CAREER_MEMORY, queryText, topK, filter);
}

/** Retrieve company insights */
export async function retrieveCompanyInsights(
    companyName: string,
    topK: number = 5
): Promise<RetrievalResult[]> {
    return searchCollection(COLLECTIONS.COMPANY_INSIGHTS, companyName, topK);
}

/** Retrieve similar skills from taxonomy */
export async function retrieveRelatedSkills(
    skillQuery: string,
    topK: number = 10
): Promise<RetrievalResult[]> {
    return searchCollection(COLLECTIONS.SKILL_TAXONOMY, skillQuery, topK);
}

// ═══════════════════════════════════════════════════════════════
// Generic search implementation
// ═══════════════════════════════════════════════════════════════
async function searchCollection(
    collection: string,
    queryText: string,
    topK: number,
    filter?: any
): Promise<RetrievalResult[]> {
    if (!USE_QDRANT_RAG) return [];

    const client = getQdrantClient();
    if (!client) return [];

    try {
        const startTime = Date.now();

        // Generate query embedding
        const queryVector = await generateEmbedding(queryText);

        // Search Qdrant
        const searchParams: any = {
            vector: queryVector,
            limit: topK,
            with_payload: true,
            score_threshold: 0.3, // Minimum relevance threshold
        };

        if (filter) {
            searchParams.filter = filter;
        }

        const results = await client.search(collection, searchParams);

        const elapsed = Date.now() - startTime;
        console.log(`[RAG-Retrieve] ${collection}: ${results.length} hits in ${elapsed}ms`);

        return (results || []).map((r: any) => ({
            id: r.id,
            score: r.score,
            text: r.payload?.text || "",
            metadata: r.payload || {},
        }));
    } catch (err: any) {
        // Don't log collection-not-found as an error
        if (err.message?.includes("not found")) {
            return [];
        }
        console.warn(`[RAG-Retrieve] ${collection} search failed:`, err.message);
        return [];
    }
}

// ── Filter builders ───────────────────────────────────────────
function buildJobFilter(filters?: { location?: string; skills?: string[] }): any | undefined {
    if (!filters) return undefined;

    const must: any[] = [];

    if (filters.location) {
        must.push({
            key: "location",
            match: { text: filters.location },
        });
    }

    // Note: Qdrant array matching needs special handling
    // For skills, we'll rely on the semantic similarity of the query
    // rather than filtering, since skill synonyms are common.

    return must.length > 0 ? { must } : undefined;
}
