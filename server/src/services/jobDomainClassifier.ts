// ═══════════════════════════════════════════════════════════════
// Job Domain Classifier — Deterministic keyword-based classifier
//
// Assigns one of 7 canonical job_domain values to a job listing
// based on its title, description, and skills array.
//
// TODO: Replace with an embedding-based classifier or fine-tuned
//       LLM classifier once we have labelled training data.
// ═══════════════════════════════════════════════════════════════

// ── Canonical domain values ──────────────────────────────────
export const JOB_DOMAIN_VALUES = [
    "data-science-ml",
    "data-analytics",
    "frontend",
    "backend",
    "mobile",
    "devops",
    "generic-fresher",
] as const;

export type JobDomain = (typeof JOB_DOMAIN_VALUES)[number];

// ── Human-readable labels ────────────────────────────────────
export const JOB_DOMAIN_LABELS: Record<JobDomain, string> = {
    "data-science-ml": "Data Science & ML",
    "data-analytics": "Data Analytics",
    "frontend": "Frontend Development",
    "backend": "Backend Development",
    "mobile": "Mobile Development",
    "devops": "DevOps & Cloud",
    "generic-fresher": "General / Fresher",
};

// ── Related-domain adjacency map ─────────────────────────────
// Used by candidate generation to decide what goes into the
// primary pool alongside an exact domain match.
// ── Related-domain adjacency map ─────────────────────────────
// Used by candidate generation to decide what goes into the
// primary pool alongside an exact domain match.
const RELATED_DOMAINS: Record<JobDomain, JobDomain[]> = {
    "data-science-ml": ["data-analytics", "backend"],
    "data-analytics": ["data-science-ml", "backend"],
    "frontend": ["mobile", "backend"],
    "backend": ["devops", "frontend", "data-analytics"],
    "mobile": ["frontend", "backend"],
    "devops": ["backend", "data-science-ml"],
    // Freshers can apply to any tech domain — include all so the primary pool is broad
    "generic-fresher": ["backend", "frontend", "data-science-ml", "data-analytics", "mobile", "devops"],
};

// ── Tech Title Detection ────────────────────────────────────
// Used to distinguish tech jobs from non-tech ones.
const TECH_TITLE_KEYWORDS = /\b(engineer|developer|sde|swe|programmer|coder|software|data|science|scientist|analyst|analytics|researcher|devops|sre|qa|tester|sdet|frontend|front[\s-]?end|backend|back[\s-]?end|fullstack|full[\s-]?stack|machine\s*learn|ml\b|ai\b|deep\s*learn|nlp|cloud|cyber|security|python|java|react|angular|vue|node|web\s*dev|mobile\s*dev|android|ios|swift|kotlin|flutter|tech|it\s|computing|sap|erp|database|dba|network|system\s*admin|embedded|firmware|hardware|vlsi|semiconductor|devrel|devsecops|blockchain|smart\s*contract|robotics|automation)\b/i;

// Non-tech roles that should never appear in the tech/fresher feed
const NON_TECH_TITLE_KEYWORDS = /\b(telecaller|fundraising|charity|event\s*manage|real\s*estate|teaching|tutor|content\s*writ|blog\s*writ|video\s*edit|graphic\s*design|fashion|textile|apparel|legal|law\b|advocate|counsel|ca\s*article|chartered\s*account|company\s*secretary|audit|taxation|finance\s*analyst|equity\s*analyst|investment\s*bank|stock\s*brok|insurance|loan|mortgage|wealth\s*manage|client\s*acqui|business\s*develop|business\s*strat|project\s*manage[^r]|operations\s*manage|general\s*manage|human\s*resource|recruitment|talent\s*acqui|staffing|placement|hospitality|hotel|restaurant|food\s*tech|delivery\s*boy|delivery\s*exec|rider|warehouse|logistics|supply\s*chain|procurement|purchase|store\s*manage|retail|customer\s*success|customer\s*support|call\s*center|bpo|medical|pharma|clinical|nursing|doctor|dentist|physiotherap|data\s*entry|clerk|receptionist|office\s*assistant|virtual\s*assistant|asistente|asistente\s*virtual|executive\s*assistant|operations\s*executive|administrative|office\s*manager|secretary)\b/i;

/**
 * Returns true if the job title looks like a tech/engineering role.
 */
export function isTechTitle(title: string): boolean {
    const t = title.toLowerCase();
    // If it matches a non-tech keyword, it's not tech
    if (NON_TECH_TITLE_KEYWORDS.test(t)) return false;
    // If it matches a tech keyword, it's tech
    if (TECH_TITLE_KEYWORDS.test(t)) return true;
    // Ambiguous titles (e.g. "Intern", "Trainee") — default to non-tech
    // unless they also contain a tech word
    return false;
}

/**
 * Returns the domains considered "related" to the given domain.
 * These are included in the primary candidate pool.
 */
export function getRelatedDomains(domain: JobDomain): JobDomain[] {
    return RELATED_DOMAINS[domain] || [];
}

/**
 * Returns true if `jobDomain` is in the primary set for `userDomain`
 * (exact match OR related).
 */
export function isDomainMatch(userDomain: JobDomain, jobDomain: JobDomain): boolean {
    if (userDomain === jobDomain) return true;
    return getRelatedDomains(userDomain).includes(jobDomain);
}

// ═══════════════════════════════════════════════════════════════
// CLASSIFIER RULES — ordered from most-specific to least-specific
// ═══════════════════════════════════════════════════════════════

// ── Title regex patterns (highest priority) ──────────────────
const TITLE_PATTERNS: { domain: JobDomain; pattern: RegExp }[] = [
    // Data Science & ML — must come before generic "data" patterns
    {
        domain: "data-science-ml",
        pattern: /\b(data\s*scien|machine\s*learn|ml\s+engineer|ml\b|ai\s+engineer|deep\s*learn|nlp\s+engineer|nlp\b|computer\s*vision|neural\s*net|research\s*scien|llm|large\s*language|generative\s*ai|reinforcement\s*learn|applied\s*scien)/i,
    },
    // Data Analytics
    {
        domain: "data-analytics",
        pattern: /\b(data\s*analyst|business\s*intellig|bi\s+analyst|bi\s+engineer|analytics\s*engineer|power\s*bi|tableau\s*dev|looker|dashboard\s*analyst|reporting\s*analyst)/i,
    },
    // Mobile
    {
        domain: "mobile",
        pattern: /\b(android\s*dev|ios\s*dev|ios\s*engineer|swift\s*dev|kotlin\s*dev|flutter\s*dev|react\s*native\s*dev|mobile\s*dev|mobile\s*engineer)/i,
    },
    // DevOps & Cloud
    {
        domain: "devops",
        pattern: /\b(devops|dev\s*ops|sre\b|site\s*reliab|cloud\s*engineer|infrastructure\s*engineer|platform\s*engineer|kubernetes\s*engineer|terraform|ci\s*\/?\s*cd\s*engineer)/i,
    },
    // Frontend
    {
        domain: "frontend",
        pattern: /\b(frontend|front[\s-]?end|react\s*dev|angular\s*dev|vue\s*dev|ui\s*engineer|ui\s*developer|web\s*developer|javascript\s*dev|typescript\s*dev)/i,
    },
    // Backend
    {
        domain: "backend",
        pattern: /\b(backend|back[\s-]?end|server[\s-]?side|api\s*dev|api\s*engineer|node\.?js\s*dev|java\s*dev|python\s*dev|golang\s*dev|\.net\s*dev|spring\s*dev|microservice)/i,
    },
];

// ── Fresher / intern detection ───────────────────────────────
const FRESHER_PATTERN = /\b(intern\b|internship|trainee|fresher|entry[\s-]?level|graduate\s*engineer|campus\s*hire|apprentice|get\b)/i;

// ── Skills keywords per domain ───────────────────────────────
const DOMAIN_SKILL_KEYWORDS: Record<JobDomain, string[]> = {
    "data-science-ml": [
        "tensorflow", "pytorch", "xgboost", "scikit-learn", "sklearn",
        "machine learning", "deep learning", "nlp", "computer vision",
        "sagemaker", "mlflow", "kubeflow", "huggingface", "transformers",
        "langchain", "llm", "neural network", "feature engineering",
        "pandas", "numpy", "scipy", "keras", "anomaly detection",
        "time series", "recommendation system", "a/b testing",
        "statistical modeling", "regression", "classification",
    ],
    "data-analytics": [
        "tableau", "power bi", "looker", "excel", "google analytics",
        "sql", "dax", "data visualization", "dashboard", "reporting",
        "business intelligence", "etl", "data warehouse", "snowflake",
        "redshift", "bigquery", "dbt", "airflow", "metabase",
    ],
    "frontend": [
        "react", "angular", "vue", "svelte", "next.js", "nuxt",
        "html", "css", "sass", "tailwind", "webpack", "vite",
        "redux", "zustand", "graphql client", "apollo client",
        "storybook", "figma", "responsive design", "accessibility",
    ],
    "backend": [
        "node", "express", "django", "flask", "fastapi", "spring",
        "spring boot", "nest.js", "golang", "rust", "microservices",
        "grpc", "rest api", "graphql server", "postgresql", "mysql",
        "mongodb", "redis", "kafka", "rabbitmq", "elasticsearch",
        "prisma", "sequelize", "typeorm",
    ],
    "mobile": [
        "android", "ios", "swift", "kotlin", "flutter", "dart",
        "react native", "swiftui", "jetpack compose", "xcode",
        "android studio", "cocoapods", "gradle", "mobile sdk",
    ],
    "devops": [
        "docker", "kubernetes", "terraform", "ansible", "jenkins",
        "github actions", "gitlab ci", "aws", "azure", "gcp",
        "linux", "nginx", "prometheus", "grafana", "datadog",
        "helm", "argocd", "vault", "istio", "cloudformation",
    ],
    "generic-fresher": [],
};

// ── Normalize a string for matching ──────────────────────────
function normalize(s: string): string {
    return s.toLowerCase().replace(/[.\-/]+/g, " ").replace(/\s+/g, " ").trim();
}

// ── Skills/text-based domain scoring (NO title gate) ─────────
// Scores each domain by keyword hits in skills (weight 3), title (2),
// description (1). Returns the best domain + score. Shared by the main
// classifier's Step 2 and by classifyDomainBySkills().
function bestDomainByKeywords(
    titleNorm: string,
    skillsText: string,
    descNorm: string,
): { domain: JobDomain | null; score: number } {
    const domainScores: Record<string, number> = {};
    for (const [domain, keywords] of Object.entries(DOMAIN_SKILL_KEYWORDS)) {
        if (domain === "generic-fresher") continue;
        let score = 0;
        for (const kw of keywords) {
            const kwNorm = normalize(kw);
            if (skillsText.includes(kwNorm)) score += 3;
            else if (titleNorm.includes(kwNorm)) score += 2;
            else if (descNorm.includes(kwNorm)) score += 1;
        }
        domainScores[domain] = score;
    }
    let bestDomain: JobDomain | null = null;
    let bestScore = 0;
    for (const [domain, score] of Object.entries(domainScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestDomain = domain as JobDomain;
        }
    }
    return { domain: bestDomain, score: bestScore };
}

/**
 * Classifies a domain from SKILLS alone (no title/tech-title gate).
 *
 * Use this for classifying a USER's own domain, where the title may be
 * missing, empty, or garbage (e.g. a mis-parsed resume role like "default.")
 * but the skills array is rich. classifyJobDomain() short-circuits to
 * "generic-fresher" whenever the title isn't a recognized tech title, which
 * throws away a strong skills signal — this function does not.
 *
 * @returns a JobDomain when the skills clearly indicate one, else null.
 */
export function classifyDomainBySkills(skills: string[] = []): JobDomain | null {
    if (!skills.length) return null;
    const { domain, score } = bestDomainByKeywords("", normalize(skills.join(" ")), "");
    // Require ≥2 strong skill matches (2×3) so a single incidental keyword
    // (e.g. one "sql") doesn't lock in a domain.
    return domain && score >= 6 ? domain : null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN CLASSIFIER
// ═══════════════════════════════════════════════════════════════

/**
 * Classifies a job into one of 7 canonical domains.
 *
 * Priority:
 *   1. Tech title gate (filters out non-tech immediately)
 *   2. Title regex (most precise)
 *   3. Skills array keyword count
 *   4. Description keyword scan (lower weight)
 *   5. Fresher/intern detection
 *   6. Fallback to "backend" (most common generic tech role)
 *
 * @param title       - Job title (e.g. "Senior ML Engineer")
 * @param description - Full job description text
 * @param skills      - Array of skill strings from the job listing
 * @returns           - One of the 7 JobDomain values
 */
export function classifyJobDomain(
    title: string,
    description: string,
    skills: string[] = [],
): JobDomain {
    const titleNorm = normalize(title || "");
    
    // ── Step 0: Tech Title Gate ──────────────────────────────
    // Immediately exclude non-tech / administrative / operations / finance / sales roles
    if (!isTechTitle(titleNorm)) {
        return "generic-fresher";
    }

    const descNorm = normalize(description || "");
    const skillsText = normalize(skills.join(" "));
    const combinedText = `${titleNorm} ${skillsText} ${descNorm}`;

    // ── Step 1: Title pattern matching (highest confidence) ──
    for (const { domain, pattern } of TITLE_PATTERNS) {
        if (pattern.test(title || "")) {
            return domain;
        }
    }

    // ── Step 2: Skills-based classification ──────────────────
    // Count how many domain-specific keywords appear in skills/title/description.
    const { domain: bestDomain, score: bestScore } = bestDomainByKeywords(titleNorm, skillsText, descNorm);

    // Only accept if the score is meaningful (at least 3 points = 1 skill match)
    if (bestDomain && bestScore >= 3) {
        return bestDomain;
    }

    // ── Step 3: Fresher / intern detection ───────────────────
    if (FRESHER_PATTERN.test(title || "")) {
        // Check if we can still determine a domain from skills/desc
        if (bestDomain && bestScore >= 2) {
            return bestDomain; // e.g. "ML Intern" → data-science-ml
        }
        return "generic-fresher";
    }

    // ── Step 4: Full-stack / generic SWE detection ───────────
    if (/\b(full[\s-]?stack|software\s*engineer|sde|swe|software\s*dev|programmer)\b/i.test(title || "")) {
        // For generic titles, use the skills/desc score if available
        if (bestDomain && bestScore >= 2) {
            return bestDomain;
        }
        return "backend"; // default for generic SWE
    }

    // Absolute fallback (removed the weak >= 1 threshold)
    return "generic-fresher";
}
