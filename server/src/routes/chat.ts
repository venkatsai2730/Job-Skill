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
import { supabaseAdmin } from "../config/supabase.js";
import {
    createConversation,
    getUserConversations,
    deleteConversation,
    renameConversation,
    addMessage,
    getConversationMessages,
    generateTitle,
} from "../services/chatHistoryService.js";

const router = Router();

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    message: { error: "Too many messages. Please wait a moment." },
});

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
        const id = req.params.id as string;
        const messages = await getConversationMessages(id);
        res.json({ messages });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/conversations/:id/messages — send message & get AI reply
router.post("/conversations/:id/messages", authenticateToken, chatLimiter, async (req: AuthRequest, res: Response) => {
    try {
        const { content, feature } = req.body;
        const conversationId = req.params.id;

        if (!content) {
            res.status(400).json({ error: "Content is required." });
            return;
        }

        // Save user message
        await addMessage({
            conversation_id: conversationId as string,
            role: "user",
            content: typeof content === "string" ? content : JSON.stringify(content),
            feature,
        });

        // Get conversation history
        const history = await getConversationMessages(conversationId as string);
        const messages = history.map(m => ({
            role: m.role,
            content: m.content,
        }));

        // Get AI reply
        const aiFeature: AIFeature = feature || "chat";
        
        // Dynamically inject user's latest resume context if available
        let resumeContext = "";
        let parsedData: any = null;
        if (aiFeature === "chat") {
            try {
                const { data: resumeRow, error } = await supabaseAdmin
                    .from("resumes")
                    .select("parsed_data")
                    .eq("user_id", req.user!.userId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (!error && resumeRow && resumeRow.parsed_data) {
                    parsedData = resumeRow.parsed_data;
                    resumeContext = parsedData.rawText || JSON.stringify(parsedData.sections);
                    if (resumeContext) {
                        messages.unshift({
                            role: "user",
                            content: `[SYSTEM CONTEXT - DO NOT ACKNOWLEDGE UNLESS ASKED]\n\nUser's Current Resume Data:\n${resumeContext}\n\n[END CONTEXT]`
                        });
                    }
                }
            } catch (err) {
                console.warn("[Chat] Failed to inject resume context:", err);
            }
        }

        // ==========================================
        // PHASE 5: COMMAND INTENT DETECTION
        // ==========================================
        let result: { reply: string; dataPayload?: any; provider?: string; model?: string; tokens?: number };

        const lowercaseContent = typeof content === "string" ? content.toLowerCase() : "";
        const isScoreIntent = lowercaseContent.includes("score my resume") || lowercaseContent.includes("ats score");
        const isLatexIntent = lowercaseContent.includes("give me latex") || lowercaseContent.includes("generate latex");
        const isCreateIntent = lowercaseContent.includes("create resume for") || lowercaseContent.includes("write me a resume for");

        if (isScoreIntent && resumeContext) {
            // Hijack chat: run the score endpoint manually
            const scoreResultRaw = await scoreResume(resumeContext);
            let scoreData: any = {};
            try {
                const jsonMatch = scoreResultRaw.reply.match(/\{[\s\S]*\}/);
                scoreData = JSON.parse(jsonMatch ? jsonMatch[0] : scoreResultRaw.reply);
            } catch (e) {
                console.error("Failed to parse scoreResult JSON", e);
            }
            
            result = {
                reply: `I analyzed your resume. Your current ATS score is **${scoreData.overall_score || "N/A"}/100**. I've attached your full ATS analysis below.`,
                dataPayload: { type: "score", data: scoreData }
            };
        } else if (isLatexIntent && parsedData) {
            // Hijack chat: return LaTeX payload
            const prompt = `Convert the following resume into a complete, professional LaTeX document using a modern template. Return ONLY the raw LaTeX code inside a \`\`\`latex ... \`\`\` block. No explanations.\nResume Data: ${JSON.stringify(parsedData.sections)}`;
            const mistralResult = await generateCode(prompt, "latex");
            
            const latexMatch = mistralResult.reply.match(/```(?:latex)?\n([\s\S]*?)```/i);
            const texPayload = latexMatch ? latexMatch[1].trim() : mistralResult.reply.replace(/```latex|```/gi, "").trim();

            result = {
                reply: "I generated the LaTeX source code for your resume using Codestral! You can copy it or compile it directly below.",
                dataPayload: { type: "latex", data: texPayload }
            };
        } else if (isCreateIntent && resumeContext) {
            // Hijack chat: extract company name
             const companyMatch = lowercaseContent.match(/(?:for|at) ([a-zA-Z0-9\s]+)/);
             const companyName = companyMatch ? companyMatch[1].trim() : "the target company";
             const coverLetterResult = await generateCoverLetter(resumeContext, "General software engineering role", companyName, "professional");
             
             result = {
                 reply: `I created targeted content for ${companyName}. Based on your background, here is a custom summary and cover letter draft: \n\n${coverLetterResult.reply}`,
             };
        } else {
            // Standard generic fallback
            result = await getAIReply(messages, aiFeature);
        }

        // Save AI reply
        await addMessage({
            conversation_id: conversationId as string,
            role: "assistant",
            content: result.reply,
            provider: result.provider,
            model: result.model,
            feature: aiFeature,
            tokens: result.tokens,
        });

        // Auto-title if first message
        if (history.length <= 1) {
            const title = generateTitle(typeof content === "string" ? content : "New Chat");
            await renameConversation(conversationId as string, req.user!.userId, title);
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
        await deleteConversation(req.params.id as string, req.user!.userId);
        res.json({ message: "Conversation deleted." });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/chat/conversations/:id — rename
router.patch("/conversations/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { title } = req.body;
        await renameConversation(req.params.id as string, req.user!.userId, title);
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
