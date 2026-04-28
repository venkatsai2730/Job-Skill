// ═══════════════════════════════════════════════════════════════
// Real-Time Job Fetcher — Production Upgrade
// Greenhouse, Lever, Ashby, JSearch, RSS, Scrapers
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";
import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

import {
    GREENHOUSE_COMPANIES, LEVER_COMPANIES, ASHBY_COMPANIES,
    JSEARCH_CRON_QUERIES, SKILL_PATTERNS, INDIAN_STATE_TO_NEAREST_METRO,
    SENIORITY_FOR_EXPERIENCE,
} from "./jobCompanies.js";
import { classifySeniorityWithAI, classifySeniorityFromTitle, resetAICallCounter } from "./jobClassifier.js";
import { fetchFreshersWorldJobs, fetchApnaJobs } from "./jobScrapers.js";

// ── Types ───────────────────────────────────────────────────
interface RawJob {
    title: string;
    company: string;
    location: string;
    job_url: string;
    source: "greenhouse" | "lever" | "ashby" | "scrape" | "jsearch" | "rss";
    posted_at: string | null;
    description?: string;
    category?: string;
    employment_type?: string;
    is_hybrid?: boolean;
}

// ── Greenhouse API ──────────────────────────────────────────
async function fetchGreenhouseJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`, {
            signal: AbortSignal.timeout(10000),
        });
        if (res.status === 404 || res.status === 429 || !res.ok) return [];
        const data = await res.json();
        return (data.jobs || []).map((j: any) => ({
            title: j.title,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.location?.name || "Remote",
            job_url: j.absolute_url || `https://boards.greenhouse.io/${company}/jobs/${j.id}`,
            source: "greenhouse" as const,
            posted_at: j.updated_at || j.created_at || null,
            description: (j.content || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
        }));
    } catch {
        return [];
    }
}

// ── Lever API ───────────────────────────────────────────────
async function fetchLeverJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
            signal: AbortSignal.timeout(10000),
        });
        if (res.status === 404 || res.status === 429 || !res.ok) return [];
        const data = await res.json();
        return (data || []).map((j: any) => ({
            title: j.text,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.categories?.location || "Remote",
            job_url: j.hostedUrl || j.applyUrl || "",
            source: "lever" as const,
            posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
            description: (j.descriptionPlain || "").substring(0, 15000),
        }));
    } catch {
        return [];
    }
}

// ── Ashby API ───────────────────────────────────────────────
async function fetchAshbyJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`, {
            signal: AbortSignal.timeout(10000),
        });
        if (res.status === 404 || res.status === 429 || !res.ok) return [];
        const data = await res.json();
        return (data.jobs || []).map((j: any) => ({
            title: j.title,
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: j.location || j.address?.city || "Remote",
            job_url: j.jobUrl || "",
            source: "ashby" as const,
            posted_at: j.publishedAt || j.createdAt || null,
            description: (j.descriptionPlain || j.descriptionHtml || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
            employment_type: j.employmentType,
        }));
    } catch {
        return [];
    }
}

// ── JSearch API ─────────────────────────────────────────────
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || "";
const JSEARCH_HOST = "jsearch.p.rapidapi.com";
const jsearchCache = new Map<string, { timestamp: number; data: RawJob[] }>();
const JSEARCH_CACHE_TTL = 10 * 60 * 1000;

async function fetchJSearchJobs(query: string, location: string, page = 1, numPages = 1): Promise<RawJob[]> {
    if (!JSEARCH_API_KEY) return [];
    try {
        const params = new URLSearchParams({
            query: `${query} in ${location}`, page: page.toString(),
            num_pages: numPages.toString(), date_posted: "month", remote_jobs_only: "false",
        });
        const res = await fetch(`https://${JSEARCH_HOST}/search?${params.toString()}`, {
            headers: { "x-rapidapi-key": JSEARCH_API_KEY, "x-rapidapi-host": JSEARCH_HOST },
            signal: AbortSignal.timeout(25000),
        });
        if (res.status === 429) {
            console.warn(`[JobFetcher] JSearch API rate limited (429)`);
            throw new Error("JSEARCH_RATE_LIMITED");
        }
        if (!res.ok) {
            console.warn(`[JobFetcher] JSearch API error: ${res.status}`);
            return [];
        }
        const data = await res.json();
        return (data.data || []).map((j: any) => ({
            title: j.job_title || "",
            company: j.employer_name || "",
            location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || "Remote",
            job_url: j.job_apply_link || j.job_google_link || "",
            source: "jsearch" as const,
            posted_at: j.job_posted_at_datetime_utc || null,
            description: (j.job_description || "").substring(0, 15000),
        }));
    } catch (err: any) {
        if (err.message === "JSEARCH_RATE_LIMITED") throw err; // Bubble up
        if (err.name !== "AbortError") console.warn("[JobFetcher] JSearch error:", err.message);
        return [];
    }
}

export async function searchJSearchLive(query: string, location: string, limit = 20): Promise<RawJob[]> {
    if (!JSEARCH_API_KEY) return [];
    const cacheKey = `${(query || "").toLowerCase().trim()}|${(location || "").toLowerCase().trim()}`;
    const cached = jsearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < JSEARCH_CACHE_TTL) return cached.data.slice(0, limit);
    let jobs = await fetchJSearchJobs(query || "software", location || "Remote", 1, 1);
    
    // Fallback if JSearch rate limited or missing key
    if (jobs.length === 0) {
        try {
            console.log(`[JobFetcher] Falling back to MCP scrapers for live search`);
            const { callMCPTool } = await import("../mcp/mcpClient.js");
            const mcpJobs = await callMCPTool("builtin_scraper", "search_jobs", { query, location, limit });
            jobs = mcpJobs.map(j => ({
                title: j.title,
                company: j.company,
                location: j.location,
                job_url: j.job_url,
                source: "mcp",
                posted_at: j.posted_at || new Date().toISOString(),
                description: j.description || "",
                category: j.category || detectCategory(j.title)
            }));
        } catch (err) {
            console.warn("[JobFetcher] MCP Fallback failed", err);
        }
    }

    jsearchCache.set(cacheKey, { timestamp: Date.now(), data: jobs });
    return jobs.slice(0, limit);
}

// ── Internshala Scraper ─────────────────────────────────────
const INTERNSHALA_URLS = [
    "https://internshala.com/jobs/jobs-in-india/",
    "https://internshala.com/internships/",
    "https://internshala.com/internships/work-from-home-internships/",
];

async function fetchInternshalaJobs(): Promise<RawJob[]> {
    try {
        let allJobs: RawJob[] = [];
        for (const url of INTERNSHALA_URLS) {
            try {
                const res = await fetch(url, {
                    signal: AbortSignal.timeout(15000),
                    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
                });
                if (!res.ok) continue;
                const html = await res.text();
                const $ = cheerio.load(html);
                $(".individual_internship").each((_: any, el: any) => {
                    const title = $(el).find(".job-title-href").text().trim() || $(el).find(".heading_4_5 a").text().trim();
                    const company = $(el).find(".company-name").text().trim();
                    const location = $(el).find(".location_link").map((_: any, l: any) => $(l).text().trim()).get().join(", ") || "India";
                    const link = $(el).attr("data-href") || $(el).find(".job-title-href").attr("href");
                    const job_url = link ? `https://internshala.com${link}` : "";
                    if (title && company && job_url) {
                        const category = url.includes("internships") ? "Internships & Fresher" : "Software Development";
                        allJobs.push({ title, company, location, job_url, source: "scrape", posted_at: new Date().toISOString(), description: `Internshala Listing.`, is_hybrid: false, category });
                    }
                });
                await new Promise(r => setTimeout(r, 1000));
            } catch { console.warn(`[JobFetcher] Internshala scrape failed for ${url}`); }
        }
        return allJobs;
    } catch (err: any) {
        console.warn("[JobFetcher] Internshala scraper failed:", err.message);
        return [];
    }
}

// ── RSS Feeds ───────────────────────────────────────────────
const NAUKRI_RSS_FEEDS = ["https://www.naukri.com/rss/jobsearch/it-jobs", "https://www.naukri.com/rss/jobsearch/software-jobs", "https://www.naukri.com/rss/jobsearch/fresher-jobs"];
const REMOTIVE_RSS_FEED = "https://remotive.io/remote-jobs/feed";
const WWR_RSS_FEED = "https://weworkremotely.com/remote-jobs.rss";

async function fetchNaukriRssJobs(): Promise<RawJob[]> {
    try {
        const parser = new XMLParser({ ignoreAttributes: false });
        let allJobs: RawJob[] = [];
        for (const feedUrl of NAUKRI_RSS_FEEDS) {
            try {
                const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) continue;
                const xmlData = await res.text();
                const parsed = parser.parse(xmlData);
                const items = parsed?.rss?.channel?.item || [];
                const jobsArray = Array.isArray(items) ? items : [items];
                allJobs.push(...jobsArray.map((item: any) => {
                    const titleParts = (item.title || "").split(" - ");
                    return {
                        title: titleParts[0]?.trim() || "Unknown Role",
                        company: titleParts[1]?.trim() || "Various Companies",
                        location: "India",
                        job_url: item.link || "",
                        source: "rss" as const,
                        category: feedUrl.includes("fresher") ? "Internships & Fresher" : undefined,
                        posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                        description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                    };
                }).filter((j: RawJob) => j.title && j.job_url));
            } catch { console.warn(`[JobFetcher] Naukri RSS feed failed: ${feedUrl}`); }
        }
        return allJobs;
    } catch (err: any) { console.warn("[JobFetcher] Naukri RSS overall failed:", err.message); return []; }
}

async function fetchGlobalRemoteRssJobs(): Promise<RawJob[]> {
    try {
        const parser = new XMLParser({ ignoreAttributes: false });
        let allJobs: RawJob[] = [];
        for (const feed of [REMOTIVE_RSS_FEED, WWR_RSS_FEED]) {
            try {
                const res = await fetch(feed, { signal: AbortSignal.timeout(10000) });
                if (!res.ok) continue;
                const xmlData = await res.text();
                const parsed = parser.parse(xmlData);
                const items = parsed?.rss?.channel?.item || [];
                const jobsArray = Array.isArray(items) ? items : [items];
                allJobs.push(...jobsArray.map((item: any) => ({
                    title: item.title || "Remote Job",
                    company: item["creator"] || item["dc:creator"] || "Remote Company",
                    location: "Remote Worldwide",
                    job_url: item.link || "",
                    source: "rss" as const,
                    posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                })));
            } catch { console.warn(`[JobFetcher] RSS feed failed: ${feed}`); }
        }
        return allJobs.filter((j: RawJob) => j.title && j.job_url);
    } catch (err: any) { console.warn("[JobFetcher] Global Remote RSS failed:", err.message); return []; }
}

async function fetchRemoteOkJobs(): Promise<RawJob[]> {
    try {
        const res = await fetch("https://remoteok.com/api", { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "JobSkillAI-Bot" } });
        if (!res.ok) return [];
        const data = await res.json();
        const jobs = Array.isArray(data) ? data.slice(1) : [];
        return jobs.map((j: any) => ({
            title: j.position, company: j.company, location: j.location || "Remote",
            job_url: j.url || "", source: "jsearch" as const,
            posted_at: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
            description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
        })).filter((j: any) => j.title && j.job_url);
    } catch (err: any) { console.warn("[JobFetcher] RemoteOK failed:", err.message); return []; }
}

// ── Helpers ─────────────────────────────────────────────────
function extractSkills(text: string): string[] {
    const lower = (text || "").toLowerCase();
    return SKILL_PATTERNS.filter(s => lower.includes(s));
}

function extractSalary(text: string): { min: number | null; max: number | null } {
    const lpaMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:lpa|lakhs?)/i);
    if (lpaMatch) return { min: parseInt(lpaMatch[1]) * 100000, max: parseInt(lpaMatch[2]) * 100000 };
    const kMatch = text.match(/\$(\d+)k?\s*[-–]\s*\$?(\d+)k/i);
    if (kMatch) return { min: parseInt(kMatch[1]) * 1000, max: parseInt(kMatch[2]) * 1000 };
    return { min: null, max: null };
}

export function extractExperience(text: string): { min: number | null; max: number | null } {
    const rangeMatch = text.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(?:years?|yrs?)/i);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
    const singleMatch = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
    if (singleMatch) return { min: parseInt(singleMatch[1]), max: null };
    return { min: null, max: null };
}

export function detectCategory(title: string, category?: string): string {
    if (category) return category;
    const t = title.toLowerCase();
    
    // Strict blocklist: Do not categorize as fresher if it contains senior keywords
    const seniorKw = ["senior", "sr ", "sr.", "lead", "staff", "principal", "architect", "manager", "director", "vp", "head", "expert", "general management", "vp "];
    const isSenior = seniorKw.some(kw => t.includes(kw));

    if (!isSenior && (t.includes("intern") || t.includes("fresher") || t.includes("trainee") || t.includes("0-1"))) {
        return "Internships & Fresher";
    }
    
    if (t.includes("data") || t.includes("analytics")) return "Data & Analytics";
    if (t.includes("design") || t.includes("ui") || t.includes("ux")) return "Design (UI/UX)";
    if (t.includes("product manager") || t.includes("pm")) return "Product Management";
    if (t.includes("devops") || t.includes("cloud") || t.includes("sre")) return "DevOps & Cloud";
    if (t.includes("qa") || t.includes("test") || t.includes("sdet")) return "QA & Testing";
    if (t.includes("sales") || t.includes("marketing")) return "Sales & Marketing";
    if (t.includes("hr") || t.includes("recruiter")) return "HR & Recruitment";
    if (t.includes("support") || t.includes("bpo")) return "Customer Support / BPO";
    return "Software Development";
}

function extractCityState(locationStr: string): { city: string; state: string; country: string } {
    const parts = locationStr.split(",").map(p => p.trim());
    return { city: parts[0] || "", state: parts[1] || "", country: parts[2] || parts[1] || "India" };
}

// ── Batched Concurrency ─────────────────────────────────────
async function runBatched<T, R>(items: T[], batchSize: number, runner: (item: T) => Promise<R[]>): Promise<R[]> {
    let results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(runner));
        results.push(...batchResults.flat());
        if (i + batchSize < items.length) await new Promise(r => setTimeout(r, 1000));
    }
    return results;
}

// ── Store Jobs with AI Classification ───────────────────────
let migrationMissing = false; // Tracks if new columns exist — persists across calls

async function storeJobs(jobs: RawJob[]): Promise<number> {
    if (jobs.length === 0) return 0;
    resetAICallCounter(); // Reset AI call budget for this cycle
    let stored = 0;

    for (const job of jobs) {
        if (!job.title || !job.company || !job.job_url) continue;

        const skills = extractSkills(job.description || "");
        const salary = extractSalary(job.description || "");
        const experience = extractExperience(job.description || "");
        const category = detectCategory(job.title, job.category);
        const locParts = extractCityState(job.location);

        // AI seniority classification when experience is unknown
        let seniority = "unknown";
        let confidenceScore = 100;

        if (experience.min === null && experience.max === null) {
            const classification = await classifySeniorityWithAI(
                `${job.title} ${job.description || ""}`
            );
            seniority = classification.seniority;
            confidenceScore = classification.confidence_score;
            // Use AI-inferred experience values
            if (classification.experience_min !== null && experience.min === null) {
                experience.min = classification.experience_min;
            }
            if (classification.experience_max !== null && experience.max === null) {
                experience.max = classification.experience_max;
            }
        } else {
            // Classify from title keywords when we have experience data
            const titleClassification = classifySeniorityFromTitle(job.title);
            seniority = titleClassification.seniority;
            confidenceScore = 90;
        }

        try {
            // Try with new columns first (requires migration)
            const upsertPayload: any = {
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
            };

            // Only add new columns if migration has been applied
            if (!migrationMissing) {
                upsertPayload.seniority_level = seniority;
                upsertPayload.is_active = true;
                upsertPayload.confidence_score = confidenceScore;
                upsertPayload.city = locParts.city;
                upsertPayload.state = locParts.state;
                upsertPayload.country = locParts.country;
                upsertPayload.category = category;
                upsertPayload.employment_type = job.employment_type || "full-time";
            }

            const { error } = await supabaseAdmin
                .from("job_listings")
                .upsert(upsertPayload, { onConflict: "job_url" });

            if (error) {
                // If column doesn't exist, switch to fallback mode for rest of batch
                if (error.message?.includes("column") && error.message?.includes("does not exist")) {
                    if (!migrationMissing) {
                        console.warn("[JobFetcher] New columns not found — falling back to original schema. Run migration.sql to enable all features.");
                        migrationMissing = true;
                    }
                    // Retry with only original columns
                    const { error: retryError } = await supabaseAdmin
                        .from("job_listings")
                        .upsert({
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
                        }, { onConflict: "job_url" });
                    if (!retryError) stored++;
                }
            } else {
                stored++;
            }
        } catch (err: any) {
            if (err.message?.includes("fetch failed") || err.cause?.code === "ENOTFOUND") {
                console.warn("[JobFetcher] Supabase unreachable — skipping.");
                return stored;
            }
        }
    }
    return stored;
}

// ── Auto-Expire (Soft Delete) ───────────────────────────────
async function autoExpireJobs() {
    if (migrationMissing) {
        console.log("[JobFetcher] Skipping auto-expiration (migration not applied).");
        return;
    }
    console.log("[JobFetcher] Running auto-expiration (soft delete)...");
    try {
        const now = new Date();

        // General: 45 days
        const generalThreshold = new Date(now);
        generalThreshold.setDate(generalThreshold.getDate() - 45);
        await supabaseAdmin.from("job_listings")
            .update({ is_active: false })
            .eq("is_active", true)
            .lt("posted_at", generalThreshold.toISOString())
            .not("source", "in", '("rss","scrape")');

        // Naukri RSS: 30 days
        const rssThreshold = new Date(now);
        rssThreshold.setDate(rssThreshold.getDate() - 30);
        await supabaseAdmin.from("job_listings")
            .update({ is_active: false })
            .eq("is_active", true)
            .eq("source", "rss")
            .lt("posted_at", rssThreshold.toISOString());

        // Internshala/Scrape: 21 days
        const scrapeThreshold = new Date(now);
        scrapeThreshold.setDate(scrapeThreshold.getDate() - 21);
        await supabaseAdmin.from("job_listings")
            .update({ is_active: false })
            .eq("is_active", true)
            .eq("source", "scrape")
            .lt("posted_at", scrapeThreshold.toISOString());

        console.log("[JobFetcher] Auto-expiration complete.");
    } catch (err: any) {
        if (err.message?.includes("does not exist")) {
            migrationMissing = true;
            console.warn("[JobFetcher] Auto-expire skipped — is_active column not found. Run migration.sql.");
        } else {
            console.error("[JobFetcher] Error expiring jobs:", err.message);
        }
    }
}

// ── Verify Top Jobs (Weekly) ────────────────────────────────
async function verifyTopJobs() {
    console.log("[JobFetcher] Running weekly job verification...");
    try {
        const { data: topJobs } = await supabaseAdmin
            .from("job_listings")
            .select("id, job_url")
            .eq("is_active", true)
            .order("view_count", { ascending: false })
            .limit(100);

        if (!topJobs || topJobs.length === 0) return;

        let deactivated = 0;
        let verified = 0;

        for (const job of topJobs) {
            try {
                const res = await fetch(job.job_url, {
                    method: "HEAD",
                    signal: AbortSignal.timeout(10000),
                    redirect: "follow",
                });
                if (res.status === 404 || res.status === 410) {
                    await supabaseAdmin.from("job_listings").update({ is_active: false }).eq("id", job.id);
                    deactivated++;
                } else if (res.ok) {
                    await supabaseAdmin.from("job_listings").update({ verified_at: new Date().toISOString() }).eq("id", job.id);
                    verified++;
                }
            } catch { /* timeout or network error — skip */ }
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`[JobFetcher] Verification done: ${verified} verified, ${deactivated} deactivated.`);
    } catch (err: any) {
        console.error("[JobFetcher] Verification error:", err.message);
    }
}

// ── Cron Entry Points ───────────────────────────────────────
export async function fetchAtsJobs(): Promise<{ total: number; stored: number }> {
    console.log(`[JobFetcher] ATS Cron: Fetching ${GREENHOUSE_COMPANIES.length + LEVER_COMPANIES.length + ASHBY_COMPANIES.length} companies...`);
    const [ghJobs, leverJobs, ashbyJobs] = await Promise.all([
        runBatched(GREENHOUSE_COMPANIES, 10, fetchGreenhouseJobs),
        runBatched(LEVER_COMPANIES, 10, fetchLeverJobs),
        runBatched(ASHBY_COMPANIES, 10, fetchAshbyJobs),
    ]);
    const allJobs = [...ghJobs, ...leverJobs, ...ashbyJobs];
    console.log(`[JobFetcher] ATS Fetched ${allJobs.length} jobs`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

export async function fetchRssJobs(): Promise<{ total: number; stored: number }> {
    console.log(`[JobFetcher] RSS Cron: Fetching Naukri, Remotive, WWR, RemoteOK...`);
    const [naukriJobs, globalRemoteJobs, remoteOkJobs] = await Promise.all([
        fetchNaukriRssJobs(), fetchGlobalRemoteRssJobs(), fetchRemoteOkJobs(),
    ]);
    const allJobs = [...naukriJobs, ...globalRemoteJobs, ...remoteOkJobs];
    console.log(`[JobFetcher] RSS Fetched ${allJobs.length} jobs`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

export async function fetchScraperJobs(): Promise<{ total: number; stored: number }> {
    console.log(`[JobFetcher] Scraper Cron: Fetching Internshala + Freshersworld + Apna...`);
    const [internshala, freshersworld, apna] = await Promise.all([
        fetchInternshalaJobs(), fetchFreshersWorldJobs(), fetchApnaJobs(),
    ]);
    const allJobs = [...internshala, ...freshersworld, ...apna];
    console.log(`[JobFetcher] Scraper Fetched ${allJobs.length} jobs`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

// JSearch cron — batched with rate limit protection
const JSEARCH_BATCH_SIZE = 5;
const JSEARCH_DELAY_MS = 15000;      // 15s between requests
const JSEARCH_BATCH_PAUSE_MS = 30000; // 30s between batches
const JSEARCH_MAX_RETRIES = 3;

export async function fetchJSearchCronJobs(): Promise<{ total: number; stored: number }> {
    if (!JSEARCH_API_KEY) { console.log("[JobFetcher] JSearch API key not set — skipping"); return { total: 0, stored: 0 }; }
    let allJobs: RawJob[] = [];
    const failed: string[] = [];
    let stopEarly = false;

    for (let i = 0; i < JSEARCH_CRON_QUERIES.length && !stopEarly; i += JSEARCH_BATCH_SIZE) {
        const batch = JSEARCH_CRON_QUERIES.slice(i, i + JSEARCH_BATCH_SIZE);

        for (const q of batch) {
            if (stopEarly) break;
            let attempt = 0;
            let succeeded = false;

            while (attempt < JSEARCH_MAX_RETRIES && !succeeded) {
                try {
                    const jobs = await fetchJSearchJobs(q.query, q.location, 1, 1);
                    allJobs.push(...jobs);
                    succeeded = true;
                    await new Promise(r => setTimeout(r, JSEARCH_DELAY_MS));
                } catch (err: any) {
                    if (err.message === "JSEARCH_RATE_LIMITED") {
                        attempt++;
                        if (attempt >= JSEARCH_MAX_RETRIES) {
                            console.warn(`[JobFetcher] JSearch rate limited 3x for "${q.query}". Stopping batch.`);
                            failed.push(q.query);
                            stopEarly = true;
                        } else {
                            const backoff = JSEARCH_DELAY_MS * Math.pow(2, attempt);
                            console.log(`[JobFetcher] JSearch rate limited on "${q.query}". Retry ${attempt}/${JSEARCH_MAX_RETRIES} in ${backoff / 1000}s`);
                            await new Promise(r => setTimeout(r, backoff));
                        }
                    } else {
                        console.error(`[JobFetcher] JSearch error for "${q.query}": ${err.message}`);
                        failed.push(q.query);
                        break;
                    }
                }
            }
        }

        // Pause between batches
        if (i + JSEARCH_BATCH_SIZE < JSEARCH_CRON_QUERIES.length && !stopEarly) {
            console.log(`[JobFetcher] JSearch batch complete. Sleeping 30s before next batch...`);
            await new Promise(r => setTimeout(r, JSEARCH_BATCH_PAUSE_MS));
        }
    }

    console.log(`[JobFetcher] JSearch fetched ${allJobs.length} jobs. Failed queries: ${failed.length}`);
    if (failed.length > 0) console.log(`[JobFetcher] JSearch failed: ${failed.join(', ')}`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

export async function fetchAllJobsLegacy(): Promise<{ total: number; stored: number }> {
    const { stored: ats } = await fetchAtsJobs();
    const { stored: rss } = await fetchRssJobs();
    const { stored: scrape } = await fetchScraperJobs();
    return { total: 0, stored: ats + rss + scrape };
}

export { autoExpireJobs, verifyTopJobs };

// ── Company Interleaving Algorithm ──────────────────────────
function interleaveByCompany(jobs: any[], maxPerCompanyPerPage: number = 2): any[] {
    const companyBuckets = new Map<string, any[]>();
    for (const job of jobs) {
        const key = (job.company || "").toLowerCase();
        if (!companyBuckets.has(key)) companyBuckets.set(key, []);
        companyBuckets.get(key)!.push(job);
    }
    const result: any[] = [];
    const companyCount = new Map<string, number>();
    let hasMore = true;
    while (hasMore) {
        hasMore = false;
        for (const [company, bucket] of companyBuckets) {
            if (bucket.length > 0) {
                hasMore = true;
                const job = bucket.shift()!;
                result.push(job);
                companyCount.set(company, (companyCount.get(company) || 0) + 1);
            }
        }
    }
    return result;
}

// ── Search Jobs (Production Quality) ────────────────────────
export async function searchJobs(filters: {
    query?: string;
    location?: string;
    skills?: string[];
    experience_max?: number;
    limit?: number;
    page?: number;
    preferred_location?: string;
    city?: string;
    country?: string;
    user_skills?: string[];
    user_experience_years?: number;
    user_seniority?: string;
}) {
    const limit = filters.limit || 20;
    const page = filters.page || 1;
    const effectiveLocation = filters.location || filters.city || "";

    let q = supabaseAdmin
        .from("job_listings")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(1500);

    if (!migrationMissing) {
        q = q.eq("is_active", true);  // ALWAYS filter active only (if col exists)
    }

    if (filters.query) {
        q = q.or(`title.ilike.%${filters.query}%,company.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
    }

    if (effectiveLocation) {
        let loc = effectiveLocation.trim().toLowerCase();
        
        // Fix common misspellings
        const spellCorrections: Record<string, string> = {
            "hyderbad": "hyderabad",
            "banglore": "bengaluru",
            "bengalore": "bengaluru",
            "gurgon": "gurugram",
            "dehli": "delhi"
        };
        if (spellCorrections[loc]) loc = spellCorrections[loc];

        const country = (filters.country || "").trim();
        let parts: string[] = [];
        const lowerLoc = loc;

        if (lowerLoc === "bengaluru" || lowerLoc === "bangalore") {
            parts.push(`location.ilike.%bengaluru%`, `location.ilike.%bangalore%`);
        } else if (lowerLoc === "mumbai" || lowerLoc === "bombay") {
            parts.push(`location.ilike.%mumbai%`, `location.ilike.%bombay%`);
        } else if (lowerLoc === "chennai" || lowerLoc === "madras") {
            parts.push(`location.ilike.%chennai%`, `location.ilike.%madras%`);
        } else if (lowerLoc === "gurugram" || lowerLoc === "gurgaon" || lowerLoc.includes("ncr") || lowerLoc === "noida") {
            parts.push(`location.ilike.%gurugram%`, `location.ilike.%gurgaon%`, `location.ilike.%noida%`, `location.ilike.%ncr%`);
        } else {
            parts.push(`location.ilike.%${loc}%`);
        }

        // Also find nearest metro for tier-2/3 cities
        const userState = (filters.country || "").toLowerCase();
        const nearestMetro = INDIAN_STATE_TO_NEAREST_METRO[userState];
        if (nearestMetro && nearestMetro.toLowerCase() !== lowerLoc) {
            parts.push(`location.ilike.%${nearestMetro}%`);
        }

        parts.push(`location.ilike.%remote%`, `location.ilike.%work from home%`, `location.ilike.%wfh%`, `location.ilike.%anywhere%`);
        if (country) parts.push(`location.ilike.%${country}%`);
        q = q.or(parts.join(","));
    }

    if (filters.skills && filters.skills.length > 0) {
        q = q.overlaps("skills", filters.skills);
    }

    const { data, error } = await q;
    
    let jobs: any[] = [];

    // Fallback: if search fails due to is_active column missing, set flag and retry without it
    if (error && error.message?.includes("is_active") && error.message?.includes("does not exist")) {
        migrationMissing = true;
        let retryQ = supabaseAdmin
            .from("job_listings")
            .select("*")
            .order("posted_at", { ascending: false })
            .limit(1500);
            
        // Re-apply ALL filters (not just query)
        if (filters.query) {
            retryQ = retryQ.or(`title.ilike.%${filters.query}%,company.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
        }
        if (effectiveLocation) {
            let loc = effectiveLocation.trim().toLowerCase();
            const spellFix: Record<string, string> = { "hyderbad": "hyderabad", "banglore": "bengaluru", "bengalore": "bengaluru", "gurgon": "gurugram", "dehli": "delhi" };
            if (spellFix[loc]) loc = spellFix[loc];
            let retryParts: string[] = [`location.ilike.%${loc}%`, `location.ilike.%remote%`];
            const retryCountry = (filters.country || "").trim();
            if (retryCountry) retryParts.push(`location.ilike.%${retryCountry}%`);
            retryQ = retryQ.or(retryParts.join(","));
        }
        if (filters.skills && filters.skills.length > 0) {
            retryQ = retryQ.overlaps("skills", filters.skills);
        }
        
        const { data: retryData, error: retryError } = await retryQ;
        if (retryError) throw new Error(retryError.message);
        
        jobs = retryData || [];
    } else if (error) {
        throw new Error(error.message);
    } else {
        jobs = data || [];
    }

    // ── In-Memory: Seniority + Experience Filtering ──
    if (filters.experience_max !== undefined) {
        const maxExp = filters.experience_max;
        let allowedSeniorities: string[] = [];

        if (maxExp <= 1) allowedSeniorities = SENIORITY_FOR_EXPERIENCE["0-1"];
        else if (maxExp <= 3) allowedSeniorities = SENIORITY_FOR_EXPERIENCE["1-3"];
        else if (maxExp <= 5) allowedSeniorities = SENIORITY_FOR_EXPERIENCE["3-5"];
        else allowedSeniorities = SENIORITY_FOR_EXPERIENCE["5+"];

        jobs = jobs.filter(job => {
            const expMin = job.experience_min;
            // Filter by experience number
            if (expMin !== null && expMin > maxExp) return false;
            // Filter by seniority level — NEVER show senior/lead to 0-1yr user
            const jobSeniority = (job.seniority_level || "unknown").toLowerCase();
            if (jobSeniority !== "unknown" && !allowedSeniorities.includes(jobSeniority)) return false;
            // Extra safety: title keyword check for entry-level
            if (maxExp <= 2) {
                const title = (job.title || "").toLowerCase();
                const seniorKw = ["senior", "sr ", "sr.", "lead", "staff", "principal", "architect", "manager", "director", "vp", "head", "expert"];
                if (seniorKw.some(kw => title.includes(kw))) return false;
            }
            return true;
        });
    }

    // ── In-Memory: Resume Match Scoring ──
    const hasUserProfile = filters.user_skills && filters.user_skills.length > 0;
    if (hasUserProfile) {
        const userSkillsList = (filters.user_skills || []).map(s => s.toLowerCase());
        const userSkillsSet = new Set(userSkillsList);
        const userExp = filters.user_experience_years || 0;
        const userCity = (filters.city || "").toLowerCase();

        jobs = jobs.map(job => {
            // Skill matching: check both skills[] array AND description text
            const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase());
            const arrayOverlap = jobSkills.filter((s: string) => userSkillsSet.has(s)).length;

            // Also scan description for user skills (catches jobs with sparse skill tags)
            const descLower = (job.description || "").toLowerCase();
            const titleLower = (job.title || "").toLowerCase();
            const descOverlap = userSkillsList.filter(s => descLower.includes(s) || titleLower.includes(s)).length;

            // Combined skill score: array match weighted higher, desc match as bonus
            const totalPossible = Math.max(userSkillsList.length, 1);
            const combinedOverlap = Math.min(totalPossible, arrayOverlap + Math.floor(descOverlap * 0.5));
            const skillScore = (combinedOverlap / totalPossible) * 100;

            const expMin = job.experience_min || 0;
            const expMax = job.experience_max || expMin + 3;
            const expScore = (userExp >= expMin && userExp <= expMax) ? 100 : (userExp < expMin ? Math.max(0, 100 - (expMin - userExp) * 30) : Math.max(0, 100 - (userExp - expMax) * 20));

            const jobLoc = (job.location || "").toLowerCase();
            const locScore = userCity && jobLoc.includes(userCity) ? 100 : (jobLoc.includes("remote") ? 70 : 30);

            const matchScore = Math.round(skillScore * 0.5 + expScore * 0.3 + locScore * 0.2);
            return { ...job, match_score: matchScore };
        });
    }

    // ── Sorting: Match score (if resume) → Location proximity → Date ──
    const userCity = (filters.location || filters.city || "").toLowerCase().trim();
    // Re-apply spell corrections for sorting
    const spellCorrections: Record<string, string> = { "hyderbad": "hyderabad", "banglore": "bengaluru", "bengalore": "bengaluru", "gurgon": "gurugram", "dehli": "delhi" };
    const cleanCity = spellCorrections[userCity] || userCity;

    const userCountry = (filters.country || filters.preferred_location || "").toLowerCase();
    const userState = userCountry; // For Indian proximity
    const nearestMetro = (INDIAN_STATE_TO_NEAREST_METRO[userState] || "").toLowerCase();

    // ── Pre-calculate values for faster sorting ──
    const qLower = (filters.query || "").toLowerCase().trim();
    // Use effectiveLocation to determine if user explicitly searched for a place
    const isExplicitLocationSearch = !!effectiveLocation;

    jobs.sort((a, b) => {
        const aLoc = (a.location || "").toLowerCase();
        const bLoc = (b.location || "").toLowerCase();

        // TIER 1: Explicit Location Search
        // If the user explicitly searched for a location (e.g. "Hyderabad"), 
        // exact city matches MUST beat everything else, regardless of match_score.
        if (isExplicitLocationSearch && cleanCity) {
            const aCityMatch = aLoc.includes(cleanCity) ? 1 : 0;
            const bCityMatch = bLoc.includes(cleanCity) ? 1 : 0;
            if (aCityMatch !== bCityMatch) return bCityMatch - aCityMatch;
            
            // Secondary location: State/Metro match
            if (userState) {
                const aStateMatch = aLoc.includes(userState) ? 1 : 0;
                const bStateMatch = bLoc.includes(userState) ? 1 : 0;
                if (aStateMatch !== bStateMatch) return bStateMatch - aStateMatch;
            }
            if (nearestMetro) {
                const aMetroMatch = aLoc.includes(nearestMetro) ? 1 : 0;
                const bMetroMatch = bLoc.includes(nearestMetro) ? 1 : 0;
                if (aMetroMatch !== bMetroMatch) return bMetroMatch - aMetroMatch;
            }
        }

        // TIER 2: Resume Match Score
        // High match scores (≥10pt difference) take priority after explicit location is satisfied
        if (hasUserProfile) {
            const scoreDiff = (b.match_score || 0) - (a.match_score || 0);
            if (Math.abs(scoreDiff) >= 10) return scoreDiff;
        }

        // TIER 3: Search Text Relevance
        if (qLower) {
            const aTitle = (a.title || "").toLowerCase();
            const bTitle = (b.title || "").toLowerCase();
            const aTitleMatch = aTitle.includes(qLower) ? 2 : 0;
            const bTitleMatch = bTitle.includes(qLower) ? 2 : 0;
            const aCompanyMatch = (a.company || "").toLowerCase().includes(qLower) ? 1 : 0;
            const bCompanyMatch = (b.company || "").toLowerCase().includes(qLower) ? 1 : 0;
            const aTextScore = aTitleMatch + aCompanyMatch;
            const bTextScore = bTitleMatch + bCompanyMatch;
            
            if (aTextScore !== bTextScore) return bTextScore - aTextScore;
            
            const aExact = aTitle === qLower ? 1 : 0;
            const bExact = bTitle === qLower ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
        }

        // TIER 4: Match Score Tiebreaker
        if (hasUserProfile) {
            const scoreDiff = (b.match_score || 0) - (a.match_score || 0);
            if (scoreDiff !== 0) return scoreDiff;
        }

        // TIER 5: Default Location Proximity (if not explicitly searched)
        if (!isExplicitLocationSearch) {
            const aCityMatch = cleanCity && aLoc.includes(cleanCity) ? 1 : 0;
            const bCityMatch = cleanCity && bLoc.includes(cleanCity) ? 1 : 0;
            if (aCityMatch !== bCityMatch) return bCityMatch - aCityMatch;

            if (userState) {
                const aStateMatch = aLoc.includes(userState) ? 1 : 0;
                const bStateMatch = bLoc.includes(userState) ? 1 : 0;
                if (aStateMatch !== bStateMatch) return bStateMatch - aStateMatch;
            }

            if (nearestMetro) {
                const aMetroMatch = aLoc.includes(nearestMetro) ? 1 : 0;
                const bMetroMatch = bLoc.includes(nearestMetro) ? 1 : 0;
                if (aMetroMatch !== bMetroMatch) return bMetroMatch - aMetroMatch;
            }
        }

        // TIER 6: Remote Fallbacks & Date
        const aRemoteIndia = aLoc.includes("remote") && aLoc.includes("india") ? 1 : 0;
        const bRemoteIndia = bLoc.includes("remote") && bLoc.includes("india") ? 1 : 0;
        if (aRemoteIndia !== bRemoteIndia) return bRemoteIndia - aRemoteIndia;

        const aRemote = aLoc.includes("remote") ? 1 : 0;
        const bRemote = bLoc.includes("remote") ? 1 : 0;
        if (aRemote !== bRemote) return bRemote - aRemote;

        return new Date(b.posted_at || 0).getTime() - new Date(a.posted_at || 0).getTime();
    });

    // ── Company Interleaving (before pagination) ──
    // Always apply interleaving, but preserve score-based ordering when resume matching
    jobs = interleaveByCompany(jobs, 2);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    let paginated = jobs.slice(from, to);

    // HARD RULE: Enforce max 2 jobs from same company per page
    const companyPageCount = new Map<string, number>();
    paginated = paginated.filter(job => {
        const key = (job.company || "").toLowerCase();
        const count = companyPageCount.get(key) || 0;
        if (count >= 2) return false;
        companyPageCount.set(key, count + 1);
        return true;
    });

    return { data: paginated, total: jobs.length };
}
