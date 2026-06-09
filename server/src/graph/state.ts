// ═══════════════════════════════════════════════════════════════
// LangGraph State — Strongly typed state for the agent graph
//
// Defines the AgentGraphState interface and LangGraph Annotation
// channel definitions used by all graph nodes.
// ═══════════════════════════════════════════════════════════════

import { Annotation } from "@langchain/langgraph";

// ── Message type ──────────────────────────────────────────────
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

// ── Intent type ───────────────────────────────────────────────
export interface IntentResult {
    name: string;
    confidence: number;
    entities: Record<string, any>;
    requestedCapabilities: string[];
}

// ── Plan type ─────────────────────────────────────────────────
export interface PlanResult {
    steps: string[];
    parallelBranches: string[];
    needsWebContext: boolean;
    needsRag: boolean;
    needsMcp: boolean;
}

// ── Tool/LLM/Retrieval tracking ───────────────────────────────
export interface ToolCallRecord {
    tool: string;
    input: any;
    output: any;
    status: "success" | "error";
    latencyMs: number;
}

export interface LLMCallRecord {
    model: string;
    provider: string;
    feature: string;
    tokens: number;
    latencyMs: number;
}

export interface RetrievalRecord {
    collection: string;
    query: string;
    topK: number;
    hits: number;
    latencyMs: number;
}

// ═══════════════════════════════════════════════════════════════
// AGENT GRAPH STATE — Full typed state object
// ═══════════════════════════════════════════════════════════════
export interface AgentGraphState {
    // ── Identity ──────────────────────────────────────────────
    userId: string;
    sessionId: string;
    messageId: string;
    route: string;

    // ── Input ─────────────────────────────────────────────────
    userMessage: string;
    conversationHistory: Message[];

    // ── Classification ────────────────────────────────────────
    intent: IntentResult | null;

    // ── Planning ──────────────────────────────────────────────
    plan: PlanResult | null;

    // ── Agent outputs ─────────────────────────────────────────
    resumeContext: any | null;
    jobsContext: any[];
    webContext: any[];
    dataContext: any | null;
    interviewContext: any | null;
    ragContext: any[];
    memories: any[];

    // ── Observability ─────────────────────────────────────────
    toolCalls: ToolCallRecord[];
    llmCalls: LLMCallRecord[];
    retrievals: RetrievalRecord[];
    traceId: string;

    // ── Output ────────────────────────────────────────────────
    finalAnswer: string | null;
    nextAction: string | null;
    errors: any[];
}

// ═══════════════════════════════════════════════════════════════
// LANGGRAPH ANNOTATION — Channel definitions for state management
//
// Each channel defines how state is updated when a node returns
// a partial state. "replace" = last write wins. "append" = array merge.
// ═══════════════════════════════════════════════════════════════
export const GraphAnnotation = Annotation.Root({
    userId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
    sessionId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
    messageId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
    route: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),

    userMessage: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
    conversationHistory: Annotation<Message[]>({
        reducer: (_, b) => b,
        default: () => [],
    }),

    intent: Annotation<IntentResult | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),

    plan: Annotation<PlanResult | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),

    resumeContext: Annotation<any | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),
    jobsContext: Annotation<any[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    webContext: Annotation<any[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    dataContext: Annotation<any | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),
    interviewContext: Annotation<any | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),
    ragContext: Annotation<any[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    memories: Annotation<any[]>({
        reducer: (_, b) => b,
        default: () => [],
    }),

    toolCalls: Annotation<ToolCallRecord[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    llmCalls: Annotation<LLMCallRecord[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    retrievals: Annotation<RetrievalRecord[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
    traceId: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),

    finalAnswer: Annotation<string | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),
    nextAction: Annotation<string | null>({
        reducer: (_, b) => b,
        default: () => null,
    }),
    errors: Annotation<any[]>({
        reducer: (a, b) => [...a, ...b],
        default: () => [],
    }),
});

// ── Helper to create initial state from request context ───────
export function createInitialState(params: {
    userId: string;
    sessionId: string;
    message: string;
    history?: Message[];
    route?: string;
    traceId?: string;
}): typeof GraphAnnotation.State {
    return {
        userId: params.userId,
        sessionId: params.sessionId,
        messageId: `msg_${Date.now()}`,
        route: params.route || "chatbot",
        userMessage: params.message,
        conversationHistory: params.history || [],
        intent: null,
        plan: null,
        resumeContext: null,
        jobsContext: [],
        webContext: [],
        dataContext: null,
        interviewContext: null,
        ragContext: [],
        memories: [],
        toolCalls: [],
        llmCalls: [],
        retrievals: [],
        traceId: params.traceId || "",
        finalAnswer: null,
        nextAction: null,
        errors: [],
    };
}
