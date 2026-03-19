import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { getAIReply, inferSemanticSkills, optimizeLinkedIn } from "../services/chatService.js";
import { computeAdvancedATS, ParsedSections } from "../lib/advanced-scorer.js";
import { normalizeSynonyms } from "../lib/synonym-map.js";

const router = Router();

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

// ── Helper: Detect if input is a LinkedIn URL ───────────────
function isLinkedInUrl(text: string): boolean {
    return /linkedin\.com\/in\//i.test(text.trim());
}

// ── Helper: Extract name from LinkedIn URL slug ─────────────
function extractNameFromUrl(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (!match) return "";
    return match[1]
        .replace(/-\w{5,}$/, "") // remove trailing ID hash
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Helper: Build minimal ParsedSections from LinkedIn text ─
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

// ── Helper: Generate sync tips comparing LinkedIn vs Resume ─
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

    // Skills in resume but missing from LinkedIn
    const missingFromLinkedIn = resumeKeywords.filter(k => !liSet.has(k.toLowerCase()));
    if (missingFromLinkedIn.length > 0) {
        tips.push(`Add ${missingFromLinkedIn.length} missing skills to LinkedIn: ${missingFromLinkedIn.slice(0, 5).join(", ")}${missingFromLinkedIn.length > 5 ? "…" : ""}`);
    }

    // Skills on LinkedIn but missing from resume
    const missingFromResume = linkedinKeywords.filter(k => !resSet.has(k.toLowerCase()));
    if (missingFromResume.length > 0) {
        tips.push(`Your LinkedIn has ${missingFromResume.length} skills not on your resume: ${missingFromResume.slice(0, 5).join(", ")}`);
    }

    // Score comparison tip
    if (linkedinScore < resumeScore - 10) {
        tips.push(`Your LinkedIn score (${linkedinScore}) lags behind your resume (${resumeScore}). Add more keywords and quantified achievements.`);
    } else if (linkedinScore > resumeScore + 10) {
        tips.push(`Your LinkedIn (${linkedinScore}) outperforms your resume (${resumeScore}). Update your resume to match!`);
    } else {
        tips.push(`Your LinkedIn (${linkedinScore}) and resume (${resumeScore}) scores are well aligned ✓`);
    }

    // Headline tip
    const liLower = linkedinText.toLowerCase();
    if (!liLower.includes("senior") && !liLower.includes("lead") && !liLower.includes("manager") && !liLower.includes("engineer") && !liLower.includes("developer")) {
        tips.push("Add your job title to your LinkedIn headline for recruiter discoverability");
    }

    // Metrics tip
    if (!/\d+[%+kKmM]/.test(linkedinText) && !/\d{2,}/.test(linkedinText)) {
        tips.push("Add quantified achievements (numbers, percentages) to your LinkedIn About section");
    }

    return tips;
}

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
                console.log(`[LinkedIn] Enriched with ${profileData.length} chars of Tavily data`);
            } else {
                enrichedText = `LinkedIn Profile URL: ${input}\nExtracted Name: ${name}\n\nNote: Could not fetch full profile data. Please optimize based on the URL, name, and any keywords visible in the URL slug.`;
                console.log("[LinkedIn] Tavily fetch returned no data, using URL-only mode");
            }
        }

        const result = await optimizeLinkedIn(enrichedText);

        let parsed;
        try {
            let raw = result.reply;
            raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const jsonStart = raw.indexOf("{");
            const jsonEnd = raw.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
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
    } catch (error: any) {
        console.error("[LinkedIn Optimize] Error:", error.message);
        res.status(500).json({ error: error.message || "Failed to optimize LinkedIn profile" });
    }
});

// ── POST /api/linkedin/score ────────────────────────────────
// Lightweight ATS scoring for LinkedIn profile text + sync tips
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

        // Semantic skill inference for LinkedIn
        const semanticSkills = await inferSemanticSkills(profileText);
        ats.inferredSkills = Array.from(new Set([...ats.inferredSkills, ...semanticSkills]));

        const syncTips = generateSyncTips(
            ats.keywords.found,
            Array.isArray(resumeKeywords) ? resumeKeywords : [],
            profileText,
            typeof resumeScore === "number" ? resumeScore : 0,
            ats.score
        );

        res.json({
            linkedinAts: ats,
            syncTips,
        });
    } catch (err: any) {
        console.error("[LinkedIn Score] Error:", err);
        res.status(500).json({ error: "Failed to score LinkedIn profile" });
    }
});

// ── Helper: Flatten any value to a plain string ─────────────
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

export default router;
