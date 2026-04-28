// ═══════════════════════════════════════════════════════════════
// LangGraph Orchestrator — Main graph definition
//
// Assembles all nodes into a StateGraph with conditional edges
// and parallel branching. Replaces the custom ariaAgent loop
// when USE_LANGGRAPH is true.
//
// Graph flow:
//   intake → intentRouter → planner → [parallel agents] → synthesis → memoryWrite → finalResponse
// ═══════════════════════════════════════════════════════════════

import { StateGraph, END } from "@langchain/langgraph";
import { GraphAnnotation, createInitialState } from "./state.js";
import type { AgentGraphState, Message } from "./state.js";

// ── Nodes ─────────────────────────────────────────────────────
import { intakeNode } from "./nodes/intakeNode.js";
import { intentRouterNode, routeFromIntent } from "./nodes/intentRouterNode.js";
import { plannerNode } from "./nodes/plannerNode.js";
import { resumeAnalysisNode } from "./nodes/resumeAnalysisNode.js";
import { jobsAgentNode } from "./nodes/jobsAgentNode.js";
import { webContextNode } from "./nodes/webContextNode.js";
import { dataAgentNode } from "./nodes/dataAgentNode.js";
import { interviewAgentNode } from "./nodes/interviewAgentNode.js";
import { synthesisNode } from "./nodes/synthesisNode.js";
import { memoryWriteNode } from "./nodes/memoryWriteNode.js";
import { finalResponseNode } from "./nodes/finalResponseNode.js";

// ── Observability ─────────────────────────────────────────────
import { startTrace, endTrace } from "../observability/langfuse.js";

// ── Response type (matches existing AriaAgent contract) ───────
export interface LangGraphAgentResponse {
    message: string;
    steps: Array<{ tool: string; thought: string; reflection?: string }>;
    toolsUsed: string[];
    intent: string;
    memories?: string;
    modelsUsed?: string[];
    totalTokens?: number;
}

// ═══════════════════════════════════════════════════════════════
// BUILD THE GRAPH
// ═══════════════════════════════════════════════════════════════
function buildGraph() {
    const graph = new StateGraph(GraphAnnotation)
        // ── Register all nodes ────────────────────────────────
        .addNode("intake", intakeNode)
        .addNode("intent_router", intentRouterNode)
        .addNode("planner", plannerNode)
        .addNode("resume_analysis", resumeAnalysisNode)
        .addNode("jobs_agent", jobsAgentNode)
        .addNode("web_context", webContextNode)
        .addNode("data_agent", dataAgentNode)
        .addNode("interview_agent", interviewAgentNode)
        .addNode("synthesis", synthesisNode)
        .addNode("memory_write", memoryWriteNode)
        .addNode("final_response", finalResponseNode)

        // ── Linear edges ──────────────────────────────────────
        .addEdge("__start__", "intake")
        .addEdge("intake", "intent_router")
        .addEdge("intent_router", "planner")

        // ── Conditional routing from planner to agents ────────
        .addConditionalEdges("planner", (state: typeof GraphAnnotation.State) => {
            const branches = routeFromIntent(state as AgentGraphState);
            // Return object mapping branch names to their target nodes
            // LangGraph handles parallelism when multiple targets returned
            if (branches.length === 0 || branches.includes("synthesis")) {
                return "synthesis";
            }
            // For simplicity, run the FIRST branch sequentially
            // In production LangGraph, parallel branches use Send()
            return branches[0];
        }, {
            resume_analysis: "resume_analysis",
            jobs_agent: "jobs_agent",
            web_context: "web_context",
            data_agent: "data_agent",
            interview_agent: "interview_agent",
            synthesis: "synthesis",
        })

        // ── All agent nodes converge to synthesis ─────────────
        .addEdge("resume_analysis", "synthesis")
        .addEdge("jobs_agent", "synthesis")
        .addEdge("web_context", "synthesis")
        .addEdge("data_agent", "synthesis")
        .addEdge("interview_agent", "synthesis")

        // ── Post-synthesis flow ───────────────────────────────
        .addEdge("synthesis", "memory_write")
        .addEdge("memory_write", "final_response")
        .addEdge("final_response", END);

    return graph.compile();
}

// ── Singleton compiled graph ──────────────────────────────────
let compiledGraph: any = null;

function getGraph() {
    if (!compiledGraph) {
        compiledGraph = buildGraph();
        console.log("[LangGraph] Graph compiled successfully");
    }
    return compiledGraph;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Drop-in replacement for runAriaAgent()
// ═══════════════════════════════════════════════════════════════
export async function runLangGraphAgent(ctx: {
    userId: string;
    sessionId: string;
    message: string;
    history?: any[];
    resumeData?: any;
    atsScore?: number | null;
    userSkills?: string[];
    userProfile?: any;
    memories?: any[];
}): Promise<LangGraphAgentResponse> {
    const startTime = Date.now();

    // Start Langfuse trace
    const traceId = startTrace({
        name: "langgraph_agent",
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        input: ctx.message,
        metadata: { route: "chatbot" },
    });

    try {
        // Build initial state
        const history: Message[] = (ctx.history || []).map((m: any) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        }));

        const initialState = createInitialState({
            userId: ctx.userId,
            sessionId: ctx.sessionId,
            message: ctx.message,
            history,
            route: "chatbot",
            traceId,
        });

        // Run the graph
        const graph = getGraph();
        const finalState = await graph.invoke(initialState);

        const totalLatency = Date.now() - startTime;

        // Build response matching existing AriaAgent contract
        const response: LangGraphAgentResponse = {
            message: finalState.finalAnswer || "I couldn't process your request.",
            steps: (finalState.toolCalls || []).map((tc: any) => ({
                tool: tc.tool,
                thought: `Called ${tc.tool}`,
                reflection: tc.status === "success" ? "Completed" : "Failed",
            })),
            toolsUsed: [...new Set((finalState.toolCalls || []).map((tc: any) => tc.tool))] as string[],
            intent: finalState.intent?.name || "general_chat",
            modelsUsed: [...new Set((finalState.llmCalls || []).map((lc: any) => lc.model))] as string[],
            totalTokens: (finalState.llmCalls || []).reduce((sum: number, lc: any) => sum + (lc.tokens || 0), 0),
        };

        // End trace
        endTrace(traceId, {
            output: response.message,
            status: "success",
            intent: response.intent,
            toolsUsed: response.toolsUsed,
            modelsUsed: response.modelsUsed,
            totalTokens: response.totalTokens,
            totalLatencyMs: totalLatency,
        });

        console.log(`[LangGraph] Completed in ${totalLatency}ms | Intent: ${response.intent} | Tools: ${response.toolsUsed.join(", ") || "none"}`);

        return response;
    } catch (err: any) {
        console.error("[LangGraph] Agent error:", err);

        endTrace(traceId, {
            status: "error",
            output: err.message,
            totalLatencyMs: Date.now() - startTime,
        });

        // Return graceful fallback
        return {
            message: "I'm having trouble processing your request right now. Please try again in a moment.",
            steps: [],
            toolsUsed: [],
            intent: "error",
        };
    }
}
