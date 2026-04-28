// ═══════════════════════════════════════════════════════════════
// Career Tools — Agent tools for career planning and optimization
// ═══════════════════════════════════════════════════════════════

import { getAIReply, optimizeLinkedIn } from "../../services/chatService.js";
import type { AgentTool, AgentContext } from "./index.js";

// ═══════════════════════════════════════════════════════════════
export const careerTools: AgentTool[] = [
    {
        name: "generate_roadmap",
        description: "Create a 3-6 month personalized career roadmap to reach a target role",
        parameters: { targetRole: "string", targetCompany: "string?", timelineMonths: "number?" },
        execute: async (args: any, ctx: AgentContext) => {
            const userSkills = ctx.userSkills?.join(", ") || "unknown";
            const role = args.targetRole || "Senior Software Engineer";
            const months = args.timelineMonths || 3;
            const company = args.targetCompany || "";

            const result = await getAIReply([{
                role: "user",
                content: `Create a detailed ${months}-month career roadmap.\n\nCurrent skills: ${userSkills}\nATS Score: ${ctx.atsScore || "unknown"}\nTarget role: "${role}"${company ? ` at ${company}` : ""}\n\nWeek by week breakdown with:\n- Specific courses/resources (with links)\n- Practice projects to build\n- Milestones to track progress\n- Skills to acquire each month\n- Interview readiness checkpoints`,
            }], "chat");

            return { roadmap: result.reply, target_role: role, months };
        },
    },
    {
        name: "optimize_linkedin",
        description: "Analyze and generate improvements for the user's LinkedIn profile",
        parameters: { section: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const resumeText = ctx.resumeData?.rawText || JSON.stringify(ctx.resumeData?.sections || {});
            if (!resumeText) return { error: "No resume found." };

            const result = await optimizeLinkedIn(resumeText);
            return { suggestions: result.reply, section: args.section || "all" };
        },
    },
    {
        name: "get_salary_insights",
        description: "Get salary benchmarks for a role in a specific location",
        parameters: { role: "string", location: "string?", experience: "string?" },
        execute: async (args: any, _ctx: AgentContext) => {
            const role = args.role || "Software Engineer";
            const location = args.location || "India";
            const experience = args.experience || "entry-level";

            const result = await getAIReply([{
                role: "user",
                content: `Provide current 2024-2025 salary ranges for "${role}" (${experience}) in:\n1. ${location} (local currency)\n2. US ($ annual)\n3. Remote ($ range)\n\nInclude:\n- Base salary ranges\n- Total compensation with bonuses/equity\n- Top-paying companies\n- Negotiation tips for this level`,
            }], "chat");

            return { salary_data: result.reply, role, location };
        },
    },
];
