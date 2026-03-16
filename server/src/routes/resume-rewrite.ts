import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getAIReply } from "../services/chatService.js";

const router = Router();
router.use(authenticateToken);

// ── POST /api/resume-rewrite/bullet — Rewrite a single bullet ──
router.post("/bullet", async (req: AuthRequest, res: Response) => {
    try {
        const { text } = req.body;

        if (!text) {
            res.status(400).json({ error: "Text to rewrite is required" });
            return;
        }

        const prompt = `Rewrite the following resume bullet point to be more impactful using the STAR method:\n\n"${text}"`;

        const result = await getAIReply(
            [{ role: "user", content: prompt }],
            "resume_rewrite"
        );

        let parsed: { improved: string[] };
        try {
            // Try to extract JSON from the AI response
            const jsonStr = result.reply.match(/\{[\s\S]*\}/)?.[0] || result.reply;
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse Maverick rewrite response:", result.reply);
            // Fallback if parsing fails
            parsed = { improved: [
                result.reply.replace(/```json/g, "").replace(/```/g, "").trim(),
                "Failed to generate variation 2. Please try again.",
                "Failed to generate variation 3. Please try again."
            ]};
        }

        res.json({
            original: text,
            improved: parsed.improved || [],
            provider: result.provider,
            model: result.model
        });

    } catch (err: any) {
        console.error("Resume rewrite error:", err);
        res.status(500).json({ error: "Failed to generate rewrites. Please try again." });
    }
});

// ── POST /api/resume-rewrite/gap-aware — Bridge an employment gap ──
router.post("/gap-aware", async (req: AuthRequest, res: Response) => {
    try {
        const { context } = req.body;
        if (!context) {
            res.status(400).json({ error: "Context surrounding the gap is required" });
            return;
        }

        const prompt = `Rewrite the following gap context into professional bridging statements for a resume:\n\n"${context}"`;
        const result = await getAIReply([{ role: "user", content: prompt }], "gap_rewrite");

        let parsed: { improved: string[] };
        try {
            const jsonStr = result.reply.match(/\{[\s\S]*\}/)?.[0] || result.reply;
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse gap rewrite response:", result.reply);
            parsed = { improved: [ "Failed to generate gap statement. Please try again." ] };
        }

        res.json({
            original: context,
            improved: parsed.improved || [],
            provider: result.provider,
            model: result.model
        });
    } catch (err: any) {
        console.error("Gap rewrite error:", err);
        res.status(500).json({ error: "Failed to generate gap statements. Please try again." });
    }
});

// ── POST /api/resume-rewrite/infer-skills — Extract hidden skills ──
router.post("/infer-skills", async (req: AuthRequest, res: Response) => {
    try {
        const { experienceBullets } = req.body;
        if (!experienceBullets || !Array.isArray(experienceBullets)) {
            res.status(400).json({ error: "An array of experience text is required" });
            return;
        }

        const prompt = `Analyze the following experience and infer all valid professional skills (hard and soft):\n\n${experienceBullets.join("\n")}`;
        const result = await getAIReply([{ role: "user", content: prompt }], "skill_inference");

        let parsed: { skills: string[] };
        try {
            const jsonStr = result.reply.match(/\{[\s\S]*\}/)?.[0] || result.reply;
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse skill inference response:", result.reply);
            parsed = { skills: [] };
        }

        res.json({
            skills: parsed.skills || [],
            provider: result.provider,
            model: result.model
        });
    } catch (err: any) {
        console.error("Skill inference error:", err);
        res.status(500).json({ error: "Failed to infer skills. Please try again." });
    }
});

export default router;
