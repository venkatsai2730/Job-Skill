import { describe, it, expect } from "vitest";
import {
    estimateShortlistingChance,
    chanceToBand,
    type UserProfile,
    type ScoredJob,
    type ShortlistBand,
} from "../services/shortlistingChance.js";

// ═══════════════════════════════════════════════════════════════
// Helper: Create test fixtures
// ═══════════════════════════════════════════════════════════════

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
        skills: ["python", "tensorflow", "pandas", "sql"],
        experienceYears: 2,
        seniority: "entry",
        domain: "data-science-ml",
        ...overrides,
    };
}

function makeJob(overrides: Partial<ScoredJob> = {}): ScoredJob {
    return {
        title: "Data Scientist",
        company: "Startup XYZ",
        skills: ["python", "tensorflow", "sql"],
        seniority_level: "entry",
        job_domain: "data-science-ml",
        posted_at: new Date().toISOString(),
        relevanceScore: 0.8,
        skillOverlapRatio: 0.7,
        domainMatch: true,
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════
// estimateShortlistingChance
// ═══════════════════════════════════════════════════════════════

describe("estimateShortlistingChance", () => {
    it("returns High for a perfect-fit domain + skill match at a startup", () => {
        const user = makeUser();
        const job = makeJob({ skillOverlapRatio: 0.9, domainMatch: true });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeGreaterThanOrEqual(55);
        expect(result.band).toBe("High");
        expect(result.reason).toContain("matching domain");
        expect(result.reason).toContain("strong skill match");
    });

    it("returns Low for a domain mismatch with low skills at a big company", () => {
        const user = makeUser({ domain: "data-science-ml" });
        const job = makeJob({
            title: "Frontend Developer",
            company: "Google",
            job_domain: "frontend",
            domainMatch: false,
            skillOverlapRatio: 0.1,
        });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeLessThanOrEqual(45);
        expect(["Low", "Medium"]).toContain(result.band);
        expect(result.reason).toContain("outside your domain");
    });

    it("returns Medium for moderate overlap at a mid-size company", () => {
        const user = makeUser({ experienceYears: 3, seniority: "mid" });
        const job = makeJob({
            company: "MidSize Corp",
            seniority_level: "mid",
            skillOverlapRatio: 0.5,
            domainMatch: true,
        });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeGreaterThanOrEqual(35);
        expect(result.chance).toBeLessThanOrEqual(99);
        expect(["Medium", "High"]).toContain(result.band);
    });

    it("caps chance for senior roles when user is very junior", () => {
        const user = makeUser({ experienceYears: 1, seniority: "entry" });
        const job = makeJob({
            title: "Senior ML Engineer",
            seniority_level: "senior",
            skillOverlapRatio: 0.8,
        });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeLessThanOrEqual(8);
        expect(result.band).toBe("Very Low");
    });

    it("caps chance for tier-1 companies + very junior users", () => {
        const user = makeUser({ experienceYears: 1, seniority: "entry" });
        const job = makeJob({
            company: "OpenAI",
            skillOverlapRatio: 0.9,
        });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeLessThanOrEqual(15);
        expect(result.reason).toContain("hyper-competitive");
    });

    it("penalizes PhD-required roles", () => {
        const user = makeUser();
        const job = makeJob({ title: "Research Scientist (PhD Required)" });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeLessThanOrEqual(5);
    });

    it("returns chance between 1 and 99", () => {
        // Even in the worst case, chance should be >= 1
        const user = makeUser({ skills: [], experienceYears: 0 });
        const job = makeJob({
            title: "Senior Staff Principal Architect",
            company: "Google",
            domainMatch: false,
            skillOverlapRatio: 0,
        });
        const result = estimateShortlistingChance(user, job);

        expect(result.chance).toBeGreaterThanOrEqual(1);
        expect(result.chance).toBeLessThanOrEqual(99);
    });

    it("includes a non-empty reason string", () => {
        const result = estimateShortlistingChance(makeUser(), makeJob());
        expect(result.reason).toBeTruthy();
        expect(result.reason.length).toBeGreaterThan(10);
    });
});

// ═══════════════════════════════════════════════════════════════
// chanceToBand
// ═══════════════════════════════════════════════════════════════

describe("chanceToBand", () => {
    const cases: [number, ShortlistBand][] = [
        [99, "High"],
        [55, "High"],
        [54, "Medium"],
        [35, "Medium"],
        [34, "Low"],
        [15, "Low"],
        [14, "Very Low"],
        [1, "Very Low"],
    ];

    it.each(cases)("chance %d → band '%s'", (chance, expected) => {
        expect(chanceToBand(chance)).toBe(expected);
    });
});
