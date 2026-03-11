import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getAIReply } from "../services/chatService.js";

const router = Router();

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,      // 1 minute
    max: 15,                   // 15 messages/min per IP
    standardHeaders: true,
    message: { error: "Too many messages. Please wait a moment." },
});

// POST /api/chat
router.post("/", chatLimiter, async (req: Request, res: Response) => {
    const { messages, provider } = req.body;

    // Validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: "Messages array is required." });
        return;
    }
    if (messages.length > 50) {
        res.status(400).json({ error: "Conversation too long. Start a new chat." });
        return;
    }
    // Validate each message shape
    const valid = messages.every(
        (m: any) => m.role && m.content && ["user", "assistant"].includes(m.role)
    );
    if (!valid) {
        res.status(400).json({ error: "Invalid message format." });
        return;
    }

    try {
        const result = await getAIReply(messages, provider || "groq");
        res.json(result);
    } catch (err: any) {
        console.error("[/api/chat] Error:", err.message);
        res.status(503).json({
            error: err.message || "AI service temporarily unavailable. Please try again.",
        });
    }
});

export default router;
