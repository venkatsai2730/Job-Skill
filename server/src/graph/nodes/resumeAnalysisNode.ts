// ═══════════════════════════════════════════════════════════════
// Resume Analysis Node — ATS scoring, bullet fixing, keyword gaps
//
// Delegates to existing resumeTools from the tool registry.
// ═══════════════════════════════════════════════════════════════

import { resumeTools } from "../../agent/tools/resumeTools.js";
import { traceNodeExecution, traceToolCall } from "../../observability/langfuse.js";
import type { AgentGraphState, ToolCallRecord } from "../state.js";

export async function resumeAnalysisNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "resume_analysis", state);

    const toolCalls: ToolCallRecord[] = [];
    let resumeResult: any = null;

    // Build agent context matching the existing tool interface
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

    // Determine which resume tools to run based on plan
    const steps = state.plan?.steps || [];
    const resumeSteps = steps.filter(s =>
        ["get_resume_score", "fix_resume_bullet", "get_resume_keywords",
         "get_skill_gap", "rewrite_resume_section"].includes(s)
    );

    // If no specific tools planned, use score as default for resume intent
    if (resumeSteps.length === 0 && state.intent?.requestedCapabilities?.includes("resume_analysis")) {
        resumeSteps.push("get_resume_score");
    }

    for (const toolName of resumeSteps) {
        const tool = resumeTools.find(t => t.name === toolName);
        if (!tool) continue;

        const startTime = Date.now();
        try {
            // Build args from intent entities
            const args: Record<string, any> = {};
            if (state.intent?.entities?.targetRole) args.targetRole = state.intent.entities.targetRole;
            if (state.intent?.entities?.section) args.section = state.intent.entities.section;

            // Extract body text from message for context
            const body = state.userMessage.replace(/^\/\w+\s*/, "").trim();
            if (body && toolName === "get_resume_keywords") args.jobDescription = body;
            if (body && toolName === "rewrite_resume_section") args.section = body || "summary";

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
                toolName,
                input: args,
                output,
                status: output?.error ? "error" : "success",
                latencyMs: latency,
                parentNode: "resume_analysis",
            });

            // Merge results
            resumeResult = resumeResult
                ? { ...resumeResult, [toolName]: output }
                : { [toolName]: output };
        } catch (err: any) {
            console.warn(`[ResumeAnalysisNode] Tool ${toolName} failed:`, err.message);
            toolCalls.push({
                tool: toolName,
                input: {},
                output: { error: err.message },
                status: "error",
                latencyMs: Date.now() - startTime,
            });
        }
    }

    return {
        resumeContext: resumeResult
            ? { ...state.resumeContext, analysis: resumeResult }
            : state.resumeContext,
        toolCalls,
    };
}
