// ═══════════════════════════════════════════════════════════════
// Shortlisting Chance Estimator — Heuristic stub for future ML model
//
// Estimates the probability (1–99%) of a candidate being shortlisted
// for a given job. Currently uses a rule-based heuristic combining
// domain match, skill overlap, seniority fit, and company competition.
//
// TODO: Replace with a calibrated learning-to-rank model (e.g.
//       LightGBM with log-loss) trained on (user, job, outcome)
//       tuples from tracked applications.
// ═══════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────
export type ShortlistBand = "Very Low" | "Low" | "Medium" | "High";

export interface ShortlistEstimate {
    /** Estimated chance percentage (1–99) */
    chance: number;
    /** Human-readable band label */
    band: ShortlistBand;
    /** Explanation of the estimate */
    reason: string;
}

export interface UserProfile {
    skills: string[];
    experienceYears: number;
    seniority: string;       // "intern" | "entry" | "mid" | "senior" | "lead"
    domain: string;          // user's primary domain
}

export interface ScoredJob {
    title: string;
    company: string;
    skills: string[];
    seniority_level: string;
    job_domain: string;
    posted_at: string;
    relevanceScore: number;  // 0.0–1.0 from relevanceScorer
    skillOverlapRatio: number;
    domainMatch: boolean;
}

// ── Big / hyper-competitive companies ────────────────────────
const BIG_COMPANIES = new Set([
    "google", "microsoft", "amazon", "meta", "apple", "netflix", "uber",
    "flipkart", "swiggy", "zomato", "paytm", "phonepe", "razorpay",
    "infosys", "tcs", "wipro", "hcl", "cognizant", "accenture", "deloitte",
    "jpmorgan", "goldman sachs", "morgan stanley", "barclays",
    "samsung", "oracle", "ibm", "intel", "nvidia", "salesforce", "adobe",
    "walmart", "spotify", "stripe", "airbnb", "openai", "anthropic",
]);

const TIER1_COMPANIES = new Set([
    "openai", "anthropic", "stripe", "figma", "netflix", "apple",
    "google", "meta", "microsoft", "amazon", "uber", "deepmind",
]);

// ── Seniority ordering ───────────────────────────────────────
const SENIORITY_ORDER = ["intern", "entry", "mid", "senior", "lead"];

function seniorityIndex(level: string): number {
    const idx = SENIORITY_ORDER.indexOf((level || "entry").toLowerCase());
    return idx >= 0 ? idx : 1;
}

// ═══════════════════════════════════════════════════════════════
// MAIN ESTIMATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Estimate the shortlisting chance for a (user, job) pair.
 *
 * This is a heuristic stub. The function signature is designed to be
 * compatible with a future ML model that takes the same inputs and
 * produces the same output shape.
 *
 * @param user - User profile with skills, experience, domain
 * @param job  - Scored job with relevance signals
 * @returns    - { chance, band, reason }
 *
 * TODO: Replace body with calibrated ML model predictions.
 *       Keep the same function signature.
 */
export function estimateShortlistingChance(
    user: UserProfile,
    job: ScoredJob,
): ShortlistEstimate {
    // ── 1. Domain match (30% weight) ─────────────────────────
    const domainScore = job.domainMatch ? 30 : 5;

    // ── 2. Skill overlap (30% weight) ────────────────────────
    const skillScore = Math.round(job.skillOverlapRatio * 30);

    // ── 3. Seniority fit (20% weight) ────────────────────────
    const userIdx = seniorityIndex(user.seniority);
    const jobIdx = seniorityIndex(job.seniority_level);
    const levelDiff = Math.abs(userIdx - jobIdx);
    const seniorityScore = levelDiff === 0 ? 20 : levelDiff === 1 ? 12 : 4;

    // ── 4. Competition / company size (10% weight) ───────────
    const companyLower = (job.company || "").toLowerCase();
    const isBigCompany = [...BIG_COMPANIES].some(bc => companyLower.includes(bc));
    const isTier1 = [...TIER1_COMPANIES].some(t1 => companyLower.includes(t1));
    const competitionScore = isTier1 ? 0 : isBigCompany ? 3 : 10;

    // ── 5. Recency (10% weight) ──────────────────────────────
    const daysOld = (Date.now() - new Date(job.posted_at).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = daysOld < 3 ? 10 : daysOld < 7 ? 7 : daysOld < 14 ? 4 : 1;

    // ── Combine ──────────────────────────────────────────────
    let rawChance = domainScore + skillScore + seniorityScore + competitionScore + recencyScore;

    // ── Strict penalties ─────────────────────────────────────
    const jobTitleLower = (job.title || "").toLowerCase();

    // PhD requirement
    if (/\b(phd|ph\.d|doctorate)\b/i.test(jobTitleLower)) {
        rawChance = Math.min(rawChance, 5);
    }

    // Senior roles for junior candidates
    if (/\b(senior|sr\.?|lead|staff|principal|director|vp)\b/i.test(jobTitleLower) && user.experienceYears < 3) {
        rawChance = Math.min(rawChance, 8);
    }

    // Tier-1 for very junior
    if (isTier1 && user.experienceYears < 2) {
        rawChance = Math.min(rawChance, 15);
    }

    // Clamp to 1–99
    const chance = Math.max(1, Math.min(99, Math.round(rawChance)));

    // ── Determine band ───────────────────────────────────────
    const band = chanceToBand(chance);

    // ── Generate reason ──────────────────────────────────────
    const reasons: string[] = [];
    if (job.domainMatch) reasons.push("matching domain");
    else reasons.push("outside your domain");

    if (job.skillOverlapRatio >= 0.6) reasons.push("strong skill match");
    else if (job.skillOverlapRatio >= 0.3) reasons.push("moderate skill match");
    else reasons.push("limited skill overlap");

    if (levelDiff === 0) reasons.push("great seniority fit");
    else if (levelDiff >= 2) reasons.push("seniority mismatch");

    if (isTier1) reasons.push("hyper-competitive company");
    else if (isBigCompany) reasons.push("high competition");
    else reasons.push("lower competition");

    if (daysOld < 3) reasons.push("recently posted");
    else if (daysOld > 14) reasons.push("posted over 2 weeks ago");

    return {
        chance,
        band,
        reason: reasons.join(", "),
    };
}

/**
 * Convert a numeric chance to a band label.
 */
export function chanceToBand(chance: number): ShortlistBand {
    if (chance >= 55) return "High";
    if (chance >= 35) return "Medium";
    if (chance >= 15) return "Low";
    return "Very Low";
}
