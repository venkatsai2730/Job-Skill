// ═══════════════════════════════════════════════════════════════
// Ingest Job — Chunk → Embed → Upsert job descriptions to Qdrant
//
// Called after storeJobs() in jobFetcher.ts. Fire-and-forget.
// No-ops when USE_QDRANT_RAG is false.
// ═══════════════════════════════════════════════════════════════

import { USE_QDRANT_RAG } from "../config/featureFlags.js";
import { getQdrantClient } from "./qdrantClient.js";
import { COLLECTIONS } from "./collections.js";
import { chunkJobDescription } from "./chunking.js";
import { generateEmbeddings } from "./embedder.js";

/** Ingest a batch of jobs into the vector DB */
export async function ingestJobs(jobs: Array<{
    id?: string;
    title: string;
    company: string;
    description?: string;
    job_url: string;
    source: string;
    location: string;
    skills?: string[];
    salary_min?: number | null;
}>): Promise<void> {
    if (!USE_QDRANT_RAG) return;

    const client = getQdrantClient();
    if (!client) return;

    try {
        const startTime = Date.now();
        let totalChunks = 0;

        // Process in batches of 20 jobs
        const JOB_BATCH = 20;
        for (let i = 0; i < jobs.length; i += JOB_BATCH) {
            const batch = jobs.slice(i, i + JOB_BATCH);

            // Chunk all jobs in this batch
            const allChunks = batch.flatMap(job => {
                const jobId = job.id || hashJobUrl(job.job_url);
                return chunkJobDescription({
                    description: job.description || "",
                    jobId,
                    title: job.title,
                    company: job.company,
                    source: job.source,
                    location: job.location,
                    skills: job.skills || [],
                    salary: job.salary_min,
                });
            });

            if (allChunks.length === 0) continue;

            // Generate embeddings
            const texts = allChunks.map(c => c.text);
            const embeddings = await generateEmbeddings(texts);

            // Build points
            const points = allChunks.map((chunk, idx) => ({
                id: generatePointId(),
                vector: embeddings[idx],
                payload: {
                    ...chunk.metadata,
                    text: chunk.text,
                    chunk_id: chunk.chunkId,
                    fetched_at: new Date().toISOString(),
                },
            }));

            // Upsert
            const UPSERT_BATCH = 100;
            for (let j = 0; j < points.length; j += UPSERT_BATCH) {
                const upsertBatch = points.slice(j, j + UPSERT_BATCH);
                await client.upsert(COLLECTIONS.JOB_DESCRIPTIONS, {
                    points: upsertBatch,
                });
            }

            totalChunks += allChunks.length;
        }

        const elapsed = Date.now() - startTime;
        console.log(`[RAG-Ingest] ${jobs.length} jobs → ${totalChunks} chunks, ${elapsed}ms`);
    } catch (err: any) {
        console.warn("[RAG-Ingest] Job ingestion failed:", err.message);
    }
}

// ── Helpers ───────────────────────────────────────────────────
function generatePointId(): string {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function hashJobUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const chr = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return `job_${Math.abs(hash).toString(36)}`;
}
