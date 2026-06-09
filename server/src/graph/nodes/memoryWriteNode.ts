// ═══════════════════════════════════════════════════════════════
// Memory Write Node — Persist key facts after each interaction
//
// Saves to Supabase user_memories + vectorizes into Qdrant
// career_memory collection for semantic retrieval.
// ═══════════════════════════════════════════════════════════════

import { updateUserMemory, saveAgentSteps } from "../../agent/agentMemory.js";
import { USE_QDRANT_RAG } from "../../config/featureFlags.js";
import { getQdrantClient } from "../../rag/qdrantClient.js";
import { COLLECTIONS } from "../../rag/collections.js";
import { generateEmbedding } from "../../rag/embedder.js";
import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState } from "../state.js";

export async function memoryWriteNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "memory_write", state);

    try {
        // 1. Save to Supabase via existing memory system
        const agentSteps = state.toolCalls.map(tc => ({
            thought: `Called ${tc.tool}`,
            tool: tc.tool,
            toolInput: tc.input,
            toolOutput: tc.output,
            reflection: tc.status === "success" ? "Tool executed successfully." : "Tool failed.",
        }));

        await updateUserMemory(
            state.userId,
            agentSteps,
            {
                type: state.intent?.name || "general_chat",
                entities: state.intent?.entities || {},
            }
        );

        await saveAgentSteps(
            state.sessionId,
            state.userId,
            agentSteps,
            state.toolCalls.map(tc => tc.tool),
            state.intent?.name || "general_chat"
        );

        // 2. Vectorize important memories into Qdrant
        if (USE_QDRANT_RAG) {
            await vectorizeMemories(state);
        }
    } catch (err: any) {
        console.warn("[MemoryWriteNode] Error:", err.message);
    }

    return {};
}

// ── Vectorize high-confidence memories ────────────────────────
async function vectorizeMemories(state: AgentGraphState): Promise<void> {
    const client = getQdrantClient();
    if (!client) return;

    const memoriesToVectorize: Array<{ key: string; value: string; type: string }> = [];

    // Extract entities as memory
    const entities = state.intent?.entities || {};
    if (entities.targetRole) {
        memoriesToVectorize.push({
            key: "target_role",
            value: entities.targetRole,
            type: "target_role",
        });
    }
    if (entities.targetCompany) {
        memoriesToVectorize.push({
            key: "target_company",
            value: entities.targetCompany,
            type: "target_company",
        });
    }

    // Store a summary of the interaction
    if (state.finalAnswer && state.intent?.name !== "general_chat") {
        memoriesToVectorize.push({
            key: `interaction_${state.intent?.name}`,
            value: `User asked about ${state.intent?.name}. Tools used: ${state.toolCalls.map(t => t.tool).join(", ")}. `,
            type: "interaction_summary",
        });
    }

    if (memoriesToVectorize.length === 0) return;

    try {
        for (const mem of memoriesToVectorize) {
            const embedding = await generateEmbedding(`${mem.key}: ${mem.value}`);

            const pointId = generatePointId();
            await client.upsert(COLLECTIONS.CAREER_MEMORY, {
                points: [{
                    id: pointId,
                    vector: embedding,
                    payload: {
                        user_id: state.userId,
                        memory_type: mem.type,
                        key: mem.key,
                        value: mem.value,
                        confidence: 0.8,
                        last_used: new Date().toISOString(),
                        text: `${mem.key}: ${mem.value}`,
                    },
                }],
            });
        }
    } catch (err: any) {
        console.warn("[MemoryWriteNode] Vectorize failed:", err.message);
    }
}

function generatePointId(): string {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
