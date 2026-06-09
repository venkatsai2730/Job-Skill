// ═══════════════════════════════════════════════════════════════
// Memory Tools — Agent tools for persistent user memory
// ═══════════════════════════════════════════════════════════════

import { getUserMemory, setUserMemory } from "../agentMemory.js";
import type { AgentTool, AgentContext } from "./index.js";

// ═══════════════════════════════════════════════════════════════
export const memoryTools: AgentTool[] = [
    {
        name: "recall_user_preference",
        description: "Recall something the user mentioned in a previous session (e.g., target role, company, preferences)",
        parameters: { topic: "string" },
        execute: async (args: any, ctx: AgentContext) => {
            const memory = await getUserMemory(ctx.userId, args.topic);
            if (!memory) {
                return { found: false, message: `No saved preference found for "${args.topic}".` };
            }
            return {
                found: true,
                key: memory.key,
                value: memory.value,
                last_updated: memory.updated_at,
            };
        },
    },
    {
        name: "save_user_preference",
        description: "Save a user preference or fact for future sessions (e.g., target role, preferred location, skills being learned)",
        parameters: { key: "string", value: "string" },
        execute: async (args: any, ctx: AgentContext) => {
            const success = await setUserMemory(ctx.userId, args.key, args.value, ctx.sessionId);
            return {
                saved: success,
                message: success
                    ? `Saved "${args.key}" = "${args.value}". I'll remember this in future sessions.`
                    : "Failed to save preference.",
            };
        },
    },
];
