// ═══════════════════════════════════════════════════════════════
// Smart Job Ranking Service — Resume-matched job scoring
// Ranks jobs by 5 weighted signals instead of chronological order.
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";
import { USE_HYBRID_JOB_RANKING } from "../config/featureFlags.js";
import { retrieveSimilarJobs } from "../rag/retrieve.js";

// ── Types ─────────────────────────────────────────────────────
export interface JobListing {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    job_url: string;
    source: string;
    salary_min: number | null;
    salary_max: number | null;
    experience_min: number | null;
    experience_max: number | null;
    skills: string[];
    required_skills?: string[];
    posted_at: string;
    fetched_at?: string;
    seniority_level?: string;
    seniority?: string;
    is_active?: boolean;
    match_score?: number;
    confidence_score?: number;
    category?: string;
    search_term?: string;
}

export interface RankedJob extends JobListing {
    match_score: number;
    matched_skills: string[];
    skill_gap: string[];
}

// ── Tech terms dictionary for project relevance ───────────────
const TECH_TERMS = new Set([
    "react", "angular", "vue", "next", "nuxt", "svelte", "node", "express", "django",
    "flask", "spring", "rails", "laravel", "fastapi", "graphql", "rest", "grpc",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "kafka", "rabbitmq",
    "docker", "kubernetes", "terraform", "aws", "azure", "gcp", "jenkins", "cicd",
    "python", "javascript", "typescript", "java", "golang", "rust", "cpp", "csharp",
    "kotlin", "swift", "flutter", "reactnative", "tensorflow", "pytorch", "pandas",
    "numpy", "scikit", "opencv", "nlp", "transformer", "bert", "gpt", "llm",
    "microservices", "serverless", "lambda", "s3", "ec2", "dynamodb", "firebase",
    "supabase", "prisma", "sequelize", "typeorm", "mongoose", "socketio", "websocket",
    "html", "css", "tailwind", "sass", "webpack", "vite", "rollup", "babel",
    "git", "linux", "nginx", "apache", "blockchain", "solidity", "web3",
    "figma", "sketch", "xd", "photoshop", "illustrator", "canva",
    "agile", "scrum", "jira", "confluence", "notion",
    "selenium", "cypress", "jest", "mocha", "playwright", "testing",
    "ml", "ai", "deeplearning", "datascience", "analytics", "tableau", "powerbi",
]);

// ── Extract tech terms from text ──────────────────────────────
function extractTechTerms(text: string): string[] {
    const words = text.toLowerCase().replace(/[^a-z0-9\s.#+]/g, " ").split(/\s+/);
    const found = new Set<string>();
    for (const word of words) {
        const normalized = word.replace(/[.#+]/g, "").trim();
        if (normalized.length > 1 && TECH_TERMS.has(normalized)) {
            found.add(normalized);
        }
    }
    return Array.from(found);
}

// ── Compute title similarity (tokenized Jaccard) ──────────────
function computeTitleSimilarity(userTitle: string, jobTitle: string): number {
    if (!userTitle || !jobTitle) return 50; // neutral if unknown

    const tokenize = (s: string) =>
        new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1));

    const userTokens = tokenize(userTitle);
    const jobTokens = tokenize(jobTitle);

    if (userTokens.size === 0 || jobTokens.size === 0) return 50;

    let intersection = 0;
    for (const token of userTokens) {
        if (jobTokens.has(token)) intersection++;
    }

    const union = new Set([...userTokens, ...jobTokens]).size;
    return Math.round((intersection / union) * 100);
}

// ── Seniority level order ─────────────────────────────────────
const SENIORITY_ORDER = ["intern", "entry", "mid", "senior", "lead"];

function seniorityIndex(level: string): number {
    const idx = SENIORITY_ORDER.indexOf(level.toLowerCase());
    return idx >= 0 ? idx : 1; // default to entry
}

// ═══════════════════════════════════════════════════════════════
// MAIN RANKING FUNCTION
// ═══════════════════════════════════════════════════════════════
export async function rankJobsForUser(
    userId: string,
    jobs: JobListing[],
    limit: number = 20
): Promise<RankedJob[]> {
    if (!jobs || jobs.length === 0) return [];

    // 1. Load user's latest resume from Supabase
    let userSkills: string[] = [];
    let userProjects: string[] = [];
    let userATSScore: number = 50;
    let userTitle: string = "";

    try {
        const { data: resume } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (resume?.parsed_data) {
            const pd = resume.parsed_data as any;

            // Extract skills from parsed sections — split parenthetical groups into individual skills
            const skillGroups = pd?.sections?.skills || [];
            const rawSkills = skillGroups.flatMap((g: any) => g.items || []);
            // "Python (pandas, NumPy, scikit-learn)" → ["Python", "pandas", "NumPy", "scikit-learn"]
            userSkills = rawSkills.flatMap((s: string) => {
                const base = s.replace(/\s*\([^)]*\)/g, '').trim();
                const parenMatch = s.match(/\(([^)]+)\)/);
                const parenItems = parenMatch ? parenMatch[1].split(/[,;]/).map(i => i.trim()).filter(Boolean) : [];
                return [base, ...parenItems].filter(i => i.length > 0);
            });

            // Extract project text
            const projects = pd?.sections?.projects || [];
            userProjects = projects.map((p: any) =>
                `${p.name || ""} ${p.description || ""} ${(p.tech || []).join(" ")}`
            );

            // Get ATS score
            userATSScore = pd?.ats?.score ?? pd?.ats?.overall_score ?? 50;

            // Get most recent title
            const expEntries = pd?.sections?.experience || [];
            if (expEntries.length > 0) {
                userTitle = expEntries[0]?.title || "";
            }
        }
    } catch {
        // No resume — return jobs with neutral score
        return jobs.slice(0, limit).map(j => ({
            ...j,
            match_score: 50,
            matched_skills: [],
            skill_gap: [],
        }));
    }

    // Also try user profile for additional skills
    try {
        const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("skills, experience_years, seniority_level")
            .eq("user_id", userId)
            .single();

        if (profile?.skills && Array.isArray(profile.skills)) {
            const profileSkills = profile.skills.filter((s: any) => typeof s === "string");
            userSkills = Array.from(new Set([...userSkills, ...profileSkills]));
        }
    } catch { /* no profile */ }

    if (userSkills.length === 0) {
        return jobs.slice(0, limit).map(j => ({
            ...j,
            match_score: 50,
            matched_skills: [],
            skill_gap: [],
        }));
    }

    // 2. Score each job
    const ranked: RankedJob[] = jobs.map(job => {
        const jobSkills = job.required_skills || job.skills || [];

        // ── Signal 1: Skill Overlap ────────────────────────────
        const matchedSkills = userSkills.filter(s =>
            jobSkills.some(js => js.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(js.toLowerCase()))
        );
        const skillOverlap = jobSkills.length > 0
            ? (matchedSkills.length / jobSkills.length) * 100
            : 50;

        // ── Signal 2: Title Match ──────────────────────────────
        const titleMatch = computeTitleSimilarity(userTitle, job.title);

        // ── Signal 3: Seniority Fit ────────────────────────────
        const userLevel = userATSScore < 40 ? "intern"
            : userATSScore < 65 ? "entry"
                : userATSScore < 80 ? "mid"
                    : "senior";
        const jobSeniority = job.seniority_level || job.seniority || "entry";
        const levelDiff = Math.abs(seniorityIndex(jobSeniority) - seniorityIndex(userLevel));
        const seniorityFit = levelDiff === 0 ? 100 : levelDiff === 1 ? 60 : 20;

        // ── Signal 4: Project Relevance ────────────────────────
        const projectText = userProjects.join(" ").toLowerCase();
        const jobText = `${job.title} ${job.description || ""}`.toLowerCase();
        const techOverlap = extractTechTerms(projectText).filter(t => jobText.includes(t));
        const projectRelevance = Math.min(100, techOverlap.length * 15);

        // ── Signal 5: Recency ──────────────────────────────────
        const hoursOld = (Date.now() - new Date(job.posted_at).getTime()) / 3600000;
        const recencyBonus = Math.max(0, 100 - hoursOld * 2);

        // ── Signals 6-8: Hybrid mode (Qdrant-enhanced) ─────────
        let semanticSimilarity = 50; // Neutral default
        let locationFit = 50;        // Neutral default
        let compensationFit = 50;    // Neutral default

        if (USE_HYBRID_JOB_RANKING) {
            // Signal 6: Location preference fit
            const jobLoc = (job.location || "").toLowerCase();
            if (jobLoc.includes("remote") || jobLoc.includes("wfh") || jobLoc.includes("anywhere")) {
                locationFit = 90; // Remote is generally high fit
            }
            // Could enhance with user's preferred_location from memory

            // Signal 7: Compensation fit (if salary data available)
            if (job.salary_min && job.salary_max) {
                compensationFit = 80; // Having salary info = transparency bonus
            }
        }

        // ── Weighted final score ────────────────────────────────
        let matchScore: number;
        if (USE_HYBRID_JOB_RANKING) {
            // 8-signal hybrid scoring
            matchScore = Math.round(
                Math.min(100, skillOverlap) * 0.35 +
                Math.min(100, titleMatch) * 0.15 +
                seniorityFit * 0.15 +
                Math.min(100, projectRelevance) * 0.10 +
                semanticSimilarity * 0.10 +
                Math.min(100, recencyBonus) * 0.05 +
                locationFit * 0.05 +
                compensationFit * 0.05
            );
        } else {
            // Original 5-signal scoring
            matchScore = Math.round(
                Math.min(100, skillOverlap) * 0.40 +
                Math.min(100, titleMatch) * 0.20 +
                seniorityFit * 0.20 +
                Math.min(100, projectRelevance) * 0.15 +
                Math.min(100, recencyBonus) * 0.05
            );
        }

        // Skills the user is missing for this job
        const skillGap = jobSkills.filter(js =>
            !userSkills.some(us => us.toLowerCase().includes(js.toLowerCase()) || js.toLowerCase().includes(us.toLowerCase()))
        );

        return {
            ...job,
            match_score: Math.max(5, Math.min(100, matchScore)),
            matched_skills: matchedSkills.slice(0, 10),
            skill_gap: skillGap.slice(0, 10),
        };
    });

    // 3. Sort by match score descending
    return ranked
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);
}

// ── Export user skills for frontend highlighting ───────────────
export async function getUserSkillsForMatching(userId: string): Promise<string[]> {
    try {
        const { data: resume } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (resume?.parsed_data) {
            const pd = resume.parsed_data as any;
            const skillGroups = pd?.sections?.skills || [];
            const rawSkills = skillGroups.flatMap((g: any) => g.items || []);
            // Split "Python (pandas, NumPy)" → ["Python", "pandas", "NumPy"]
            return rawSkills.flatMap((s: string) => {
                const base = s.replace(/\s*\([^)]*\)/g, '').trim();
                const parenMatch = s.match(/\(([^)]+)\)/);
                const parenItems = parenMatch ? parenMatch[1].split(/[,;]/).map((i: string) => i.trim()).filter(Boolean) : [];
                return [base, ...parenItems].filter((i: string) => i.length > 0);
            });
        }
    } catch { /* ignore */ }
    return [];
}

// ── rankJobsForUserWithSkills ──────────────────────────────────
// Like rankJobsForUser but accepts pre-loaded user data to avoid double DB fetch.
// This is the preferred function to call from chat.ts /jobs handler.
export async function rankJobsForUserWithSkills(
    userId: string,
    jobs: JobListing[],
    preloadedSkills: string[],   // already normalized (lowercase, no spaces)
    preloadedExpYears: number,
    limit: number = 20
): Promise<RankedJob[]> {
    if (!jobs || jobs.length === 0) return [];

    // Normalize the pre-loaded skills consistently
    const userSkills = preloadedSkills.map(s => s.toLowerCase().replace(/[\s.]+/g, ''));

    // Get ATS score and title from resume (still need one quick fetch for these)
    let userATSScore: number = 50;
    let userTitle: string = "";
    let userProjects: string[] = [];

    try {
        const { data: resume } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (resume?.parsed_data) {
            const pd = resume.parsed_data as any;
            userATSScore = pd?.ats?.score ?? pd?.ats?.overall_score ?? 50;
            const expEntries = pd?.sections?.experience || [];
            if (expEntries.length > 0) userTitle = expEntries[0]?.title || "";
            const projects = pd?.sections?.projects || [];
            userProjects = projects.map((p: any) =>
                `${p.name || ""} ${p.description || ""} ${(p.tech || []).join(" ")}`
            );
        }
    } catch { /* use defaults */ }

    if (userSkills.length === 0) {
        return jobs.slice(0, limit).map(j => ({
            ...j,
            match_score: 50,
            matched_skills: [],
            skill_gap: [],
        }));
    }

    const ranked: RankedJob[] = jobs.map(job => {
        // Normalize job skills the same way
        const jobSkillsRaw = job.required_skills || job.skills || [];
        const jobSkills = jobSkillsRaw.map((s: string) => s.toLowerCase().replace(/[\s.]+/g, ''));

        // ── Signal 1: Skill Overlap ────────────────────────────
        // Also scan description for skill mentions (DB skills[] is often sparse)
        const descNorm = (job.description || "").toLowerCase().replace(/[\s.]+/g, '');
        const titleNorm = (job.title || "").toLowerCase().replace(/[\s.]+/g, '');

        const matchedFromArray = userSkills.filter(s =>
            jobSkills.some(js => js.includes(s) || s.includes(js))
        );
        const matchedFromDesc = userSkills.filter(s =>
            !matchedFromArray.includes(s) && (descNorm.includes(s) || titleNorm.includes(s))
        );

        // Weight array match higher than description mention
        const totalMatched = matchedFromArray.length + Math.floor(matchedFromDesc.length * 0.5);
        const skillOverlap = userSkills.length > 0
            ? Math.min(100, (totalMatched / userSkills.length) * 100)
            : 50;

        // ── Signal 2: Title Match ──────────────────────────────
        const titleMatch = computeTitleSimilarity(userTitle, job.title);

        // ── Signal 3: Seniority Fit ────────────────────────────
        const userLevel = preloadedExpYears <= 1 ? "intern"
            : preloadedExpYears <= 3 ? "entry"
            : preloadedExpYears <= 6 ? "mid"
            : "senior";
        const jobSeniority = job.seniority_level || job.seniority || "entry";
        const levelDiff = Math.abs(seniorityIndex(jobSeniority) - seniorityIndex(userLevel));
        const seniorityFit = levelDiff === 0 ? 100 : levelDiff === 1 ? 60 : 20;

        // ── Signal 4: Project Relevance ────────────────────────
        const projectText = userProjects.join(" ").toLowerCase();
        const jobText = `${job.title} ${job.description || ""}`.toLowerCase();
        const techOverlap = extractTechTerms(projectText).filter(t => jobText.includes(t));
        const projectRelevance = Math.min(100, techOverlap.length * 15);

        // ── Signal 5: Recency ──────────────────────────────────
        const hoursOld = (Date.now() - new Date(job.posted_at).getTime()) / 3600000;
        const recencyBonus = Math.max(0, 100 - hoursOld * 2);

        const matchScore = Math.round(
            Math.min(100, skillOverlap) * 0.40 +
            Math.min(100, titleMatch) * 0.20 +
            seniorityFit * 0.20 +
            Math.min(100, projectRelevance) * 0.15 +
            Math.min(100, recencyBonus) * 0.05
        );

        // Human-readable matched skills (original form)
        const matchedSkillsDisplay = (job.required_skills || job.skills || [])
            .filter((js: string) => userSkills.some(us => js.toLowerCase().replace(/[\s.]+/g, '').includes(us) || us.includes(js.toLowerCase().replace(/[\s.]+/g, ''))))
            .slice(0, 10);

        const skillGap = (job.required_skills || job.skills || [])
            .filter((js: string) => !userSkills.some(us => js.toLowerCase().replace(/[\s.]+/g, '').includes(us) || us.includes(js.toLowerCase().replace(/[\s.]+/g, ''))))
            .slice(0, 10);

        return {
            ...job,
            match_score: Math.max(5, Math.min(100, matchScore)),
            matched_skills: matchedSkillsDisplay,
            skill_gap: skillGap,
        };
    });

    return ranked
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, limit);
}

