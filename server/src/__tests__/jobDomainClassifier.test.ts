import { describe, it, expect } from "vitest";
import {
    classifyJobDomain, getRelatedDomains, isDomainMatch,
    JOB_DOMAIN_VALUES, JOB_DOMAIN_LABELS, type JobDomain,
} from "../services/jobDomainClassifier.js";

// ═══════════════════════════════════════════════════════════════
// classifyJobDomain — Title-based classification
// ═══════════════════════════════════════════════════════════════

describe("classifyJobDomain — title patterns", () => {
    const cases: [string, JobDomain][] = [
        // Data Science & ML
        ["Data Scientist", "data-science-ml"],
        ["Senior Machine Learning Engineer", "data-science-ml"],
        ["ML Engineer - NLP", "data-science-ml"],
        ["AI Engineer", "data-science-ml"],
        ["Deep Learning Researcher", "data-science-ml"],
        ["Applied Scientist - Computer Vision", "data-science-ml"],
        ["NLP Engineer", "data-science-ml"],
        ["LLM Engineer - Generative AI", "data-science-ml"],

        // Data Analytics
        ["Data Analyst", "data-analytics"],
        ["Business Intelligence Analyst", "data-analytics"],
        ["BI Engineer", "data-analytics"],
        ["Analytics Engineer", "data-analytics"],
        ["Tableau Developer", "data-analytics"],

        // Frontend
        ["React Developer", "frontend"],
        ["Frontend Engineer", "frontend"],
        ["UI Engineer", "frontend"],
        ["Angular Developer", "frontend"],
        ["Web Developer", "frontend"],

        // Backend
        ["Backend Engineer", "backend"],
        ["Node.js Developer", "backend"],
        ["Java Developer", "backend"],
        ["API Engineer", "backend"],
        ["Python Developer", "backend"],

        // Mobile
        ["Android Developer", "mobile"],
        ["iOS Engineer", "mobile"],
        ["Flutter Developer", "mobile"],
        ["React Native Developer", "mobile"],
        ["Mobile Engineer", "mobile"],

        // DevOps
        ["DevOps Engineer", "devops"],
        ["SRE", "devops"],
        ["Cloud Engineer", "devops"],
        ["Platform Engineer", "devops"],
        ["Infrastructure Engineer", "devops"],
    ];

    it.each(cases)("classifies '%s' as %s", (title, expected) => {
        expect(classifyJobDomain(title, "", [])).toBe(expected);
    });
});

describe("classifyJobDomain — fresher/intern detection", () => {
    it("classifies 'Software Engineer Intern' as generic-fresher", () => {
        expect(classifyJobDomain("Software Engineer Intern", "", [])).toBe("generic-fresher");
    });

    it("classifies 'Graduate Engineer Trainee' as generic-fresher", () => {
        expect(classifyJobDomain("Graduate Engineer Trainee", "", [])).toBe("generic-fresher");
    });

    it("classifies 'ML Intern' as data-science-ml (domain wins over fresher)", () => {
        const result = classifyJobDomain("ML Intern", "machine learning internship with pytorch", ["python", "pytorch"]);
        expect(result).toBe("data-science-ml");
    });

    it("classifies 'Intern' alone as generic-fresher", () => {
        expect(classifyJobDomain("Intern", "", [])).toBe("generic-fresher");
    });
});

describe("classifyJobDomain — skills-based classification", () => {
    it("classifies generic 'Software Engineer' with ML skills as data-science-ml", () => {
        const result = classifyJobDomain(
            "Software Engineer",
            "work with data pipelines and ML models",
            ["python", "tensorflow", "pytorch", "pandas"]
        );
        expect(result).toBe("data-science-ml");
    });

    it("classifies generic 'Software Engineer' with React skills as frontend", () => {
        const result = classifyJobDomain(
            "Software Engineer",
            "build user interfaces",
            ["react", "typescript", "css", "html"]
        );
        expect(result).toBe("frontend");
    });

    it("classifies generic 'Software Engineer' with no skills as backend (default)", () => {
        expect(classifyJobDomain("Software Engineer", "", [])).toBe("backend");
    });

    it("classifies 'SDE' with Docker/K8s skills as devops", () => {
        const result = classifyJobDomain(
            "SDE",
            "manage infrastructure and deployments",
            ["docker", "kubernetes", "terraform", "aws"]
        );
        expect(result).toBe("devops");
    });
});

describe("classifyJobDomain — description-based fallback", () => {
    it("uses description keywords when title and skills are ambiguous", () => {
        const result = classifyJobDomain(
            "Engineer",
            "You will build Android applications using Kotlin and Jetpack Compose",
            []
        );
        expect(result).toBe("mobile");
    });
});

// ═══════════════════════════════════════════════════════════════
// getRelatedDomains
// ═══════════════════════════════════════════════════════════════

describe("getRelatedDomains", () => {
    it("data-science-ml includes data-analytics", () => {
        const related = getRelatedDomains("data-science-ml");
        expect(related).toContain("data-analytics");
    });

    it("frontend includes mobile", () => {
        const related = getRelatedDomains("frontend");
        expect(related).toContain("mobile");
    });

    it("devops includes backend", () => {
        const related = getRelatedDomains("devops");
        expect(related).toContain("backend");
    });

    it("generic-fresher includes all 6 tech domains (broadest primary pool)", () => {
        const related = getRelatedDomains("generic-fresher");
        expect(related).toContain("backend");
        expect(related).toContain("frontend");
        expect(related).toContain("data-science-ml");
        expect(related).toContain("data-analytics");
        expect(related).toContain("mobile");
        expect(related).toContain("devops");
    });
});

// ═══════════════════════════════════════════════════════════════
// isDomainMatch
// ═══════════════════════════════════════════════════════════════

describe("isDomainMatch", () => {
    it("exact match returns true", () => {
        expect(isDomainMatch("data-science-ml", "data-science-ml")).toBe(true);
    });

    it("related match returns true", () => {
        expect(isDomainMatch("data-science-ml", "data-analytics")).toBe(true);
    });

    it("unrelated match returns false", () => {
        expect(isDomainMatch("data-science-ml", "frontend")).toBe(false);
    });

    it("frontend → mobile is a match (related)", () => {
        expect(isDomainMatch("frontend", "mobile")).toBe(true);
    });

    it("mobile → devops is not a match", () => {
        expect(isDomainMatch("mobile", "devops")).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// Constants validation
// ═══════════════════════════════════════════════════════════════

describe("JOB_DOMAIN_VALUES", () => {
    it("has exactly 7 values", () => {
        expect(JOB_DOMAIN_VALUES.length).toBe(7);
    });

    it("every domain has a label", () => {
        for (const domain of JOB_DOMAIN_VALUES) {
            expect(JOB_DOMAIN_LABELS[domain]).toBeDefined();
            expect(JOB_DOMAIN_LABELS[domain].length).toBeGreaterThan(0);
        }
    });
});
