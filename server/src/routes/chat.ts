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
        const result = await getAIReply(messages, aiFeature);

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

        // Auto-title if first message
        if (history.length <= 1) {
            const title = generateTitle(typeof content === "string" ? content : "New Chat");
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
