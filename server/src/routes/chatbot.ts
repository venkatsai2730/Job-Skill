import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { simulateGreenhouse, simulateLever, simulateAshby, simulateNaukri } from "../lib/ats-simulator.js";
import {
    getAIReply, predictInterviewQuestions, fixResumeBullets, createResumeBullets,
    generateCoverLetter, scoreJobMatch, answerScreeningQuestions, optimizeLinkedIn,
} from "../services/chatService.js";
import { parseSections } from "./resume.js";
import { generateLatex } from "../lib/latex-generator.js";
import { searchJobs } from "../services/jobFetcher.js";

const router = Router();

// Helper to extract command from message
function extractCommand(message: string): string | null {
    if (!message || typeof message !== "string") return null;
    const match = message.trim().match(/^\/([a-zA-Z-]+)/);
    return match ? match[1].toLowerCase() : null;
}

// Helper to get remainder text after the command
function getCommandBody(message: string): string {
    return (message || "").replace(/^\/[a-zA-Z-]+\s*/, "").trim();
}

// Helper to auto-fetch resume context
export async function getResumeContext(userId: string): Promise<{ resumeText: string; parsedData: any } | null> {
    try {
        const { data: resumeRow, error } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!error && resumeRow?.parsed_data) {
            const parsed = resumeRow.parsed_data as any;
            const resumeText = parsed?.rawText || JSON.stringify(parsed?.sections || {});
            return { resumeText, parsedData: parsed };
        }
    } catch { /* no resume */ }
    return null;
}

// Helper to get user profile
export async function getUserProfile(userId: string): Promise<any | null> {
    try {
        const { data } = await supabaseAdmin
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();
        return data;
    } catch { return null; }
}

// ── HELP command content ────────────────────────────────────
const HELP_TEXT = `# 🤖 Aria — Your AI Career Co-Pilot

## Resume Commands
- \`/score\` — Full 20-criteria ATS score with breakdown
- \`/fix\` — Fix all weak bullets using STAR method
- \`/fix [bullet]\` — Fix a specific bullet line
- \`/keywords [JD]\` — Find missing keywords vs job description
- \`/compare [JD]\` — Full resume vs JD gap analysis
- \`/tailor [JD]\` — Rewrite resume bullets to match JD
- \`/improve\` — Top 5 highest-impact improvements
- \`/word-choice\` — Replace weak verbs with power verbs
- \`/quantify\` — Find & fix all bullets missing numbers

## Job Commands
- \`/jobs\` — Top 10 jobs matching your resume
- \`/jobs [role]\` — Jobs for a specific role
- \`/match [JD]\` — Score your resume against a specific JD
- \`/apply [URL]\` — Generate complete application package
- \`/why [job title]\` — Explain why a job matches or doesn't
- \`/salary [role]\` — Current salary range in India/global

## Application Commands
- \`/cover [JD]\` — Generate a tailored cover letter
- \`/cover-email\` — Generate email to send with application
- \`/answers [JD]\` — Generate screening question answers
- \`/followup\` — Generate follow-up email after applying

## Interview Commands
- \`/prep [JD]\` — Full interview preparation
- \`/questions [JD]\` — Generate 20 likely interview questions
- \`/behavioral\` — STAR-format behavioral answers
- \`/technical [role]\` — Technical questions for your skills
- \`/answer [Q]\` — Draft a model answer for a question
- \`/mock\` — Start a mock interview session

## Career Commands
- \`/skills\` — Analyse skill gaps for target roles
- \`/roadmap [role]\` — 90-day skill roadmap
- \`/market\` — Job market insights for your skills
- \`/linkedin\` — LinkedIn profile improvements

## Other
- \`/help\` — Show this list`;

// ── POST /api/chatbot/resume-chatbot ────────────────────────
router.post("/resume-chatbot", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { message, command: explicitCommand, payload = {} } = req.body;
        const userId = req.user!.userId;

        // 1. Determine the command — supports slash commands AND natural language
        let command = explicitCommand || extractCommand(message);
        const body = getCommandBody(message || "");

        // If no explicit slash command, try natural language mapping
        if (!command && message) {
            const nl = message.toLowerCase();
            if (/fix|improve|better|higher score|how to fix/.test(nl)) command = "fix";
            else if (/rewrite|improve my (summary|experience|projects|skills)/.test(nl)) command = "rewrite";
            else if (/find jobs|show jobs|what jobs|jobs for me/.test(nl)) command = "jobs";
            else if (/my score|ats score|how is my resume|check my resume|score my/.test(nl)) command = "score";
            else if (/interview|prepare for|interview questions/.test(nl)) command = "prep";
            else if (/roadmap|plan|30 day|what should i do/.test(nl)) command = "roadmap";
            else if (/write bullets|bullet points|help me write/.test(nl)) command = "fix";
            else if (/cover letter|write a cover/.test(nl)) command = "cover";
            else if (/mock interview/.test(nl)) command = "mock";
            else command = "chat"; // Default: conversational chat with resume context
        }

        if (!command) {
            return res.status(400).json({
                type: "error",
                message: "No command provided. Type /help to see all available commands."
            });
        }

        // 2. Extract payload data
        let { resumeText, jobDescription } = payload;

        // If body text provided and no JD, use body as JD
        if (body && body.length > 10 && !jobDescription) {
            jobDescription = body;
        }

        // 3. Auto-fetch Resume Context if missing
        if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
            const ctx = await getResumeContext(userId);
            if (ctx) {
                resumeText = ctx.resumeText;
            }
        }

        // Get user profile for context injection
        const userProfile = await getUserProfile(userId);

        // Build context prefix for AI prompts
        const contextPrefix = resumeText
            ? `[RESUME DATA]: ${resumeText.substring(0, 3000)}\n\n`
            : "";
        const profilePrefix = userProfile
            ? `[USER PROFILE]: Skills: ${(userProfile.skills || []).join(", ")}. Experience: ${userProfile.experience_years || 0} years. Location: ${(userProfile.preferred_locations || []).join(", ")}.\n\n`
            : "";

        // 4. Route Command
        switch (command) {
            // ──────────────────────────────────────────
            // RESUME COMMANDS
            // ──────────────────────────────────────────
            case "score": {
                if (!resumeText || resumeText.trim().length < 20) {
                    return res.status(400).json({ type: "error", message: "I need a resume to score. Please upload one first." });
                }
                const sections = parseSections(resumeText);
                const greenhouse = simulateGreenhouse(sections, resumeText, jobDescription);
                const lever = simulateLever(sections, resumeText, jobDescription);
                const ashby = simulateAshby(sections, resumeText, jobDescription);
                const naukri = simulateNaukri(sections, resumeText, jobDescription);
                return res.json({
                    type: "success", command: "score",
                    message: "ATS simulation complete across 4 platforms.",
                    data: { greenhouse, lever, ashby, naukri }
                });
            }

            case "fix": {
                if (!resumeText || resumeText.trim().length < 20) {
                    return res.status(400).json({ type: "error", message: "Please upload a resume first." });
                }
                const bulletsToFix = body || (payload.bullets ? payload.bullets.join("\n") : resumeText);
                const fixedBullets = await fixResumeBullets(bulletsToFix, jobDescription);
                return res.json({ type: "success", command: "fix", message: "Bullets optimized using STAR method.", data: fixedBullets });
            }

            case "keywords": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                if (!jobDescription) return res.status(400).json({ type: "error", message: "Please provide a job description: /keywords [paste JD here]" });
                const result = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Find ALL missing keywords from this JD that are NOT in the resume. Return JSON: { "found": [...], "missing": [...], "critical_missing": [...], "suggestions": "..." }\n\nJob Description:\n${jobDescription}`
                }], "chat");
                return res.json({ type: "success", command: "keywords", message: "Keyword analysis complete.", data: { reply: result.reply } });
            }

            case "compare": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                if (!jobDescription) return res.status(400).json({ type: "error", message: "Provide a JD: /compare [paste JD]" });
                const matchResult = await scoreJobMatch(resumeText, jobDescription);
                return res.json({ type: "success", command: "compare", message: "Gap analysis complete.", data: { reply: matchResult.reply } });
            }

            case "tailor": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                if (!jobDescription) return res.status(400).json({ type: "error", message: "Provide a JD: /tailor [paste JD]" });
                const tailorResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Rewrite the resume bullets to closely match this job description. Use keywords from the JD. Keep the same structure but optimize every bullet for this specific role.\n\nJob Description:\n${jobDescription}`
                }], "resume_fix");
                return res.json({ type: "success", command: "tailor", message: "Resume tailored for the target JD.", data: { reply: tailorResult.reply } });
            }

            case "improve": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const improveResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Give the top 5 highest-impact improvements for this resume. For each: explain the issue, show the exact fix, and estimate score gain. Be specific — reference actual bullet lines.`
                }], "chat");
                return res.json({ type: "success", command: "improve", message: "Top 5 improvements identified.", data: { reply: improveResult.reply } });
            }

            case "word-choice": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const wordResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Find ALL weak verbs and passive phrases in this resume. Replace each with a powerful action verb. Show before/after for every instance.`
                }], "resume_fix");
                return res.json({ type: "success", command: "word-choice", message: "Weak verbs replaced with power verbs.", data: { reply: wordResult.reply } });
            }

            case "quantify": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const quantifyResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Find ALL bullets in this resume that lack numbers/metrics/percentages. For each, suggest a realistic quantified version. Show before → after format.`
                }], "resume_fix");
                return res.json({ type: "success", command: "quantify", message: "Quantification suggestions ready.", data: { reply: quantifyResult.reply } });
            }

            // ──────────────────────────────────────────
            // JOB COMMANDS
            // ──────────────────────────────────────────
            case "jobs": {
                const searchQuery = body || (userProfile?.current_role || "software developer");
                const userCity = (userProfile?.preferred_locations?.[0] || "India");
                const result = await searchJobs({
                    query: searchQuery,
                    location: userCity,
                    user_skills: userProfile?.skills || [],
                    user_experience_years: userProfile?.experience_years || 0,
                    limit: 10,
                    page: 1,
                });
                const jobList = (result.data || []).map((j: any, i: number) =>
                    `${i + 1}. **${j.title}** at ${j.company} (${j.location})${j.match_score ? ` — ${j.match_score}% match` : ""}\n   🔗 ${j.job_url}`
                ).join("\n\n");
                return res.json({
                    type: "success", command: "jobs",
                    message: `Found ${result.data.length} jobs for "${searchQuery}"`,
                    data: { reply: jobList || "No matching jobs found. Try a different search term.", jobs: result.data }
                });
            }

            case "match": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                if (!jobDescription) return res.status(400).json({ type: "error", message: "Provide a JD: /match [paste JD]" });
                const matchResult2 = await scoreJobMatch(resumeText, jobDescription);
                return res.json({ type: "success", command: "match", message: "Match analysis complete.", data: { reply: matchResult2.reply } });
            }

            case "apply": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const applyResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Generate a complete application package for this job. Include: 1) Tailored cover letter (300-400 words) 2) Key skills to highlight 3) Screening question preparation 4) Follow-up email template.\n\nJob/URL: ${body || jobDescription || "general application"}`
                }], "cover_letter");
                return res.json({ type: "success", command: "apply", message: "Application package generated.", data: { reply: applyResult.reply } });
            }

            case "why": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const whyResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Explain why the job "${body || "this role"}" matches or doesn't match this candidate's profile. Be specific about skill overlaps, experience fit, and location compatibility.`
                }], "chat");
                return res.json({ type: "success", command: "why", message: "Match explanation ready.", data: { reply: whyResult.reply } });
            }

            case "salary": {
                const salaryRole = body || userProfile?.current_role || "software engineer";
                const salaryResult = await getAIReply([{
                    role: "user",
                    content: `${profilePrefix}Provide current 2024-2025 salary ranges for "${salaryRole}" in:\n1. India (₹ LPA format for Fresher/Mid/Senior)\n2. US ($ annual)\n3. UK (£ annual)\n4. Remote ($ range)\nInclude negotiation tips based on experience level.`
                }], "chat");
                return res.json({ type: "success", command: "salary", message: "Salary data ready.", data: { reply: salaryResult.reply } });
            }

            // ──────────────────────────────────────────
            // APPLICATION COMMANDS
            // ──────────────────────────────────────────
            case "cover": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const jd = jobDescription || body;
                if (!jd) return res.status(400).json({ type: "error", message: "Provide a JD: /cover [paste JD]" });
                const coverResult = await generateCoverLetter(resumeText, jd, payload.company || "the company", payload.tone || "professional");
                return res.json({ type: "success", command: "cover", message: "Cover letter generated.", data: { reply: coverResult.reply } });
            }

            case "cover-email": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const emailResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Generate a professional email to send along with a job application. Keep it concise (100-150 words). Include subject line. Reference key skills from the resume that match the job.${jobDescription ? `\n\nJob Description:\n${jobDescription}` : ""}`
                }], "cover_letter");
                return res.json({ type: "success", command: "cover-email", message: "Application email generated.", data: { reply: emailResult.reply } });
            }

            case "answers": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const questions = payload.questions || ["Tell me about yourself", "Why are you interested in this role?", "What are your salary expectations?", "When can you start?", "Do you have experience with [tech from JD]?"];
                const answersResult = await answerScreeningQuestions(
                    { ...userProfile, resumeText },
                    questions
                );
                return res.json({ type: "success", command: "answers", message: "Screening answers generated.", data: { reply: answersResult.reply } });
            }

            case "followup": {
                const followupResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Generate a professional follow-up email to send 5-7 days after submitting a job application. Keep it concise (80-120 words). Reference specific skills and express continued interest. Include subject line.`
                }], "cover_letter");
                return res.json({ type: "success", command: "followup", message: "Follow-up email generated.", data: { reply: followupResult.reply } });
            }

            // ──────────────────────────────────────────
            // INTERVIEW COMMANDS
            // ──────────────────────────────────────────
            case "prep": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const prepResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Prepare a COMPLETE interview preparation guide for this candidate. Include:\n1. 5 Technical questions with model answers\n2. 5 Behavioral questions with STAR answers\n3. 3 Company research talking points\n4. Key strengths to highlight\n5. Potential red flags and how to address them${jobDescription ? `\n\nJob Description:\n${jobDescription}` : ""}`
                }], "interview_prediction");
                return res.json({ type: "success", command: "prep", message: "Interview preparation complete.", data: { reply: prepResult.reply } });
            }

            case "questions":
            case "predict-questions": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const predResult = await predictInterviewQuestions(resumeText, jobDescription || body);
                let categories: any[] = [];
                try {
                    let raw = predResult.reply;
                    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                    const jsonStart = raw.indexOf("{");
                    const jsonEnd = raw.lastIndexOf("}");
                    if (jsonStart !== -1 && jsonEnd !== -1) raw = raw.slice(jsonStart, jsonEnd + 1);
                    categories = JSON.parse(raw).categories || [];
                } catch { /* parse failed */ }
                return res.json({ type: "success", command: "questions", message: "Interview questions predicted.", data: { categories, reply: predResult.reply } });
            }

            case "behavioral": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const behavResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Generate 5 common behavioral interview questions and provide STAR-format answers (Situation, Task, Action, Result) using ACTUAL experience from this resume. Each answer should be 150-200 words.`
                }], "interview_prediction");
                return res.json({ type: "success", command: "behavioral", message: "Behavioral answers ready.", data: { reply: behavResult.reply } });
            }

            case "technical": {
                const techRole = body || userProfile?.current_role || "software engineer";
                const techResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}Generate 10 technical interview questions specifically for a "${techRole}" role. Base questions on the skills found in the resume. Include: difficulty level, expected answer outline, and common follow-up questions.`
                }], "interview_prediction");
                return res.json({ type: "success", command: "technical", message: "Technical questions generated.", data: { reply: techResult.reply } });
            }

            case "answer": {
                const question = body;
                if (!question) return res.status(400).json({ type: "error", message: "Provide a question: /answer [your question]" });
                const ansResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Draft a model answer for this interview question. Use STAR method if behavioral, or clear structure with examples if technical. Base on the candidate's actual experience.\n\nQuestion: ${question}`
                }], "chat");
                return res.json({ type: "success", command: "answer", message: "Model answer drafted.", data: { reply: ansResult.reply } });
            }

            case "mock": {
                const mockResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Start a mock interview session. Ask me the FIRST interview question based on my resume and target role. Wait for my answer before asking the next question. Start with: "Welcome to your mock interview! Let's begin with..."${body ? `\n\nTarget Role: ${body}` : ""}`
                }], "chat");
                return res.json({ type: "success", command: "mock", message: "Mock interview started!", data: { reply: mockResult.reply } });
            }

            // ──────────────────────────────────────────
            // CAREER COMMANDS
            // ──────────────────────────────────────────
            case "skills": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const skillsResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Analyse this candidate's skill gaps for their target roles. Show:\n1. Current skills (strong)\n2. Emerging skills needed in 2024-2025 market\n3. Critical gaps to fill\n4. Recommended learning path for each gap`
                }], "chat");
                return res.json({ type: "success", command: "skills", message: "Skill gap analysis complete.", data: { reply: skillsResult.reply } });
            }

            case "roadmap": {
                const targetRole = body || userProfile?.target_roles?.[0] || "senior software engineer";
                const roadmapResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Create a detailed 90-day skill roadmap to qualify for "${targetRole}". Week by week breakdown with:\n- Specific courses/resources (with links if possible)\n- Practice projects\n- Milestones to track progress\n- Interview readiness checkpoints`
                }], "chat");
                return res.json({ type: "success", command: "roadmap", message: "90-day roadmap created.", data: { reply: roadmapResult.reply } });
            }

            case "market": {
                const marketResult = await getAIReply([{
                    role: "user",
                    content: `${contextPrefix}${profilePrefix}Provide current job market insights for this candidate's skills:\n1. Demand trends for their top skills\n2. Fastest growing roles they qualify for\n3. Salary trends in India and globally\n4. Top hiring companies right now\n5. Remote work opportunities`
                }], "chat");
                return res.json({ type: "success", command: "market", message: "Market insights ready.", data: { reply: marketResult.reply } });
            }

            case "linkedin": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const linkedinResult = await optimizeLinkedIn(resumeText);
                return res.json({ type: "success", command: "linkedin", message: "LinkedIn optimization suggestions ready.", data: { reply: linkedinResult.reply } });
            }

            // ──────────────────────────────────────────
            // LEGACY COMMANDS
            // ──────────────────────────────────────────
            case "create": {
                if (!payload.role && !jobDescription && !body) {
                    return res.status(400).json({ type: "error", message: "Provide a role: /create [role name]" });
                }
                const targetRole2 = payload.role || body || "Software Engineer";
                const createdBullets = await createResumeBullets(targetRole2, jobDescription);
                return res.json({ type: "success", command: "create", message: `Generated bullets for ${targetRole2}.`, data: createdBullets });
            }

            case "latex": {
                if (!resumeText) return res.status(400).json({ type: "error", message: "Upload a resume first." });
                const sectionsLatex = parseSections(resumeText);
                const latexCode = generateLatex(sectionsLatex, payload.templateId || "it_1");
                return res.json({ type: "success", command: "latex", message: "LaTeX resume compiled.", data: { latex: latexCode } });
            }

            // ──────────────────────────────────────────
            // HELP
            // ──────────────────────────────────────────
            case "help": {
                return res.json({ type: "success", command: "help", message: "Available commands", data: { reply: HELP_TEXT } });
            }

            default:
                return res.status(400).json({
                    type: "error",
                    message: `Unknown command '/${command}'. Type /help to see all available commands.`
                });
        }

    } catch (err: any) {
        console.error("[Chatbot API] Unhandled error:", err);
        return res.status(500).json({
            type: "error",
            message: "An unexpected error occurred while processing your command. Please try again."
        });
    }
});

export default router;
