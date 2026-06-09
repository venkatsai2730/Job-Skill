// ═══════════════════════════════════════════════════════════════
// Tool Registry — Unified registration of all agent capabilities
// Each tool has: name, description, parameters, execute()
// ═══════════════════════════════════════════════════════════════

import { resumeTools } from "./resumeTools.js";
import { resumeEditTools } from "./resumeEditTool.js";
import { jobTools } from "./jobTools.js";
import { interviewTools } from "./interviewTools.js";
import { careerTools } from "./careerTools.js";
import { memoryTools } from "./memoryTools.js";

// ── Types ─────────────────────────────────────────────────────
export interface AgentContext {
    userId: string;
    sessionId: string;
    message: string;
    history: { role: string; content: string }[];
    resumeData: any | null;
    atsScore: number | null;
    userSkills: string[];
    userProfile: any | null;
    memories: any[];
}

export interface AgentTool {
    name: string;
    description: string;
    parameters: Record<string, string>;
    execute: (args: any, ctx: AgentContext) => Promise<any>;
}

export interface AgentStep {
    thought: string;
    tool: string;
    toolInput: any;
    toolOutput: any;
    reflection: string;
}

// ── Unified Tool Registry ─────────────────────────────────────
export const ARIA_TOOLS: AgentTool[] = [
    ...resumeTools,
    ...resumeEditTools,
    ...jobTools,
    ...interviewTools,
    ...careerTools,
    ...memoryTools,
];

// ── Tool lookup by name ───────────────────────────────────────
const toolMap = new Map<string, AgentTool>();
for (const tool of ARIA_TOOLS) {
    toolMap.set(tool.name, tool);
}

// ── Execute a tool by name ────────────────────────────────────
export async function executeAgentTool(
    toolCall: { name: string; args: Record<string, any> },
    ctx: AgentContext,
    _previousSteps: AgentStep[]
): Promise<AgentStep> {
    const tool = toolMap.get(toolCall.name);

    if (!tool) {
        return {
            thought: `Tool "${toolCall.name}" not found in registry.`,
            tool: toolCall.name,
            toolInput: toolCall.args,
            toolOutput: { error: `Unknown tool: ${toolCall.name}` },
            reflection: "Tool not found. Will use general chat instead.",
        };
    }

    try {
        console.log(`[Agent] Executing tool: ${tool.name}`);
        const output = await tool.execute(toolCall.args, ctx);

        return {
            thought: `Called ${tool.name} to ${tool.description}`,
            tool: tool.name,
            toolInput: toolCall.args,
            toolOutput: output,
            reflection: output.error ? "Tool returned an error." : "Tool executed successfully.",
        };
    } catch (err: any) {
        console.error(`[Agent] Tool ${tool.name} failed:`, err.message);
        return {
            thought: `Tool ${tool.name} threw an error.`,
            tool: tool.name,
            toolInput: toolCall.args,
            toolOutput: { error: err.message },
            reflection: "Tool execution failed. Will provide fallback response.",
        };
    }
}

// ── Get tool descriptions for system prompt injection ─────────
export function getToolDescriptions(): string {
    return ARIA_TOOLS.map(t => {
        const params = Object.entries(t.parameters)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
        return `- ${t.name}(${params}): ${t.description}`;
    }).join("\n");
}

// ── Get tool names list ───────────────────────────────────────
export function getToolNames(): string[] {
    return ARIA_TOOLS.map(t => t.name);
}
