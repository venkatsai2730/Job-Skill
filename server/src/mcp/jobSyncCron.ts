// ═══════════════════════════════════════════════════════════════
// MCP Job Sync Cron — PRIMARY job fetching engine
//
// This is the MAIN cron that populates the job_listings table.
// Uses the built-in MCP scraper (zero API keys, zero rate limits).
// Replaces the legacy ATS/RSS/JSearch cron architecture.
//
// Schedule: Every 2 hours (was 8h — now more frequent since
//           we're the primary source, not a supplement).
// ═══════════════════════════════════════════════════════════════

import { callMCPTool } from "./mcpClient.js";
import { supabaseAdmin } from "../config/supabase.js";
import { detectCategory, extractExperience } from "../services/jobFetcher.js";
import { classifySeniorityFromTitle } from "../services/jobClassifier.js";

// ── Job Query Definitions ────────────────────────────────────
interface JobQuery {
    term: string;
    location: string;
    seniority: "intern" | "entry" | "mid" | "senior";
}

const JOB_QUERIES: JobQuery[] = [
    // ── Fresher / Intern (India) — Tech-specific queries ─────
    { term: "Software Engineer Intern", location: "India", seniority: "intern" },
    { term: "SDE Intern", location: "India", seniority: "intern" },
    { term: "Data Science Intern", location: "India", seniority: "intern" },
    { term: "Web Developer Intern", location: "India", seniority: "intern" },
    { term: "Fresher Software Developer", location: "India", seniority: "entry" },
    { term: "Graduate Engineer Trainee", location: "India", seniority: "entry" },
    { term: "Junior Software Engineer", location: "India", seniority: "entry" },
    { term: "Associate Software Engineer", location: "India", seniority: "entry" },
    { term: "Trainee Developer", location: "India", seniority: "entry" },
    { term: "Entry Level Developer", location: "India", seniority: "entry" },
    { term: "Campus Hire Engineer", location: "India", seniority: "entry" },
    { term: "Junior Web Developer", location: "India", seniority: "entry" },
    { term: "Fresher Data Analyst", location: "India", seniority: "entry" },
    // ── Additional tech-specific intern queries ──────────────
    { term: "Python Developer Intern", location: "India", seniority: "intern" },
    { term: "React Developer Intern", location: "India", seniority: "intern" },
    { term: "Machine Learning Intern", location: "India", seniority: "intern" },
    { term: "Cloud Engineer Intern", location: "India", seniority: "intern" },
    { term: "DevOps Intern", location: "India", seniority: "intern" },
    { term: "Backend Developer Intern", location: "India", seniority: "intern" },
    { term: "Frontend Developer Intern", location: "India", seniority: "intern" },
    { term: "Full Stack Developer Intern", location: "India", seniority: "intern" },
    { term: "Java Developer Intern", location: "India", seniority: "intern" },
    { term: "QA Intern", location: "India", seniority: "intern" },
    { term: "Cybersecurity Intern", location: "India", seniority: "intern" },

    // ── Fresher / Intern (India metros) ──────────────────────
    { term: "Fresher Developer", location: "Bangalore", seniority: "entry" },
    { term: "Fresher Developer", location: "Hyderabad", seniority: "entry" },
    { term: "Fresher Developer", location: "Pune", seniority: "entry" },
    { term: "Fresher Developer", location: "Chennai", seniority: "entry" },
    { term: "Fresher Developer", location: "Mumbai", seniority: "entry" },
    { term: "Fresher Developer", location: "Delhi NCR", seniority: "entry" },
    { term: "Software Intern", location: "Bangalore", seniority: "intern" },
    { term: "Software Intern", location: "Hyderabad", seniority: "intern" },

    // ── Entry Level (India) ──────────────────────────────────
    { term: "Frontend Developer", location: "India", seniority: "entry" },
    { term: "Backend Developer", location: "India", seniority: "entry" },
    { term: "Full Stack Developer", location: "India", seniority: "entry" },
    { term: "React Developer", location: "India", seniority: "entry" },
    { term: "Node.js Developer", location: "India", seniority: "entry" },
    { term: "Python Developer", location: "India", seniority: "entry" },
    { term: "Java Developer", location: "India", seniority: "entry" },
    { term: "MERN Stack Developer", location: "India", seniority: "entry" },
    { term: "Angular Developer", location: "India", seniority: "entry" },
    { term: "Flutter Developer", location: "India", seniority: "entry" },
    { term: "Android Developer", location: "India", seniority: "entry" },
    { term: "iOS Developer", location: "India", seniority: "entry" },
    { term: "Data Engineer", location: "India", seniority: "entry" },
    { term: "Machine Learning Engineer", location: "India", seniority: "entry" },
    { term: "DevOps Engineer", location: "India", seniority: "entry" },
    { term: "QA Engineer", location: "India", seniority: "entry" },
    { term: "Cloud Engineer", location: "India", seniority: "entry" },
    { term: "Data Analyst", location: "India", seniority: "entry" },
    { term: "Business Analyst", location: "India", seniority: "entry" },
    { term: "UI UX Designer", location: "India", seniority: "entry" },
    { term: "Product Manager", location: "India", seniority: "entry" },
    { term: "Cybersecurity Analyst", location: "India", seniority: "entry" },

    // ── Mid Level (India) ────────────────────────────────────
    { term: "Software Engineer", location: "India", seniority: "mid" },
    { term: "Software Engineer", location: "Bangalore", seniority: "mid" },
    { term: "Software Engineer", location: "Hyderabad", seniority: "mid" },
    { term: "Software Engineer", location: "Pune", seniority: "mid" },

    // ── Global / Remote ──────────────────────────────────────
    { term: "Software Engineer", location: "Remote", seniority: "mid" },
    { term: "Junior Developer", location: "Remote", seniority: "entry" },
    { term: "Entry Level Software Engineer", location: "United States", seniority: "entry" },
    { term: "Junior Developer", location: "United States", seniority: "entry" },
    { term: "New Grad Software Engineer", location: "United States", seniority: "entry" },
    { term: "Software Engineer", location: "United States", seniority: "mid" },
    { term: "Developer", location: "United Kingdom", seniority: "mid" },
    { term: "Software Engineer", location: "Canada", seniority: "mid" },
    { term: "Developer", location: "Germany", seniority: "mid" },

    // ── Senior Level (India) ─────────────────────────────────
    { term: "Senior Software Engineer", location: "India", seniority: "senior" },
    { term: "Senior Software Engineer", location: "Bangalore", seniority: "senior" },
    { term: "Senior Data Scientist", location: "India", seniority: "senior" },
    { term: "Senior Machine Learning Engineer", location: "India", seniority: "senior" },
    { term: "Senior React Developer", location: "India", seniority: "senior" },
    { term: "Senior Backend Engineer", location: "India", seniority: "senior" },
    { term: "Senior Full Stack Developer", location: "India", seniority: "senior" },
    { term: "Senior DevOps Engineer", location: "India", seniority: "senior" },
    { term: "Senior Android Developer", location: "India", seniority: "senior" },
    { term: "Senior iOS Developer", location: "India", seniority: "senior" },
    { term: "Senior Data Engineer", location: "India", seniority: "senior" },
    { term: "Lead Software Engineer", location: "India", seniority: "senior" },
    { term: "Staff Engineer", location: "India", seniority: "senior" },
    { term: "Principal Engineer", location: "India", seniority: "senior" },

    // ── Specialized ML / AI (India + Remote) ─────────────────
    { term: "NLP Engineer", location: "India", seniority: "mid" },
    { term: "Computer Vision Engineer", location: "India", seniority: "mid" },
    { term: "LLM Engineer", location: "India", seniority: "mid" },
    { term: "AI Research Engineer", location: "India", seniority: "mid" },
    { term: "Generative AI Engineer", location: "India", seniority: "mid" },
    { term: "MLOps Engineer", location: "India", seniority: "mid" },
    { term: "NLP Engineer", location: "Remote", seniority: "mid" },
    { term: "LLM Engineer", location: "Remote", seniority: "mid" },
    { term: "Generative AI Engineer", location: "Remote", seniority: "mid" },
    { term: "AI Engineer", location: "Remote", seniority: "mid" },

    // ── Analytics / Data (India) ─────────────────────────────
    { term: "Data Science Engineer", location: "India", seniority: "mid" },
    { term: "Analytics Engineer", location: "India", seniority: "mid" },
    { term: "BI Developer", location: "India", seniority: "mid" },
    { term: "Power BI Developer", location: "India", seniority: "mid" },
    { term: "Tableau Developer", location: "India", seniority: "mid" },
    { term: "Big Data Engineer", location: "India", seniority: "mid" },

    // ── More Domain Coverage (India) ─────────────────────────
    { term: "Blockchain Developer", location: "India", seniority: "mid" },
    { term: "Embedded Systems Engineer", location: "India", seniority: "mid" },
    { term: "Security Engineer", location: "India", seniority: "mid" },
    { term: "Site Reliability Engineer", location: "India", seniority: "mid" },
    { term: "MEAN Stack Developer", location: "India", seniority: "entry" },
    { term: "MERN Stack Developer", location: "India", seniority: "entry" },
    { term: "TypeScript Developer", location: "India", seniority: "entry" },
    { term: "Go Developer", location: "India", seniority: "mid" },
    { term: "Rust Developer", location: "India", seniority: "mid" },
    { term: "Scala Developer", location: "India", seniority: "mid" },

    // ── Additional Metro Cities (India) ──────────────────────
    { term: "Software Engineer", location: "Kolkata", seniority: "mid" },
    { term: "Software Engineer", location: "Ahmedabad", seniority: "mid" },
    { term: "Software Engineer", location: "Jaipur", seniority: "mid" },
    { term: "Developer", location: "Noida", seniority: "entry" },
    { term: "Developer", location: "Gurugram", seniority: "entry" },
    { term: "Developer", location: "Mumbai", seniority: "entry" },

    // ── More Global / Remote ─────────────────────────────────
    { term: "Software Engineer", location: "Australia", seniority: "mid" },
    { term: "Software Engineer", location: "Singapore", seniority: "mid" },
    { term: "Software Engineer", location: "Netherlands", seniority: "mid" },
    { term: "Software Engineer", location: "UAE", seniority: "mid" },
    { term: "Machine Learning Engineer", location: "Remote", seniority: "mid" },
    { term: "Full Stack Developer", location: "Remote", seniority: "mid" },
    { term: "Backend Developer", location: "Remote", seniority: "entry" },
    { term: "Frontend Developer", location: "Remote", seniority: "entry" },
    { term: "Data Engineer", location: "Remote", seniority: "mid" },
];

// ── Regex-based skill extraction ─────────────────────────────
const SKILL_KEYWORDS = [
    "javascript", "typescript", "python", "java", "react", "angular", "vue",
    "node", "express", "django", "flask", "spring", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "git", "sql", "mongodb", "postgresql",
    "redis", "graphql", "rest", "api", "microservices", "html", "css",
    "linux", "devops", "machine learning", "data science", "golang", "rust",
    "swift", "kotlin", "flutter", "react native", "next.js", "nest.js",
    "kafka", "rabbitmq", "elasticsearch", "ci/cd", "jenkins", "github actions",
    "c++", "c#", ".net", "php", "laravel", "selenium", "figma",
    "power bi", "tableau", "tensorflow", "pytorch", "pandas", "numpy",
    "tailwind", "sass", "webpack", "vite", "firebase", "supabase",
    "spring boot", "hibernate", "maven", "gradle", "junit",
];

function extractSkillsRegex(text: string): string[] {
    const lower = (text || "").toLowerCase();
    return SKILL_KEYWORDS.filter(skill => lower.includes(skill));
}

// ── Sleep utility ─────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Track migration status ────────────────────────────────────
let migrationMissing = false;

// ═══════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION
// ═══════════════════════════════════════════════════════════════
export async function syncJobsViaMCP(): Promise<{ total: number; errors: number }> {
    console.log(`[MCP-Sync] Starting job sync (${JOB_QUERIES.length} queries)...`);
    let totalUpserted = 0;
    let totalErrors = 0;
    let totalFetched = 0;

    // Process queries in batches of 5 to avoid overwhelming scrapers
    const BATCH_SIZE = 5;
    for (let i = 0; i < JOB_QUERIES.length; i += BATCH_SIZE) {
        const batch = JOB_QUERIES.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
            batch.map(async (query) => {
                try {
                    console.log(`[MCP-Sync] Searching: "${query.term}" in ${query.location}`);

                    const jobs = await callMCPTool("builtin_scraper", "search_jobs", {
                        search_term: query.term,
                        location: query.location,
                        results_wanted: 50,
                    });

                    if (!Array.isArray(jobs) || jobs.length === 0) return { fetched: 0, stored: 0, errors: 0 };

                    // Pre-fetch existing posted_at in one query so re-scrapes don't reset the date
                    const jobUrls = jobs.map((j: any) => j.job_url).filter(Boolean);
                    const { data: existingRecords } = await supabaseAdmin
                        .from("job_listings")
                        .select("job_url, posted_at")
                        .in("job_url", jobUrls);
                    const existingPostedAt = new Map(
                        (existingRecords || []).map((r: any) => [r.job_url, r.posted_at])
                    );

                    let stored = 0;
                    let errors = 0;

                    for (const rawJob of jobs) {
                        const title = rawJob.title || "Untitled";
                        const company = rawJob.company || "Unknown";
                        const location = rawJob.location || "India";
                        const description = rawJob.description || "";
                        const jobUrl = rawJob.job_url || "";
                        if (!jobUrl || !title || title === "Untitled") continue;

                        const skills = extractSkillsRegex(description + " " + title);
                        const category = detectCategory(title, rawJob.category);
                        const experience = extractExperience(description);
                        const classification = classifySeniorityFromTitle(title + " " + description);

                        const upsertPayload: Record<string, any> = {
                            title, company, location,
                            description: description.substring(0, 10000),
                            job_url: jobUrl,
                            source: rawJob.source || "mcp",
                            salary_min: rawJob.salary_min || null,
                            salary_max: rawJob.salary_max || null,
                            posted_at: existingPostedAt.get(jobUrl) || rawJob.posted_at || new Date().toISOString(),
                            skills,
                            experience_min: experience.min ?? classification.experience_min,
                            experience_max: experience.max ?? classification.experience_max,
                        };

                        if (!migrationMissing) {
                            upsertPayload.category = category;
                            upsertPayload.seniority_level = classification.seniority !== "unknown"
                                ? classification.seniority
                                : query.seniority;
                            upsertPayload.confidence_score = classification.confidence_score;
                            upsertPayload.is_active = true;
                        }

                        const { error } = await supabaseAdmin
                            .from("job_listings")
                            .upsert(upsertPayload, { onConflict: "job_url" });

                        if (error) {
                            if (error.message?.includes("column") && error.message?.includes("does not exist")) {
                                migrationMissing = true;
                                // Retry with base schema
                                const { error: retryErr } = await supabaseAdmin
                                    .from("job_listings")
                                    .upsert({
                                        title, company, location,
                                        description: description.substring(0, 10000),
                                        job_url: jobUrl,
                                        source: rawJob.source || "mcp",
                                        salary_min: rawJob.salary_min || null,
                                        salary_max: rawJob.salary_max || null,
                                        posted_at: existingPostedAt.get(jobUrl) || rawJob.posted_at || new Date().toISOString(),
                                        skills,
                                    }, { onConflict: "job_url" });
                                if (!retryErr) stored++;
                                else errors++;
                            } else {
                                errors++;
                            }
                        } else {
                            stored++;
                        }
                    }

                    return { fetched: jobs.length, stored, errors };
                } catch (err: any) {
                    console.warn(`[MCP-Sync] Query failed "${query.term}":`, err.message);
                    return { fetched: 0, stored: 0, errors: 1 };
                }
            })
        );

        for (const r of batchResults) {
            if (r.status === "fulfilled") {
                totalFetched += r.value.fetched;
                totalUpserted += r.value.stored;
                totalErrors += r.value.errors;
            } else {
                totalErrors++;
            }
        }

        // Pause between batches to be polite to scraped sites
        if (i + BATCH_SIZE < JOB_QUERIES.length) {
            await sleep(3000);
        }
    }

    // Soft-delete jobs older than 30 days (keeps pool large and relevant)
    if (!migrationMissing) {
        try {
            const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
            await supabaseAdmin
                .from("job_listings")
                .update({ is_active: false })
                .lt("posted_at", cutoff)
                .eq("is_active", true);
            console.log(`[MCP-Sync] Expired jobs older than 30 days`);
        } catch (err: any) {
            if (err.message?.includes("does not exist")) {
                migrationMissing = true;
            } else {
                console.warn("[MCP-Sync] Expiry failed:", err.message);
            }
        }
    }

    console.log(`[MCP-Sync] ✅ Complete. Fetched: ${totalFetched}, Stored: ${totalUpserted}, Errors: ${totalErrors}`);
    return { total: totalUpserted, errors: totalErrors };
}

// ── Reactivate jobs that were over-aggressively expired ──────
// Repairs jobs soft-deleted by the old 7-day rule. Safe to run repeatedly.
export async function reactivateRecentJobs(): Promise<void> {
    if (migrationMissing) return;
    try {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        await supabaseAdmin
            .from("job_listings")
            .update({ is_active: true })
            .gte("posted_at", cutoff)
            .eq("is_active", false);
        console.log(`[MCP-Sync] Re-activated recently expired jobs (< 30 days old)`);
    } catch (err: any) {
        if (err.message?.includes("does not exist")) {
            migrationMissing = true;
        } else {
            console.warn("[MCP-Sync] Re-activation failed:", err.message);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// CRON SCHEDULER — runs every 2 hours (primary engine)
// ═══════════════════════════════════════════════════════════════
const MCP_SYNC_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

export function startMCPJobCron() {
    // Immediately repair jobs over-expired by old 7-day rule
    reactivateRecentJobs().catch(err =>
        console.warn("[MCP-Cron] Re-activation failed:", err.message)
    );

    // Initial full sync after 15s delay
    setTimeout(() => {
        syncJobsViaMCP().catch(err =>
            console.warn("[MCP-Cron] Initial sync failed:", err.message)
        );
    }, 15_000);

    // Recurring sync
    setInterval(() => {
        syncJobsViaMCP().catch(err =>
            console.warn("[MCP-Cron] Scheduled sync failed:", err.message)
        );
    }, MCP_SYNC_INTERVAL);

    console.log("⏰ [MCP-Cron] Primary job sync: every 2 hours (10 sources, zero API keys)");
}
