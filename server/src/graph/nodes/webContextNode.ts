// ═══════════════════════════════════════════════════════════════
// Web Context Node — Fetches company/hiring context
//
// Optional/gated — only runs when plan.needsWebContext is true.
// Enriches responses about specific companies.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../../services/chatService.js";
import { retrieveCompanyInsights } from "../../rag/retrieve.js";
import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState, ToolCallRecord } from "../state.js";

export async function webContextNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "web_context", state);

    // Only run if plan says we need web context
    if (!state.plan?.needsWebContext) {
        return {};
    }

    const toolCalls: ToolCallRecord[] = [];
    const webResults: any[] = [];

    try {
        const company = state.intent?.entities?.targetCompany || "";
        if (!company) return {};

        const startTime = Date.now();

        // 1. Check Qdrant for cached company insights
        const cachedInsights = await retrieveCompanyInsights(company, 3);
        if (cachedInsights.length > 0) {
            webResults.push({
                source: "qdrant_cache",
                company,
                insights: cachedInsights.map(r => r.text),
            });
        }

        // 2. Generate company context via LLM (cost-effective alternative to web scraping)
        const result = await getAIReply([{
            role: "user",
            content: `Provide a brief hiring context for "${company}":
1. What they're known for
2. Their tech stack (if known)
3. Recent hiring trends
4. Interview style
5. Company culture highlights

Keep it concise and factual. If unsure, say so.`,
        }], "chat");

        const latency = Date.now() - startTime;

        webResults.push({
            source: "llm_knowledge",
            company,
            context: result.reply,
        });

        toolCalls.push({
            tool: "web_context_lookup",
            input: { company },
            output: { insights: webResults.length },
            status: "success",
            latencyMs: latency,
        });
    } catch (err: any) {
        console.warn("[WebContextNode] Error:", err.message);
        toolCalls.push({
            tool: "web_context_lookup",
            input: {},
            output: { error: err.message },
            status: "error",
            latencyMs: 0,
        });
    }

    return {
        webContext: webResults,
        toolCalls,
    };
}
