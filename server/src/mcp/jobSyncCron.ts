// ═══════════════════════════════════════════════════════════════
// MCP Job Sync Cron — Fetches jobs via built-in scraper on schedule
// Replaces the legacy ATS/RSS/Scraper cron architecture.
// ═══════════════════════════════════════════════════════════════

import { callMCPTool } from "./mcpClient.js";
import { supabaseAdmin } from "../config/supabase.js";
import { createHash } from "crypto";
import { detectCategory, extractExperience } from "../services/jobFetcher.js";

// ── Job Query Definitions ────────────────────────────────────
interface JobQuery {
    term: string;
    location: string;
    seniority: "intern" | "entry" | "mid" | "senior";
}

const JOB_QUERIES: JobQuery[] = [
    // Fresher / Intern
    { term: "Software Engineer Intern", location: "India", seniority: "intern" },
    { term: "SDE Intern", location: "India", seniority: "intern" },
    { term: "Data Science Intern", location: "India", seniority: "intern" },
    { term: "Fresher Software Developer", location: "India", seniority: "entry" },
    { term: "Graduate Engineer Trainee", location: "India", seniority: "entry" },
    { term: "Junior Software Engineer", location: "India", seniority: "entry" },
    // Entry Level
    { term: "Frontend Developer", location: "India", seniority: "entry" },
    { term: "Backend Developer", location: "India", seniority: "entry" },
    { term: "Full Stack Developer", location: "India", seniority: "entry" },
    { term: "Data Engineer", location: "India", seniority: "entry" },
    { term: "Machine Learning Engineer", location: "India", seniority: "entry" },
    { term: "DevOps Engineer", location: "India", seniority: "entry" },
    { term: "React Developer", location: "India", seniority: "entry" },
    { term: "Python Developer", location: "India", seniority: "entry" },
    // Mid Level
    { term: "Software Engineer", location: "India", seniority: "mid" },
];

// ── Skill Extraction from JD ─────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

async function extractSkillsFromJD(description: string): Promise<string[]> {
    if (!description || description.length < 50 || !GROQ_API_KEY) {
        return extractSkillsRegex(description || "");
    }

    try {
        const truncated = description.substring(0, 3000);
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    { role: "system", content: "Extract technical skills from this job description. Return ONLY a JSON array of skill strings, no markdown. Example: [\"React\", \"Node.js\", \"Python\"]" },
                    { role: "user", content: truncated },
                ],
                temperature: 0.1,
                max_tokens: 300,
            }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return extractSkillsRegex(description);

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "[]";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) return parsed.filter((s: any) => typeof s === "string").slice(0, 20);
        }
    } catch {
        // Fallback to regex
    }

    return extractSkillsRegex(description);
}

// ── Regex-based skill extraction fallback ─────────────────────
function extractSkillsRegex(text: string): string[] {
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
    ];

    const lower = text.toLowerCase();
    return SKILL_KEYWORDS.filter(skill => lower.includes(skill));
}

// ── Hash generator for deduplication ──────────────────────────
function generateHash(input: string): string {
    return createHash("md5").update(input).digest("hex").substring(0, 16);
}

// ── Sleep utility ─────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION
// ═══════════════════════════════════════════════════════════════
export async function syncJobsViaMCP(): Promise<{ total: number; errors: number }> {
    console.log("[MCP-Sync] Starting job sync via built-in scraper...");
    let totalUpserted = 0;
    let totalErrors = 0;

    for (const query of JOB_QUERIES) {
        try {
            console.log(`[MCP-Sync] Searching: "${query.term}" in ${query.location}`);

            // Call the built-in scraper (replaces broken npx subprocess)
            let jobs: any[] = [];
            try {
                const result = await callMCPTool("builtin_scraper", "search_jobs", {
                    search_term: query.term,
                    location: query.location,
                    results_wanted: 300,
                });

                jobs = Array.isArray(result) ? result : [];
            } catch (err: any) {
                console.warn(`[MCP-Sync] Scraper failed for "${query.term}":`, err.message);
                totalErrors++;
                continue;
            }

            console.log(`[MCP-Sync] Got ${jobs.length} results for "${query.term}"`);

            // Process each job
            for (const rawJob of jobs) {
                try {
                    const title = rawJob.title || "Untitled";
                    const company = rawJob.company || rawJob.company_name || "Unknown";
                    const location = rawJob.location || "India";
                    const description = rawJob.description || "";
                    const jobUrl = rawJob.job_url || rawJob.apply_url || rawJob.url || "";

                    if (!jobUrl) continue;

                    // Extract skills and enrich job data
                    const skills = await extractSkillsFromJD(description);
                    const category = detectCategory(title, rawJob.category);
                    const experience = extractExperience(description);

                    // Build upsert payload — try full schema first
                    const upsertPayload: Record<string, any> = {
                        title: title,
                        company: company,
                        location: location,
                        description: description.substring(0, 10000),
                        job_url: jobUrl,
                        source: rawJob.source || "mcp",
                        salary_min: rawJob.salary_min || null,
                        salary_max: rawJob.salary_max || null,
                        posted_at: rawJob.posted_at || new Date().toISOString(),
                        skills: skills,
                        category: category,
                        experience_min: experience.min,
                        experience_max: experience.max,
                        seniority_level: category === "Internships & Fresher" ? (query.seniority || "entry") : "unknown",
                    };

                    const { error } = await supabaseAdmin.from("job_listings").upsert(
                        upsertPayload,
                        { onConflict: "job_url" }
                    );

                    if (error) {
                        // If new columns don't exist, retry with base schema only
                        if (error.message?.includes("column") && error.message?.includes("does not exist")) {
                            const { error: retryError } = await supabaseAdmin.from("job_listings").upsert(
                                {
                                    title, company, location,
                                    description: description.substring(0, 10000),
                                    job_url: jobUrl,
                                    source: rawJob.source || "mcp",
                                    salary_min: rawJob.salary_min || null,
                                    salary_max: rawJob.salary_max || null,
                                    posted_at: rawJob.posted_at || new Date().toISOString(),
                                    skills: skills,
                                },
                                { onConflict: "job_url" }
                            );
                            if (retryError) {
                                console.warn(`[MCP-Sync] Retry upsert error:`, retryError.message);
                                totalErrors++;
                            } else {
                                totalUpserted++;
                            }
                        } else {
                            console.warn(`[MCP-Sync] Upsert error:`, error.message);
                            totalErrors++;
                        }
                    } else {
                        totalUpserted++;
                    }
                } catch (jobErr: any) {
                    console.warn(`[MCP-Sync] Job processing error:`, jobErr.message);
                    totalErrors++;
                }
            }

            // Small delay between query batches to be polite
            await sleep(2000);
        } catch (queryErr: any) {
            console.warn(`[MCP-Sync] Query error for "${query.term}":`, queryErr.message);
            totalErrors++;
        }
    }

    // Soft-delete jobs older than 48 hours
    try {
        const cutoff = new Date(Date.now() - 2 * 86400000).toISOString();
        await supabaseAdmin
            .from("job_listings")
            .update({ is_active: false })
            .lt("fetched_at", cutoff)
            .eq("is_active", true);
        console.log(`[MCP-Sync] Expired old jobs before ${cutoff}`);
    } catch (err: any) {
        console.warn("[MCP-Sync] Expiry failed:", err.message);
    }

    console.log(`[MCP-Sync] ✅ Sync complete. Upserted: ${totalUpserted}, Errors: ${totalErrors}`);
    return { total: totalUpserted, errors: totalErrors };
}

// ═══════════════════════════════════════════════════════════════
// CRON SCHEDULER — runs every 8 hours
// ═══════════════════════════════════════════════════════════════
const MCP_SYNC_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours

export function startMCPJobCron() {
    // Initial sync after 30s delay (let server fully start)
    setTimeout(() => {
        syncJobsViaMCP().catch(err =>
            console.warn("[MCP-Cron] Initial sync failed:", err.message)
        );
    }, 30_000);

    // Recurring sync
    setInterval(() => {
        syncJobsViaMCP().catch(err =>
            console.warn("[MCP-Cron] Scheduled sync failed:", err.message)
        );
    }, MCP_SYNC_INTERVAL);

    console.log("⏰ [MCP-Cron] Job sync scheduled: every 8 hours (built-in scraper, no external APIs)");
}
