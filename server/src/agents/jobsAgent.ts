// ═══════════════════════════════════════════════════════════════
// Jobs Agent — Standalone wrapper for job search + matching tools
//
// Encapsulates job-specific logic with MCP integration.
// ═══════════════════════════════════════════════════════════════

import { jobTools } from "../agent/tools/jobTools.js";
import { selectModelForTask } from "../agent/modelPolicy.js";
import type { AgentContext, AgentTool } from "../agent/tools/index.js";

export class JobsAgent {
    private tools: AgentTool[];
    private modelConfig;

    constructor() {
        this.tools = jobTools;
        this.modelConfig = selectModelForTask("job_matching");
    }

    getSystemPrompt(): string {
        return `You are the Jobs Agent within JobSkill AI.
Your job is to find, rank, and explain job opportunities.

CAPABILITIES:
${this.tools.map(t => `- ${t.name}: ${t.description}`).join("\n")}

RULES:
1. Always rank jobs by resume match, not just recency
2. Show match_score, matched_skills, and skill_gap for each job
3. Highlight the top 3-5 matches most prominently
4. Explain WHY a job matches or doesn't match
5. Include direct apply links
6. Note if a job might expire soon (>30 days old)`;
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

export const jobsAgent = new JobsAgent();
