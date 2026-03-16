import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { simulateGreenhouse, simulateLever } from "../lib/ats-simulator.js";
import { predictInterviewQuestions, fixResumeBullets, createResumeBullets } from "../services/chatService.js";
import { parseSections } from "./resume.js";
import { generateLatex } from "../lib/latex-generator.js";

const router = Router();

// Helper to extract command from message if structured command isn't provided
function extractCommand(message: string): string | null {
    if (!message || typeof message !== "string") return null;
    const match = message.trim().match(/^\/([a-zA-Z-]+)/);
    return match ? match[1].toLowerCase() : null;
}

// ── POST /api/chatbot/resume-chatbot ──
router.post("/resume-chatbot", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { message, command: explicitCommand, payload = {} } = req.body;
        
        // 1. Determine the command
        const command = explicitCommand || extractCommand(message);
        
        if (!command) {
            return res.status(400).json({
                type: "error",
                message: "No command provided. Please use a slash command like /score, /fix, /latex, /create, or /predict-questions in your message, or provide a 'command' field."
            });
        }

        // 2. Extract payload data
        let { resumeText, jobDescription } = payload;
        
        // If message was provided but jobDescription wasn't, try to pull JD from the remainder of the message
        if (message && !jobDescription) {
            const remainder = message.replace(/^\/[a-zA-Z-]+\s*/, "").trim();
            if (remainder.length > 10) {
                jobDescription = remainder;
            }
        }

        // 3. Auto-fetch Resume Context if missing
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
                console.warn("[Chatbot API] Failed to auto-fetch resume from DB:", err);
            }
        }

        // 4. Route Command
        switch (command) {
            case "score":
                // Requires resumeText
                if (!resumeText || resumeText.trim().length < 20) {
                    return res.status(400).json({
                        type: "error",
                        message: "I couldn't find a resume to score. Please upload or paste a resume first."
                    });
                }
                const sections = parseSections(resumeText);
                const greenhouse = simulateGreenhouse(sections, resumeText, jobDescription);
                const lever = simulateLever(sections, resumeText, jobDescription);
                return res.json({
                    type: "success",
                    command: "score",
                    message: "Successfully generated ATS simulation scores.",
                    data: { greenhouse, lever }
                });

            case "predict-questions":
                // Requires resumeText, JD is highly recommended but optional in the underlying service
                if (!resumeText || resumeText.trim().length < 20) {
                    return res.status(400).json({
                        type: "error",
                        message: "I need your resume to predict interview questions accurately. Please upload one first."
                    });
                }
                const predictionResult = await predictInterviewQuestions(resumeText, jobDescription);
                let categories = [];
                try {
                    let raw = predictionResult.reply;
                    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
                    const jsonStart = raw.indexOf("{");
                    const jsonEnd = raw.lastIndexOf("}");
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        raw = raw.slice(jsonStart, jsonEnd + 1);
                    }
                    const parsed = JSON.parse(raw);
                    categories = parsed.categories || [];
                } catch (e) {
                    console.warn("[Chatbot API] Failed to parse interview questions json:", e);
                }

                return res.json({
                    type: "success",
                    command: "predict-questions",
                    message: "Successfully predicted interview questions based on your profile.",
                    data: { categories }
                });

            case "fix":
                if (!payload.bullets && (!resumeText || resumeText.trim().length < 20)) {
                    return res.status(400).json({
                        type: "error",
                        message: "Please provide the specific bullets you want to fix in the payload.bullets array, or upload a resume."
                    });
                }
                const bulletsToFix = payload.bullets ? payload.bullets.join("\n") : resumeText;
                const fixedBullets = await fixResumeBullets(bulletsToFix, jobDescription);
                return res.json({
                    type: "success",
                    command: "fix",
                    message: "Successfully optimized your resume bullets.",
                    data: fixedBullets
                });

            case "create":
                if (!payload.role && !jobDescription) {
                    return res.status(400).json({
                        type: "error",
                        message: "Please provide a target role or a job description so I can generate relevant bullets."
                    });
                }
                const targetRole = payload.role || "Software Engineer";
                const createdBullets = await createResumeBullets(targetRole, jobDescription);
                return res.json({
                    type: "success",
                    command: "create",
                    message: `Successfully generated new resume bullets for ${targetRole}.`,
                    data: createdBullets
                });

            case "latex":
                if (!resumeText || resumeText.trim().length < 20) {
                    return res.status(400).json({
                        type: "error",
                        message: "Please provide a resume to generate an unbreakable ATS LaTeX template."
                    });
                }
                const sectionsLatex = parseSections(resumeText);
                // Defaulting to "it_1" (Jake's Resume) as the ultimate unbreakable ATS template.
                const latexCode = generateLatex(sectionsLatex, payload.templateId || "it_1");
                return res.json({
                    type: "success",
                    command: "latex",
                    message: "Successfully compiled your resume into an ATS-unbreakable LaTeX template.",
                    data: {
                        latex: latexCode
                    }
                });

            default:
                return res.status(400).json({
                    type: "error",
                    message: `Unknown command '/${command}'. Valid commands are: score, fix, latex, create, predict-questions.`
                });
        }

    } catch (err: any) {
        console.error("[Chatbot API] Unhandled error:", err);
        return res.status(500).json({
            type: "error",
            message: "An unexpected error occurred while processing your command."
        });
    }
});

export default router;
