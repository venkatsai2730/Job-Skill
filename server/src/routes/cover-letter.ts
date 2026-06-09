import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { generateCoverLetter } from "../services/chatService.js";
import { normalizeSynonyms } from "../lib/synonym-map.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// Cover Letter ATS Scoring Engine (local, no AI needed)
// 
// 5 dimensions × 20 pts each = 100 total
// ═══════════════════════════════════════════════════════════════

interface CoverLetterScore {
    overall: number;
    label: string;
    breakdown: {
        tone: { score: number; max: 20; feedback: string };
        keywords: { score: number; max: 20; feedback: string };
        length: { score: number; max: 20; feedback: string };
        personalization: { score: number; max: 20; feedback: string };
        structure: { score: number; max: 20; feedback: string };
    };
    readability: {
        fleschScore: number;
        gradeLevel: string;
        avgSentenceLength: number;
        avgWordLength: number;
    };
    issues: { type: "warning" | "success"; text: string }[];
    keywordsFound: string[];
    keywordsMissing: string[];
}

// ── Flesch-Kincaid Readability ──────────────────────────────
function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
}

function computeReadability(text: string) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const totalSyllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
    
    const sentenceCount = Math.max(1, sentences.length);
    const wordCount = Math.max(1, words.length);
    const avgSentenceLength = Math.round(wordCount / sentenceCount);
    const avgWordLength = Math.round((words.join("").length / wordCount) * 10) / 10;

    // Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
    const fleschScore = Math.min(100, Math.max(0, Math.round(
        206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount)
    )));

    let gradeLevel = "Graduate";
    if (fleschScore >= 80) gradeLevel = "Easy (6th Grade)";
    else if (fleschScore >= 65) gradeLevel = "Standard (8th Grade)";
    else if (fleschScore >= 50) gradeLevel = "Fairly Difficult (College)";
    else if (fleschScore >= 30) gradeLevel = "Difficult (College+)";

    return { fleschScore, gradeLevel, avgSentenceLength, avgWordLength };
}

// ── Main Scoring Function ──────────────────────────────────
function scoreCoverLetter(text: string, jobDescription?: string): CoverLetterScore {
    const normalized = normalizeSynonyms(text);
    const lower = normalized.toLowerCase();
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const issues: { type: "warning" | "success"; text: string }[] = [];

    // ════════ 1. TONE ANALYSIS (20 pts) ════════
    let toneScore = 0;
    const formalWords = ["pleased", "opportunity", "contribute", "expertise", "passion", "dedicated", "motivated", "enthusiastic", "committed", "thrilled", "eager", "confident", "delighted", "proven", "accomplished", "proficient"];
    const informalWords = ["hey", "gonna", "wanna", "stuff", "cool", "awesome", "lol", "btw", "tbh", "asap", "fyi"];
    const actionVerbs = ["led", "managed", "developed", "built", "designed", "implemented", "achieved", "improved", "delivered", "launched", "streamlined", "spearheaded", "orchestrated", "optimized", "transformed", "automated", "accelerated", "scaled"];

    const formalCount = formalWords.filter(w => lower.includes(w)).length;
    const informalCount = informalWords.filter(w => lower.includes(w)).length;
    const actionCount = actionVerbs.filter(w => lower.includes(w)).length;

    toneScore += Math.min(8, formalCount * 2);
    toneScore += Math.min(8, actionCount * 2);
    toneScore += 4; // base
    toneScore -= informalCount * 4;

    if (informalCount > 0) issues.push({ type: "warning", text: `Informal language detected (${informalWords.filter(w => lower.includes(w)).join(", ")}). Use professional tone.` });
    if (formalCount >= 3) issues.push({ type: "success", text: `Strong professional tone with ${formalCount} engagement words.` });
    if (actionCount >= 2) issues.push({ type: "success", text: `Great use of ${actionCount} action verbs.` });
    else issues.push({ type: "warning", text: "Add action verbs (led, built, improved, launched) to strengthen impact." });

    toneScore = Math.min(20, Math.max(0, toneScore));
    const toneFeedback = toneScore >= 16 ? "Professional and impactful" : toneScore >= 10 ? "Decent tone, add more action verbs" : "Needs more professional language";

    // ════════ 2. KEYWORD MATCHING (20 pts) ════════
    let keywordsScore = 0;
    let keywordsFound: string[] = [];
    let keywordsMissing: string[] = [];

    if (jobDescription) {
        const jobNorm = normalizeSynonyms(jobDescription).toLowerCase();
        const jobWords = jobNorm.split(/\W+/).filter(w => w.length > 3);
        const wordFreq: Record<string, number> = {};
        jobWords.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });

        const techTerms = ["react", "nodejs", "python", "aws", "docker", "kubernetes", "typescript", "javascript", "sql", "api", "cloud", "agile", "devops", "machine", "learning", "data", "analytics", "product", "management", "strategy", "design", "java", "spring", "graphql", "redis", "kafka", "terraform", "azure", "gcp", "golang", "rust", "figma"];
        const importantTerms = [
            ...Object.entries(wordFreq).filter(([, c]) => c >= 2).map(([w]) => w),
            ...techTerms.filter(t => jobNorm.includes(t))
        ];
        const unique = [...new Set(importantTerms)].slice(0, 20);

        keywordsFound = unique.filter(kw => lower.includes(kw));
        keywordsMissing = unique.filter(kw => !lower.includes(kw));

        const matchRate = unique.length > 0 ? keywordsFound.length / unique.length : 0;
        keywordsScore = Math.min(20, Math.round(matchRate * 20));

        if (keywordsFound.length >= 5) issues.push({ type: "success", text: `Excellent: ${keywordsFound.length} JD keywords matched.` });
        else if (keywordsMissing.length > 5) issues.push({ type: "warning", text: `Missing ${keywordsMissing.length} key terms: ${keywordsMissing.slice(0, 4).join(", ")}…` });
    } else {
        keywordsScore = 10;
        issues.push({ type: "warning", text: "No JD provided — keyword matching skipped." });
    }
    const keywordsFeedback = keywordsScore >= 16 ? "Strong keyword alignment" : keywordsScore >= 10 ? "Some keywords missing" : "Weak keyword coverage";

    // ════════ 3. LENGTH & READABILITY (20 pts) ════════
    let lengthScore = 0;
    const readability = computeReadability(text);

    if (wordCount >= 250 && wordCount <= 400) {
        lengthScore = 12;
        issues.push({ type: "success", text: `Perfect length: ${wordCount} words.` });
    } else if (wordCount >= 200 && wordCount <= 500) {
        lengthScore = 8;
        issues.push({ type: "success", text: `Acceptable: ${wordCount} words. Ideal is 250-400.` });
    } else if (wordCount < 200) {
        lengthScore = Math.max(3, Math.round((wordCount / 200) * 8));
        issues.push({ type: "warning", text: `Too short: ${wordCount} words. Aim for 250-400.` });
    } else {
        lengthScore = Math.max(4, 12 - Math.round(((wordCount - 500) / 200) * 6));
        issues.push({ type: "warning", text: `Too long: ${wordCount} words. Keep under 400.` });
    }

    // Readability bonus (8 pts)
    if (readability.fleschScore >= 50 && readability.fleschScore <= 80) {
        lengthScore += 8; // perfectly readable
        issues.push({ type: "success", text: `Readability: ${readability.fleschScore} (${readability.gradeLevel}).` });
    } else if (readability.fleschScore >= 30) {
        lengthScore += 5;
        issues.push({ type: "warning", text: `Readability: ${readability.fleschScore} — slightly complex. Simplify sentences.` });
    } else {
        lengthScore += 2;
        issues.push({ type: "warning", text: `Readability: ${readability.fleschScore} — too complex. Use shorter sentences.` });
    }

    lengthScore = Math.min(20, Math.max(0, lengthScore));
    const lengthFeedback = lengthScore >= 16 ? "Great length and readability" : lengthScore >= 10 ? "Acceptable" : "Needs adjustment";

    // ════════ 4. PERSONALIZATION (20 pts) ════════
    let personalizationScore = 0;

    // Company/role mention
    const hasCompanyMention = /dear\s+\w+|hiring\s+manager|team\s+at\s+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:'s)?/i.test(text);
    if (hasCompanyMention) { personalizationScore += 5; issues.push({ type: "success", text: "Personalized greeting detected." }); }
    else issues.push({ type: "warning", text: "Add a personalized greeting (e.g., 'Dear Hiring Team at [Company]')." });

    // Quantified achievements
    const numberMatches = text.match(/\d+[%+]|\$[\d,.]+|saved?\s+\d|increased?\s+\d|reduced?\s+\d|grew?\s+\d|\d+x\s|[₹$€£][\d,.]+[KkMmBb]?/gi);
    const numCount = numberMatches ? numberMatches.length : 0;
    if (numCount >= 2) { personalizationScore += 8; issues.push({ type: "success", text: `${numCount} quantified achievement(s) — great impact.` }); }
    else if (numCount === 1) { personalizationScore += 4; issues.push({ type: "warning", text: "Add more metrics (%, $, numbers) for stronger impact." }); }
    else issues.push({ type: "warning", text: "No quantified achievements. Add specifics like 'increased revenue by 30%'." });

    // Call to action
    const hasCTA = /interview|discuss|connect|call|meeting|look forward|excited to|welcome the opportunity|happy to|pleased to/i.test(text);
    if (hasCTA) { personalizationScore += 4; issues.push({ type: "success", text: "Clear call-to-action in closing." }); }
    else issues.push({ type: "warning", text: "End with a call to action (e.g., 'I'd welcome the opportunity to discuss…')." });

    // Unique value proposition (mentions "I" + result-oriented language)
    const hasValueProp = /i\s+(successfully|uniquely|specifically|directly)/i.test(text) || /my\s+(unique|specific|direct|key)/i.test(text);
    if (hasValueProp) { personalizationScore += 3; }

    personalizationScore = Math.min(20, personalizationScore);
    const personalizationFeedback = personalizationScore >= 16 ? "Highly personalized" : personalizationScore >= 10 ? "Some personalization" : "Too generic";

    // ════════ 5. STRUCTURE & ATS FORMAT (20 pts) ════════
    let structureScore = 0;

    // Paragraph count (3-4 is ideal)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 30);
    if (paragraphs.length >= 3 && paragraphs.length <= 5) {
        structureScore += 6;
        issues.push({ type: "success", text: `Good structure: ${paragraphs.length} paragraphs.` });
    } else if (paragraphs.length >= 2) {
        structureScore += 3;
        issues.push({ type: "warning", text: `${paragraphs.length} paragraph(s). Aim for 3-4.` });
    } else {
        issues.push({ type: "warning", text: "Single block of text. Break into 3-4 paragraphs." });
    }

    // Has greeting (Dear..., Hi..., Hello...)
    const hasGreeting = /^(dear|hi|hello|to whom)/im.test(text.trim());
    if (hasGreeting) { structureScore += 4; }
    else { issues.push({ type: "warning", text: "Missing greeting line (Dear Hiring Manager, etc.)." }); }

    // Has sign-off (Sincerely, Best regards, etc.)
    const hasSignoff = /(sincerely|regards|best|respectfully|thank you|yours truly)/i.test(text.slice(-200));
    if (hasSignoff) { structureScore += 4; }
    else { issues.push({ type: "warning", text: "Missing sign-off (Sincerely, Best regards, etc.)." }); }

    // ATS-safe: no tables, no special chars, no excessive caps
    const hasSpecialFormatting = /[│┤┐└┘┬┴┼═║╔╗╚╝]/.test(text);
    const excessiveCaps = (text.match(/[A-Z]{4,}/g) || []).length;
    if (!hasSpecialFormatting && excessiveCaps < 3) {
        structureScore += 3;
    } else {
        issues.push({ type: "warning", text: "Special formatting or excessive caps detected — may break ATS parsing." });
    }

    // Opening hook strength (first paragraph mentions the role/position)
    const firstParagraph = (paragraphs[0] || "").toLowerCase();
    const hasRoleMention = /role|position|opportunity|opening|application/i.test(firstParagraph);
    if (hasRoleMention) { structureScore += 3; issues.push({ type: "success", text: "Opening paragraph clearly references the role." }); }
    else { issues.push({ type: "warning", text: "First paragraph should mention the specific role/position." }); }

    structureScore = Math.min(20, structureScore);
    const structureFeedback = structureScore >= 16 ? "Well-structured for ATS" : structureScore >= 10 ? "Structure is OK" : "Needs structural improvements";

    // ════════ TOTAL ════════
    const overall = Math.min(100, Math.max(0, toneScore + keywordsScore + lengthScore + personalizationScore + structureScore));
    let label = "Needs Work";
    if (overall >= 85) label = "Excellent";
    else if (overall >= 70) label = "Good";
    else if (overall >= 50) label = "Fair";

    return {
        overall,
        label,
        breakdown: {
            tone: { score: toneScore, max: 20, feedback: toneFeedback },
            keywords: { score: keywordsScore, max: 20, feedback: keywordsFeedback },
            length: { score: lengthScore, max: 20, feedback: lengthFeedback },
            personalization: { score: personalizationScore, max: 20, feedback: personalizationFeedback },
            structure: { score: structureScore, max: 20, feedback: structureFeedback },
        },
        readability: computeReadability(text),
        issues: issues.sort((a, b) => a.type === "warning" && b.type === "success" ? -1 : a.type === "success" && b.type === "warning" ? 1 : 0),
        keywordsFound,
        keywordsMissing,
    };
}

// ═══════════════════════════════════════════════════════════════
// POST /api/cover-letter/score — Score an existing cover letter
// ═══════════════════════════════════════════════════════════════
router.post("/score", authenticateToken, (req: AuthRequest, res: Response) => {
    try {
        const { coverLetterText, jobDescription } = req.body;

        if (!coverLetterText || typeof coverLetterText !== "string" || coverLetterText.trim().length < 30) {
            res.status(400).json({ error: "coverLetterText is required (min 30 chars)" });
            return;
        }

        const result = scoreCoverLetter(coverLetterText.trim(), jobDescription?.trim());
        res.json(result);
    } catch (err: any) {
        console.error("[CoverLetter Score] Error:", err);
        res.status(500).json({ error: "Failed to score cover letter" });
    }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/cover-letter/generate — Generate + auto-score
// ═══════════════════════════════════════════════════════════════
router.post("/generate", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        let { resumeText, jobDescription, companyName, tone } = req.body;

        if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 20) {
            res.status(400).json({ error: "jobDescription is required (min 20 chars)" });
            return;
        }

        // ── Validate tone ──
        const validTones = ["professional", "formal", "friendly", "confident", "enthusiastic"];
        if (tone && !validTones.includes(tone)) {
            tone = "professional";
        }

        // ── Auto-fetch resume if not provided ──
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
            } catch {
                // Silently fail — we'll check below
            }

            if (!resumeText || resumeText.trim().length < 20) {
                res.status(400).json({ 
                    error: "resumeText is required. Paste your resume text or upload a resume first.",
                    suggestion: "Upload a PDF resume at /api/resume/upload, then try again without resumeText — we'll use your saved resume."
                });
                return;
            }
        }

        // ── Call AI with retry ──
        let result;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                result = await generateCoverLetter(
                    resumeText.trim(),
                    jobDescription.trim(),
                    companyName?.trim() || "the company",
                    tone || "professional"
                );
                break; // success
            } catch (aiErr: any) {
                console.warn(`[CoverLetter] AI attempt ${attempts}/${maxAttempts} failed:`, aiErr.message);
                if (attempts >= maxAttempts) {
                    res.status(503).json({ 
                        error: "AI service temporarily unavailable. Please try again in a moment.",
                        details: aiErr.message
                    });
                    return;
                }
                // Wait 1s before retry
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!result) {
            res.status(503).json({ error: "AI service returned no result after retries." });
            return;
        }

        // ── Parse JSON response ──
        let parsed: { coverLetter?: string; keyMatches?: string[]; tone?: string; wordCount?: number } = {};
        try {
            let raw = result.reply;
            // Strip markdown fences
            raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            // Extract JSON object
            const jsonStart = raw.indexOf("{");
            const jsonEnd = raw.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            parsed = JSON.parse(raw);
        } catch {
            // JSON parse failed — wrap raw text as cover letter
            parsed = { 
                coverLetter: result.reply.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim(), 
                keyMatches: [], 
                tone: tone || "professional", 
                wordCount: result.reply.split(/\s+/).length 
            };
        }

        const letterText = parsed.coverLetter || result.reply;

        // ── Auto-score the generated letter ──
        const score = scoreCoverLetter(letterText, jobDescription.trim());

        res.json({
            coverLetter: letterText,
            keyMatches: parsed.keyMatches || [],
            tone: parsed.tone || tone || "professional",
            wordCount: parsed.wordCount || letterText.split(/\s+/).length,
            score,
            provider: result.provider,
            model: result.model,
        });
    } catch (err: any) {
        console.error("[CoverLetter Generate] Error:", err);
        res.status(500).json({ error: err.message || "Failed to generate cover letter" });
    }
});

export default router;
