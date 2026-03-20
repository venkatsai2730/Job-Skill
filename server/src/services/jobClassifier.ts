// ═══════════════════════════════════════════════════════════════
// Groq AI Seniority Classification + Keyword Fallback
// With rate-limit protection to avoid 429 floods
// ═══════════════════════════════════════════════════════════════

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// ── Rate Limit Guard ────────────────────────────────────────
// When Groq returns 429, we pause AI calls for a cooldown period
let rateLimitedUntil = 0;                // timestamp when cooldown expires
const RATE_LIMIT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown after a 429
let aiCallsThisCycle = 0;               // counter per fetch cycle
const MAX_AI_CALLS_PER_CYCLE = 20;      // max AI calls per cron cycle

/** Call this at the START of each cron cycle to reset the counter */
export function resetAICallCounter() {
    aiCallsThisCycle = 0;
}

interface SeniorityResult {
    experience_min: number | null;
    experience_max: number | null;
    seniority: "intern" | "entry" | "mid" | "senior" | "lead" | "unknown";
    confidence_score: number;
}

/**
 * Classify seniority using Groq AI (llama-4-scout).
 * Only called when regex extraction yields null for both min/max.
 * 
 * Rate-limit protection:
 * - Max 20 AI calls per cron cycle
 * - 5 minute cooldown after any 429 response
 * - 2 second delay between calls
 * - Falls back to keyword classification when limited
 */
export async function classifySeniorityWithAI(description: string): Promise<SeniorityResult> {
    // Guard 1: No API key or too short
    if (!GROQ_API_KEY || !description || description.length < 50) {
        return classifySeniorityFromTitle(description);
    }

    // Guard 2: Still in cooldown from a previous 429
    if (Date.now() < rateLimitedUntil) {
        return classifySeniorityFromTitle(description);
    }

    // Guard 3: Already hit max AI calls for this cycle
    if (aiCallsThisCycle >= MAX_AI_CALLS_PER_CYCLE) {
        return classifySeniorityFromTitle(description);
    }

    try {
        // Throttle: small delay before each AI call
        await new Promise(r => setTimeout(r, 2000));

        aiCallsThisCycle++;

        const truncated = description.substring(0, 4000);
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    {
                        role: "system",
                        content: "You are a job classification expert. Return only valid JSON, no markdown.",
                    },
                    {
                        role: "user",
                        content: `Read this job description and return JSON only:
{
  "experience_min": number (0 if fresher/entry level, null if unclear),
  "experience_max": number or null,
  "seniority": "intern" | "entry" | "mid" | "senior" | "lead" | "unknown",
  "confidence_score": number between 0 and 100
}
Job Description: ${truncated}`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 200,
            }),
            signal: AbortSignal.timeout(10000),
        });

        // Handle rate limiting — enter cooldown
        if (res.status === 429) {
            console.warn(`[AI-Classify] Groq rate limited (429). Pausing AI calls for 5 minutes.`);
            rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN;
            return classifySeniorityFromTitle(description);
        }

        if (!res.ok) {
            console.warn(`[AI-Classify] Groq API returned ${res.status}`);
            return classifySeniorityFromTitle(description);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return classifySeniorityFromTitle(description);
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const validSeniorities = ["intern", "entry", "mid", "senior", "lead", "unknown"];
        const seniority = validSeniorities.includes(parsed.seniority) ? parsed.seniority : "unknown";

        return {
            experience_min: typeof parsed.experience_min === "number" ? parsed.experience_min : null,
            experience_max: typeof parsed.experience_max === "number" ? parsed.experience_max : null,
            seniority,
            confidence_score: Math.min(100, Math.max(0, parseInt(parsed.confidence_score) || 50)),
        };
    } catch (err: any) {
        if (err.name !== "AbortError") {
            console.warn("[AI-Classify] Groq classification failed:", err.message);
        }
        return classifySeniorityFromTitle(description);
    }
}

/**
 * Keyword-based seniority classification fallback.
 * Used when Groq API is unavailable, rate-limited, or fails.
 * This is fast, free, and always available.
 */
export function classifySeniorityFromTitle(text: string): SeniorityResult {
    const lower = (text || "").toLowerCase();

    if (/\b(intern|internship|trainee|apprentice)\b/.test(lower)) {
        return { experience_min: 0, experience_max: 0, seniority: "intern", confidence_score: 80 };
    }
    if (/\b(fresher|entry[\s-]?level|junior|associate|graduate|campus)\b/.test(lower)) {
        return { experience_min: 0, experience_max: 2, seniority: "entry", confidence_score: 75 };
    }
    if (/\b(lead|team\s*lead|tech\s*lead|principal|head\s+of|director|vp\b|vice\s*president)\b/.test(lower)) {
        return { experience_min: 8, experience_max: null, seniority: "lead", confidence_score: 70 };
    }
    if (/\b(senior|sr\.?|staff|architect|expert|specialist)\b/.test(lower)) {
        return { experience_min: 5, experience_max: null, seniority: "senior", confidence_score: 70 };
    }
    if (/\b(mid[\s-]?level|mid[\s-]?senior|level\s*[23]|ii|iii)\b/.test(lower)) {
        return { experience_min: 2, experience_max: 5, seniority: "mid", confidence_score: 65 };
    }

    // Default: unknown with low confidence
    return { experience_min: null, experience_max: null, seniority: "unknown", confidence_score: 40 };
}
