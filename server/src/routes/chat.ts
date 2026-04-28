import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
    getAIReply,
    generateCoverLetter,
    scoreJobMatch,
    answerScreeningQuestions,
    scoreResume,
    generateCode,
    type AIFeature,
} from "../services/chatService.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import {
    createConversation,
    getUserConversations,
    deleteConversation,
    renameConversation,
    addMessage,
    getConversationMessages,
    generateTitle,
} from "../services/chatHistoryService.js";
import { getResumeContext, getUserProfile } from "./chatbot.js";

const router = Router();

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    message: { error: "Too many messages. Please wait a moment." },
});

// ── Extract role keywords for title relevance filtering ──────
function extractRoleKeywords(role: string): string[] {
    const lower = role.toLowerCase();
    const keywords: string[] = [];
    
    // Map common role titles to search keywords
    const ROLE_KEYWORD_MAP: Record<string, string[]> = {
        "data scientist":       ["data", "scientist", "ml", "machine learning", "analytics", "ai"],
        "data analyst":         ["data", "analyst", "analytics", "bi", "business intelligence"],
        "machine learning":     ["ml", "machine learning", "ai", "deep learning", "data scientist"],
        "software engineer":    ["software", "engineer", "developer", "sde", "swe"],
        "frontend":             ["frontend", "front-end", "react", "angular", "vue", "ui"],
        "backend":              ["backend", "back-end", "server", "api", "node", "python", "java"],
        "full stack":           ["full stack", "fullstack", "full-stack", "software", "developer"],
        "devops":               ["devops", "sre", "infrastructure", "cloud", "platform"],
        "product manager":      ["product", "manager", "pm"],
        "designer":             ["design", "ui", "ux", "product design"],
        "android":              ["android", "mobile", "kotlin"],
        "ios":                  ["ios", "swift", "mobile"],
    };

    for (const [roleKey, kws] of Object.entries(ROLE_KEYWORD_MAP)) {
        if (lower.includes(roleKey)) {
            keywords.push(...kws);
            return [...new Set(keywords)];
        }
    }

    // Fallback: split the role into individual words
    const words = lower.split(/\s+/).filter(w => w.length > 2);
    keywords.push(...words);
    return [...new Set(keywords)];
}

// ── Format a single job card for chat display ───────────────
function formatJobCard(j: any, index: number): string {
    const salary = j.salary_min && j.salary_max
        ? `₹${Math.round(j.salary_min / 100000)}-${Math.round(j.salary_max / 100000)} LPA`
        : j.salary_min ? `₹${Math.round(j.salary_min / 100000)}+ LPA` : null;

    // Clean skill names: remove parenthetical content and duplicates
    const cleanSkill = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();
    const matchedSkills = [...new Set((j.matched_skills || []).map(cleanSkill))].filter(Boolean).slice(0, 4);
    const skillGap = [...new Set((j.skill_gap || []).map(cleanSkill))].filter(Boolean).slice(0, 2);

    let card = `### ${index}. ${j.title} at **${j.company}**\n`;
    card += `📍 ${j.location || "Remote"}`;
    if (salary) card += ` · 💰 ${salary}`;
    card += `\n\n`;

    if (matchedSkills.length > 0) {
        card += `✅ Your skills match: ${matchedSkills.join(", ")}\n`;
    }
    if (skillGap.length > 0) {
        card += `📌 Good to have: ${skillGap.join(", ")}\n`;
    }

    if (j.job_url) {
        card += `\n🔗 **[Apply Now →](${j.job_url})**\n`;
    }
    card += `\n---\n\n`;
    return card;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/chat — Main AI chat (supports feature routing)
// ═══════════════════════════════════════════════════════════════
router.post("/", chatLimiter, async (req: Request, res: Response) => {
    const { messages, feature, conversationId } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Messages array is required." });
        return;
    }
    if (messages.length > 100) {
        res.status(400).json({ error: "Conversation too long. Start a new chat." });
        return;
    }

    const validFeatures: AIFeature[] = [
        "chat", "resume_pdf", "resume_image", "cover_letter",
        "job_match", "agent", "screening", "notification", "code_gen",
    ];
    const aiFeature: AIFeature = validFeatures.includes(feature) ? feature : "chat";

    try {
        const result = await getAIReply(messages, aiFeature);
        res.json(result);
    } catch (err: any) {
        console.error("[/api/chat] Error:", err.message);
        res.status(503).json({ error: err.message || "AI service temporarily unavailable." });
    }
});

// ═══════════════════════════════════════════════════════════════
// Chat History Endpoints (authenticated)
// ═══════════════════════════════════════════════════════════════

// GET /api/chat/conversations — list user's conversations
router.get("/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const conversations = await getUserConversations(req.user!.userId);
        res.json({ conversations });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/conversations — create new conversation
router.post("/conversations", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { title } = req.body;
        const conv = await createConversation(req.user!.userId, title || "New Chat");
        res.json({ conversation: conv });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/chat/conversations/:id/messages — get messages for a conversation
router.get("/conversations/:id/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const messages = await getConversationMessages(req.params.id as any as string);
        res.json({ messages });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/conversations/:id/messages — send message & get AI reply
router.post("/conversations/:id/messages", authenticateToken, chatLimiter, async (req: AuthRequest, res: Response) => {
    try {
        const { content, feature } = req.body;
        const conversationId = req.params.id as any as string;

        if (!content) {
            res.status(400).json({ error: "Content is required." });
            return;
        }

        // Save user message
        await addMessage({
            conversation_id: conversationId as any,
            role: "user",
            content: typeof content === "string" ? content : JSON.stringify(content),
            feature: feature as any,
        });

        // Get conversation history
        const history = await getConversationMessages(conversationId);
        const messages = history.map(m => {
            let parsedContent: any = m.content;
            if (typeof m.content === "string" && m.content.trim().startsWith("[") && m.content.trim().endsWith("]")) {
                try {
                    parsedContent = JSON.parse(m.content);
                } catch { /* ignore */ }
            }
            return {
                role: m.role,
                content: parsedContent,
            };
        });

        // Inject resume and profile context into the latest user message
        const ctx = await getResumeContext(req.user!.userId);
        const userProfile = await getUserProfile(req.user!.userId);
        let contextPrefix = "";
        
        if (ctx?.resumeText && ctx.resumeText.length > 20) {
            contextPrefix += `\n\n[RESUME DATA]: ${ctx.resumeText.substring(0, 3000)}\n`;
        }
        if (userProfile) {
            contextPrefix += `[USER PROFILE]: Skills: ${(userProfile.skills || []).join(", ")}. Experience: ${userProfile.experience_years || 0} years.\n`;
        }
        
        if (contextPrefix && messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === "user") {
                if (typeof lastMsg.content === "string") {
                    lastMsg.content = `${lastMsg.content}${contextPrefix}`;
                } else if (Array.isArray(lastMsg.content)) {
                    lastMsg.content.push({ type: "text", text: contextPrefix });
                }
            }
        }

        // Get AI reply
        const aiFeature: AIFeature = feature || "chat";
        
        // ── INTERCEPT: /jobs command → fetch real jobs from DB with links ──
        const userMsg = typeof content === "string" ? content.trim().toLowerCase() : "";
        let result: any;
        
        if (userMsg === "/jobs" || userMsg.startsWith("/jobs ")) {
            const searchQuery = userMsg.replace(/^\/jobs\s*/, "").trim();
            try {
                // Extract clean individual skills from user's resume
                let userSkills: string[] = [];
                if (ctx?.parsedData?.sections?.skills) {
                    const skillGroups = ctx.parsedData.sections.skills as any[];
                    userSkills = skillGroups.flatMap((g: any) => (g.items || []))
                        .map((s: string) => s.replace(/\s*\([^)]*\)/g, '').trim()) // Remove parenthetical: "Python (pandas)" → "Python"
                        .filter((s: string) => s.length > 0 && s.length < 40);
                }
                if (userSkills.length === 0 && userProfile?.skills) {
                    userSkills = (userProfile.skills as string[])
                        .map((s: string) => s.replace(/\s*\([^)]*\)/g, '').trim())
                        .filter((s: string) => s.length > 0);
                }

                // Determine user's role and location from resume/profile
                // The experience parser sometimes puts company name in title field,
                // so we need to be smart about extracting the actual job role.
                let userRole = searchQuery;
                
                if (!userRole) {
                    // Try to find a real job title from experience entries
                    const expEntries = ctx?.parsedData?.sections?.experience || [];
                    for (const exp of expEntries) {
                        const title = (exp.title || "").trim();
                        const company = (exp.company || "").trim();
                        // A real job title contains role keywords, a company name doesn't
                        const ROLE_WORDS = /\b(engineer|developer|scientist|analyst|designer|manager|lead|architect|consultant|intern|associate|senior|junior|trainee|specialist|coordinator|administrator|devops|sre|qa|tester)\b/i;
                        if (ROLE_WORDS.test(title)) {
                            userRole = title;
                            break;
                        }
                        // Check if company field has the role (parser sometimes swaps them)
                        if (ROLE_WORDS.test(company)) {
                            userRole = company;
                            break;
                        }
                    }
                    
                    // Fallback: try user profile
                    if (!userRole) {
                        userRole = userProfile?.current_role || "";
                    }
                    
                    // Last resort: infer from skills
                    if (!userRole && userSkills.length > 0) {
                        const skillsLower = userSkills.map(s => s.toLowerCase());
                        if (skillsLower.some(s => ["tensorflow", "pytorch", "machine learning", "deep learning", "ml", "nlp"].includes(s))) {
                            userRole = "machine learning engineer";
                        } else if (skillsLower.some(s => ["react", "angular", "vue", "frontend"].includes(s))) {
                            userRole = "frontend developer";
                        } else if (skillsLower.some(s => ["node", "express", "django", "flask", "fastapi"].includes(s))) {
                            userRole = "backend developer";
                        } else if (skillsLower.some(s => ["python", "sql", "pandas", "data"].includes(s))) {
                            userRole = "data scientist";
                        } else {
                            userRole = "software engineer";
                        }
                    }
                }
                
                const userLocation = userProfile?.preferred_locations?.[0] || "";

                // Search with role-specific query and user's location
                const jobResult = await (await import("../services/jobFetcher.js")).searchJobs({
                    query: userRole || "data scientist",
                    location: userLocation,
                    limit: 100,
                    page: 1,
                    user_skills: userSkills,
                    user_experience_years: userProfile?.experience_years || 0,
                });

                let rankedJobs = jobResult.data || [];
                
                if (rankedJobs.length > 0) {
                    try {
                        const { rankJobsForUser } = await import("../services/jobRankingService.js");
                        rankedJobs = await rankJobsForUser(req.user!.userId, rankedJobs, 100);
                    } catch { /* use unranked */ }
                }

                // Filter: only recommend jobs that are actually relevant
                // 1. Match score >= 50 (strong skill overlap)
                // 2. Title must be somewhat related to user's field
                const roleKeywords = extractRoleKeywords(userRole || "software");
                const recommended = rankedJobs
                    .filter((j: any) => {
                        const score = j.match_score || 0;
                        if (score < 50) return false;
                        // Title relevance check: at least one role keyword must appear in job title
                        const titleLower = (j.title || "").toLowerCase();
                        const hasRelevantTitle = roleKeywords.length === 0 || roleKeywords.some(kw => titleLower.includes(kw));
                        return hasRelevantTitle;
                    })
                    .slice(0, 10);

                if (recommended.length === 0 && rankedJobs.length > 0) {
                    // Fallback: show top 5 by match score with a note
                    const topJobs = rankedJobs
                        .filter((j: any) => (j.match_score || 0) >= 30)
                        .slice(0, 5);
                    
                    if (topJobs.length === 0) {
                        result = { reply: `I couldn't find strong matches for your profile right now. New jobs are synced every 2 hours. Try searching for a specific role:\n- \`/jobs data scientist\`\n- \`/jobs machine learning engineer\`\n- \`/jobs python developer\``, provider: "system", model: "internal" };
                    } else {
                        let reply = `## Recommended Jobs\n\n`;
                        reply += `Here are the closest matches I found. Your resume could be stronger for some of these — type \`/score\` to see what to improve.\n\n`;
                        for (let i = 0; i < topJobs.length; i++) {
                            reply += formatJobCard(topJobs[i], i + 1);
                        }
                        result = { reply, provider: "system+db", model: "job_ranking" };
                    }
                } else if (recommended.length === 0) {
                    result = { reply: `No matching jobs found for your profile right now. New jobs sync every 2 hours — check back soon, or try a specific role like \`/jobs data scientist\`.`, provider: "system", model: "internal" };
                } else {
                    const userName = ctx?.resumeText?.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] || "";
                    let reply = `## Recommended Jobs${userName ? ` for ${userName}` : ""}\n\n`;
                    reply += `Based on your skills and experience, these are the best roles for you right now:\n\n`;

                    for (let i = 0; i < recommended.length; i++) {
                        reply += formatJobCard(recommended[i], i + 1);
                    }

                    reply += `\n💡 **Next step:** Click a link to apply, or type \`/cover [company name]\` to generate a tailored cover letter.`;
                    result = { reply, provider: "system+db", model: "job_ranking" };
                }
            } catch (jobErr: any) {
                console.warn("[Chat] Job search failed:", jobErr.message);
                result = await getAIReply(messages, aiFeature);
            }
        } else {
            result = await getAIReply(messages, aiFeature);
        }

        // Save AI reply
        await addMessage({
            conversation_id: conversationId as any,
            role: "assistant",
            content: result.reply,
            provider: result.provider,
            model: result.model,
            feature: aiFeature as any,
            tokens: result.tokens,
        });

        // Auto-title: generate a meaningful title like ChatGPT does
        if (history.length <= 1) {
            let title: string;
            const msgText = typeof content === "string" ? content : "New Chat";
            
            // First try the command mapping for instant titles
            title = generateTitle(msgText);
            
            // If it's not a slash command and we have an AI reply, generate a smarter title
            if (!msgText.startsWith("/") && result.reply && result.reply.length > 20) {
                try {
                    const { getAIReply: getTitleReply } = await import("../services/chatService.js");
                    const titleResult = await getTitleReply([
                        { role: "system", content: "Generate a short 3-6 word title for this conversation. Return ONLY the title text, nothing else. No quotes, no punctuation at the end." },
                        { role: "user", content: `User asked: "${msgText.substring(0, 200)}"\nAssistant replied about: "${result.reply.substring(0, 300)}"` },
                    ], "chat");
                    const aiTitle = (titleResult.reply || "").trim().replace(/^["']|["']$/g, "").substring(0, 50);
                    if (aiTitle && aiTitle.length > 3 && aiTitle.length < 50) {
                        title = aiTitle;
                    }
                } catch {
                    // Fall back to generateTitle
                }
            }
            
            await renameConversation(conversationId as any as string, req.user!.userId, title);
        }

        res.json(result);
    } catch (err: any) {
        console.error("[/api/chat/conversations/:id/messages] Error:", err.message);
        res.status(503).json({ error: err.message || "AI service temporarily unavailable." });
    }
});

// DELETE /api/chat/conversations/:id
router.delete("/conversations/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        await deleteConversation(req.params.id as any as string, req.user!.userId);
        res.json({ message: "Conversation deleted." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/chat/conversations/:id — rename
router.patch("/conversations/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { title } = req.body;
        await renameConversation(req.params.id as any as string, req.user!.userId, title as any);
        res.json({ message: "Renamed." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
// Specialized AI Endpoints
// ═══════════════════════════════════════════════════════════════

// POST /api/chat/cover-letter
router.post("/cover-letter", chatLimiter, async (req: Request, res: Response) => {
    const { resumeText, jobDescription, companyName, tone } = req.body;
    if (!resumeText || !jobDescription) {
        res.status(400).json({ error: "resumeText and jobDescription are required." });
        return;
    }
    try {
        const result = await generateCoverLetter(resumeText, jobDescription, companyName || "the company", tone);
        res.json(result);
    } catch (err: any) {
        res.status(503).json({ error: err.message });
    }
});

// POST /api/chat/job-match
router.post("/job-match", chatLimiter, async (req: Request, res: Response) => {
    const { resumeText, jobDescription } = req.body;
    if (!resumeText || !jobDescription) {
        res.status(400).json({ error: "resumeText and jobDescription are required." });
        return;
    }
    try {
        const result = await scoreJobMatch(resumeText, jobDescription);
        res.json(result);
    } catch (err: any) {
        res.status(503).json({ error: err.message });
    }
});

// POST /api/chat/screening
router.post("/screening", chatLimiter, async (req: Request, res: Response) => {
    const { userProfile, questions } = req.body;
    if (!questions || !Array.isArray(questions)) {
        res.status(400).json({ error: "questions array is required." });
        return;
    }
    try {
        const result = await answerScreeningQuestions(userProfile || {}, questions);
        res.json(result);
    } catch (err: any) {
        res.status(503).json({ error: err.message });
    }
});

// POST /api/chat/score-resume
router.post("/score-resume", chatLimiter, async (req: Request, res: Response) => {
    const { resumeText } = req.body;
    if (!resumeText) {
        res.status(400).json({ error: "resumeText is required." });
        return;
    }
    try {
        const result = await scoreResume(resumeText);
        res.json(result);
    } catch (err: any) {
        res.status(503).json({ error: err.message });
    }
});

// POST /api/chat/code-gen
router.post("/code-gen", chatLimiter, async (req: Request, res: Response) => {
    const { prompt, language } = req.body;
    if (!prompt) {
        res.status(400).json({ error: "prompt is required." });
        return;
    }
    try {
        const result = await generateCode(prompt, language);
        res.json(result);
    } catch (err: any) {
        res.status(503).json({ error: err.message });
    }
});

export default router;
