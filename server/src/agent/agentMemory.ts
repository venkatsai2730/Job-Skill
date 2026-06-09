// ═══════════════════════════════════════════════════════════════
// Agent Memory — Persistent user memory across sessions
// Makes Aria feel like a true career coach who "knows" the user.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";
import { USE_QDRANT_RAG } from "../config/featureFlags.js";
import { getQdrantClient } from "../rag/qdrantClient.js";
import { COLLECTIONS } from "../rag/collections.js";
import { generateEmbedding } from "../rag/embedder.js";

// ── Types ─────────────────────────────────────────────────────
export interface UserMemory {
    id: string;
    user_id: string;
    key: string;
    value: any;
    session_id?: string;
    created_at: string;
    updated_at: string;
}

export interface AgentStep {
    thought: string;
    tool: string;
    toolInput: any;
    toolOutput: any;
    reflection: string;
}

// ── Get all memories for a user ───────────────────────────────
export async function getUserMemories(userId: string): Promise<UserMemory[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from("user_memories")
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(50);

        if (error) {
            console.warn("[AgentMemory] Fetch error:", error.message);
            return [];
        }
        return data || [];
    } catch {
        return [];
    }
}

// ── Search memories by topic keyword ──────────────────────────
export async function getUserMemory(userId: string, topic: string): Promise<UserMemory | null> {
    try {
        const { data } = await supabaseAdmin
            .from("user_memories")
            .select("*")
            .eq("user_id", userId)
            .ilike("key", `%${topic}%`)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

        return data || null;
    } catch {
        return null;
    }
}

// ── Save or update a memory ───────────────────────────────────
export async function setUserMemory(
    userId: string,
    key: string,
    value: any,
    sessionId?: string
): Promise<boolean> {
    try {
        const { error } = await supabaseAdmin
            .from("user_memories")
            .upsert(
                {
                    user_id: userId,
                    key: key.toLowerCase().trim(),
                    value: typeof value === "string" ? { text: value } : value,
                    session_id: sessionId || null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,key" }
            );

        if (error) {
            console.warn("[AgentMemory] Save error:", error.message);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// ── Auto-extract and save facts from agent steps ──────────────
export async function updateUserMemory(
    userId: string,
    steps: AgentStep[],
    intent: { type: string; entities?: Record<string, string> }
): Promise<void> {
    try {
        // Extract target role if mentioned
        if (intent.entities?.targetRole) {
            await setUserMemory(userId, "target_role", intent.entities.targetRole);
        }
        if (intent.entities?.targetCompany) {
            await setUserMemory(userId, "target_company", intent.entities.targetCompany);
        }
        if (intent.entities?.location) {
            await setUserMemory(userId, "preferred_location", intent.entities.location);
        }

        // Track what tools were used (for learning user patterns)
        const toolsUsed = steps.map(s => s.tool).filter(Boolean);
        if (toolsUsed.length > 0) {
            await setUserMemory(userId, "last_tools_used", {
                tools: toolsUsed,
                timestamp: new Date().toISOString(),
            });
        }

        // Track last intent
        await setUserMemory(userId, "last_intent", {
            type: intent.type,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.warn("[AgentMemory] Auto-extract failed:", err.message);
    }
}

// ── Save agent execution steps for transparency ───────────────
export async function saveAgentSteps(
    sessionId: string,
    userId: string,
    steps: AgentStep[],
    toolsUsed: string[],
    intent: string
): Promise<void> {
    try {
        await supabaseAdmin.from("agent_steps").insert({
            session_id: sessionId,
            user_id: userId,
            steps: steps,
            tools_used: toolsUsed,
            intent: intent,
        });
    } catch (err: any) {
        console.warn("[AgentMemory] Save steps failed:", err.message);
    }
}

// ── Get memory summary string for system prompt injection ─────
export function formatMemoriesForPrompt(memories: UserMemory[]): string {
    if (!memories || memories.length === 0) return "";

    const relevant = memories.filter(m =>
        ["target_role", "target_company", "preferred_location", "learning_skills",
         "applied_jobs", "interview_dates", "salary_goal", "current_skill_focus",
         "repeated_resume_issues", "user_preferences"].includes(m.key)
    );

    if (relevant.length === 0) return "";

    const lines = relevant.map(m => {
        const val = typeof m.value === "object" && m.value.text ? m.value.text : JSON.stringify(m.value);
        return `  • ${m.key.replace(/_/g, " ")}: ${val}`;
    });

    return `\n[ARIA MEMORY — Things I remember about you]:\n${lines.join("\n")}\n`;
}

// ── Vectorize a memory into Qdrant (for semantic retrieval) ───
export async function vectorizeMemory(
    userId: string,
    key: string,
    value: string
): Promise<void> {
    if (!USE_QDRANT_RAG) return;

    const client = getQdrantClient();
    if (!client) return;

    try {
        const text = `${key}: ${value}`;
        const embedding = await generateEmbedding(text);

        const pointId = generateMemoryPointId();
        await client.upsert(COLLECTIONS.CAREER_MEMORY, {
            points: [{
                id: pointId,
                vector: embedding,
                payload: {
                    user_id: userId,
                    memory_type: key,
                    key,
                    value,
                    confidence: 0.9,
                    last_used: new Date().toISOString(),
                    text,
                },
            }],
        });
    } catch (err: any) {
        console.warn("[AgentMemory] Vectorize failed:", err.message);
    }
}

function generateMemoryPointId(): string {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

