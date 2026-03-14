import { Router, Response } from "express";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { optimizeLinkedIn } from "../services/chatService.js";

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

        // Combine all raw content and snippets from matching results
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
        .replace(/\b\w/g, c => c.toUpperCase()); // Title case
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

        // If user provided a LinkedIn URL, try to fetch actual profile data
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

        // Try to parse the AI reply as JSON
        let parsed;
        try {
            let raw = result.reply;
            // Remove markdown fences if the AI wraps it
            raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            // Remove any leading/trailing text outside the JSON
            const jsonStart = raw.indexOf("{");
            const jsonEnd = raw.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1) {
                raw = raw.slice(jsonStart, jsonEnd + 1);
            }
            parsed = JSON.parse(raw);
        } catch {
            // If JSON parse fails, return raw reply
            res.json({ raw: result.reply, provider: result.provider, model: result.model });
            return;
        }

        // Ensure all section values are strings (flatten any arrays/objects)
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

// ── Helper: Flatten any value to a plain string ─────────────
function flattenToString(val: any): string {
    if (!val) return "";
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
        return val.map(v => {
            if (typeof v === "string") return `• ${v}`;
            if (typeof v === "object" && v !== null) {
                // Handle objects like { title, description } or { role, detail }
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
