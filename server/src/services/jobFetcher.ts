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
import { fetchFreshersWorldJobs, fetchApnaJobs, fetchIndeedRssJobs, fetchGlassdoorRssJobs } from "./jobScrapers.js";
import { classifyJobDomain, isTechTitle } from "./jobDomainClassifier.js";

// ── Types ───────────────────────────────────────────────────
interface RawJob {
    title: string;
    company: string;
    location: string;
    job_url: string;
    source: "greenhouse" | "lever" | "ashby" | "scrape" | "jsearch" | "rss" | "mcp";
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
// Normalize a skill string: lowercase, strip dots and spaces
// "React.js" → "reactjs", "Node JS" → "nodejs", "Machine Learning" → "machinelearning"
function normalizeSkill(s: string): string {
    return s.toLowerCase().replace(/[\s.]+/g, '').replace(/[^a-z0-9#]/g, '');
}

function extractSkills(text: string): string[] {
    const lower = (text || "").toLowerCase();
    // Match against normalized patterns — also handle variant spellings
    return SKILL_PATTERNS.filter(s => {
        const normalized = normalizeSkill(s);
        const textNorm = lower.replace(/[\s.]+/g, '');
        return textNorm.includes(normalized);
    });
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
    
    // ── Non-tech categories first (prevent defaulting to "Software Development") ──
    if (/\b(telecaller|call\s*center|bpo)\b/i.test(t)) return "Customer Support / BPO";
    if (/\b(sales|marketing|digital\s*marketing|seo|sem|content\s*market|brand)\b/i.test(t)) return "Sales & Marketing";
    if (/\b(hr\b|human\s*resource|recruiter|talent\s*acqui|staffing|placement)\b/i.test(t)) return "HR & Recruitment";
    if (/\b(finance|accounting|ca\s*article|chartered|equity|investment|banking|loan|audit|taxation)\b/i.test(t)) return "Finance & Accounting";
    if (/\b(legal|law\b|advocate|counsel|compliance|attorney)\b/i.test(t)) return "Legal";
    if (/\b(fundraising|charity|ngo|social\s*work|community)\b/i.test(t)) return "Non-Profit / NGO";
    if (/\b(video\s*edit|graphic\s*design|motion\s*graphic|animation|photography|content\s*creat|copywrite|blog\s*writ|content\s*writ)\b/i.test(t)) return "Creative & Content";
    if (/\b(business\s*develop|business\s*strat|client\s*acqui|project\s*manage)\b/i.test(t)) return "Business Development";
    if (/\b(real\s*estate|property|teaching|tutor|faculty|professor|education)\b/i.test(t)) return "Education & Others";
    if (/\b(medical|pharma|clinical|nursing|doctor|health)\b/i.test(t)) return "Healthcare";
    if (/\b(logistics|supply\s*chain|warehouse|procurement|operations)\b/i.test(t)) return "Operations & Logistics";
    if (/\b(customer\s*success|customer\s*support|support\s*exec|helpdesk)\b/i.test(t)) return "Customer Support / BPO";
    
    // ── Senior keyword block ──
    const seniorKw = ["senior", "sr ", "sr.", "lead", "staff", "principal", "architect", "manager", "director", "vp", "head", "expert", "general management"];
    const isSenior = seniorKw.some(kw => t.includes(kw));

    // ── Fresher detection — ONLY for tech roles ──
    const fresherPattern = /\b(intern|fresher|trainee|0[\s-]?1|junior|jr\.?|associate|graduate\s*engineer|campus|entry[\s-]?level|get\b|apprentice)\b/i;
    if (!isSenior && fresherPattern.test(t) && isTechTitle(title)) {
        return "Internships & Fresher";
    }
    
    // ── Tech category detection ──
    if (/\b(data|analytics|bi\b|business\s*intelligence)\b/i.test(t) && isTechTitle(title)) return "Data & Analytics";
    if (/\b(design|ui|ux)\b/i.test(t) && isTechTitle(title)) return "Design (UI/UX)";
    if (/\b(product\s*manager|pm\b)\b/i.test(t)) return "Product Management";
    if (/\b(devops|cloud|sre|infrastructure)\b/i.test(t)) return "DevOps & Cloud";
    if (/\b(qa|test|sdet)\b/i.test(t)) return "QA & Testing";
    
    // Default: only label as "Software Development" if title actually looks tech
    if (isTechTitle(title)) return "Software Development";
    return "Other";
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

    // Pre-fetch existing posted_at in one query so re-scrapes don't overwrite original dates
    const allUrls = jobs.map(j => j.job_url).filter(Boolean);
    const { data: existingRecords } = await supabaseAdmin
        .from("job_listings")
        .select("job_url, posted_at")
        .in("job_url", allUrls);
    const existingPostedAt = new Map(
        (existingRecords || []).map((r: any) => [r.job_url, r.posted_at])
    );

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
                posted_at: existingPostedAt.get(job.job_url) || job.posted_at || new Date().toISOString(),
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
                // Domain classification at ingestion time
                upsertPayload.job_domain = classifyJobDomain(job.title, job.description || "", skills);
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
                            posted_at: existingPostedAt.get(job.job_url) || job.posted_at || new Date().toISOString(),
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
    console.log(`[JobFetcher] Scraper Cron: Fetching Internshala + Freshersworld + Apna + Indeed RSS + Glassdoor...`);
    const [internshala, freshersworld, apna, indeedRss, glassdoor] = await Promise.all([
        fetchInternshalaJobs(), fetchFreshersWorldJobs(), fetchApnaJobs(),
        fetchIndeedRssJobs(), fetchGlassdoorRssJobs(),
    ]);
    const allJobs = [...internshala, ...freshersworld, ...apna, ...indeedRss, ...glassdoor];
    console.log(`[JobFetcher] Scraper Fetched ${allJobs.length} jobs (Internshala: ${internshala.length}, FW: ${freshersworld.length}, Apna: ${apna.length}, Indeed: ${indeedRss.length}, Glassdoor: ${glassdoor.length})`);
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
    // Only interleave within score bands to preserve relevance ordering
    // Jobs with similar scores (within 15 points) get interleaved; 
    // higher-scoring jobs always appear before lower-scoring ones
    if (jobs.length === 0) return [];
    
    const hasScores = jobs[0]?.match_score !== undefined;
    if (!hasScores) {
        // No scores — use simple round-robin
        const companyBuckets = new Map<string, any[]>();
        for (const job of jobs) {
            const key = (job.company || "").toLowerCase();
            if (!companyBuckets.has(key)) companyBuckets.set(key, []);
            companyBuckets.get(key)!.push(job);
        }
        const result: any[] = [];
        let hasMore = true;
        while (hasMore) {
            hasMore = false;
            for (const [, bucket] of companyBuckets) {
                if (bucket.length > 0) {
                    hasMore = true;
                    result.push(bucket.shift()!);
                }
            }
        }
        return result;
    }

    // Score-aware interleaving: group into bands of 15 points, interleave within each band
    const BAND_SIZE = 15;
    const result: any[] = [];
    let i = 0;
    
    while (i < jobs.length) {
        const bandStart = jobs[i].match_score || 0;
        const bandEnd = bandStart - BAND_SIZE;
        
        // Collect all jobs in this score band
        const band: any[] = [];
        while (i < jobs.length && (jobs[i].match_score || 0) > bandEnd) {
            band.push(jobs[i]);
            i++;
        }
        
        // Interleave within the band (limit per company)
        const companyCount = new Map<string, number>();
        const deferred: any[] = [];
        
        for (const job of band) {
            const key = (job.company || "").toLowerCase();
            const count = companyCount.get(key) || 0;
            if (count < maxPerCompanyPerPage) {
                result.push(job);
                companyCount.set(key, count + 1);
            } else {
                deferred.push(job);
            }
        }
        
        // Add deferred jobs at the end of this band (still better than next band)
        result.push(...deferred);
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
    category?: string;
    user_skills?: string[];
    user_experience_years?: number;
    user_seniority?: string;
    user_primary_domain?: string;
    bypassLocationFilter?: boolean; // set true for domain-aware users; location handled in-memory
}) {
    // Return-slice cap. Raised so domain-aware feeds can surface the full
    // in-region pool (hundreds of jobs) rather than the first 500.
    const limit = Math.min(filters.limit || 40, 2000);
    const page = filters.page || 1;
    const effectiveLocation = filters.location || filters.city || "";

    // Build the query-text filter clause once so it can be re-applied per page.
    const queryOr = filters.query
        ? `title.ilike.%${filters.query}%,company.ilike.%${filters.query}%,description.ilike.%${filters.query}%`
        : null;

    let q = supabaseAdmin
        .from("job_listings")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(3000);

    if (!migrationMissing) {
        q = q.eq("is_active", true);  // ALWAYS filter active only (if col exists)
    }

    if (queryOr) {
        q = q.or(queryOr);
    }

    // For domain-aware logged-in users, skip the hard DB location filter.
    // Location ranking is handled in-memory by computeLocationMatch() in the relevance scorer,
    // so nearby jobs still appear first. Without this bypass, city detection (e.g. "Hyderabad")
    // would restrict the raw DB pool to only ~30 jobs tagged with that city, starving domain-split.
    let locationOr: string | null = null;
    if (effectiveLocation && !filters.bypassLocationFilter) {
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
            parts.push(`location.ilike.%bengaluru%`, `location.ilike.%bangalore%`, `city.ilike.%bengaluru%`, `city.ilike.%bangalore%`);
        } else if (lowerLoc === "mumbai" || lowerLoc === "bombay") {
            parts.push(`location.ilike.%mumbai%`, `location.ilike.%bombay%`, `city.ilike.%mumbai%`, `city.ilike.%bombay%`);
        } else if (lowerLoc === "chennai" || lowerLoc === "madras") {
            parts.push(`location.ilike.%chennai%`, `location.ilike.%madras%`, `city.ilike.%chennai%`, `city.ilike.%madras%`);
        } else if (lowerLoc === "gurugram" || lowerLoc === "gurgaon" || lowerLoc.includes("ncr") || lowerLoc === "noida") {
            parts.push(`location.ilike.%gurugram%`, `location.ilike.%gurgaon%`, `location.ilike.%noida%`, `location.ilike.%ncr%`, `city.ilike.%gurugram%`, `city.ilike.%gurgaon%`, `city.ilike.%noida%`);
        } else {
            parts.push(`location.ilike.%${loc}%`, `city.ilike.%${loc}%`);
        }

        // Also find nearest metro for tier-2/3 cities
        const userState = (filters.country || "").toLowerCase();
        const nearestMetro = INDIAN_STATE_TO_NEAREST_METRO[userState];
        if (nearestMetro && nearestMetro.toLowerCase() !== lowerLoc) {
            parts.push(`location.ilike.%${nearestMetro}%`, `city.ilike.%${nearestMetro.toLowerCase()}%`);
        }

        parts.push(`location.ilike.%remote%`, `location.ilike.%work from home%`, `location.ilike.%wfh%`, `location.ilike.%anywhere%`, `city.ilike.%remote%`);
        if (country) parts.push(`location.ilike.%${country}%`);
        locationOr = parts.join(",");
        q = q.or(locationOr);
    }

    if (filters.skills && filters.skills.length > 0) {
        q = q.overlaps("skills", filters.skills);
    }

    // ── Paginated fetch ──────────────────────────────────────────────
    // PostgREST caps a single response at ~1000 rows. A domain-aware feed
    // needs the FULL in-region pool (hundreds of India jobs spread across
    // thousands of rows), so we page through in 1000-row chunks up to a cap.
    // Re-apply the same filter clauses on a fresh builder per page.
    const applyFilters = (qq: any) => {
        if (!migrationMissing) qq = qq.eq("is_active", true);
        if (queryOr) qq = qq.or(queryOr);
        if (locationOr) qq = qq.or(locationOr);
        if (filters.skills && filters.skills.length > 0) qq = qq.overlaps("skills", filters.skills);
        return qq;
    };
    const PAGE = 1000;
    const maxFetch = Math.min(Math.max(filters.limit || 40, 1000), 8000);
    let data: any[] = [];
    let error: any = null;
    for (let start = 0; start < maxFetch; start += PAGE) {
        const res = await applyFilters(
            supabaseAdmin.from("job_listings").select("*").order("posted_at", { ascending: false })
        ).range(start, start + PAGE - 1);
        if (res.error) { error = res.error; break; }
        data = data.concat(res.data || []);
        if (!res.data || res.data.length < PAGE) break;
    }
    
    let jobs: any[] = [];

    // Fallback: if search fails due to is_active column missing, set flag and retry without it
    if (error && error.message?.includes("is_active") && error.message?.includes("does not exist")) {
        migrationMissing = true;
        let retryQ = supabaseAdmin
            .from("job_listings")
            .select("*")
            .order("posted_at", { ascending: false })
            .limit(3000);
            
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

    // ── In-Memory: Category Filtering ──
    // When a specific category is requested (e.g., "Internships & Fresher"),
    // filter jobs to that category BEFORE pagination so we get a full page of results.
    if (filters.category) {
        const cat = filters.category;
        const fresherPattern = /\b(intern|fresher|trainee|junior|jr\.?|associate|graduate|campus|entry[\s-]?level|apprentice)\b/i;
        const seniorKw = ["senior", "sr ", "sr.", "lead", "staff", "principal", "architect", "manager", "director", "vp", "head", "expert"];
        
        if (cat === "Internships & Fresher") {
            jobs = jobs.filter(job => {
                const title = job.title || "";
                const titleLower = title.toLowerCase();
                // STRICT BLOCK: Senior keywords → never a fresher job
                if (seniorKw.some(kw => titleLower.includes(kw))) return false;
                // TECH GATE: Must be a tech-related title
                if (!isTechTitle(title)) return false;

                if ((job.category || "").includes("Fresher")) return true;
                if (job.seniority_level === "intern" || job.seniority_level === "entry") return true;
                if (fresherPattern.test(titleLower)) return true;
                return false;
            });
        } else if (cat === "Remote") {
            jobs = jobs.filter(job => (job.location || "").toLowerCase().includes("remote"));
        } else if (cat === "Software Development") {
            jobs = jobs.filter(job => 
                ["Software Development", "Data & Analytics", "DevOps & Cloud"].includes(job.category || "")
            );
        } else {
            jobs = jobs.filter(job => (job.category || "") === cat);
        }
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
            // BUT allow "unknown" seniority through (don't discard unclassified jobs)
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

        // For freshers (0-2 yrs), boost jobs that are explicitly fresher-friendly
        if (maxExp <= 2) {
            const fresherPattern = /\b(intern|fresher|trainee|junior|jr\.?|associate|graduate|campus|entry[\s-]?level|apprentice|0[\s-]?[12]\s*(?:years?|yrs?))\b/i;
            jobs.sort((a, b) => {
                const aFresher = fresherPattern.test(a.title || "") || (a.category || "").includes("Fresher") ? 1 : 0;
                const bFresher = fresherPattern.test(b.title || "") || (b.category || "").includes("Fresher") ? 1 : 0;
                if (aFresher !== bFresher) return bFresher - aFresher;
                return 0; // preserve existing order for ties
            });
        }
    }

    // ── In-Memory: Resume Match Scoring ──
    const hasUserProfile = filters.user_skills && filters.user_skills.length > 0;
    if (hasUserProfile) {
        const userSkillsList = (filters.user_skills || []).map(s => s.toLowerCase().trim());
        // Normalize skills for fuzzy matching (remove dots, spaces, "js" suffix variations)
        const normalizeSkill = (s: string) => s.toLowerCase().replace(/[.\-\s]+/g, "").replace(/js$/, "").trim();
        const userSkillsNormalized = userSkillsList.map(normalizeSkill);
        const userSkillsSet = new Set(userSkillsNormalized);
        const userExp = filters.user_experience_years || 0;
        const userCity = (filters.city || "").toLowerCase();

        jobs = jobs.map(job => {
            // Skill matching: check both skills[] array AND description text
            const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase().trim());
            const jobSkillsNormalized = jobSkills.map(normalizeSkill);
            
            // Fuzzy array overlap: normalized comparison
            const arrayOverlap = jobSkillsNormalized.filter((s: string) => 
                userSkillsSet.has(s) || userSkillsNormalized.some(us => us.includes(s) || s.includes(us))
            ).length;

            // Also scan description for user skills (catches jobs with sparse skill tags)
            // Use word boundary matching to avoid false positives
            const descLower = (job.description || "").toLowerCase();
            const titleLower = (job.title || "").toLowerCase();
            const descOverlap = userSkillsList.filter(s => {
                if (s.length < 3) return false; // skip very short skills to avoid false matches
                // Use word boundary check for longer skill names
                const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escaped}\\b`, 'i');
                return regex.test(descLower) || regex.test(titleLower);
            }).length;

            // Combined skill score: array match weighted higher, desc match as bonus
            const totalPossible = Math.max(userSkillsList.length, 1);
            const combinedOverlap = Math.min(totalPossible, arrayOverlap + Math.floor(descOverlap * 0.6));
            const skillScore = (combinedOverlap / totalPossible) * 100;

            // Check if job title/domain is relevant to user's PRIMARY domain
            const titleLowerForMatch = (job.title || "").toLowerCase();
            
            // Domain relevance check based on user's primary domain
            let domainRelevance = 0; // -1 = mismatch, 0 = neutral, 1 = match
            if (filters.user_primary_domain) {
                const DOMAIN_TITLE_PATTERNS: Record<string, { match: RegExp; mismatch: RegExp }> = {
                    "data-science-ml": {
                        match: /\b(data\s*scien|machine\s*learn|ml\s+engineer|deep\s*learn|nlp\s*engineer|llm|data\s*analyst|research\s*scien|computer\s*vision|neural|python\s*dev|ai\s+engineer)/i,
                        mismatch: /\b(frontend|front.?end|devops|dev\s*ops|cloud\s*eng|aws\s*dev|qa\b|quality\s*assur|security|cyber|info.?sec|network\s*eng|sys.?admin|ui.?ux|ux\s*design|ios\s*dev|android|flutter|swift|salesforce|sap\b|erp|helpdesk|support\s*eng|full.?stack|web\s*dev|team\s*memb)/i,
                    },
                    "frontend": {
                        match: /\b(frontend|front.?end|react|angular|vue|ui\s*dev|web\s*dev|javascript\s*dev)/i,
                        mismatch: /\b(data\s*scien|machine\s*learn|devops|backend|security|cyber|network|sys.?admin|dba)/i,
                    },
                    "backend": {
                        match: /\b(backend|back.?end|server|api\s*dev|node\s*dev|java\s*dev|python\s*dev|golang|microservice)/i,
                        mismatch: /\b(frontend|ui.?ux|design|security|cyber|network|data\s*scien|machine\s*learn)/i,
                    },
                    "devops": {
                        match: /\b(devops|dev\s*ops|sre|cloud\s*eng|infrastructure|platform\s*eng|kubernetes|terraform)/i,
                        mismatch: /\b(frontend|data\s*scien|machine\s*learn|ui.?ux|design|qa\b|security|cyber)/i,
                    },
                    "data-engineering": {
                        match: /\b(data\s*engineer|etl|pipeline\s*eng|spark|airflow|warehouse|analytics\s*eng)/i,
                        mismatch: /\b(frontend|devops|security|cyber|qa\b|ui.?ux|ios|android)/i,
                    },
                    "fullstack": {
                        match: /\b(full.?stack|software\s*engineer|software\s*dev|sde|web\s*dev)/i,
                        mismatch: /\b(data\s*scien|machine\s*learn|devops|security|cyber|network|sys.?admin)/i,
                    },
                };
                
                const patterns = DOMAIN_TITLE_PATTERNS[filters.user_primary_domain];
                if (patterns) {
                    if (patterns.match.test(titleLowerForMatch)) {
                        domainRelevance = 1; // Title matches user's domain
                    } else if (patterns.mismatch.test(titleLowerForMatch)) {
                        domainRelevance = -1; // Title is clearly a different domain
                    }
                }
            }

            const expMin = job.experience_min || 0;
            const expMax = job.experience_max || expMin + 3;
            const expScore = (userExp >= expMin && userExp <= expMax) ? 100 : (userExp < expMin ? Math.max(0, 100 - (expMin - userExp) * 30) : Math.max(0, 100 - (userExp - expMax) * 20));

            const jobLoc = (job.location || "").toLowerCase();
            const locScore = userCity && jobLoc.includes(userCity) ? 100 : (jobLoc.includes("remote") ? 70 : 30);

            // Skill weight is dominant (65%) — irrelevant jobs MUST score low
            let matchScore = Math.round(skillScore * 0.65 + expScore * 0.20 + locScore * 0.15);
            
            // Penalty: if ZERO skills matched (both array and description), cap score very low
            if (combinedOverlap === 0) {
                matchScore = Math.min(matchScore, 8);
            }
            
            // Domain-based adjustment: boost matching domain, heavily penalize mismatches
            if (domainRelevance === 1) {
                matchScore = Math.min(100, matchScore + 20); // Strong boost: "Data Scientist" for a DS user
            } else if (domainRelevance === -1) {
                matchScore = Math.max(1, matchScore - 50); // Very heavy penalty: "DevOps/Security/Cloud" for a DS user
            }

            return { ...job, match_score: matchScore };
        });

        // Filter out jobs with near-zero match scores — only when results are abundant
        const minMatchThreshold = 5;
        const relevantJobs = jobs.filter(job => (job.match_score || 0) >= minMatchThreshold);
        if (relevantJobs.length >= 200) {
            jobs = relevantJobs;
        }
    }

    // ── Deduplication: Remove duplicate jobs (same title + company) ──
    // Keep the one with the highest match_score or most recent posting
    const seen = new Map<string, any>();
    for (const job of jobs) {
        const key = `${(job.title || "").toLowerCase().trim()}|${(job.company || "").toLowerCase().trim()}`;
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, job);
        } else {
            // Keep the one with higher match_score, or more recent if scores are equal
            const existingScore = existing.match_score || 0;
            const newScore = job.match_score || 0;
            if (newScore > existingScore || (newScore === existingScore && new Date(job.posted_at || 0) > new Date(existing.posted_at || 0))) {
                seen.set(key, job);
            }
        }
    }
    jobs = Array.from(seen.values());

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

        // TIER 1: Resume Match Score (HIGHEST PRIORITY when user has a profile)
        // Skill relevance is the most important signal — users want jobs matching their skills
        if (hasUserProfile) {
            const aScore = a.match_score || 0;
            const bScore = b.match_score || 0;
            const scoreDiff = bScore - aScore;
            // Strong score difference (≥15pt) always wins over location
            if (Math.abs(scoreDiff) >= 15) return scoreDiff;
        }

        // TIER 2: Location Match (within similar match scores)
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

        // TIER 3: Match Score (any difference matters now)
        if (hasUserProfile) {
            const scoreDiff = (b.match_score || 0) - (a.match_score || 0);
            if (scoreDiff !== 0) return scoreDiff;
        }

        // TIER 4: Search Text Relevance
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
    // Apply interleaving, but preserve score-based ordering when resume matching
    // Use higher per-company limit when user has profile (score-sorted) or results are low
    const maxPerCompany = hasUserProfile ? 5 : (jobs.length < 40 ? 4 : 2);
    jobs = interleaveByCompany(jobs, maxPerCompany);

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginated = jobs.slice(from, to);

    return { data: paginated, total: jobs.length };
}
