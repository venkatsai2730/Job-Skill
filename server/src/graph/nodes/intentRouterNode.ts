// ═══════════════════════════════════════════════════════════════
// Intent Router Node — Classifies user intent
//
// Wraps existing classifyIntent() from intentClassifier.ts.
// Returns intent classification to drive conditional edges.
// ═══════════════════════════════════════════════════════════════

import { Send } from "@langchain/langgraph";
import { classifyIntent } from "../../agent/intentClassifier.js";
import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState, IntentResult } from "../state.js";

// ── Intent → Capability mapping ──────────────────────────────
const INTENT_CAPABILITIES: Record<string, string[]> = {
    score_inquiry: ["resume_analysis"],
    fix_bullet: ["resume_analysis"],
    keyword_gap: ["resume_analysis"],
    skill_gap: ["resume_analysis", "data_processing"],
    resume_rewrite: ["resume_analysis"],

    job_search: ["jobs", "data_processing"],
    top_matches: ["jobs", "data_processing"],
    job_explanation: ["jobs", "web_context"],
    cover_letter: ["resume_analysis", "jobs"],

    interview_prep: ["interview"],
    answer_feedback: ["interview"],
    mock_interview: ["interview"],

    career_roadmap: ["resume_analysis", "jobs", "data_processing"],
    linkedin_audit: ["resume_analysis"],
    salary_query: ["jobs"],

    general_career: ["resume_analysis", "jobs", "data_processing"],
    full_job_apply: ["jobs", "resume_analysis", "data_processing"],

    general_chat: [],
};

export async function intentRouterNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "intent_router", state);

    try {
        const history = state.conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
        }));

        const classified = await classifyIntent(state.userMessage, history);

        const intent: IntentResult = {
            name: classified.type,
            confidence: classified.confidence,
            entities: classified.entities || {},
            requestedCapabilities: INTENT_CAPABILITIES[classified.type] || [],
        };

        return { intent };
    } catch (err: any) {
        console.warn("[IntentRouterNode] Classification error:", err.message);
        return {
            intent: {
                name: "general_chat",
                confidence: 50,
                entities: {},
                requestedCapabilities: [],
            },
            errors: [{ node: "intent_router", message: err.message }],
        };
    }
}

/** Routing function — determines which branches to activate */
export function routeFromIntent(state: AgentGraphState): string[] {
    const caps = state.intent?.requestedCapabilities || [];

    if (caps.length === 0) return ["synthesis"];

    const branches: string[] = [];

    if (caps.includes("resume_analysis")) branches.push("resume_analysis");
    if (caps.includes("jobs")) branches.push("jobs_agent");
    if (caps.includes("web_context")) branches.push("web_context");
    if (caps.includes("data_processing")) branches.push("data_agent");
    if (caps.includes("interview")) branches.push("interview_agent");

    return branches.length > 0 ? branches : ["synthesis"];
}

/**
 * Fan-out routing for the planner's conditional edge.
 *
 * Dispatches EVERY requested branch concurrently via LangGraph's Send()
 * primitive — all branches run in the same superstep and converge on
 * synthesis. This replaces the old `branches[0]` behaviour where only the
 * first branch ran.
 *
 * Each Send carries the current state, so every branch node receives the
 * same planner output. The state reducers in state.ts are safe for these
 * concurrent writes: each last-write-wins channel (resumeContext,
 * dataContext, interviewContext) has exactly ONE writer node, and the
 * remaining channels (jobsContext, webContext, toolCalls, …) append.
 *
 * NOTE: data_agent's salary-normalization reads state.jobsContext, which is
 * empty under true parallelism (jobs_agent runs in the same superstep). Its
 * RAG semanticJobs path is independent and still populates dataContext.
 */
export function fanOutFromIntent(state: AgentGraphState): "synthesis" | Send[] {
    const branches = routeFromIntent(state);

    // Empty capabilities (e.g. general_chat) → skip agents entirely.
    if (branches.length === 0 || branches.includes("synthesis")) {
        return "synthesis";
    }

    return branches.map((node) => new Send(node, state));
}
