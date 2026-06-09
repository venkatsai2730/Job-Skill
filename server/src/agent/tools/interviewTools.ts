// ═══════════════════════════════════════════════════════════════
// Interview Tools — Agent tools for interview preparation
// ═══════════════════════════════════════════════════════════════

import { getAIReply, predictInterviewQuestions } from "../../services/chatService.js";
import type { AgentTool, AgentContext } from "./index.js";

// ═══════════════════════════════════════════════════════════════
export const interviewTools: AgentTool[] = [
    {
        name: "generate_interview_questions",
        description: "Generate role-specific interview questions based on the job and resume",
        parameters: { jobTitle: "string", difficulty: "string?", type: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const resumeText = ctx.resumeData?.rawText || JSON.stringify(ctx.resumeData?.sections || {});
            if (!resumeText) return { error: "No resume found." };

            const role = args.jobTitle || "Software Engineer";
            const difficulty = args.difficulty || "medium";
            const qType = args.type || "both";

            const result = await getAIReply([{
                role: "user",
                content: `Generate ${qType === "both" ? "technical AND behavioral" : qType} interview questions for a "${role}" role.\n\nDifficulty: ${difficulty}\nCandidate's resume:\n${resumeText.substring(0, 2500)}\n\nFor each question:\n1. The question\n2. Why it's asked\n3. Key points to cover in the answer\n4. A sample answer outline based on the candidate's resume`,
            }], "interview_prediction");

            return { questions: result.reply, role, difficulty };
        },
    },
    {
        name: "evaluate_interview_answer",
        description: "Evaluate the user's answer to an interview question using STAR framework",
        parameters: { question: "string", answer: "string" },
        execute: async (args: any, _ctx: AgentContext) => {
            const result = await getAIReply([{
                role: "user",
                content: `Evaluate this interview answer using the STAR framework (Situation, Task, Action, Result).\n\nQuestion: ${args.question}\n\nCandidate's Answer: ${args.answer}\n\nProvide:\n1. STAR breakdown score (1-10 for each component)\n2. Overall score (1-10)\n3. What was strong\n4. What was missing\n5. Improved version of the answer`,
            }], "chat");

            return { evaluation: result.reply };
        },
    },
    {
        name: "mock_interview",
        description: "Start a mock interview session for a specific role",
        parameters: { role: "string", company: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const resumeText = ctx.resumeData?.rawText || "";
            const role = args.role || "Software Engineer";
            const company = args.company || "";

            const result = await getAIReply([{
                role: "user",
                content: `Start a mock interview session. You are the interviewer for a "${role}" position${company ? ` at ${company}` : ""}.\n\nCandidate's resume:\n${resumeText.substring(0, 2000)}\n\nAsk the FIRST interview question. Make it specific to the candidate's background. Start with: "Welcome to your mock interview! Let's begin..."`,
            }], "chat");

            return { interview_start: result.reply, role, company };
        },
    },
];
