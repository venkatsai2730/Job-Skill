// ═══════════════════════════════════════════════════════════════
// Job Tools — Agent tools for job search, matching, and cover letters
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../../config/supabase.js";
import { rankJobsForUser } from "../../services/jobRankingService.js";
import { getAIReply, generateCoverLetter } from "../../services/chatService.js";
import { searchJobs } from "../../services/jobFetcher.js";
import type { AgentTool, AgentContext } from "./index.js";

// ═══════════════════════════════════════════════════════════════
export const jobTools: AgentTool[] = [
    {
        name: "search_jobs",
        description: "Search job listings from the database ranked by resume match",
        parameters: { query: "string?", location: "string?", seniority: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const result = await searchJobs({
                query: args.query || "",
                location: args.location || "",
                limit: 20,
                page: 1,
                user_skills: ctx.userSkills,
            });

            const jobs = result.data || [];
            if (jobs.length === 0) return { jobs: [], message: "No matching jobs found." };

            const ranked = await rankJobsForUser(ctx.userId, jobs, 10);
            return {
                jobs: ranked.map((j: any) => ({
                    title: j.title,
                    company: j.company,
                    location: j.location,
                    match_score: j.match_score,
                    matched_skills: j.matched_skills,
                    skill_gap: j.skill_gap,
                    job_url: j.job_url,
                    source: j.source,
                    posted_at: j.posted_at,
                })),
                total: ranked.length,
            };
        },
    },
    {
        name: "get_top_matched_jobs",
        description: "Get the top 5 jobs that best match the user's resume right now",
        parameters: {},
        execute: async (_args: any, ctx: AgentContext) => {
            // Fetch active jobs from DB
            const { data: jobs } = await supabaseAdmin
                .from("job_listings")
                .select("*")
                .eq("is_active", true)
                .order("posted_at", { ascending: false })
                .limit(100);

            if (!jobs || jobs.length === 0) return { jobs: [], message: "No active jobs in the database." };

            const ranked = await rankJobsForUser(ctx.userId, jobs, 5);
            return {
                jobs: ranked.map((j: any) => ({
                    title: j.title,
                    company: j.company,
                    location: j.location,
                    match_score: j.match_score,
                    matched_skills: j.matched_skills?.slice(0, 5),
                    skill_gap: j.skill_gap?.slice(0, 3),
                    job_url: j.job_url,
                    source: j.source,
                })),
            };
        },
    },
    {
        name: "explain_job_match",
        description: "Explain in detail why a specific job is or isn't a good match for the user",
        parameters: { jobTitle: "string", jobCompany: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const resumeText = ctx.resumeData?.rawText || JSON.stringify(ctx.resumeData?.sections || {});
            const userSkills = ctx.userSkills?.join(", ") || "unknown";

            const result = await getAIReply([{
                role: "user",
                content: `The user has these skills: ${userSkills}\nATS Score: ${ctx.atsScore || "unknown"}\n\nExplain why the job "${args.jobTitle}"${args.jobCompany ? ` at ${args.jobCompany}` : ""} matches or doesn't match this candidate. Be specific about:\n1. Skill overlaps\n2. Experience fit\n3. Seniority match\n4. What they'd need to improve\n\nResume context:\n${resumeText?.substring(0, 2000) || "No resume"}`,
            }], "chat");

            return { explanation: result.reply };
        },
    },
    {
        name: "generate_cover_letter",
        description: "Generate a tailored cover letter for a specific job",
        parameters: { jobDescription: "string?", jobTitle: "string?", company: "string?", tone: "string?" },
        execute: async (args: any, ctx: AgentContext) => {
            const resumeText = ctx.resumeData?.rawText || JSON.stringify(ctx.resumeData?.sections || {});
            if (!resumeText) return { error: "No resume found." };

            const jd = args.jobDescription || `${args.jobTitle || "Software Engineer"} role${args.company ? ` at ${args.company}` : ""}`;
            const result = await generateCoverLetter(
                resumeText,
                jd,
                args.company || "the company",
                args.tone || "professional"
            );

            return { cover_letter: result.reply };
        },
    },
];
