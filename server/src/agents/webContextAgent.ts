// ═══════════════════════════════════════════════════════════════
// Web Context Agent — Company insights + hiring signals
//
// Gated capability for enriching responses with company context.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../services/chatService.js";
import { retrieveCompanyInsights } from "../rag/retrieve.js";
import { selectModelForTask } from "../agent/modelPolicy.js";

export class WebContextAgent {
    private modelConfig;

    constructor() {
        this.modelConfig = selectModelForTask("chat", { preferFast: true });
    }

    getSystemPrompt(): string {
        return `You are the Web Context Agent within JobSkill AI.
Your job is to provide factual company context for career decisions.

RULES:
1. Only state facts you are confident about
2. Clearly mark anything uncertain with "reportedly" or "likely"
3. Focus on: tech stack, hiring trends, culture, interview process
4. Keep responses concise and actionable`;
    }

    getPreferredModel() {
        return this.modelConfig;
    }

    async getCompanyContext(companyName: string): Promise<{
        source: string;
        context: string;
        cached: boolean;
    }> {
        // First check Qdrant cache
        const cached = await retrieveCompanyInsights(companyName, 3);
        if (cached.length > 0) {
            return {
                source: "qdrant_cache",
                context: cached.map(r => r.text).join("\n\n"),
                cached: true,
            };
        }

        // Generate via LLM
        const result = await getAIReply([{
            role: "user",
            content: `Brief hiring context for "${companyName}": tech stack, culture, interview style. Be factual and concise.`,
        }], "chat");

        return {
            source: "llm_knowledge",
            context: result.reply,
            cached: false,
        };
    }
}

export const webContextAgent = new WebContextAgent();
