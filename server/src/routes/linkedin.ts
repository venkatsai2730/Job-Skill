import { Router, Response } from "express";
import Groq from "groq-sdk";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";

const router = Router();
router.use(authenticateToken);

const LINKEDIN_URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%.]+\/?(\?.*)?$/;

function extractUsername(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-%.-]+)/);
    return match?.[1] ?? "unknown";
}

// POST /api/linkedin/analyze
router.post("/analyze", async (req: AuthRequest, res: Response) => {
    const { url, headline, about, experience, skills } = req.body;

    if (!url || typeof url !== "string") {
        res.status(400).json({ error: "LinkedIn URL is required" });
        return;
    }

    const trimmedUrl = url.trim();
    if (!LINKEDIN_URL_RE.test(trimmedUrl)) {
        res.status(400).json({
            error: "Please provide a valid LinkedIn profile URL (e.g., https://www.linkedin.com/in/your-name)",
        });
        return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_groq_api_key_here") {
        res.status(500).json({ error: "AI service not configured. Add GROQ_API_KEY to the server .env file." });
        return;
    }

    try {
        const username = extractUsername(trimmedUrl);
        const groq = new Groq({ apiKey });

        const providedContent = [
            headline && `Headline: ${headline}`,
            about && `About: ${about}`,
            experience && `Experience: ${experience}`,
            skills && `Skills: ${skills}`,
        ]
            .filter(Boolean)
            .join("\n\n");

        const prompt = `You are an expert LinkedIn profile optimizer and career coach with 15 years of experience helping professionals land top roles.

LinkedIn Profile URL: ${trimmedUrl}
Username: ${username}
${providedContent ? `\nCurrent profile content:\n${providedContent}` : "\n(User did not provide profile text — infer realistic current content from the username and generate improvements for a typical software engineer profile)"}

Analyze the profile and return ONLY a valid JSON object — no markdown, no code fences, no explanation outside the JSON.

JSON structure:
{
  "sections": [
    {
      "name": "Headline",
      "score": <integer 0-100>,
      "current": "<current headline text — use provided value if given, otherwise infer a realistic one>",
      "optimized": "<headline with value proposition, specialisation, and 2-3 key technologies — max 220 chars>",
      "feedback": "<one sentence on what the key improvement is>"
    },
    {
      "name": "About",
      "score": <integer 0-100>,
      "current": "<current about text — use provided value if given, otherwise a short realistic placeholder>",
      "optimized": "<compelling 3-sentence about: who you are + measurable achievements + what you bring>",
      "feedback": "<one sentence on the key improvement>"
    },
    {
      "name": "Experience",
      "score": <integer 0-100>,
      "current": "<current experience text — use provided value if given, otherwise a short realistic placeholder>",
      "optimized": "<one strong achievement bullet with metric, action verb, and business impact>",
      "feedback": "<one sentence on the key improvement>"
    },
    {
      "name": "Skills",
      "score": <integer 0-100>,
      "current": "<current skills text — use provided value if given, otherwise a short realistic placeholder>",
      "optimized": "<modern, recruiter-optimised skills list as comma-separated values with depth and breadth>",
      "feedback": "<one sentence on the key improvement>"
    }
  ],
  "messageTemplates": [
    {
      "title": "Connection Request",
      "text": "<warm personalised connection request referencing the profile context — under 300 chars>"
    },
    {
      "title": "Recruiter Follow-up",
      "text": "<professional recruiter follow-up: 2 sentences, enthusiastic and concise>"
    },
    {
      "title": "Informational Interview",
      "text": "<informational interview request: 2-3 sentences, specific and respectful of their time>"
    }
  ]
}`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2048,
            temperature: 0.7,
        });

        const rawText = completion.choices[0]?.message?.content?.trim() ?? "";

        let parsed: any;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("AI returned malformed JSON");
            parsed = JSON.parse(jsonMatch[0]);
        }

        const overallScore = Math.round(
            parsed.sections.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0) / parsed.sections.length
        );

        res.json({ sections: parsed.sections, messageTemplates: parsed.messageTemplates, overallScore });
    } catch (err: any) {
        console.error("LinkedIn analyze error:", err?.message ?? err);
        const detail = err?.message ?? String(err);
        res.status(500).json({ error: `Analysis failed: ${detail}` });
    }
});

export default router;
