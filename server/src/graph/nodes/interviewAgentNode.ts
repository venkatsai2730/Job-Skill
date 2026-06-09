// ═══════════════════════════════════════════════════════════════
// Interview Agent Node — Interview prep, mock sessions, STAR eval
//
// Delegates to existing interviewTools from the tool registry.
// ═══════════════════════════════════════════════════════════════

import { interviewTools } from "../../agent/tools/interviewTools.js";
import { traceNodeExecution, traceToolCall } from "../../observability/langfuse.js";
import type { AgentGraphState, ToolCallRecord } from "../state.js";

export async function interviewAgentNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "interview_agent", state);

    const toolCalls: ToolCallRecord[] = [];
    let interviewResult: any = null;

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

    // Determine which interview tools to run
    const steps = state.plan?.steps || [];
    const interviewSteps = steps.filter(s =>
        ["generate_interview_questions", "evaluate_interview_answer", "mock_interview"].includes(s)
    );

    if (interviewSteps.length === 0 && state.intent?.requestedCapabilities?.includes("interview")) {
        interviewSteps.push("generate_interview_questions");
    }

    for (const toolName of interviewSteps) {
        const tool = interviewTools.find(t => t.name === toolName);
        if (!tool) continue;

        const startTime = Date.now();
        try {
            const args: Record<string, any> = {};
            const body = state.userMessage.replace(/^\/\w+\s*/, "").trim();

            if (state.intent?.entities?.targetRole) args.jobTitle = state.intent.entities.targetRole;
            if (state.intent?.entities?.targetCompany) args.company = state.intent.entities.targetCompany;
            if (body && toolName === "generate_interview_questions") args.jobTitle = body || "Software Engineer";
            if (body && toolName === "mock_interview") args.role = body || "Software Engineer";
            if (body && toolName === "evaluate_interview_answer") {
                const parts = body.split(/\n+/).filter(Boolean);
                if (parts.length >= 2) {
                    args.question = parts[0];
                    args.answer = parts.slice(1).join("\n");
                }
            }

            const output = await tool.execute(args, ctx);
            const latency = Date.now() - startTime;

            toolCalls.push({
                tool: toolName, input: args,
                output: typeof output === "string" ? output.substring(0, 1000) : output,
                status: output?.error ? "error" : "success",
                latencyMs: latency,
            });

            traceToolCall(state.traceId, {
                toolName, input: args, output,
                status: output?.error ? "error" : "success",
                latencyMs: latency,
                parentNode: "interview_agent",
            });

            interviewResult = interviewResult
                ? { ...interviewResult, [toolName]: output }
                : { [toolName]: output };
        } catch (err: any) {
            console.warn(`[InterviewAgentNode] Tool ${toolName} failed:`, err.message);
            toolCalls.push({
                tool: toolName, input: {}, output: { error: err.message },
                status: "error", latencyMs: Date.now() - startTime,
            });
        }
    }

    return {
        interviewContext: interviewResult,
        toolCalls,
    };
}
