// ═══════════════════════════════════════════════════════════════
// Jobs Agent Node — Job search, matching, cover letters
//
// Delegates to existing jobTools + MCP client.
// ═══════════════════════════════════════════════════════════════

import { jobTools } from "../../agent/tools/jobTools.js";
import { traceNodeExecution, traceToolCall } from "../../observability/langfuse.js";
import type { AgentGraphState, ToolCallRecord } from "../state.js";

export async function jobsAgentNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "jobs_agent", state);

    const toolCalls: ToolCallRecord[] = [];
    const jobsResults: any[] = [];

    const ctx = {
        userId: state.userId,
        sessionId: state.sessionId,
        message: state.userMessage,
        history: state.conversationHistory.map(m => ({ role: m.role, content: m.content })),
        resumeData: state.resumeContext,
        atsScore: state.resumeContext?.atsScore || null,
        userSkills: state.resumeContext?.userSkills || [],
        userProfile: state.resumeContext?.userProfile || null,
        memories: state.memories,
    };

    // Determine which job tools to run
    const steps = state.plan?.steps || [];
    const jobSteps = steps.filter(s =>
        ["search_jobs", "get_top_matched_jobs", "explain_job_match", "generate_cover_letter"].includes(s)
    );

    // Default to search if jobs capability needed but no specific tool planned
    if (jobSteps.length === 0 && state.intent?.requestedCapabilities?.includes("jobs")) {
        jobSteps.push("search_jobs");
    }

    for (const toolName of jobSteps) {
        const tool = jobTools.find(t => t.name === toolName);
        if (!tool) continue;

        const startTime = Date.now();
        try {
            const args: Record<string, any> = {};
            if (state.intent?.entities?.targetRole) args.query = state.intent.entities.targetRole;
            if (state.intent?.entities?.targetCompany) {
                args.jobCompany = state.intent.entities.targetCompany;
                args.company = state.intent.entities.targetCompany;
            }

            const body = state.userMessage.replace(/^\/\w+\s*/, "").trim();
            if (body && toolName === "search_jobs") args.query = body;
            if (body && toolName === "explain_job_match") args.jobTitle = body;
            if (body && toolName === "generate_cover_letter") args.jobDescription = body;

            const output = await tool.execute(args, ctx);
            const latency = Date.now() - startTime;

            toolCalls.push({
                tool: toolName,
                input: args,
                output: typeof output === "string" ? output.substring(0, 1000) : output,
                status: output?.error ? "error" : "success",
                latencyMs: latency,
            });

            traceToolCall(state.traceId, {
                toolName, input: args, output,
                status: output?.error ? "error" : "success",
                latencyMs: latency,
                parentNode: "jobs_agent",
            });

            jobsResults.push({ tool: toolName, result: output });
        } catch (err: any) {
            console.warn(`[JobsAgentNode] Tool ${toolName} failed:`, err.message);
            toolCalls.push({
                tool: toolName, input: {}, output: { error: err.message },
                status: "error", latencyMs: Date.now() - startTime,
            });
        }
    }

    return {
        jobsContext: jobsResults,
        toolCalls,
    };
}
