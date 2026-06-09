// ═══════════════════════════════════════════════════════════════
// Langfuse Observability — Unified tracing for LLM/Tool/Retrieval
//
// Uses @langfuse/client v5. All trace calls are no-ops when
// USE_LANGFUSE is false, so this module is always safe to import.
// ═══════════════════════════════════════════════════════════════

import { USE_LANGFUSE } from "../config/featureFlags.js";

// ── Lazy-init Langfuse client ─────────────────────────────────
let langfuseClient: any = null;

function getLangfuse() {
    if (!USE_LANGFUSE) return null;
    if (langfuseClient) return langfuseClient;

    try {
        // Dynamic import to avoid hard crash if package missing
        const { Langfuse } = require("@langfuse/client");
        langfuseClient = new Langfuse({
            secretKey: process.env.LANGFUSE_SECRET_KEY || "",
            publicKey: process.env.LANGFUSE_PUBLIC_KEY || "",
            baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
        });
        console.log("[Langfuse] Client initialized");
        return langfuseClient;
    } catch (err: any) {
        console.warn("[Langfuse] Failed to initialize:", err.message);
        return null;
    }
}

// ── Types ─────────────────────────────────────────────────────
export interface TraceContext {
    traceId: string;
    trace: any;       // Langfuse Trace object
    spans: Map<string, any>;  // Named spans for nested hierarchy
}

// In-memory trace store (keyed by traceId)
const activeTraces = new Map<string, TraceContext>();

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Drop-in tracing helpers
// ═══════════════════════════════════════════════════════════════

/** Start a new trace for an incoming user request */
export function startTrace(params: {
    name: string;
    userId: string;
    sessionId: string;
    input?: any;
    metadata?: Record<string, any>;
}): string {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const lf = getLangfuse();
    if (!lf) return traceId;

    try {
        const trace = lf.trace({
            id: traceId,
            name: params.name,
            userId: params.userId,
            sessionId: params.sessionId,
            input: params.input,
            metadata: params.metadata || {},
        });

        activeTraces.set(traceId, { traceId, trace, spans: new Map() });
    } catch (err: any) {
        console.warn("[Langfuse] startTrace error:", err.message);
    }

    return traceId;
}

/** Trace a LangGraph node execution */
export function traceNodeExecution(
    traceId: string,
    nodeName: string,
    state: Record<string, any>
): void {
    const ctx = activeTraces.get(traceId);
    if (!ctx) return;

    try {
        const span = ctx.trace.span({
            name: `node:${nodeName}`,
            input: {
                intent: state.intent?.name || "unknown",
                plan: state.plan?.steps || [],
            },
            metadata: {
                userId: state.userId,
                route: state.route,
            },
        });
        ctx.spans.set(nodeName, span);
    } catch (err: any) {
        console.warn(`[Langfuse] traceNode(${nodeName}) error:`, err.message);
    }
}

/** Trace an LLM call (model, prompt, output, usage) */
export function traceLLMCall(
    traceId: string,
    params: {
        model: string;
        provider: string;
        prompt: string;
        output: string;
        tokens?: number;
        latencyMs?: number;
        parentNode?: string;
        feature?: string;
    }
): void {
    const ctx = activeTraces.get(traceId);
    if (!ctx) return;

    try {
        const parent = params.parentNode
            ? ctx.spans.get(params.parentNode) || ctx.trace
            : ctx.trace;

        parent.generation({
            name: `llm:${params.provider}/${params.model}`,
            model: params.model,
            input: params.prompt.substring(0, 5000),
            output: params.output.substring(0, 5000),
            usage: {
                totalTokens: params.tokens || 0,
            },
            metadata: {
                provider: params.provider,
                feature: params.feature || "unknown",
                latencyMs: params.latencyMs || 0,
            },
        });
    } catch (err: any) {
        console.warn("[Langfuse] traceLLMCall error:", err.message);
    }
}

/** Trace a tool call (MCP, agent tool, etc.) */
export function traceToolCall(
    traceId: string,
    params: {
        toolName: string;
        input: any;
        output: any;
        status: "success" | "error";
        latencyMs?: number;
        parentNode?: string;
    }
): void {
    const ctx = activeTraces.get(traceId);
    if (!ctx) return;

    try {
        const parent = params.parentNode
            ? ctx.spans.get(params.parentNode) || ctx.trace
            : ctx.trace;

        parent.span({
            name: `tool:${params.toolName}`,
            input: typeof params.input === "string"
                ? params.input.substring(0, 2000)
                : JSON.stringify(params.input).substring(0, 2000),
            output: typeof params.output === "string"
                ? params.output.substring(0, 2000)
                : JSON.stringify(params.output).substring(0, 2000),
            metadata: {
                status: params.status,
                latencyMs: params.latencyMs || 0,
            },
        });
    } catch (err: any) {
        console.warn("[Langfuse] traceToolCall error:", err.message);
    }
}

/** Trace a vector retrieval operation */
export function traceRetrieval(
    traceId: string,
    params: {
        collection: string;
        query: string;
        topK: number;
        hits: number;
        latencyMs?: number;
        parentNode?: string;
    }
): void {
    const ctx = activeTraces.get(traceId);
    if (!ctx) return;

    try {
        const parent = params.parentNode
            ? ctx.spans.get(params.parentNode) || ctx.trace
            : ctx.trace;

        parent.span({
            name: `retrieval:${params.collection}`,
            input: params.query.substring(0, 1000),
            output: `${params.hits} hits from ${params.collection} (top-${params.topK})`,
            metadata: {
                collection: params.collection,
                topK: params.topK,
                hits: params.hits,
                latencyMs: params.latencyMs || 0,
            },
        });
    } catch (err: any) {
        console.warn("[Langfuse] traceRetrieval error:", err.message);
    }
}

/** End a trace with final result metadata */
export function endTrace(
    traceId: string,
    result: {
        output?: string;
        status?: "success" | "error";
        intent?: string;
        toolsUsed?: string[];
        modelsUsed?: string[];
        totalTokens?: number;
        totalLatencyMs?: number;
        fallbackTriggered?: boolean;
    }
): void {
    const ctx = activeTraces.get(traceId);
    if (!ctx) return;

    try {
        // Close all open spans
        for (const [, span] of ctx.spans) {
            try { span.end(); } catch { /* ignore */ }
        }

        // Update trace with final output
        ctx.trace.update({
            output: result.output?.substring(0, 5000),
            metadata: {
                status: result.status || "success",
                intent: result.intent,
                toolsUsed: result.toolsUsed || [],
                modelsUsed: result.modelsUsed || [],
                totalTokens: result.totalTokens || 0,
                totalLatencyMs: result.totalLatencyMs || 0,
                fallbackTriggered: result.fallbackTriggered || false,
            },
        });

        // Flush to Langfuse
        const lf = getLangfuse();
        if (lf) lf.flush();

        // Cleanup
        activeTraces.delete(traceId);
    } catch (err: any) {
        console.warn("[Langfuse] endTrace error:", err.message);
        activeTraces.delete(traceId);
    }
}

/** Create a standalone trace for non-agent operations (e.g., cron jobs) */
export function traceStandalone(params: {
    name: string;
    input?: any;
    output?: any;
    metadata?: Record<string, any>;
}): void {
    const lf = getLangfuse();
    if (!lf) return;

    try {
        lf.trace({
            name: params.name,
            input: params.input,
            output: params.output,
            metadata: params.metadata || {},
        });
        lf.flush();
    } catch (err: any) {
        console.warn("[Langfuse] traceStandalone error:", err.message);
    }
}
