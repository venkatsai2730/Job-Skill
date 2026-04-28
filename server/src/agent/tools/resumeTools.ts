// ═══════════════════════════════════════════════════════════════
// Resume Tools — Agent tools for resume analysis and optimization
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../../config/supabase.js";
import { getAIReply, fixResumeBullets, rewriteResumeSection } from "../../services/chatService.js";
import { computeAdvancedATS } from "../../lib/advanced-scorer.js";
import { parseSections } from "../../routes/resume.js";
import type { AgentTool, AgentContext } from "./index.js";

// ── Helper: Get latest resume ─────────────────────────────────
async function getLatestResume(userId: string) {
    const { data } = await supabaseAdmin
        .from("resumes")
        .select("parsed_data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
    return data?.parsed_data as any || null;
}

// ═══════════════════════════════════════════════════════════════
export const resumeTools: AgentTool[] = [
    {
        name: "get_resume_score",
        description: "Get the user's current ATS score breakdown with all penalties and issues",
        parameters: {},
        execute: async (_args: any, ctx: AgentContext) => {
            const pd = ctx.resumeData || await getLatestResume(ctx.userId);
            if (!pd) return { error: "No resume found. Please upload a resume first." };

            const rawText = pd.rawText || JSON.stringify(pd.sections || {});
            const sections = pd.sections || parseSections(rawText);
            const ats = computeAdvancedATS(sections, rawText, ctx.userId);

            return {
                score: ats.score,
                grade: ats.grade,
                percentile: ats.percentile,
                label: ats.label,
                atsRisk: ats.atsRisk,
                top_issues: ats.top_issues?.slice(0, 5) || [],
                next_steps: ats.next_steps || [],
                breakdown: ats.breakdown,
            };
        },
    },
    {
        name: "fix_resume_bullet",
        description: "Rewrite a specific resume bullet to be stronger, quantified, and ATS-friendly",
        parameters: { bullet: "string", context: "string", targetRole: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const bullet = args.bullet || "";
            if (!bullet) {
                // If no specific bullet, get weakest bullets from resume
                const pd = ctx.resumeData || await getLatestResume(ctx.userId);
                if (!pd) return { error: "No resume found." };
                const rawText = pd.rawText || JSON.stringify(pd.sections || {});
                const result = await fixResumeBullets(rawText, args.context);
                return result;
            }
            const result = await fixResumeBullets(bullet, args.context || args.targetRole);
            return result;
        },
    },
    {
        name: "get_resume_keywords",
        description: "Extract missing keywords from resume compared to a job description",
        parameters: { jobDescription: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const pd = ctx.resumeData || await getLatestResume(ctx.userId);
            if (!pd) return { error: "No resume found." };

            const resumeText = pd.rawText || JSON.stringify(pd.sections || {});
            const jd = args.jobDescription || "general software engineering role";

            const result = await getAIReply([{
                role: "user",
                content: `Compare this resume against the job description. Find ALL missing keywords.\n\nResume:\n${resumeText.substring(0, 3000)}\n\nJob Description:\n${jd}\n\nReturn: found keywords, missing critical keywords, and suggestions.`,
            }], "chat");

            return { analysis: result.reply };
        },
    },
    {
        name: "get_skill_gap",
        description: "Compare user skills against a target role and return what they're missing",
        parameters: { targetRole: "string", targetCompany: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const userSkills = ctx.userSkills || [];
            const role = args.targetRole || "Software Engineer";
            const company = args.targetCompany || "";

            const result = await getAIReply([{
                role: "user",
                content: `The user has these skills: ${userSkills.join(", ") || "unknown"}.\n\nAnalyze the skill gap for the role: "${role}"${company ? ` at ${company}` : ""}.\n\nReturn:\n1. Skills they already have that are relevant\n2. Critical missing skills\n3. Nice-to-have skills\n4. Recommended learning path for each gap`,
            }], "chat");

            return { gap_analysis: result.reply };
        },
    },
    {
        name: "rewrite_resume_section",
        description: "Fully rewrite a resume section (summary, experience, skills) for a target role",
        parameters: { section: "string", targetRole: "string" },
        execute: async (args: any, ctx: AgentContext) => {
            const pd = ctx.resumeData || await getLatestResume(ctx.userId);
            if (!pd) return { error: "No resume found." };

            const resumeText = pd.rawText || JSON.stringify(pd.sections || {});
            const section = args.section || "summary";
            const atsIssues = pd.ats?.issues?.filter((i: any) => i.type === "warning").map((i: any) => i.text) || [];

            const result = await rewriteResumeSection(resumeText, section, atsIssues);
            return { rewritten_section: result.reply, section_name: section };
        },
    },
];
