/**
 * High-speed Algorithmic Bullet Point Scorer.
 * Outperforms "Resume Worded" and "Jobscan" by scanning for power verbs, 
 * quantified metrics, and penalizing weak/fluff text natively without LLM latency.
 */

export interface BulletFeedback {
    score: number;             // 0-100 score for this individual bullet
    hasPowerVerb: boolean;
    hasMetrics: boolean;
    fluffWordsDetected: string[];
    feedback: string[];
}

// ── Dictionary Definitions ────────────────────────────────

export const POWER_VERBS = new Set([
    "accelerated", "achieved", "adapted", "advocated", "aligned", "amplified", "analyzed", "architected",
    "assembled", "assessed", "audited", "authored", "automated", "boosted", "built", "capitalized",
    "championed", "coached", "coded", "collaborated", "completed", "conceived", "conceptualized",
    "conducted", "consolidated", "constructed", "converted", "coordinated", "corresponded", "created",
    "cultivated", "customized", "debugged", "decreased", "defined", "delegated", "delivered", "deployed",
    "designed", "determined", "developed", "devised", "diagnosed", "directed", "discovered", "dispatched",
    "drafted", "drove", "edited", "educated", "eliminated", "enabled", "engineered", "enhanced", "established",
    "evaluated", "executed", "expanded", "expedited", "extracted", "facilitated", "forecasted", "formulated",
    "fostered", "founded", "generated", "guided", "headed", "identified", "illustrated", "implemented",
    "improved", "incorporated", "increased", "influenced", "initiated", "innovated", "inspired", "installed",
    "instituted", "integrated", "introduced", "invented", "investigated", "launched", "led", "leveraged",
    "maintained", "managed", "maximized", "mentored", "mobilized", "modernized", "modified", "motivated",
    "navigated", "negotiated", "operated", "optimized", "orchestrated", "organized", "originated",
    "overhauled", "oversaw", "participated", "partnered", "performed", "pioneered", "planned", "predicted",
    "presented", "prevented", "produced", "programmed", "projected", "promoted", "proposed", "published",
    "quantified", "raised", "recommended", "reconciled", "recruited", "redesigned", "reduced", "reengineered",
    "regulated", "reorganized", "reported", "represented", "researched", "resolved", "restructured",
    "revamped", "reviewed", "revitalized", "routed", "saved", "scaled", "secured", "shaped", "simplified",
    "solved", "spearheaded", "standardized", "steered", "strategized", "streamlined", "structured",
    "succeeded", "superceded", "supervised", "surpassed", "synthesized", "systematized", "tailored",
    "targeted", "tested", "trained", "transformed", "transitioned", "translated", "troubleshot",
    "uncovered", "unified", "updated", "upgraded", "utilized", "validated", "verified", "visualized"
]);

const WEAK_WORDS = [
    "helped", "made", "worked on", "responsible for", "duties included", "good", "great", "hard worker",
    "team player", "synergy", "try", "tried", "various", "some", "a lot of", "many", "assisted", "was involved in",
    "participated in", "contributed to", "handled", "managed to", "success in", "effort"
];

const METRIC_REGEX = /(?:\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b)(?:%|\+|\s*(?:percent|K|M|B|dollars|hours|days|weeks|months|years|users|requests|clicks|views|clients))?/i;

// Contextual impact words that imply measurement even without explicit numbers
const CONTEXTUAL_METRIC_WORDS = /\b(accuracy|performance|reliability|efficiency|throughput|latency|scalability|availability|uptime|reduction|improvement|optimization|roi|revenue|cost|savings|growth|conversion|retention|engagement|productivity)\b/i;


// ── Scoring Logic ─────────────────────────────────────────

export function analyzeBullet(text: string): BulletFeedback {
    const feedbackList: string[] = [];
    let score = 100;

    // Normalize
    const cleanText = text.trim();
    if (!cleanText) {
        return { score: 0, hasPowerVerb: false, hasMetrics: false, fluffWordsDetected: [], feedback: ["Empty bullet point."] };
    }

    const words = cleanText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    // 1. Check Power Verb (Usually the first 1-2 words of a bullet)
    let hasPowerVerb = false;
    const firstWord = words[0];
    const secondWord = words.length > 1 ? words[1] : "";
    
    if (POWER_VERBS.has(firstWord) || POWER_VERBS.has(secondWord)) {
        hasPowerVerb = true;
    } else {
        score -= 20;
        feedbackList.push("Lacks a strong action verb at the start. Use words like 'Architected' or 'Spearheaded'.");
    }

    // 2. Check Metrics (Quantification)
    let hasMetrics = false;
    if (METRIC_REGEX.test(cleanText)) {
        hasMetrics = true;
    } else if (CONTEXTUAL_METRIC_WORDS.test(cleanText)) {
        // Partial credit: contextual impact words imply measurement
        hasMetrics = false;
        score -= 8;
        feedbackList.push("Has impact context but no specific numbers. Quantify the result (e.g., 'improved accuracy by 15%').");
    } else {
        score -= 15; // Reduced from -30: harsh penalty was deflating scores unfairly
        feedbackList.push("No numbers or percentages found. Use the STAR method to quantify the impact.");
    }

    // 3. Detect Weak "Fluff" Words
    const fluffWordsDetected: string[] = [];
    const lowerText = cleanText.toLowerCase();
    
    for (const fluff of WEAK_WORDS) {
        const regex = new RegExp(`\\b${fluff}\\b`, 'i');
        if (regex.test(lowerText)) {
            // Skip if the bullet already starts with a power verb (avoid double-penalizing)
            if (hasPowerVerb && (fluff === "assisted" || fluff === "contributed to" || fluff === "participated in")) continue;
            fluffWordsDetected.push(fluff);
            score -= 5; // Reduced from -10: was too aggressive
        }
    }

    if (fluffWordsDetected.length > 0) {
        feedbackList.push(`Remove weak language or clichés: "${fluffWordsDetected.join('", "')}".`);
    }

    // 4. Length Check (Ideal bullet is 1-2 powerful lines, ~60-150 chars)
    if (cleanText.length < 40) {
        score -= 10;
        feedbackList.push("Bullet point is too short. Expand slightly on the 'How' or the 'Result'.");
    } else if (cleanText.length > 250) {
        score -= 15;
        feedbackList.push("Bullet point is too long and hard to read. Break it into two or edit for brevity.");
    }

    // Floor the score at 0
    score = Math.max(0, score);

    return {
        score,
        hasPowerVerb,
        hasMetrics,
        fluffWordsDetected,
        feedback: feedbackList
    };
}

/**
 * Analyzes an entire array of bullet points and returns an average score + details.
 */
export function analyzeAllBullets(bullets: string[]): { overallScore: number; details: BulletFeedback[] } {
    if (!bullets || bullets.length === 0) {
        return { overallScore: 0, details: [] };
    }

    const details = bullets.map(analyzeBullet);
    const totalScore = details.reduce((acc, curr) => acc + curr.score, 0);
    const overallScore = Math.round(totalScore / bullets.length);

    return { overallScore, details };
}
