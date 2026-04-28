// ═══════════════════════════════════════════════════════════════
// Intake Node — Loads user context in parallel
//
// First node in the graph. Fetches resume, profile, memories,
// and (optionally) RAG context before any classification.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../../config/supabase.js";
import { getUserMemories } from "../../agent/agentMemory.js";
import { retrieveCareerMemory } from "../../rag/retrieve.js";
import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState } from "../state.js";

export async function intakeNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "intake", state);

    try {
        // Load everything in parallel
        const [resumeData, userProfile, memories, ragMemories] = await Promise.all([
            loadResumeData(state.userId),
            loadUserProfile(state.userId),
            getUserMemories(state.userId).catch(() => []),
            retrieveCareerMemory(state.userMessage, state.userId, 5).catch(() => []),
        ]);

        // Build resume context
        const resumeContext = resumeData
            ? {
                rawText: resumeData.rawText || "",
                sections: resumeData.sections || null,
                ats: resumeData.ats || null,
                atsScore: resumeData.ats?.score ?? resumeData.ats?.overall_score ?? null,
                userSkills: extractSkills(resumeData),
                userProfile,
            }
            : null;

        // Merge memories from Supabase + RAG
        const allMemories = [
            ...memories,
            ...ragMemories.map(r => ({
                key: r.metadata?.key || "rag_memory",
                value: r.text,
                source: "qdrant",
                score: r.score,
            })),
        ];

        return {
            resumeContext,
            memories: allMemories,
            ragContext: ragMemories.length > 0
                ? [{ source: "career_memory", hits: ragMemories.length }]
                : [],
        };
    } catch (err: any) {
        console.warn("[IntakeNode] Error:", err.message);
        return {
            errors: [{ node: "intake", message: err.message }],
        };
    }
}

// ── Helpers ───────────────────────────────────────────────────
async function loadResumeData(userId: string): Promise<any | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!error && data?.parsed_data) {
            const pd = data.parsed_data as any;
            return {
                sections: pd.sections || null,
                ats: pd.ats || null,
                rawText: pd.rawText || JSON.stringify(pd.sections || {}),
            };
        }
    } catch { /* no resume */ }
    return null;
}

async function loadUserProfile(userId: string): Promise<any | null> {
    try {
        const { data } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();
        return data;
    } catch { return null; }
}

function extractSkills(resumeData: any): string[] {
    if (resumeData?.sections?.skills) {
        return (resumeData.sections.skills as any[]).flatMap((g: any) => g.items || []);
    }
    return [];
}
