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
import { logActivity } from "../services/activityService.js";

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
                // ── Require resume context for personalised results ──
                if (!ctx?.resumeText && !searchQuery && !userProfile?.skills?.length) {
                    result = {
                        reply: `## Upload Your Resume First 📄\n\nTo give you **personalised job matches**, I need to read your resume first.\n\n**How to get started:**\n1. Click the 📎 paperclip to attach your resume (PDF or DOCX)\n2. Or type \`/jobs [role name]\` to search manually — e.g. \`/jobs data scientist\`\n\nOnce I have your resume, I'll rank jobs by how well they match your skills, experience level, and location.`,
                        provider: "system",
                        model: "internal",
                    };
                    await addMessage({
                        conversation_id: conversationId as any,
                        role: "assistant",
                        content: result.reply,
                        provider: result.provider,
                        model: result.model,
                        feature: aiFeature as any,
                    });
                    res.json(result);
                    return;
                }

                // ─── Extract + normalize skills ──────────────────────────
                let userSkills: string[] = [];
                let displaySkills: string[] = [];
                if (ctx?.parsedData?.sections?.skills) {
                    const skillGroups = ctx.parsedData.sections.skills as any[];
                    const rawSkills = skillGroups.flatMap((g: any) => g.items || []);
                    displaySkills = rawSkills.map((s: string) => s.replace(/\s*\([^)]*\)/g, '').trim())
                        .filter((s: string) => s.length > 0);
                    userSkills = rawSkills.flatMap((s: string) => {
                        const base = s.replace(/\s*\([^)]*\)/g, '').trim();
                        const parenMatch = s.match(/\(([^)]+)\)/);
                        const parenItems = parenMatch
                            ? parenMatch[1].split(/[,;]/).map((i: string) => i.trim()).filter(Boolean)
                            : [];
                        return [base, ...parenItems];
                    }).map((s: string) => s.toLowerCase().replace(/[\s.]+/g, '').trim())
                      .filter((s: string) => s.length > 1 && s.length < 40);
                }
                if (userSkills.length === 0 && userProfile?.skills) {
                    userSkills = (userProfile.skills as string[])
                        .map((s: string) => s.toLowerCase().replace(/[\s.]+/g, '').trim())
                        .filter((s: string) => s.length > 1);
                    displaySkills = userProfile.skills as string[];
                }

                // ─── Separate DOMAIN skills vs GENERIC skills ────────────
                // Generic skills match nearly every job and cause false positives
                const GENERIC_SKILLS = new Set([
                    "git", "api", "rest", "html", "css", "linux", "agile", "scrum",
                    "jira", "confluence", "notion", "cicd", "docker",
                    "nginx", "apache", "sass", "webpack", "vite", "babel",
                ]);
                const domainSkills = userSkills.filter(s => !GENERIC_SKILLS.has(s));

                // ─── Determine user's role ───────────────────────────────
                let userRole = searchQuery;
                if (!userRole) {
                    const expEntries = ctx?.parsedData?.sections?.experience || [];
                    const ROLE_WORDS = /\b(engineer|developer|scientist|analyst|designer|manager|lead|architect|consultant|intern|associate|senior|junior|trainee|specialist|coordinator|administrator|devops|sre|qa|tester)\b/i;
                    for (const exp of expEntries) {
                        const title = (exp.title || "").trim();
                        const company = (exp.company || "").trim();
                        if (ROLE_WORDS.test(title)) { userRole = title; break; }
                        if (ROLE_WORDS.test(company)) { userRole = company; break; }
                    }
                    if (!userRole) userRole = userProfile?.current_role || "";
                    if (!userRole && domainSkills.length > 0) {
                        if (domainSkills.some(s => ["tensorflow","pytorch","machinelearning","deeplearning","ml","nlp","xgboost","llm","llms"].includes(s))) {
                            userRole = "machine learning engineer";
                        } else if (domainSkills.some(s => ["react","angular","vue","frontend"].includes(s))) {
                            userRole = "frontend developer";
                        } else if (domainSkills.some(s => ["node","express","django","flask","fastapi"].includes(s))) {
                            userRole = "backend developer";
                        } else if (domainSkills.some(s => ["python","sql","pandas","datascience","data"].includes(s))) {
                            userRole = "data scientist";
                        } else {
                            userRole = "software engineer";
                        }
                    }
                }

                // Clean role: remove seniority prefixes for search
                const cleanRole = (userRole || "")
                    .replace(/\b(associate|senior|junior|lead|staff|principal|sr\.?|jr\.?)\b/gi, '')
                    .trim();

                const userLocation = userProfile?.preferred_locations?.[0] || "";
                const userExpYears = userProfile?.experience_years || 0;
                const hasExplicitQuery = !!searchQuery;

                console.log(`[Chat /jobs] query="${searchQuery}", role="${userRole}", cleanRole="${cleanRole}", domainSkills=${domainSkills.length}, location="${userLocation}"`);

                // ──────────────────────────────────────────────────────────
                // SEARCH STRATEGY:
                // /jobs <query>  → single DB search with that query
                // /jobs          → MULTI-KEYWORD search using role words
                //                  + top domain skills as separate queries
                //
                // Why? Exact phrase like "Associate Data Scientist" matches
                // nothing. No filter matches everything. Individual keywords
                // like "data", "scientist", "python" each pull relevant jobs.
                // ──────────────────────────────────────────────────────────
                const { searchJobs } = await import("../services/jobFetcher.js");
                let allJobs: any[] = [];
                const seenUrls = new Set<string>();
                const addJobs = (jobs: any[]) => {
                    for (const j of jobs) {
                        if (j.job_url && !seenUrls.has(j.job_url)) {
                            seenUrls.add(j.job_url);
                            allJobs.push(j);
                        }
                    }
                };

                if (hasExplicitQuery) {
                    // User typed explicit query → single search
                    const r = await searchJobs({ query: searchQuery, location: userLocation, limit: 200, page: 1, user_skills: domainSkills, user_experience_years: userExpYears });
                    addJobs(r.data || []);
                    console.log(`[Chat /jobs] Explicit "${searchQuery}" → ${allJobs.length} results`);
                } else {
                    // Build targeted search keywords from role + skills
                    const searchTerms: string[] = [];
                    if (cleanRole.length > 2) searchTerms.push(cleanRole);
                    // Individual role words (skip noise)
                    const noise = new Set(["the", "and", "for", "at", "in", "of", "a"]);
                    for (const w of cleanRole.toLowerCase().split(/\s+/)) {
                        if (w.length > 2 && !noise.has(w)) searchTerms.push(w);
                    }
                    // Top 3 domain skills
                    for (const s of domainSkills.slice(0, 3)) {
                        searchTerms.push(s);
                    }
                    const uniqueTerms = [...new Set(searchTerms)].slice(0, 6);
                    console.log(`[Chat /jobs] Search terms: [${uniqueTerms.join(", ")}]`);

                    for (const term of uniqueTerms) {
                        try {
                            const r = await searchJobs({ query: term, location: userLocation, limit: 100, page: 1, user_skills: domainSkills, user_experience_years: userExpYears });
                            addJobs(r.data || []);
                        } catch { /* skip failed term */ }
                    }
                    console.log(`[Chat /jobs] Multi-search → ${allJobs.length} unique jobs`);
                }

                // ─── Re-rank with DOMAIN skills only ─────────────────────
                let rankedJobs = allJobs;
                if (rankedJobs.length > 0) {
                    try {
                        const { rankJobsForUserWithSkills } = await import("../services/jobRankingService.js");
                        rankedJobs = await rankJobsForUserWithSkills(req.user!.userId, rankedJobs, domainSkills, userExpYears, 200);
                    } catch {
                        try {
                            const { rankJobsForUser } = await import("../services/jobRankingService.js");
                            rankedJobs = await rankJobsForUser(req.user!.userId, rankedJobs, 200);
                        } catch { /* use unranked */ }
                    }
                }

                // ─── HARD FILTER: title must relate to user's field ──────
                // "Head of Creative", "Legal Counsel" etc. must NEVER show
                // for a data science profile.
                const roleKws = extractRoleKeywords(userRole || "software");
                const titleMatchTerms = [...new Set([...roleKws, ...domainSkills.slice(0, 5)])];

                const relevant = rankedJobs
                    .filter((j: any) => {
                        const tl = (j.title || "").toLowerCase();
                        return titleMatchTerms.some(kw => tl.includes(kw));
                    })
                    .sort((a: any, b: any) => (b.match_score || 0) - (a.match_score || 0))
                    .slice(0, 10);

                console.log(`[Chat /jobs] Final: ${relevant.length} relevant (${rankedJobs.length} total, titleMatchTerms: [${titleMatchTerms.slice(0, 6).join(",")}])`);

                if (relevant.length === 0) {
                    result = {
                        reply: rankedJobs.length > 0
                            ? `I found ${rankedJobs.length} jobs but none matched your **${displaySkills.slice(0, 3).join(", ")}** profile closely.\n\n**Try:**\n- \`/jobs ${cleanRole || "data scientist"}\`\n- \`/jobs python developer\`\n- \`/jobs machine learning engineer\`\n\nJobs sync every 15 minutes.`
                            : `No matching jobs yet. Syncs every 15 min.\n\n- \`/jobs ${cleanRole || "software engineer"}\`\n- \`/jobs data scientist\``,
                        provider: "system", model: "internal",
                    };
                } else {
                    const userName = ctx?.resumeText?.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1] || "";
                    let reply = `## Recommended Jobs${userName ? ` for ${userName}` : ""}\n\n`;
                    reply += `Based on your **${displaySkills.slice(0, 5).join(", ")}** skills and ${userExpYears} year(s) experience:\n\n`;
                    for (let i = 0; i < relevant.length; i++) {
                        reply += formatJobCard(relevant[i], i + 1);
                    }
                    reply += `\n💡 **Next step:** Click a link to apply, or type \`/cover [company name]\` to generate a tailored cover letter.`;
                    result = { reply, provider: "system+db", model: "job_ranking" };
                    logActivity({ user_id: req.user!.userId, type: "job_search", title: `Found ${relevant.length} jobs matching your profile`, meta: { role: userRole, count: relevant.length } }).catch(() => {});
                }
            } catch (jobErr: any) {
                console.error("[Chat] /jobs pipeline error:", jobErr.message);
                result = { reply: `Something went wrong fetching jobs.\n\n**Error:** ${jobErr.message}\n\nTry: \`/jobs [role name]\``, provider: "system", model: "error" };
            }
        } else {
            result = await getAIReply(messages, aiFeature);

            // Log notable commands
            const msgLower = typeof content === "string" ? content.trim().toLowerCase() : "";
            if (msgLower.startsWith("/cover")) {
                logActivity({
                    user_id: req.user!.userId,
                    type: "cover_letter",
                    title: "Cover letter generated",
                    meta: {},
                }).catch(() => {});
            } else if (msgLower.startsWith("/mock") || msgLower.startsWith("/prep")) {
                logActivity({
                    user_id: req.user!.userId,
                    type: "mock_interview",
                    title: "Completed mock interview / interview prep",
                    meta: {},
                }).catch(() => {});
            } else if (msgLower.startsWith("/skills")) {
                logActivity({
                    user_id: req.user!.userId,
                    type: "skill_analysis",
                    title: "Skills gap analysis completed",
                    meta: {},
                }).catch(() => {});
            }
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
