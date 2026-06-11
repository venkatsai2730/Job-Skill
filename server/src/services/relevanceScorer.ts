// ═══════════════════════════════════════════════════════════════
// Relevance Scorer — Weighted multi-signal scoring function
//
// Produces a 0.0–1.0 scalar from 5 input signals.
// Designed for easy swap to an ML model (LTR, gradient boosted
// ranker, or neural scorer) once we have click/apply training data.
//
// TODO: Replace with a trained LightGBM / XGBoost ranker when
//       we have >= 10k (user, job, outcome) tuples.
// ═══════════════════════════════════════════════════════════════

// ── Tunable weights ──────────────────────────────────────────
// These define how much each signal contributes to the final score.
// Sum MUST equal 1.0.

export const RELEVANCE_WEIGHTS = {
    domain:   0.35,
    skills:   0.30,
    title:    0.15,
    location: 0.10,
    recency:  0.10,
} as const;

// ── Thresholds ───────────────────────────────────────────────
/** Minimum relevance score for a job to enter the primary pool */
export const MIN_PRIMARY_RELEVANCE = 0.30;

/** Relaxed threshold when the primary pool has fewer than MIN_PRIMARY_JOBS */
export const RELAXED_PRIMARY_RELEVANCE = 0.18;

/** If primary pool has fewer jobs than this, relax the threshold */
export const MIN_PRIMARY_JOBS = 30;

// ── Input types ──────────────────────────────────────────────
export interface RelevanceSignals {
    /** Whether the job's domain matches the user's domain (or is in the related set) */
    domainMatch: boolean;

    /**
     * Fraction of the user's skills that overlap with the job's required skills.
     * Range: 0.0–1.0
     */
    skillOverlapRatio: number;

    /**
     * Token-level Jaccard similarity between the user's current title and the job title.
     * Range: 0.0–1.0
     */
    titleSimilarity: number;

    /**
     * How well the job's location matches the user's preferences.
     * 1.0 = exact city match, 0.6 = same country, 0.5 = remote, 0.0 = no match
     */
    locationMatch: number;

    /**
     * Recency signal. 1.0 = posted today, decays exponentially.
     * Range: 0.0–1.0
     */
    recencyScore: number;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a single relevance score for a (user, job) pair.
 *
 * @returns A value between 0.0 and 1.0 (higher = more relevant)
 *
 * TODO: This function is the primary swap point for an ML model.
 *       Keep the same signature; replace the body with model.predict().
 */
export function computeRelevanceScore(signals: RelevanceSignals): number {
    const w = RELEVANCE_WEIGHTS;

    const score =
        w.domain   * (signals.domainMatch ? 1.0 : 0.0) +
        w.skills   * clamp01(signals.skillOverlapRatio) +
        w.title    * clamp01(signals.titleSimilarity) +
        w.location * clamp01(signals.locationMatch) +
        w.recency  * clamp01(signals.recencyScore);

    return clamp01(score);
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Compute individual signals
// ═══════════════════════════════════════════════════════════════

/**
 * Compute skill overlap ratio between a user's skills and a job's required skills.
 * Uses normalized fuzzy matching (removes dots, spaces, lowercases).
 */
export function computeSkillOverlap(
    userSkills: string[],
    jobSkills: string[],
    jobDescription: string = "",
): { ratio: number; matchedSkills: string[]; skillGap: string[] } {
    if (userSkills.length === 0) return { ratio: 0, matchedSkills: [], skillGap: jobSkills };

    const normalize = (s: string) => s.toLowerCase().replace(/[.\-/\s]+/g, "").trim();
    const userNorm = userSkills.map(normalize);
    const userNormSet = new Set(userNorm);
    const descNorm = normalize(jobDescription);

    const matchedSkills: string[] = [];
    const skillGap: string[] = [];

    for (const js of jobSkills) {
        const jsNorm = normalize(js);
        const isMatch = userNormSet.has(jsNorm) ||
            userNorm.some(us => us.includes(jsNorm) || jsNorm.includes(us));
        // Also check description for skills with short names
        const descMatch = !isMatch && jsNorm.length >= 3 && descNorm.includes(jsNorm);

        if (isMatch || descMatch) {
            matchedSkills.push(js);
        } else {
            skillGap.push(js);
        }
    }

    // Ratio is matched / total job skills (or user skills if job has none)
    const denominator = jobSkills.length > 0 ? jobSkills.length : userSkills.length;
    const ratio = denominator > 0 ? matchedSkills.length / denominator : 0;

    return { ratio: Math.min(1.0, ratio), matchedSkills, skillGap };
}

/**
 * Compute token-level Jaccard similarity between two titles.
 */
export function computeTitleSimilarity(userTitle: string, jobTitle: string): number {
    if (!userTitle || !jobTitle) return 0.5; // neutral when unknown

    const tokenize = (s: string) =>
        new Set(
            s.toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .split(/\s+/)
                .filter(w => w.length > 1)
        );

    const userTokens = tokenize(userTitle);
    const jobTokens = tokenize(jobTitle);

    if (userTokens.size === 0 || jobTokens.size === 0) return 0.5;

    let intersection = 0;
    for (const token of userTokens) {
        if (jobTokens.has(token)) intersection++;
    }

    const union = new Set([...userTokens, ...jobTokens]).size;
    return union > 0 ? intersection / union : 0;
}

/**
 * Compute location match score.
 *
 * @param jobLocation  - e.g. "Hyderabad, India" or "Remote"
 * @param userCity     - e.g. "hyderabad"
 * @param userCountry  - e.g. "india"
 * @returns 0.0–1.0
 */
export function computeLocationMatch(
    jobLocation: string,
    userCity: string,
    userCountry: string,
): number {
    const loc = (jobLocation || "").toLowerCase();
    const city = (userCity || "").toLowerCase();
    const country = (userCountry || "").toLowerCase();

    if (city && loc.includes(city)) return 1.0;
    if (loc.includes("remote") || loc.includes("wfh") || loc.includes("anywhere")) return 0.5;
    if (country && loc.includes(country)) return 0.6;
    return 0.0;
}

/**
 * Compute recency score with exponential decay.
 * 1.0 at day 0, ~0.5 at 7 days, ~0.0 at 30+ days.
 *
 * @param postedAt - ISO date string
 * @returns 0.0–1.0
 */
export function computeRecencyScore(postedAt: string): number {
    if (!postedAt) return 0.3; // unknown date → low-ish default
    const daysOld = (Date.now() - new Date(postedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld < 0) return 1.0; // future date (clock skew)
    // Exponential decay: half-life of 7 days
    return Math.exp(-0.1 * daysOld);
}

// ── Utility ──────────────────────────────────────────────────
function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}
