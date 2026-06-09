import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { predictInterviewQuestions } from "../services/chatService.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// POST /api/interview/predict-interview-questions
// ═══════════════════════════════════════════════════════════════
router.post("/predict-interview-questions", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        let { resumeText, jobDescription } = req.body;

        // Auto-fetch resume if not provided
        if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
            try {
                const { data: resumeRow, error } = await supabaseAdmin
                    .from("resumes")
                    .select("parsed_data")
                    .eq("user_id", req.user!.userId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (!error && resumeRow?.parsed_data) {
                    const parsed = resumeRow.parsed_data as any;
                    resumeText = parsed?.rawText || JSON.stringify(parsed?.sections || {});
                }
            } catch (err) {
                console.warn("[Interview Predict] Failed to fetch resume from DB:", err);
            }

            if (!resumeText || resumeText.trim().length < 20) {
                res.status(400).json({
                    error: "resumeText is required. Paste your resume text or upload a resume first."
                });
                return;
            }
        }

        let parsed: any;
        let attempts = 0;
        const maxAttempts = 2;
        let success = false;

        // Retry logic for AI failures
        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                const result = await predictInterviewQuestions(resumeText.trim(), jobDescription?.trim());
                
                let raw = result.reply;
                raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                const jsonStart = raw.indexOf("{");
                const jsonEnd = raw.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    raw = raw.slice(jsonStart, jsonEnd + 1);
                }
                parsed = JSON.parse(raw);
                
                // Validate the structure
                if (!parsed.categories || !Array.isArray(parsed.categories)) {
                    throw new Error("Invalid structure from AI: missing 'categories' array");
                }
                success = true; // Break out of retry loop
            } catch (err: any) {
                console.warn(`[Interview Predict] Attempt ${attempts}/${maxAttempts} failed:`, err.message);
                if (attempts >= maxAttempts) {
                    console.warn("[Interview Predict] Max attempts reached, falling back to default.", err);
                    parsed = {
                        categories: [
                            {
                                title: "Technical Questions",
                                questions: [
                                    {
                                        question: "Can you describe a challenging technical problem you solved recently?",
                                        skill: "General Technical",
                                        suggestedAnswer: "Use the STAR method to describe a specific bug or architecture problem you resolved."
                                    }
                                ]
                            },
                            {
                                title: "Behavioral Questions",
                                questions: [
                                    {
                                        question: "Tell me about a time you disagreed with a team member.",
                                        skill: "Communication",
                                        suggestedAnswer: "Focus on how you resolved the conflict professionally and what you learned."
                                    }
                                ]
                            }
                        ]
                    };
                    success = true; // Proceed with fallback
                } else {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        res.json({
            categories: parsed.categories
        });
    } catch (err: any) {
        console.error("[Interview Predict] Error:", err);
        res.status(500).json({ error: err.message || "Failed to predict interview questions" });
    }
});

export default router;
