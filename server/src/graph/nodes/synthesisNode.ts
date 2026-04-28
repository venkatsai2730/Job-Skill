// ═══════════════════════════════════════════════════════════════
// Synthesis Node — Merges all agent outputs into final answer
//
// Collects outputs from all parallel branches, synthesizes them
// into a coherent response via LLM.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../../services/chatService.js";
import { formatMemoriesForPrompt } from "../../agent/agentMemory.js";
import { traceNodeExecution, traceLLMCall } from "../../observability/langfuse.js";
import type { AgentGraphState, LLMCallRecord } from "../state.js";

export async function synthesisNode(
    state: AgentGraphState
): Promise<Partial<AgentGraphState>> {
    traceNodeExecution(state.traceId, "synthesis", state);

    const llmCalls: LLMCallRecord[] = [];

    try {
        // Collect all tool outputs into a summary
        const toolSummaries = buildToolSummaries(state);

        // If no tools were called, do a direct chat
        if (toolSummaries.length === 0) {
            const startTime = Date.now();
            const systemPrompt = buildSystemPrompt(state);

            const result = await getAIReply([
                { role: "system", content: systemPrompt },
                { role: "user", content: state.userMessage },
            ], "chat");

            const latency = Date.now() - startTime;

            llmCalls.push({
                model: result.model || "unknown",
                provider: result.provider || "unknown",
                feature: "chat",
                tokens: result.tokens || 0,
                latencyMs: latency,
            });

            traceLLMCall(state.traceId, {
                model: result.model, provider: result.provider,
                prompt: state.userMessage, output: result.reply,
                tokens: result.tokens, latencyMs: latency,
                parentNode: "synthesis", feature: "chat",
            });

            return {
                finalAnswer: result.reply,
                llmCalls,
            };
        }

        // Synthesize from multiple tool outputs
        const startTime = Date.now();
        const systemPrompt = buildSystemPrompt(state);
        const synthesisPrompt = `User asked: "${state.userMessage}"

I called these tools and got the following results:

${toolSummaries.join("\n\n")}

${state.ragContext.length > 0 ? `\nSemantic search also found ${state.ragContext.reduce((s: number, r: any) => s + (r.hits || 0), 0)} relevant vectors from the knowledge base.\n` : ""}

Synthesize this data into a clear, actionable response for the user. Reference specific numbers and facts from the tool outputs. End with one specific next step suggestion.`;

        const result = await getAIReply([
            { role: "system", content: systemPrompt },
            { role: "user", content: synthesisPrompt },
        ], "chat");

        const latency = Date.now() - startTime;

        llmCalls.push({
            model: result.model || "unknown",
            provider: result.provider || "unknown",
            feature: "synthesis",
            tokens: result.tokens || 0,
            latencyMs: latency,
        });

        traceLLMCall(state.traceId, {
            model: result.model, provider: result.provider,
            prompt: synthesisPrompt.substring(0, 2000),
            output: result.reply.substring(0, 2000),
            tokens: result.tokens, latencyMs: latency,
            parentNode: "synthesis", feature: "synthesis",
        });

        return {
            finalAnswer: result.reply,
            llmCalls,
        };
    } catch (err: any) {
        console.warn("[SynthesisNode] Error:", err.message);
        return {
            finalAnswer: "I'm having trouble processing your request right now. Please try again in a moment.",
            errors: [{ node: "synthesis", message: err.message }],
            llmCalls,
        };
    }
}

// ── Build system prompt with context ──────────────────────────
function buildSystemPrompt(state: AgentGraphState): string {
    const atsInfo = state.resumeContext?.atsScore
        ? `ATS Score: ${state.resumeContext.atsScore}/100`
        : "ATS Score: not yet scored";

    const skillsInfo = state.resumeContext?.userSkills?.length > 0
        ? `Skills: ${state.resumeContext.userSkills.join(", ")}`
        : "Skills: not yet analyzed";

    const memoriesStr = formatMemoriesForPrompt(state.memories || []);

    return `You are Aria, an elite AI Career Co-Pilot built into JobSkill AI.
You are not a generic chatbot. You are a specialized career intelligence
system with deep knowledge of ATS systems, resume optimization,
technical hiring, and the Indian tech job market.

YOUR PERSONALITY:
- Direct and actionable. Never give vague advice.
- Data-first. Always reference the user's actual resume data.
- Proactive. Notice problems and flag them.
- Warm but professional.

USER CONTEXT:
  ${atsInfo}
  ${skillsInfo}
${memoriesStr}

RULES:
1. Always use the user's ACTUAL resume data — not hypothetical
2. Reference specific data from tool outputs in your response
3. For multi-step requests, synthesize ALL tool outputs into one cohesive answer
4. After every answer, suggest ONE next action: "💡 Next step: [X]"
5. Keep responses under 400 words unless the user asked for a full rewrite
6. Use markdown for structure`;
}

// ── Build tool summaries from state ───────────────────────────
function buildToolSummaries(state: AgentGraphState): string[] {
    const summaries: string[] = [];

    // Resume analysis results
    if (state.resumeContext?.analysis) {
        for (const [tool, output] of Object.entries(state.resumeContext.analysis)) {
            const outputStr = typeof output === "string"
                ? output : JSON.stringify(output, null, 2).substring(0, 2000);
            summaries.push(`[Tool: ${tool}]\n${outputStr}`);
        }
    }

    // Job results
    for (const jc of state.jobsContext) {
        const outputStr = typeof jc.result === "string"
            ? jc.result : JSON.stringify(jc.result, null, 2).substring(0, 2000);
        summaries.push(`[Tool: ${jc.tool}]\n${outputStr}`);
    }

    // Web context
    for (const wc of state.webContext) {
        const text = wc.context || wc.insights?.join("\n") || JSON.stringify(wc);
        summaries.push(`[Web Context: ${wc.company || "unknown"}]\n${text.substring(0, 1500)}`);
    }

    // Interview results
    if (state.interviewContext) {
        for (const [tool, output] of Object.entries(state.interviewContext)) {
            const outputStr = typeof output === "string"
                ? output : JSON.stringify(output, null, 2).substring(0, 2000);
            summaries.push(`[Tool: ${tool}]\n${outputStr}`);
        }
    }

    // Data agent results
    if (state.dataContext?.semanticJobs?.length > 0) {
        const topJobs = state.dataContext.semanticJobs.slice(0, 5)
            .map((j: any) => `  - ${j.title} at ${j.company} (similarity: ${(j.score * 100).toFixed(0)}%)`)
            .join("\n");
        summaries.push(`[Semantic Job Matches (from vector search)]\n${topJobs}`);
    }

    return summaries;
}
