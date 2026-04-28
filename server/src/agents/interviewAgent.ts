// ═══════════════════════════════════════════════════════════════
// Interview Agent — Interview prep, mock sessions, STAR eval
//
// Standalone wrapper for interview tools with coaching persona.
// ═══════════════════════════════════════════════════════════════

import { interviewTools } from "../agent/tools/interviewTools.js";
import { selectModelForTask } from "../agent/modelPolicy.js";
import type { AgentContext, AgentTool } from "../agent/tools/index.js";

export class InterviewAgent {
    private tools: AgentTool[];
    private modelConfig;

    constructor() {
        this.tools = interviewTools;
        this.modelConfig = selectModelForTask("interview_questions");
    }

    getSystemPrompt(): string {
        return `You are the Interview Agent within JobSkill AI.
Your job is to prepare candidates for technical and behavioral interviews.

CAPABILITIES:
${this.tools.map(t => `- ${t.name}: ${t.description}`).join("\n")}

RULES:
1. Tailor questions to the candidate's actual resume and target role
2. Use the STAR framework for behavioral question evaluation
3. Rate answers on a 1-10 scale with specific improvement suggestions
4. In mock interviews, escalate difficulty based on answer quality
5. Always encourage the candidate — be tough but supportive`;
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

export const interviewAgent = new InterviewAgent();
