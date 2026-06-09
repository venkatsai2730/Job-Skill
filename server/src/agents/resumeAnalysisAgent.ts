// ═══════════════════════════════════════════════════════════════
// Resume Analysis Agent — Standalone wrapper for resume tools
//
// Encapsulates resume-specific logic with its own system prompt.
// Used by the LangGraph orchestrator as a specialized agent.
// ═══════════════════════════════════════════════════════════════

import { resumeTools } from "../agent/tools/resumeTools.js";
import { selectModelForTask } from "../agent/modelPolicy.js";
import type { AgentContext, AgentTool } from "../agent/tools/index.js";

export class ResumeAnalysisAgent {
    private tools: AgentTool[];
    private modelConfig;

    constructor() {
        this.tools = resumeTools;
        this.modelConfig = selectModelForTask("resume_analysis");
    }

    getSystemPrompt(): string {
        return `You are the Resume Analysis Agent within JobSkill AI.
Your job is to analyze, score, and improve resumes for ATS compatibility.

CAPABILITIES:
${this.tools.map(t => `- ${t.name}: ${t.description}`).join("\n")}

RULES:
1. Always reference the user's ACTUAL resume data
2. Cite specific ATS penalties and their impact
3. When suggesting fixes, show before/after examples
4. Never hallucinate skills or experience the user doesn't have
5. Use markdown formatting for readability`;
    }

    getPreferredModel() {
        return this.modelConfig;
    }

    async executeTool(toolName: string, args: any, ctx: AgentContext): Promise<any> {
        const tool = this.tools.find(t => t.name === toolName);
        if (!tool) throw new Error(`Tool not found: ${toolName}`);
        return tool.execute(args, ctx);
    }

    getAvailableTools(): string[] {
        return this.tools.map(t => t.name);
    }
}

export const resumeAnalysisAgent = new ResumeAnalysisAgent();
