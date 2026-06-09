import { Router, Response } from "express";
import Groq from "groq-sdk";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { inferSemanticSkills, optimizeLinkedIn } from "../services/chatService.js";
import { computeAdvancedATS, ParsedSections } from "../lib/advanced-scorer.js";
import { normalizeSynonyms } from "../lib/synonym-map.js";
import { logActivity } from "../services/activityService.js";

const router = Router();

const LINKEDIN_URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%.]+\/?(\?.*)?$/;

function extractUsername(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-%.-]+)/);
    return match?.[1] ?? "unknown";
}

// ── Helper: Fetch LinkedIn profile data via Tavily search ───
async function fetchLinkedInProfile(url: string): Promise<string | null> {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return null;

    try {
        const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: tavilyKey,
                query: `site:linkedin.com ${url}`,
                search_depth: "advanced",
                include_raw_content: true,
                max_results: 3,
                include_domains: ["linkedin.com"],
            }),
        });

        if (!res.ok) {
            console.warn("[Tavily] Search failed:", res.status);
            return null;
        }

        const data = await res.json();
        if (!data.results || data.results.length === 0) return null;

        const profileData = data.results
            .map((r: any) => {
                const parts: string[] = [];
                if (r.title) parts.push(`Title: ${r.title}`);
                if (r.content) parts.push(r.content);
                if (r.raw_content) parts.push(r.raw_content);
                return parts.join("\n");
            })
            .join("\n\n---\n\n");

        return profileData.length > 100 ? profileData : null;
    } catch (err: any) {
        console.warn("[Tavily] Error fetching profile:", err.message);
        return null;
    }
}

function isLinkedInUrl(text: string): boolean {
    return /linkedin\.com\/in\//i.test(text.trim());
}

function extractNameFromUrl(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (!match) return "";
    return match[1]
        .replace(/-\w{5,}$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

function buildLinkedInSections(text: string): ParsedSections {
    const lines = text.split(/\r?\n/).filter(Boolean);
    let summary = "";
    const skillItems: string[] = [];
    const bullets: string[] = [];

    for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (l.length < 40 && /[,|•·]/.test(l)) {
            skillItems.push(...l.split(/[,|•·]/).map(s => s.trim()).filter(Boolean));
        } else if (l.length > 60 && !summary) {
            summary = l;
        } else if (l.length > 20) {
            bullets.push(l);
        }
    }

    return {
        summary,
        experience: bullets.length > 0 ? [{
            title: "LinkedIn Profile",
            company: "",
            dates: "",
            bullets: bullets.slice(0, 20),
        }] : [],
        education: [],
        skills: skillItems.length > 0 ? [{ category: "Skills", items: skillItems }] : [],
        projects: [],
    };
}

function generateSyncTips(
    linkedinKeywords: string[],
    resumeKeywords: string[],
    linkedinText: string,
    resumeScore: number,
    linkedinScore: number
): string[] {
    const tips: string[] = [];
    const liSet = new Set(linkedinKeywords.map(k => k.toLowerCase()));
    const resSet = new Set(resumeKeywords.map(k => k.toLowerCase()));

    const missingFromLinkedIn = resumeKeywords.filter(k => !liSet.has(k.toLowerCase()));
    if (missingFromLinkedIn.length > 0) {
        tips.push(`Add ${missingFromLinkedIn.length} missing skills to LinkedIn: ${missingFromLinkedIn.slice(0, 5).join(", ")}${missingFromLinkedIn.length > 5 ? "…" : ""}`);
    }

    const missingFromResume = linkedinKeywords.filter(k => !resSet.has(k.toLowerCase()));
    if (missingFromResume.length > 0) {
        tips.push(`Your LinkedIn has ${missingFromResume.length} skills not on your resume: ${missingFromResume.slice(0, 5).join(", ")}`);
    }

    if (linkedinScore < resumeScore - 10) {
        tips.push(`Your LinkedIn score (${linkedinScore}) lags behind your resume (${resumeScore}). Add more keywords and quantified achievements.`);
    } else if (linkedinScore > resumeScore + 10) {
        tips.push(`Your LinkedIn (${linkedinScore}) outperforms your resume (${resumeScore}). Update your resume to match!`);
    } else {
        tips.push(`Your LinkedIn (${linkedinScore}) and resume (${resumeScore}) scores are well aligned ✓`);
    }

    const liLower = linkedinText.toLowerCase();
    if (!liLower.includes("senior") && !liLower.includes("lead") && !liLower.includes("manager") && !liLower.includes("engineer") && !liLower.includes("developer")) {
        tips.push("Add your job title to your LinkedIn headline for recruiter discoverability");
    }

    if (!/\d+[%+kKmM]/.test(linkedinText) && !/\d{2,}/.test(linkedinText)) {
        tips.push("Add quantified achievements (numbers, percentages) to your LinkedIn About section");
    }

    return tips;
}

function flattenToString(val: any): string {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
        return val.map(v => {
            if (typeof v === "string") return `• ${v}`;
            if (typeof v === "object" && v !== null) {
                return Object.values(v).filter(Boolean).map(String).join(" — ");
            }
            return String(v);
        }).join("\n");
    }
    if (typeof val === "object") {
        return Object.entries(val)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(" | ");
    }
    return String(val);
}

// POST /api/linkedin/analyze
router.post("/analyze", authenticateToken, async (req: AuthRequest, res: Response) => {
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
      "current": "<current headline text>",
      "optimized": "<headline with value proposition, specialisation, and 2-3 key technologies — max 220 chars>",
      "feedback": "<one sentence on what the key improvement is>"
    },
    {
      "name": "About",
      "score": <integer 0-100>,
      "current": "<current about text>",
      "optimized": "<compelling 3-sentence about: who you are + measurable achievements + what you bring>",
      "feedback": "<one sentence on the key improvement>"
    },
    {
      "name": "Experience",
      "score": <integer 0-100>,
      "current": "<current experience text>",
      "optimized": "<one strong achievement bullet with metric, action verb, and business impact>",
      "feedback": "<one sentence on the key improvement>"
    },
    {
      "name": "Skills",
      "score": <integer 0-100>,
      "current": "<current skills text>",
      "optimized": "<modern, recruiter-optimised skills list as comma-separated values>",
      "feedback": "<one sentence on the key improvement>"
    }
  ],
  "messageTemplates": [
    { "title": "Connection Request", "text": "<warm personalised connection request — under 300 chars>" },
    { "title": "Recruiter Follow-up", "text": "<professional recruiter follow-up: 2 sentences>" },
    { "title": "Informational Interview", "text": "<informational interview request: 2-3 sentences>" }
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
        res.status(500).json({ error: `Analysis failed: ${err?.message ?? String(err)}` });
    }
});

// POST /api/linkedin/optimize
router.post("/optimize", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { profileText } = req.body;

        if (!profileText || typeof profileText !== "string" || profileText.trim().length < 10) {
            res.status(400).json({ error: "Please provide your LinkedIn profile text (at least 10 characters)." });
            return;
        }

        const input = profileText.trim();
        let enrichedText = input;

        if (isLinkedInUrl(input)) {
            const name = extractNameFromUrl(input);
            console.log(`[LinkedIn] Detected URL. Extracted name: "${name}". Fetching via Tavily...`);
            const profileData = await fetchLinkedInProfile(input);

            if (profileData) {
                enrichedText = `LinkedIn Profile URL: ${input}\nExtracted Name: ${name}\n\n--- FETCHED PROFILE DATA ---\n${profileData}`;
            } else {
                enrichedText = `LinkedIn Profile URL: ${input}\nExtracted Name: ${name}\n\nNote: Could not fetch full profile data. Optimize based on the URL, name, and URL slug keywords.`;
            }
        }

        const result = await optimizeLinkedIn(enrichedText);

        let parsed;
        try {
            let raw = result.reply;
            raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const jsonStart = raw.indexOf("{");
            const jsonEnd = raw.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) raw = raw.slice(jsonStart, jsonEnd + 1);
            parsed = JSON.parse(raw);
        } catch {
            res.json({ raw: result.reply, provider: result.provider, model: result.model });
            return;
        }

        if (parsed.sections && Array.isArray(parsed.sections)) {
            parsed.sections = parsed.sections.map((s: any) => ({
                name: String(s.name || "Unknown"),
                score: typeof s.score === "number" ? s.score : parseInt(String(s.score || "0"), 10) || 0,
                current: flattenToString(s.current),
                optimized: flattenToString(s.optimized),
            }));
        }

        res.json({
            sections: parsed.sections || [],
            messageTemplates: parsed.messageTemplates || [],
            provider: result.provider,
            model: result.model,
        });

        logActivity({
            user_id: req.user!.userId,
            type: "linkedin_optimized",
            title: "LinkedIn profile optimized",
            meta: {},
        }).catch(() => {});
    } catch (error: any) {
        console.error("[LinkedIn Optimize] Error:", error.message);
        res.status(500).json({ error: error.message || "Failed to optimize LinkedIn profile" });
    }
});

// POST /api/linkedin/score
router.post("/score", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { profileText, resumeKeywords, resumeScore } = req.body;

        if (!profileText || typeof profileText !== "string" || profileText.trim().length < 20) {
            res.status(400).json({ error: "profileText is required (min 20 chars)" });
            return;
        }

        const normalized = normalizeSynonyms(profileText);
        const sections = buildLinkedInSections(normalized);
        const ats = computeAdvancedATS(sections, profileText, req.user?.userId, { isPdf: false });

        const semanticSkills = await inferSemanticSkills(profileText);
        ats.inferredSkills = Array.from(new Set([...ats.inferredSkills, ...semanticSkills]));

        const syncTips = generateSyncTips(
            ats.keywords.found,
            Array.isArray(resumeKeywords) ? resumeKeywords : [],
            profileText,
            typeof resumeScore === "number" ? resumeScore : 0,
            ats.score
        );

        res.json({ linkedinAts: ats, syncTips });
    } catch (err: any) {
        console.error("[LinkedIn Score] Error:", err);
        res.status(500).json({ error: "Failed to score LinkedIn profile" });
    }
});

export default router;
