// ═══════════════════════════════════════════════════════════════
// Aria Agent — Full Agentic AI Career Co-Pilot
// Loop: PERCEIVE → PLAN → ACT → REFLECT → RESPOND → MEMORIZE
//
// When USE_LANGGRAPH=true, delegates to the LangGraph orchestrator.
// Otherwise, runs the existing custom while-loop unchanged.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../services/chatService.js";
import { classifyIntent, planTools, reflectOnStep } from "./intentClassifier.js";
import { executeAgentTool, getToolDescriptions } from "./tools/index.js";
import { updateUserMemory, saveAgentSteps, formatMemoriesForPrompt } from "./agentMemory.js";
import { USE_LANGGRAPH } from "../config/featureFlags.js";
import type { AgentContext, AgentStep } from "./tools/index.js";

// ── Response type ─────────────────────────────────────────────
export interface AgentResponse {
    message: string;
    steps: AgentStep[];
    toolsUsed: string[];
    intent: string;
    memories?: string;
}

// ── System Prompt ─────────────────────────────────────────────
function buildSystemPrompt(ctx: AgentContext): string {
    const toolList = getToolDescriptions();
    const memoriesStr = formatMemoriesForPrompt(ctx.memories || []);
    const atsInfo = ctx.atsScore ? `ATS Score: ${ctx.atsScore}/100` : "ATS Score: not yet scored";
    const skillsInfo = ctx.userSkills.length > 0 ? `Skills: ${ctx.userSkills.join(", ")}` : "Skills: not yet analyzed";

    return `You are Aria, an elite AI Career Co-Pilot built into JobSkill AI.
You are not a generic chatbot. You are a specialized career intelligence
system with deep knowledge of ATS systems, resume optimization,
technical hiring, and the Indian tech job market.

YOUR PERSONALITY:
- Direct and actionable. Never give vague advice.
- Data-first. Always reference the user's actual resume data,
  their ATS score, their skills, and their specific situation.
- Proactive. Don't wait to be asked — notice problems and flag them.
- Warm but professional. You genuinely care about the user's career.

YOUR CAPABILITIES (tools you have called):
${toolList}

USER CONTEXT:
  ${atsInfo}
  ${skillsInfo}
${memoriesStr}

RULES:
1. Always use the user's ACTUAL resume data — not hypothetical
2. Reference specific data from tool outputs in your response
3. For multi-step requests, synthesize ALL tool outputs into one cohesive answer
4. After every answer, suggest ONE next action: "💡 Next step: [X]"
5. If the user's ATS score < 50 and they ask about jobs, address
   the score first: "Let's boost your score to 65+ before applying —
   you'll get 3x more callbacks. Here's what to fix..."
6. Show your reasoning when doing complex analysis (transparency)

FORMAT:
- Use markdown for structure (bullets, bold, code blocks for resume text)
- For job listings: show title, company, match %, and top 2 reasons for match
- For resume fixes: show BEFORE → AFTER clearly
- Keep responses under 400 words unless the user asked for a full rewrite
- End with: "💡 Next step: [specific action]"`;
}

// ── Synthesize final response from tool outputs ───────────────
async function synthesizeResponse(
    steps: AgentStep[],
    ctx: AgentContext,
    intent: { type: string }
): Promise<string> {
    // If no tools were called, do a direct AI chat
    if (steps.length === 0) {
        const systemPrompt = buildSystemPrompt(ctx);
        const result = await getAIReply([
            { role: "system", content: systemPrompt },
            { role: "user", content: ctx.message },
        ], "chat");
        return result.reply;
    }

    // Collect all tool outputs
    const toolSummaries = steps.map(s => {
        const outputStr = typeof s.toolOutput === "string"
            ? s.toolOutput
            : JSON.stringify(s.toolOutput, null, 2).substring(0, 2000);
        return `[Tool: ${s.tool}]\n${outputStr}`;
    }).join("\n\n");

    const systemPrompt = buildSystemPrompt(ctx);
    const result = await getAIReply([
        { role: "system", content: systemPrompt },
        {
            role: "user",
            content: `User asked: "${ctx.message}"\n\nI called these tools and got the following results:\n\n${toolSummaries}\n\nSynthesize this data into a clear, actionable response for the user. Reference specific numbers and facts from the tool outputs. End with one specific next step suggestion.`,
        },
    ], "chat");

    return result.reply;
}

// ═══════════════════════════════════════════════════════════════
// MAIN AGENT LOOP
// ═══════════════════════════════════════════════════════════════
const MAX_STEPS = 6;

export async function runAriaAgent(ctx: AgentContext): Promise<AgentResponse> {
    // ── LangGraph delegation (when enabled) ───────────────────
    if (USE_LANGGRAPH) {
        try {
            const { runLangGraphAgent } = await import("../graph/langgraphOrchestrator.js");
            const result = await runLangGraphAgent({
                userId: ctx.userId,
                sessionId: ctx.sessionId,
                message: ctx.message,
                history: ctx.history,
                resumeData: ctx.resumeData,
                atsScore: ctx.atsScore,
                userSkills: ctx.userSkills,
                userProfile: ctx.userProfile,
                memories: ctx.memories,
            });
            return {
                message: result.message,
                steps: result.steps.map(s => ({
                    thought: s.thought,
                    tool: s.tool,
                    toolInput: {},
                    toolOutput: {},
                    reflection: s.reflection || "",
                })),
                toolsUsed: result.toolsUsed,
                intent: result.intent,
            };
        } catch (err: any) {
            console.error("[Agent] LangGraph fallback to legacy:", err.message);
            // Fall through to legacy loop
        }
    }

    // ── LEGACY AGENT LOOP ─────────────────────────────────────
    const steps: AgentStep[] = [];

    try {
        // ── STEP 1: PERCEIVE — classify the intent ────────────
        console.log(`[Agent] Processing message: "${ctx.message.substring(0, 80)}..."`);
        const intent = await classifyIntent(ctx.message, ctx.history);
        console.log(`[Agent] Intent: ${intent.type} (confidence: ${intent.confidence})`);

        // ── STEP 2: PLAN — decide which tools are needed ──────
        const plan = planTools(intent, ctx);
        console.log(`[Agent] Plan: ${plan.tools.map(t => t.name).join(" → ") || "direct chat"}`);

        // ── STEP 3: ACT — execute tools in sequence ───────────
        for (const toolCall of plan.tools) {
            if (steps.length >= MAX_STEPS) {
                console.log("[Agent] Max steps reached, stopping tool execution.");
                break;
            }

            const step = await executeAgentTool(toolCall, ctx, steps);
            steps.push(step);

            // ── STEP 4: REFLECT — is the result enough? ──────
            const reflection = reflectOnStep(step, ctx, intent);
            if (reflection.isComplete) break;
            if (reflection.shouldRetry && reflection.revisedArgs) {
                const retryStep = await executeAgentTool(
                    { ...toolCall, args: reflection.revisedArgs },
                    ctx,
                    steps
                );
                steps.push(retryStep);
            }
        }

        // ── STEP 5: RESPOND — synthesize final answer ─────────
        const finalAnswer = await synthesizeResponse(steps, ctx, intent);

        // ── STEP 6: MEMORIZE — save key facts ─────────────────
        try {
            await updateUserMemory(ctx.userId, steps, intent);
            await saveAgentSteps(
                ctx.sessionId,
                ctx.userId,
                steps,
                steps.map(s => s.tool).filter(Boolean),
                intent.type
            );
        } catch (memErr: any) {
            console.warn("[Agent] Memory save failed:", memErr.message);
        }

        return {
            message: finalAnswer,
            steps,
            toolsUsed: steps.map(s => s.tool).filter(Boolean),
            intent: intent.type,
        };
    } catch (err: any) {
        console.error("[Agent] Agent loop error:", err);

        // Graceful fallback — do a direct chat if agent fails
        try {
            const fallbackResult = await getAIReply([
                { role: "user", content: ctx.message },
            ], "chat");

            return {
                message: fallbackResult.reply,
                steps,
                toolsUsed: [],
                intent: "general_chat",
            };
        } catch {
            return {
                message: "I'm having trouble processing your request right now. Please try again in a moment.",
                steps,
                toolsUsed: [],
                intent: "error",
            };
        }
    }
}
