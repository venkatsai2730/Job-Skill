// ═══════════════════════════════════════════════════════════════
// Ingest Resume — Parse → Chunk → Embed → Upsert to Qdrant
//
// Called after a resume is saved to Supabase. Non-blocking.
// No-ops when USE_QDRANT_RAG is false.
// ═══════════════════════════════════════════════════════════════

import { USE_QDRANT_RAG } from "../config/featureFlags.js";
import { getQdrantClient } from "./qdrantClient.js";
import { COLLECTIONS } from "./collections.js";
import { chunkResume } from "./chunking.js";
import { generateEmbeddings } from "./embedder.js";

/** Ingest a parsed resume into the vector DB */
export async function ingestResume(params: {
    userId: string;
    resumeId: string;
    resumeText: string;
    sections?: any;
    atsScore?: number | null;
}): Promise<void> {
    if (!USE_QDRANT_RAG) return;

    const client = getQdrantClient();
    if (!client) return;

    try {
        const startTime = Date.now();

        // 1. Chunk the resume
        const chunks = chunkResume({
            resumeText: params.resumeText,
            userId: params.userId,
            resumeId: params.resumeId,
            sections: params.sections,
            atsScore: params.atsScore,
        });

        if (chunks.length === 0) {
            console.warn("[RAG-Ingest] No chunks produced from resume");
            return;
        }

        // 2. Generate embeddings for all chunks
        const texts = chunks.map(c => c.text);
        const embeddings = await generateEmbeddings(texts);

        // 3. Delete old vectors for this user's resume (idempotent re-ingest)
        try {
            await client.delete(COLLECTIONS.RESUMES_CHUNKS, {
                filter: {
                    must: [
                        { key: "user_id", match: { value: params.userId } },
                    ],
                },
            });
        } catch {
            // Collection might not exist yet, ignore
        }

        // 4. Upsert vectors
        const points = chunks.map((chunk, i) => ({
            id: generatePointId(),
            vector: embeddings[i],
            payload: {
                ...chunk.metadata,
                text: chunk.text,
                chunk_id: chunk.chunkId,
                section: chunk.section,
                skills: extractSkillsFromChunk(chunk.text),
                created_at: new Date().toISOString(),
            },
        }));

        // Batch upsert (Qdrant supports up to 100 points per call)
        const BATCH_SIZE = 100;
        for (let i = 0; i < points.length; i += BATCH_SIZE) {
            const batch = points.slice(i, i + BATCH_SIZE);
            await client.upsert(COLLECTIONS.RESUMES_CHUNKS, {
                points: batch,
            });
        }

        const elapsed = Date.now() - startTime;
        console.log(`[RAG-Ingest] Resume ingested: ${chunks.length} chunks, ${elapsed}ms`);
    } catch (err: any) {
        console.warn("[RAG-Ingest] Resume ingestion failed:", err.message);
    }
}

// ── Helpers ───────────────────────────────────────────────────
function generatePointId(): string {
    // Qdrant accepts UUIDs or unsigned integers
    // Using a random hex string as UUID-like identifier
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extractSkillsFromChunk(text: string): string[] {
    const COMMON_SKILLS = [
        "javascript", "typescript", "python", "java", "react", "angular", "vue",
        "node", "express", "django", "flask", "aws", "azure", "gcp",
        "docker", "kubernetes", "git", "sql", "mongodb", "postgresql",
        "redis", "graphql", "rest", "html", "css", "linux", "golang", "rust",
        "swift", "kotlin", "flutter", "next.js", "tensorflow", "pytorch",
        "machine learning", "data science", "devops", "ci/cd", "kafka",
    ];
    const lower = text.toLowerCase();
    return COMMON_SKILLS.filter(s => lower.includes(s));
}
