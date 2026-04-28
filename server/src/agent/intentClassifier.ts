// ═══════════════════════════════════════════════════════════════
// Intent Classifier — Maps natural language → intent → tools
// Uses Groq AI for classification with regex fallback.
// ═══════════════════════════════════════════════════════════════

import { getAIReply } from "../services/chatService.js";
import type { AgentContext } from "./tools/index.js";

// ── Intent Types ──────────────────────────────────────────────
export interface ClassifiedIntent {
    type: string;
    confidence: number;
    entities: Record<string, string>;
    requiresTools: string[];
}

// ── Intent → Tool Mapping ─────────────────────────────────────
export const INTENT_TOOL_MAP: Record<string, string[]> = {
    // Resume intents
    score_inquiry:    ["get_resume_score"],
    fix_bullet:       ["get_resume_score", "fix_resume_bullet"],
    keyword_gap:      ["get_resume_keywords"],
    skill_gap:        ["get_skill_gap"],
    resume_rewrite:   ["rewrite_resume_section"],

    // Job intents
    job_search:       ["search_jobs"],
    top_matches:      ["get_top_matched_jobs"],
    job_explanation:  ["explain_job_match"],
    cover_letter:     ["get_resume_score", "generate_cover_letter"],

    // Interview intents
    interview_prep:   ["generate_interview_questions"],
    answer_feedback:  ["evaluate_interview_answer"],
    mock_interview:   ["mock_interview"],

    // Career intents
    career_roadmap:   ["get_skill_gap", "generate_roadmap"],
    linkedin_audit:   ["optimize_linkedin"],
    salary_query:     ["get_salary_insights"],

    // Multi-step (agent decides tool sequence)
    general_career:   ["get_resume_score", "get_top_matched_jobs", "get_skill_gap"],
    full_job_apply:   ["get_top_matched_jobs", "explain_job_match", "generate_cover_letter"],

    // Free-form chat — no tools, just AI chat
    general_chat:     [],
};

// ── Regex-based intent classification (fast, no API call) ─────
function classifyIntentRegex(message: string): ClassifiedIntent {
    const nl = message.toLowerCase().trim();
    const entities: Record<string, string> = {};

    // Extract entities
    const roleMatch = nl.match(/(?:for|as|at)\s+(?:a\s+)?([a-z\s]+?)(?:\s+(?:role|position|job|at|in)|$)/i);
    if (roleMatch) entities.targetRole = roleMatch[1].trim();

    const companyMatch = nl.match(/(?:at|for)\s+(google|amazon|microsoft|meta|apple|flipkart|swiggy|razorpay|cred|zomato|netflix|stripe|uber|airbnb)\b/i);
    if (companyMatch) entities.targetCompany = companyMatch[1].trim();

    // Slash command detection (highest priority)
    const slashMatch = nl.match(/^\/(score|fix|jobs|match|prep|roadmap|skills|linkedin|salary|mock|cover|help|improve|keywords|compare|tailor|draft|rewrite|create|behavioral|technical|answer|market|apply)/);
    if (slashMatch) {
        const cmdMap: Record<string, string> = {
            score: "score_inquiry", fix: "fix_bullet", jobs: "job_search",
            match: "job_explanation", prep: "interview_prep", roadmap: "career_roadmap",
            skills: "skill_gap", linkedin: "linkedin_audit", salary: "salary_query",
            mock: "mock_interview", cover: "cover_letter", improve: "fix_bullet",
            keywords: "keyword_gap", compare: "keyword_gap", tailor: "resume_rewrite",
            draft: "resume_rewrite", rewrite: "resume_rewrite", create: "fix_bullet",
            behavioral: "interview_prep", technical: "interview_prep",
            answer: "answer_feedback", market: "salary_query",
            apply: "full_job_apply", help: "general_chat",
        };
        const intentType = cmdMap[slashMatch[1]] || "general_chat";
        return {
            type: intentType,
            confidence: 95,
            entities,
            requiresTools: INTENT_TOOL_MAP[intentType] || [],
        };
    }

    // Natural language patterns
    if (/fix|improve|better|higher score|optimize|how to fix/.test(nl)) {
        return { type: "fix_bullet", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.fix_bullet };
    }
    if (/rewrite|improve my (summary|experience|projects|skills)/.test(nl)) {
        const sectionMatch = nl.match(/improve my (\w+)/);
        if (sectionMatch) entities.section = sectionMatch[1];
        return { type: "resume_rewrite", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.resume_rewrite };
    }
    if (/find jobs|show jobs|what jobs|jobs for me|job search|matching jobs|job openings/.test(nl)) {
        return { type: "job_search", confidence: 85, entities, requiresTools: INTENT_TOOL_MAP.job_search };
    }
    if (/top match|best match|best jobs|jobs that match|top 5/.test(nl)) {
        return { type: "top_matches", confidence: 85, entities, requiresTools: INTENT_TOOL_MAP.top_matches };
    }
    if (/my score|ats score|how is my resume|check my resume|score my|rate my|resume score/.test(nl)) {
        return { type: "score_inquiry", confidence: 90, entities, requiresTools: INTENT_TOOL_MAP.score_inquiry };
    }
    if (/interview|prepare for|interview questions|prep for/.test(nl)) {
        return { type: "interview_prep", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.interview_prep };
    }
    if (/mock interview/.test(nl)) {
        return { type: "mock_interview", confidence: 90, entities, requiresTools: INTENT_TOOL_MAP.mock_interview };
    }
    if (/roadmap|plan|learning path|what should i do|career plan|90.day/.test(nl)) {
        return { type: "career_roadmap", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.career_roadmap };
    }
    if (/cover letter|write a cover/.test(nl)) {
        return { type: "cover_letter", confidence: 85, entities, requiresTools: INTENT_TOOL_MAP.cover_letter };
    }
    if (/salary|pay|compensation|package|ctc|lpa/.test(nl)) {
        return { type: "salary_query", confidence: 85, entities, requiresTools: INTENT_TOOL_MAP.salary_query };
    }
    if (/linkedin|profile optimization/.test(nl)) {
        return { type: "linkedin_audit", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.linkedin_audit };
    }
    if (/skill gap|missing skills|what skills|skills i need/.test(nl)) {
        return { type: "skill_gap", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.skill_gap };
    }
    if (/keyword|missing keyword|ats keyword/.test(nl)) {
        return { type: "keyword_gap", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.keyword_gap };
    }
    if (/why.*match|why.*job|explain.*match|why this/.test(nl)) {
        return { type: "job_explanation", confidence: 75, entities, requiresTools: INTENT_TOOL_MAP.job_explanation };
    }
    if (/help me (get|land|apply|find).*job|full application|apply to/.test(nl)) {
        return { type: "full_job_apply", confidence: 75, entities, requiresTools: INTENT_TOOL_MAP.full_job_apply };
    }
    if (/evaluate my answer|how was my answer|grade my answer|feedback on/.test(nl)) {
        return { type: "answer_feedback", confidence: 80, entities, requiresTools: INTENT_TOOL_MAP.answer_feedback };
    }

    // Default: general chat
    return { type: "general_chat", confidence: 50, entities, requiresTools: [] };
}

// ═══════════════════════════════════════════════════════════════
// MAIN CLASSIFIER — regex first, AI for ambiguous cases
// ═══════════════════════════════════════════════════════════════
export async function classifyIntent(
    message: string,
    _history: { role: string; content: string }[]
): Promise<ClassifiedIntent> {
    // Fast regex path for high-confidence matches
    const regexResult = classifyIntentRegex(message);
    if (regexResult.confidence >= 75) {
        return regexResult;
    }

    // For low-confidence, try AI classification
    try {
        const intentNames = Object.keys(INTENT_TOOL_MAP).join(", ");
        const result = await getAIReply([{
            role: "user",
            content: `Classify this user message into EXACTLY ONE intent.\n\nAvailable intents: ${intentNames}\n\nUser message: "${message}"\n\nReturn ONLY JSON: {"type": "<intent_name>", "confidence": <0-100>, "entities": {"targetRole": "...", "targetCompany": "..."}}`,
        }], "chat");

        const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const intentType = parsed.type || "general_chat";
            return {
                type: INTENT_TOOL_MAP[intentType] ? intentType : "general_chat",
                confidence: parsed.confidence || 60,
                entities: parsed.entities || {},
                requiresTools: INTENT_TOOL_MAP[intentType] || [],
            };
        }
    } catch {
        // AI classification failed, use regex result
    }

    return regexResult;
}

// ── Plan tool execution order ─────────────────────────────────
export function planTools(
    intent: ClassifiedIntent,
    ctx: AgentContext
): { tools: { name: string; args: Record<string, any> }[] } {
    const toolNames = intent.requiresTools;
    if (toolNames.length === 0) return { tools: [] };

    const tools = toolNames.map(name => {
        const args: Record<string, any> = {};

        // Inject entities into tool args
        if (intent.entities.targetRole) args.targetRole = intent.entities.targetRole;
        if (intent.entities.targetCompany) args.targetCompany = intent.entities.targetCompany;
        if (intent.entities.section) args.section = intent.entities.section;

        // Inject message body for context-dependent tools
        const body = ctx.message.replace(/^\/\w+\s*/, "").trim();
        if (body && name.includes("search")) args.query = body;
        if (body && name.includes("keyword")) args.jobDescription = body;
        if (body && name.includes("cover_letter")) args.jobDescription = body;
        if (body && name.includes("explain")) {
            args.jobTitle = body;
        }
        if (body && name.includes("interview") && !args.targetRole) {
            args.jobTitle = body || "Software Engineer";
        }
        if (body && name.includes("roadmap") && !args.targetRole) {
            args.targetRole = body || "Software Engineer";
        }
        if (body && name === "evaluate_interview_answer") {
            // Parse question and answer from body
            const parts = body.split(/\n+/).filter(Boolean);
            if (parts.length >= 2) {
                args.question = parts[0];
                args.answer = parts.slice(1).join("\n");
            }
        }

        return { name, args };
    });

    return { tools };
}

// ── Reflect on a step's output ────────────────────────────────
export function reflectOnStep(
    step: { toolOutput: any },
    _ctx: AgentContext,
    _intent: ClassifiedIntent
): { isComplete: boolean; shouldRetry: boolean; revisedArgs?: any } {
    const output = step.toolOutput;

    // Check for errors
    if (output?.error) {
        return { isComplete: false, shouldRetry: false };
    }

    // The step produced useful output
    return { isComplete: false, shouldRetry: false };
}
