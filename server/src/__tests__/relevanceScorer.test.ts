import { describe, it, expect } from "vitest";
import {
    computeRelevanceScore,
    computeSkillOverlap,
    computeTitleSimilarity,
    computeLocationMatch,
    computeRecencyScore,
    MIN_PRIMARY_RELEVANCE,
    RELAXED_PRIMARY_RELEVANCE,
    type RelevanceSignals,
} from "../services/relevanceScorer.js";

// ═══════════════════════════════════════════════════════════════
// computeRelevanceScore
// ═══════════════════════════════════════════════════════════════

describe("computeRelevanceScore", () => {
    it("returns ~1.0 for a perfect match", () => {
        const signals: RelevanceSignals = {
            domainMatch: true,
            skillOverlapRatio: 1.0,
            titleSimilarity: 1.0,
            locationMatch: 1.0,
            recencyScore: 1.0,
        };
        const score = computeRelevanceScore(signals);
        expect(score).toBeGreaterThanOrEqual(0.95);
        expect(score).toBeLessThanOrEqual(1.0);
    });

    it("returns ~0.0 for a complete mismatch", () => {
        const signals: RelevanceSignals = {
            domainMatch: false,
            skillOverlapRatio: 0.0,
            titleSimilarity: 0.0,
            locationMatch: 0.0,
            recencyScore: 0.0,
        };
        expect(computeRelevanceScore(signals)).toBe(0);
    });

    it("domain mismatch significantly lowers score even with high skill overlap", () => {
        const withDomain: RelevanceSignals = {
            domainMatch: true, skillOverlapRatio: 0.8,
            titleSimilarity: 0.5, locationMatch: 0.5, recencyScore: 0.7,
        };
        const withoutDomain: RelevanceSignals = {
            domainMatch: false, skillOverlapRatio: 0.8,
            titleSimilarity: 0.5, locationMatch: 0.5, recencyScore: 0.7,
        };
        const diff = computeRelevanceScore(withDomain) - computeRelevanceScore(withoutDomain);
        // Domain contributes 35%, so the difference should be ~0.35
        expect(diff).toBeGreaterThanOrEqual(0.30);
        expect(diff).toBeLessThanOrEqual(0.40);
    });

    it("clamps values above 1.0 to 1.0", () => {
        const signals: RelevanceSignals = {
            domainMatch: true, skillOverlapRatio: 1.5,
            titleSimilarity: 1.5, locationMatch: 1.5, recencyScore: 1.5,
        };
        expect(computeRelevanceScore(signals)).toBeCloseTo(1.0, 10);
    });

    it("clamps values below 0.0 to 0.0", () => {
        const signals: RelevanceSignals = {
            domainMatch: false, skillOverlapRatio: -1,
            titleSimilarity: -1, locationMatch: -1, recencyScore: -1,
        };
        expect(computeRelevanceScore(signals)).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════
// computeSkillOverlap
// ═══════════════════════════════════════════════════════════════

describe("computeSkillOverlap", () => {
    it("returns 1.0 for perfect overlap", () => {
        const { ratio } = computeSkillOverlap(
            ["React", "TypeScript", "Node.js"],
            ["react", "typescript", "node.js"]
        );
        expect(ratio).toBe(1.0);
    });

    it("returns 0.0 for zero overlap", () => {
        const { ratio } = computeSkillOverlap(
            ["Python", "TensorFlow"],
            ["React", "Angular"]
        );
        expect(ratio).toBe(0.0);
    });

    it("handles fuzzy matching (dots, dashes, case)", () => {
        const { ratio, matchedSkills } = computeSkillOverlap(
            ["Node.js", "Next.js"],
            ["nodejs", "nextjs"]
        );
        expect(ratio).toBe(1.0);
        expect(matchedSkills.length).toBe(2);
    });

    it("returns 0.0 for empty user skills", () => {
        const { ratio } = computeSkillOverlap([], ["React", "Node"]);
        expect(ratio).toBe(0.0);
    });

    it("identifies skill gaps correctly", () => {
        const { skillGap } = computeSkillOverlap(
            ["Python", "React"],
            ["Python", "Kubernetes", "Docker"]
        );
        expect(skillGap).toContain("Kubernetes");
        expect(skillGap).toContain("Docker");
        expect(skillGap).not.toContain("Python");
    });
});

// ═══════════════════════════════════════════════════════════════
// computeTitleSimilarity
// ═══════════════════════════════════════════════════════════════

describe("computeTitleSimilarity", () => {
    it("returns 1.0 for identical titles", () => {
        expect(computeTitleSimilarity("Data Scientist", "Data Scientist")).toBe(1.0);
    });

    it("returns 0.5 for unknown user title", () => {
        expect(computeTitleSimilarity("", "Software Engineer")).toBe(0.5);
    });

    it("returns partial similarity for overlapping tokens", () => {
        const sim = computeTitleSimilarity("ML Engineer", "Machine Learning Engineer");
        expect(sim).toBeGreaterThan(0);
        expect(sim).toBeLessThan(1.0);
    });

    it("returns low similarity for completely different titles", () => {
        const sim = computeTitleSimilarity("Frontend Developer", "Data Scientist");
        expect(sim).toBeLessThan(0.2);
    });
});

// ═══════════════════════════════════════════════════════════════
// computeLocationMatch
// ═══════════════════════════════════════════════════════════════

describe("computeLocationMatch", () => {
    it("returns 1.0 for exact city match", () => {
        expect(computeLocationMatch("Hyderabad, India", "hyderabad", "india")).toBe(1.0);
    });

    it("returns 0.5 for remote jobs", () => {
        expect(computeLocationMatch("Remote", "hyderabad", "india")).toBe(0.5);
    });

    it("returns 0.6 for same country but different city", () => {
        expect(computeLocationMatch("Bangalore, India", "hyderabad", "india")).toBe(0.6);
    });

    it("returns 0.0 for completely different location", () => {
        expect(computeLocationMatch("San Francisco, USA", "hyderabad", "india")).toBe(0.0);
    });
});

// ═══════════════════════════════════════════════════════════════
// computeRecencyScore
// ═══════════════════════════════════════════════════════════════

describe("computeRecencyScore", () => {
    it("returns ~1.0 for today", () => {
        expect(computeRecencyScore(new Date().toISOString())).toBeGreaterThan(0.9);
    });

    it("returns ~0.5 for 7-day-old job", () => {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const score = computeRecencyScore(sevenDaysAgo);
        expect(score).toBeGreaterThan(0.35);
        expect(score).toBeLessThan(0.65);
    });

    it("returns very low for 30-day-old job", () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        expect(computeRecencyScore(thirtyDaysAgo)).toBeLessThan(0.1);
    });

    it("returns 0.3 for missing date", () => {
        expect(computeRecencyScore("")).toBe(0.3);
    });
});

// ═══════════════════════════════════════════════════════════════
// Primary/Cross threshold constants
// ═══════════════════════════════════════════════════════════════

describe("threshold constants", () => {
    it("MIN_PRIMARY_RELEVANCE is between 0 and 1", () => {
        expect(MIN_PRIMARY_RELEVANCE).toBeGreaterThan(0);
        expect(MIN_PRIMARY_RELEVANCE).toBeLessThan(1);
    });

    it("RELAXED threshold is lower than strict", () => {
        expect(RELAXED_PRIMARY_RELEVANCE).toBeLessThan(MIN_PRIMARY_RELEVANCE);
    });
});
