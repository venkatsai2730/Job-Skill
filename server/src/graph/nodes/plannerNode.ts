// ═══════════════════════════════════════════════════════════════
// Planner Node — Decides tool execution strategy
//
// Wraps existing planTools() and adds parallel branch planning.
// ═══════════════════════════════════════════════════════════════

import { planTools, INTENT_TOOL_MAP } from "../../agent/intentClassifier.js";
import { traceNodeExecution } from "../../observability/langfuse.js";
import type { AgentGraphState, PlanResult } from "../state.js";

export async function plannerNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "planner", state);

    try {
        const intent = state.intent;
        if (!intent) {
            return {
                plan: {
                    steps: [],
                    parallelBranches: [],
                    needsWebContext: false,
                    needsRag: false,
                    needsMcp: false,
                },
            };
        }

        // Use existing planner for tool sequence
        const toolPlan = planTools(
            {
                type: intent.name,
                confidence: intent.confidence,
                entities: intent.entities,
                requiresTools: INTENT_TOOL_MAP[intent.name] || [],
            },
            {
                userId: state.userId,
                sessionId: state.sessionId,
                message: state.userMessage,
                history: state.conversationHistory.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                resumeData: state.resumeContext,
                atsScore: state.resumeContext?.atsScore || null,
                userSkills: state.resumeContext?.userSkills || [],
                userProfile: state.resumeContext?.userProfile || null,
                memories: state.memories,
            }
        );

        // Determine parallel branches
        const caps = intent.requestedCapabilities || [];
        const parallelBranches: string[] = [];

        // Parallelism rules from spec
        if (caps.includes("jobs") && caps.includes("data_processing")) {
            parallelBranches.push("jobs_agent", "data_agent");
        }
        if (caps.includes("web_context")) {
            parallelBranches.push("web_context");
        }
        if (caps.includes("resume_analysis") && caps.includes("jobs")) {
            // Broad career request → run all in parallel
            if (!parallelBranches.includes("jobs_agent")) parallelBranches.push("jobs_agent");
            parallelBranches.push("resume_analysis");
        }
        if (caps.includes("interview")) {
            parallelBranches.push("interview_agent");
        }

        const plan: PlanResult = {
            steps: toolPlan.tools.map(t => t.name),
            parallelBranches,
            needsWebContext: caps.includes("web_context"),
            needsRag: caps.includes("data_processing") || caps.includes("jobs"),
            needsMcp: caps.includes("jobs"),
        };

        return { plan };
    } catch (err: any) {
        console.warn("[PlannerNode] Error:", err.message);
        return {
            plan: {
                steps: [],
                parallelBranches: [],
                needsWebContext: false,
                needsRag: false,
                needsMcp: false,
            },
            errors: [{ node: "planner", message: err.message }],
        };
    }
}
