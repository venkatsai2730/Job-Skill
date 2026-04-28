// ═══════════════════════════════════════════════════════════════
// Qdrant Collections — Schema definitions + bootstrap
//
// Defines 5 collections with metadata payload schemas.
// Call ensureCollections() at server startup to auto-create.
// ═══════════════════════════════════════════════════════════════

import { getQdrantClient } from "./qdrantClient.js";
import { USE_QDRANT_RAG } from "../config/featureFlags.js";

// ── Vector dimensions (Google text-embedding-004 = 768) ───────
export const VECTOR_DIM = 768;

// ── Collection Names ──────────────────────────────────────────
export const COLLECTIONS = {
    RESUMES_CHUNKS: "resumes_chunks",
    JOB_DESCRIPTIONS: "job_descriptions",
    SKILL_TAXONOMY: "skill_taxonomy",
    CAREER_MEMORY: "career_memory",
    COMPANY_INSIGHTS: "company_insights",
} as const;

// ── Payload Schemas (for documentation; Qdrant is schema-less) ─
export interface ResumeChunkPayload {
    user_id: string;
    resume_id: string;
    chunk_id: string;
    section: string;       // "experience" | "summary" | "skills" | "projects" | "education"
    text: string;
    skills: string[];
    projects: string[];
    experience_level: string;
    ats_score: number | null;
    created_at: string;
}

export interface JobDescriptionPayload {
    job_id: string;
    title: string;
    company: string;
    source: string;
    location: string;
    seniority: string;
    required_skills: string[];
    normalized_salary: number | null;
    text: string;
    fetched_at: string;
}

export interface SkillTaxonomyPayload {
    skill_name: string;
    aliases: string[];
    category: string;
    related_roles: string[];
    related_skills: string[];
}

export interface CareerMemoryPayload {
    user_id: string;
    memory_type: string;
    key: string;
    value: string;
    confidence: number;
    last_used: string;
}

export interface CompanyInsightsPayload {
    company_name: string;
    source_url: string;
    text: string;
    topic: string;
    freshness: string;
}

// ═══════════════════════════════════════════════════════════════
// Bootstrap — Create collections if they don't exist
// ═══════════════════════════════════════════════════════════════
export async function ensureCollections(): Promise<void> {
    if (!USE_QDRANT_RAG) return;

    const client = getQdrantClient();
    if (!client) return;

    const collectionNames = Object.values(COLLECTIONS);

    try {
        const existing = await client.getCollections();
        const existingNames = new Set(
            (existing.collections || []).map((c: any) => c.name)
        );

        for (const name of collectionNames) {
            if (existingNames.has(name)) {
                console.log(`[Qdrant] Collection "${name}" already exists`);
                continue;
            }

            await client.createCollection(name, {
                vectors: {
                    size: VECTOR_DIM,
                    distance: "Cosine",
                },
                optimizers_config: {
                    default_segment_number: 2,
                },
                replication_factor: 1,
            });
            console.log(`[Qdrant] Created collection: ${name}`);
        }

        console.log(`[Qdrant] All ${collectionNames.length} collections ensured`);
    } catch (err: any) {
        console.warn("[Qdrant] ensureCollections error:", err.message);
    }
}
