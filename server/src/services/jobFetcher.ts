// ═══════════════════════════════════════════════════════════════
// Real-Time Job Fetcher — Greenhouse, Lever, Career Page Scraping
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";

const GREENHOUSE_COMPANIES = ["swiggy", "meesho", "razorpay", "zomato", "blinkit", "curefit", "urbancompany"];
const LEVER_COMPANIES = ["cred", "groww", "zepto", "phonepe", "jupiter", "slice", "bharatpe"];

interface RawJob {
    title: string;
    company: string;
    location: string;
    job_url: string;
    source: "greenhouse" | "lever" | "scrape";
    posted_at: string | null;
    description?: string;
}

// ── Greenhouse API ──────────────────────────────────────────
async function fetchGreenhouseJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.jobs || []).map((j: any) => ({
            title: j.title,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.location?.name || "Remote",
            job_url: j.absolute_url || `https://boards.greenhouse.io/${company}/jobs/${j.id}`,
            source: "greenhouse" as const,
            posted_at: j.updated_at || j.created_at || null,
            description: (j.content || "").replace(/<[^>]*>/g, " ").substring(0, 2000),
        }));
    } catch (err) {
        console.warn(`[JobFetcher] Greenhouse ${company} failed:`, (err as Error).message);
        return [];
    }
}

// ── Lever API ───────────────────────────────────────────────
async function fetchLeverJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data || []).map((j: any) => ({
            title: j.text,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.categories?.location || "Remote",
            job_url: j.hostedUrl || j.applyUrl || "",
            source: "lever" as const,
            posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
            description: (j.descriptionPlain || "").substring(0, 2000),
        }));
    } catch (err) {
        console.warn(`[JobFetcher] Lever ${company} failed:`, (err as Error).message);
        return [];
    }
}

// ── Extract skills from job description ─────────────────────
const SKILL_PATTERNS = [
    "javascript", "typescript", "python", "java", "react", "angular", "vue",
    "node", "express", "django", "flask", "spring", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "git", "sql", "mongodb", "postgresql",
    "redis", "graphql", "rest", "api", "microservices", "html", "css",
    "linux", "devops", "machine learning", "data science", "golang", "rust",
    "swift", "kotlin", "flutter", "react native", "next.js", "nest.js",
    "kafka", "rabbitmq", "elasticsearch", "ci/cd", "jenkins", "github actions",
];

function extractSkills(text: string): string[] {
    const lower = (text || "").toLowerCase();
    return SKILL_PATTERNS.filter(s => lower.includes(s));
}

// ── Extract salary range ────────────────────────────────────
function extractSalary(text: string): { min: number | null; max: number | null } {
    // Match patterns like "₹15-25 LPA", "$120k-$180k", "15,00,000 - 25,00,000"
    const lpaMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:lpa|lakhs?)/i);
    if (lpaMatch) return { min: parseInt(lpaMatch[1]) * 100000, max: parseInt(lpaMatch[2]) * 100000 };

    const kMatch = text.match(/\$(\d+)k?\s*[-–]\s*\$?(\d+)k/i);
    if (kMatch) return { min: parseInt(kMatch[1]) * 1000, max: parseInt(kMatch[2]) * 1000 };

    return { min: null, max: null };
}

// ── Extract experience range ────────────────────────────────
function extractExperience(text: string): { min: number | null; max: number | null } {
    const match = text.match(/(\d+)\s*[-–+]\s*(\d+)?\s*(?:years?|yrs?)/i);
    if (match) return { min: parseInt(match[1]), max: match[2] ? parseInt(match[2]) : null };
    const singleMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
    if (singleMatch) return { min: parseInt(singleMatch[1]), max: null };
    return { min: null, max: null };
}

// ── Deduplicate & Store ─────────────────────────────────────
async function storeJobs(jobs: RawJob[]): Promise<number> {
    if (jobs.length === 0) return 0;

    let stored = 0;
    for (const job of jobs) {
        if (!job.title || !job.company || !job.job_url) continue;

        const skills = extractSkills(job.description || "");
        const salary = extractSalary(job.description || "");
        const experience = extractExperience(job.description || "");

        try {
            // Upsert by job_url to deduplicate
            const { error } = await supabaseAdmin
                .from("job_listings")
                .upsert(
                    {
                        title: job.title,
                        company: job.company,
                        location: job.location,
                        skills,
                        experience_min: experience.min,
                        experience_max: experience.max,
                        salary_min: salary.min,
                        salary_max: salary.max,
                        job_url: job.job_url,
                        source: job.source,
                        description: job.description || "",
                        posted_at: job.posted_at || new Date().toISOString(),
                    },
                    { onConflict: "job_url" }
                );

            if (!error) stored++;
        } catch (err: any) {
            // Supabase unreachable — log once and skip remaining
            if (err.message?.includes("fetch failed") || err.cause?.code === "ENOTFOUND") {
                console.warn("[JobFetcher] Supabase unreachable — skipping job storage. Check SUPABASE_URL in .env");
                return stored;
            }
            // Other errors — just skip this job
        }
    }
    return stored;
}

// ── Main Fetch Function (called by cron) ────────────────────
export async function fetchAllJobs(): Promise<{ total: number; stored: number }> {
    console.log("[JobFetcher] Starting job fetch cycle...");
    const allJobs: RawJob[] = [];

    // Fetch from all sources in parallel
    const [ghJobs, leverJobs] = await Promise.all([
        Promise.all(GREENHOUSE_COMPANIES.map(fetchGreenhouseJobs)),
        Promise.all(LEVER_COMPANIES.map(fetchLeverJobs)),
    ]);

    allJobs.push(...ghJobs.flat(), ...leverJobs.flat());

    console.log(`[JobFetcher] Fetched ${allJobs.length} total jobs`);

    try {
        const stored = await storeJobs(allJobs);
        console.log(`[JobFetcher] Stored ${stored} new/updated jobs`);
        return { total: allJobs.length, stored };
    } catch (err: any) {
        if (err.message?.includes("fetch failed") || err.cause?.code === "ENOTFOUND") {
            console.warn("[JobFetcher] ⚠️ Supabase unreachable — cannot store jobs. Verify SUPABASE_URL in .env is correct and the project is active.");
        } else {
            console.warn("[JobFetcher] Store failed:", err.message);
        }
        return { total: allJobs.length, stored: 0 };
    }
}

// ── Search jobs from DB ─────────────────────────────────────
export async function searchJobs(filters: {
    query?: string;
    location?: string;
    skills?: string[];
    experience_max?: number;
    limit?: number;
}) {
    let q = supabaseAdmin
        .from("job_listings")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(filters.limit || 50);

    if (filters.query) {
        q = q.or(`title.ilike.%${filters.query}%,company.ilike.%${filters.query}%`);
    }
    if (filters.location) {
        q = q.ilike("location", `%${filters.location}%`);
    }
    if (filters.skills && filters.skills.length > 0) {
        q = q.overlaps("skills", filters.skills);
    }
    if (filters.experience_max) {
        q = q.or(`experience_min.is.null,experience_min.lte.${filters.experience_max}`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
}
