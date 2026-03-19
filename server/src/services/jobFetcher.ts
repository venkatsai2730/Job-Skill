// ═══════════════════════════════════════════════════════════════
// Real-Time Job Fetcher — Greenhouse, Lever, JSearch (Global)
// ═══════════════════════════════════════════════════════════════

import { supabaseAdmin } from "../config/supabase.js";

const GREENHOUSE_COMPANIES = [
    // Phase 5 Group 1: Indian Unicorns
    "swiggy", "zomato", "oyo", "paytm", "cred", "groww", "zepto", "meesho", 
    "nykaa", "razorpay", "lenskart", "mamaearth", "boat", "cars24", "spinny", 
    "dealshare", "udaan", "moglix", "ofbusiness", "delhivery", "blackbuck", 
    "porter", "shiprocket", "blinkit", "curefit", "urbancompany",

    // Phase 5 Group 4: Global MNCs India Office
    "google", "microsoft", "amazon", "flipkart", "samsung", "ibm",
    "accenture", "deloitte", "ey", "pwc", "capgemini",

    // Famous Startups / Unicorns
    "airbnb", "pinterest", "discord", "figma", "notion", "brex", "ramp",
    // Enterprise Tech
    "twilio", "datadog", "okta", "plaid", "gusto", "robinhood", "coinbase", "kraken",
    // Cloud / DevTools
    "hashicorp", "docker", "vercel", "cloudflare", "gitlab", "postman", "apollographql",
    // AI / Forward edge
    "openai", "anthropic", "scaleai", "huggingface",
    // Companies with large Hyderabad/India presence
    "rubrik", "cohesity", "confluent", "snowflake", "nutanix", "arcesium", "deshaw", 
    "tanium", "informatica", "qualtrics", "pagerduty", "cloudera", "grab",
    // Well known consumer
    "reddit", "doordash", "instacart", "lyft", "spotify", "duolingo"
];

const LEVER_COMPANIES = [
    // Phase 5 Group 1 & 2: Indian Tech
    "cred", "groww", "zepto", "phonepe", "jupiter", "slice", "bharatpe", 
    "freshworks", "postman", "browserstack", "hasura", "clevertap", "moengage",
    "webengage", "capillary", "setu", "decentro", "hyperface", "signzy", 
    "cashfree", "juspay", "instamojo", "gojek",
    
    // Finance/Payments
    "revolut",
    // Dev Tools & SaaS
    "retool", "linear", "mux", "fivetran", "segment", "amplitude", "miro",
    // Big names
    "netflix", "yelp", "eventbrite", "quora", "glassdoor", "atlassian",
    "canva", "squarespace", "webflow", "shopify"
];

const ASHBY_COMPANIES = [
    // Global Tech
    "openai", "notion", "snowflake", "deel", "vanta",
    "airwallex", "confluent", "kraken", "deliveroo",

    // India Focused
    "darwinbox", "keka", "zoho", "freshworks",
    "chargebee", "cleartax", "licious", "blackbuck",
    "delhivery", "udaan", "vedantu", "unacademy",
    "byju", "physicswallah", "scaler", "upgrad",

    // Startups Using Ashby in India
    "setu", "hyperface", "decentro", "cashfree",
    "signzy", "syntizen", "yulu", "ather", "ola",
    "rapido", "porter", "dunzo"
];

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
            signal: AbortSignal.timeout(10000), // 10 second timeout per company
        });
        if (res.status === 404) return []; // Ignore gracefully
        if (res.status === 429) {
            console.warn(`[JobFetcher] Greenhouse ${company} Rate Limited 429`);
            return [];
        }
        if (!res.ok) return [];
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
    } catch (err: any) {
        if (err.name !== "AbortError") {
            console.warn(`[JobFetcher] Greenhouse ${company} failed:`, err.message);
        }
        return [];
    }
}

// ── Lever API ───────────────────────────────────────────────
async function fetchLeverJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
            signal: AbortSignal.timeout(10000), // 10 second limit
        });
        if (res.status === 404) return []; // Ignore gracefully
        if (res.status === 429) {
            console.warn(`[JobFetcher] Lever ${company} Rate Limited 429`);
            return [];
        }
        if (!res.ok) return [];
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
    } catch (err: any) {
        if (err.name !== "AbortError") {
            console.warn(`[JobFetcher] Lever ${company} failed:`, err.message);
        }
        return [];
    }
}

// ── Ashby API ───────────────────────────────────────────────
async function fetchAshbyJobs(company: string): Promise<RawJob[]> {
    try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`, {
            signal: AbortSignal.timeout(10000), 
        });
        if (res.status === 404) return []; // Ignore gracefully
        if (res.status === 429) {
            console.warn(`[JobFetcher] Ashby ${company} Rate Limited 429`);
            return [];
        }
        if (!res.ok) return [];
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
    } catch (err: any) {
        if (err.name !== "AbortError") {
            console.warn(`[JobFetcher] Ashby ${company} failed:`, err.message);
        }
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// JSearch API (RapidAPI) — Global job aggregation
// LinkedIn, Indeed, Glassdoor, ZipRecruiter, and more
// ═══════════════════════════════════════════════════════════════

const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || "";
const JSEARCH_HOST = "jsearch.p.rapidapi.com";

// Live search cache (10 minutes TTL)
const jsearchCache = new Map<string, { timestamp: number; data: RawJob[] }>();
const JSEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchJSearchJobs(query: string, location: string, page: number = 1, numPages: number = 1): Promise<RawJob[]> {
    if (!JSEARCH_API_KEY) return [];

    try {
        const params = new URLSearchParams({
            query: `${query} in ${location}`,
            page: page.toString(),
            num_pages: numPages.toString(),
            date_posted: "month",        // Only last month's jobs
            remote_jobs_only: "false",
        });

        const res = await fetch(`https://${JSEARCH_HOST}/search?${params.toString()}`, {
            headers: {
                "x-rapidapi-key": JSEARCH_API_KEY,
                "x-rapidapi-host": JSEARCH_HOST,
            },
            signal: AbortSignal.timeout(15000),
        });

        if (res.status === 429) {
            console.warn("[JobFetcher] JSearch rate limited (429)");
            return [];
        }
        if (!res.ok) {
            console.warn(`[JobFetcher] JSearch failed with status ${res.status}`);
            return [];
        }

        const data = await res.json();
        const jobs: any[] = data.data || [];

        return jobs.map((j: any) => ({
            title: j.job_title || "",
            company: j.employer_name || "",
            location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ") || "Remote",
            job_url: j.job_apply_link || j.job_google_link || "",
            source: "jsearch" as const,
            posted_at: j.job_posted_at_datetime_utc || null,
            description: (j.job_description || "").substring(0, 15000),
        }));
    } catch (err: any) {
        if (err.name !== "AbortError") {
            console.warn("[JobFetcher] JSearch error:", err.message);
        }
        return [];
    }
}

/**
 * Live JSearch query — called on-demand from the job-listings route.
 * Results are cached for 10 minutes per query+location combo.
 */
export async function searchJSearchLive(query: string, location: string, limit: number = 20): Promise<RawJob[]> {
    if (!JSEARCH_API_KEY) return [];

    const cacheKey = `${(query || "").toLowerCase().trim()}|${(location || "").toLowerCase().trim()}`;
    const cached = jsearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < JSEARCH_CACHE_TTL) {
        return cached.data.slice(0, limit);
    }

    const jobs = await fetchJSearchJobs(query || "software", location || "Remote", 1, 1);
    jsearchCache.set(cacheKey, { timestamp: Date.now(), data: jobs });
    return jobs.slice(0, limit);
}

// ── Extract skills from job description ─────────────────────
const SKILL_PATTERNS = [
    // Global Tech Skills
    "javascript", "typescript", "python", "java", "react", "angular", "vue",
    "node", "express", "django", "flask", "spring", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "git", "sql", "mongodb", "postgresql",
    "redis", "graphql", "rest", "api", "microservices", "html", "css",
    "linux", "devops", "machine learning", "data science", "golang", "rust",
    "swift", "kotlin", "flutter", "react native", "next.js", "nest.js",
    "kafka", "rabbitmq", "elasticsearch", "ci/cd", "jenkins", "github actions",
    
    // Phase 7: Indian Tech Stack & Domains
    "j2ee", "spring mvc", "hibernate", ".net", "asp.net", "c#", "angular.js",
    "php", "laravel", "codeigniter", "oracle db", "selenium", "testng", "junit",
    "sap abap", "sap fico", "sap mm", "sap sd", "oracle erp", "salesforce",
    "upi", "payment gateway", "bbps", "aadhaar api", "digilocker", "npci",
    "customer service", "voice process", "non-voice", "data entry", "back office", "kyc"
];

// Phase 3: Naukri RSS Feeds
import { XMLParser } from "fast-xml-parser";

// Phase 2: Scrapers
import * as cheerio from "cheerio";

const INTERNSHALA_URLS = [
    "https://internshala.com/jobs/jobs-in-india/",
    "https://internshala.com/internships/",
    "https://internshala.com/internships/work-from-home-internships/"
];

async function fetchInternshalaJobs(): Promise<RawJob[]> {
    try {
        let allJobs: RawJob[] = [];
        
        for (const url of INTERNSHALA_URLS) {
            try {
                const res = await fetch(url, {
                    signal: AbortSignal.timeout(15000),
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
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
                        const isHybrid = location.toLowerCase().includes("hybrid") || location.toLowerCase().includes("work from home") || title.toLowerCase().includes("work from home");
                        const category = url.includes("internships") ? "Internships & Fresher" : "Software Development";
                        
                        // Extract basically visible details as description
                        const stipend = $(el).find(".stipend").text().trim();
                        const experience = $(el).find(".experience").text().trim();
                        const desc = `Internshala Listing.\nStipend/Salary: ${stipend}\nExperience required: ${experience}\nApply directly at Internshala.`;

                        allJobs.push({
                            title,
                            company,
                            location,
                            job_url,
                            source: "scrape",
                            posted_at: new Date().toISOString(), // Internshala doesn't expose easy absolute dates on cards
                            description: desc,
                            is_hybrid: isHybrid,
                            category
                        });
                    }
                });
                
                // Be gentle
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                console.warn(`[JobFetcher] Internshala scrape failed for ${url}`);
            }
        }
        
        return allJobs;
    } catch (err: any) {
        console.warn("[JobFetcher] Internshala scraper failed:", err.message);
        return [];
    }
}

const NAUKRI_RSS_FEEDS = [
    "https://www.naukri.com/rss/jobsearch/it-jobs",
    "https://www.naukri.com/rss/jobsearch/software-jobs",
    "https://www.naukri.com/rss/jobsearch/fresher-jobs"
];

// Phase 4: Global Remote Jobs
const REMOTIVE_RSS_FEED = "https://remotive.io/remote-jobs/feed";
const WWR_RSS_FEED = "https://weworkremotely.com/remote-jobs.rss";

async function fetchGlobalRemoteRssJobs(): Promise<RawJob[]> {
    try {
        const parser = new XMLParser({ ignoreAttributes: false });
        let allJobs: RawJob[] = [];

        // Remotive
        try {
            const res = await fetch(REMOTIVE_RSS_FEED, { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const xmlData = await res.text();
                const parsed = parser.parse(xmlData);
                const items = parsed?.rss?.channel?.item || [];
                const jobsArray = Array.isArray(items) ? items : [items];
                
                allJobs.push(...jobsArray.map((item: any) => ({
                    title: item.title || "Remote Job",
                    company: item["creator"] || item["dc:creator"] || "Remotive Company",
                    location: "Remote Worldwide",
                    job_url: item.link || "",
                    source: "rss" as const,
                    posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                    is_hybrid: false
                })));
            }
        } catch (e) {
            console.warn("[JobFetcher] Remotive RSS feed failed");
        }

        // We Work Remotely
        try {
            const res = await fetch(WWR_RSS_FEED, { signal: AbortSignal.timeout(10000) });
            if (res.ok) {
                const xmlData = await res.text();
                const parsed = parser.parse(xmlData);
                const items = parsed?.rss?.channel?.item || [];
                const jobsArray = Array.isArray(items) ? items : [items];
                
                allJobs.push(...jobsArray.map((item: any) => ({
                    title: item.title || "Remote Job",
                    company: item["creator"] || item["dc:creator"] || "WWR Company",
                    location: "Remote",
                    job_url: item.link || "",
                    source: "rss" as const,
                    posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                    description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                    is_hybrid: false
                })));
            }
        } catch (e) {
            console.warn("[JobFetcher] WWR RSS feed failed");
        }

        return allJobs.filter((j: RawJob) => j.title && j.job_url);
    } catch (err: any) {
        console.warn("[JobFetcher] Global Remote RSS overall failed:", err.message);
        return [];
    }
}

async function fetchRemoteOkJobs(): Promise<RawJob[]> {
    try {
        const res = await fetch("https://remoteok.com/api", {
            signal: AbortSignal.timeout(10000),
            headers: {
                "User-Agent": "JobSkillAI-Bot"
            }
        });
        if (!res.ok) return [];
        
        const data = await res.json();
        // The first element is usually legal/metadata, the rest are jobs
        const jobs = Array.isArray(data) ? data.slice(1) : [];
        
        return jobs.map((j: any) => ({
            title: j.position,
            company: j.company,
            location: j.location || "Remote",
            job_url: j.url || "",
            source: "jsearch" as const, // tagging as jsearch or generic scrape equivalent
            posted_at: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
            description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
            is_hybrid: false
        })).filter(j => j.title && j.job_url);
    } catch (err: any) {
        console.warn("[JobFetcher] RemoteOK API failed:", err.message);
        return [];
    }
}

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

                const formattedJobs = jobsArray.map((item: any) => {
                    const titleParts = (item.title || "").split(" - ");
                    const title = titleParts[0]?.trim() || "Unknown Role";
                    const company = titleParts[1]?.trim() || "Various Companies";
                    
                    return {
                        title,
                        company,
                        location: "India", // Naukri RSS usually implies India
                        job_url: item.link || "",
                        source: "rss" as const,
                        posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                        description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                    };
                }).filter((j: RawJob) => j.title && j.job_url);

                allJobs.push(...formattedJobs);
            } catch (err) {
                console.warn(`[JobFetcher] Naukri RSS feed failed: ${feedUrl}`);
            }
        }
        return allJobs;
    } catch (err: any) {
        console.warn("[JobFetcher] Naukri RSS overall failed:", err.message);
        return [];
    }
}

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
export function extractExperience(text: string): { min: number | null; max: number | null } {
    const rangeMatch = text.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(?:years?|yrs?)/i);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };

    const singleMatch = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)/i);
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

        // Smart Category Detection
        const titleLower = job.title.toLowerCase();
        let category = "Software Development"; // default
        if (titleLower.includes("data") || titleLower.includes("analytics")) category = "Data & Analytics";
        if (titleLower.includes("design") || titleLower.includes("ui") || titleLower.includes("ux")) category = "Design (UI/UX)";
        if (titleLower.includes("product manager") || titleLower.includes("pm")) category = "Product Management";
        if (titleLower.includes("devops") || titleLower.includes("cloud") || titleLower.includes("sre")) category = "DevOps & Cloud";
        if (titleLower.includes("qa") || titleLower.includes("test") || titleLower.includes("sdet")) category = "QA & Testing";
        if (titleLower.includes("sales") || titleLower.includes("account executive") || titleLower.includes("marketing")) category = "Sales & Marketing";
        if (titleLower.includes("finance") || titleLower.includes("accountant")) category = "Finance & Accounts";
        if (titleLower.includes("hr") || titleLower.includes("recruiter")) category = "HR & Recruitment";
        if (titleLower.includes("support") || titleLower.includes("customer success") || titleLower.includes("bpo")) category = "Customer Support / BPO";
        if (titleLower.includes("intern") || titleLower.includes("fresher") || titleLower.includes("trainee")) category = "Internships & Fresher";

        try {
            // Upsert by job_url to deduplicate
            const { error } = await supabaseAdmin
                .from("job_listings")
                .upsert(
                    {
                        title: job.title,
                        company: job.company,
                        location: job.location, // raw location
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
            if (err.message?.includes("fetch failed") || err.cause?.code === "ENOTFOUND") {
                console.warn("[JobFetcher] Supabase unreachable — skipping job storage.");
                return stored;
            }
            console.error("[JobFetcher] Insert Error for job", job.title, ":", err.message || err);
        }
    }
    return stored;
}

// ── Phase 9: Auto-Expire Old Jobs ───────────────────────────
async function autoExpireJobs() {
    console.log("[JobFetcher] Running auto-expiration for jobs older than 45 days...");
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - 45);
        const thresholdIso = thresholdDate.toISOString();

        // In Supabase, if is_active column doesn't exist, we must physically delete
        const { error, count } = await supabaseAdmin
            .from("job_listings")
            .delete()
            .lt("posted_at", thresholdIso);

        if (error) {
            console.error("[JobFetcher] Failed to expire old jobs:", error.message);
        } else {
            console.log(`[JobFetcher] Successfully expired old jobs.`);
        }
    } catch (err: any) {
        console.error("[JobFetcher] Error expiring old jobs:", err.message);
    }
}

// ── Main Fetch Function (called by cron) ────────────────────
// Helper for batched concurrent requests
async function runBatched<T, R>(items: T[], batchSize: number, runner: (item: T) => Promise<R[]>): Promise<R[]> {
    let results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(runner));
        results.push(...batchResults.flat());
        // Small delay between batches to respect overall API stability
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return results;
}

// Cron job queries for JSearch — broad searches across major regions
const JSEARCH_CRON_QUERIES = [
    { query: "software engineer", location: "India" },
    { query: "developer", location: "India" },
    { query: "software engineer", location: "United States" },
    { query: "developer", location: "United Kingdom" },
    { query: "software engineer", location: "Remote" },
    { query: "data analyst", location: "India" },
    { query: "designer", location: "India" },
    { query: "product manager", location: "India" },
];

// ── Cron Fetch Groupings ────────────────────────────────────

    // Fetch from JSearch (sequential to respect rate limits)
    let jsearchJobs: RawJob[] = [];
    if (JSEARCH_API_KEY) {
        for (const q of JSEARCH_CRON_QUERIES) {
            const jobs = await fetchJSearchJobs(q.query, q.location, 1, 1);
            jsearchJobs.push(...jobs);
            // Small delay between JSearch calls
            await new Promise(r => setTimeout(r, 500));
        }
        console.log(`[JobFetcher] JSearch fetched ${jsearchJobs.length} jobs`);
    } else {
        console.log(`[JobFetcher] JSearch API key not set — skipping global job fetch`);
    }

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
        fetchNaukriRssJobs(),
        fetchGlobalRemoteRssJobs(),
        fetchRemoteOkJobs(),
    ]);
    const allJobs = [...naukriJobs, ...globalRemoteJobs, ...remoteOkJobs];
    console.log(`[JobFetcher] RSS Fetched ${allJobs.length} jobs`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

export async function fetchScraperJobs(): Promise<{ total: number; stored: number }> {
    console.log(`[JobFetcher] Scraper Cron: Fetching Internshala...`);
    const [internshalaJobs] = await Promise.all([
        fetchInternshalaJobs()
    ]);
    const allJobs = [...internshalaJobs];
    console.log(`[JobFetcher] Scraper Fetched ${allJobs.length} jobs`);
    const stored = await storeJobs(allJobs);
    return { total: allJobs.length, stored };
}

export async function fetchAllJobsLegacy(): Promise<{ total: number; stored: number }> {
    // Left for backwards compatibility if needed
    const { stored: ats } = await fetchAtsJobs();
    const { stored: rss } = await fetchRssJobs();
    const { stored: scrape } = await fetchScraperJobs();
    return { total: 0, stored: ats + rss + scrape };
}

export { autoExpireJobs };

// ── Search jobs from DB (with smarter location matching) ────
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
}) {
    const limit = filters.limit || 20;
    const page = filters.page || 1;

    // Determine effective location for filtering
    const effectiveLocation = filters.location || filters.city || "";

    // We fetch a larger pool to rank in-memory, to support complex priority sorting
    let q = supabaseAdmin
        .from("job_listings")
        .select("*")
        .order("posted_at", { ascending: false })
        .limit(1500); // slightly higher cap to ensure we get good local jobs

    if (filters.query) {
        q = q.or(`title.ilike.%${filters.query}%,company.ilike.%${filters.query}%`);
    }
    if (effectiveLocation) {
        // Smart location matching: city OR state OR country OR remote
        // Build a flexible OR filter that matches several variants
        const loc = effectiveLocation.trim();
        const country = (filters.country || "").trim();
        
        // Build location filter parts
        let parts = [];
        
        // Handle common Indian city aliases/normalization
        const lowerLoc = loc.toLowerCase();
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
        
        // Phase 6: Smarter Remote Matching
        parts.push(`location.ilike.%remote%`);
        parts.push(`location.ilike.%work from home%`);
        parts.push(`location.ilike.%wfh%`);
        parts.push(`location.ilike.%anywhere in india%`);
        parts.push(`location.ilike.%pan india%`);
        parts.push(`location.ilike.%anywhere%`);
        
        // If the user explicity searched for the country, or if it's the only thing we have
        if (lowerLoc === country.toLowerCase()) {
            parts.push(`location.ilike.%${country}%`);
        } else if (!filters.location && country) {
            // ONLY fallback to country if the user didn't explicitly type a location
            // e.g. they just relied on auto-detect, so we give them some country jobs
            parts.push(`location.ilike.%${country}%`);
        }

        q = q.or(parts.join(","));
    }
    if (filters.skills && filters.skills.length > 0) {
        q = q.overlaps("skills", filters.skills);
    }
    // Experience filtering is now done explicitly in memory to avoid Supabase .or() param conflicts

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    
    let jobs = data || [];

    // --- In-Memory Filters (Experience & Seniority) ---
    if (filters.experience_max !== undefined) {
        const isEntryLevel = filters.experience_max <= 2;
        const maxExp = filters.experience_max;
        
        jobs = jobs.filter(job => {
            const expMin = job.experience_min;
            
            if (isEntryLevel) {
                // strict entry level: ignore if min experience > threshold
                if (expMin !== null && expMin > maxExp) return false;
                
                // Exclude senior keywords from title for 0-2 yrs
                const title = (job.title || "").toLowerCase();
                const seniorKeywords = [
                    "senior", "sr ", "sr.", "lead", "staff", "principal", 
                    "architect", "manager", "director", "vp", "head",
                    "expert", "mid-level", "level 3", "level 4", "level 5"
                ];
                if (seniorKeywords.some(kw => title.includes(kw))) return false;
                if (title.includes("account executive")) return false; // often non-entry sales
                
                return true;
            } else {
                // Just respect max exp if specified, otherwise tolerate null
                if (expMin !== null && expMin > maxExp) return false;
                return true;
            }
        });
    }

    // ADVANCED RANKING: Nearby City > Same Country > Remote > Rest > then by Date
    const userCity = (filters.city || filters.location || "").toLowerCase();
    const userCountry = (filters.country || filters.preferred_location || "").toLowerCase();

    if (userCity || userCountry) {
        jobs.sort((a, b) => {
            const aLoc = (a.location || "").toLowerCase();
            const bLoc = (b.location || "").toLowerCase();
            
            // Priority 1: Exact city match
            const aCityMatch = userCity && aLoc.includes(userCity) ? 1 : 0;
            const bCityMatch = userCity && bLoc.includes(userCity) ? 1 : 0;
            if (aCityMatch !== bCityMatch) return bCityMatch - aCityMatch;

            // Priority 2: Same country match
            const aCountryMatch = userCountry && aLoc.includes(userCountry) ? 1 : 0;
            const bCountryMatch = userCountry && bLoc.includes(userCountry) ? 1 : 0;
            if (aCountryMatch !== bCountryMatch) return bCountryMatch - aCountryMatch;

            // Priority 3: Remote roles (accessible from anywhere)
            const aIsRemote = aLoc.includes("remote") ? 1 : 0;
            const bIsRemote = bLoc.includes("remote") ? 1 : 0;
            if (aIsRemote !== bIsRemote) return bIsRemote - aIsRemote;

            // Priority 4: Date fallback
            const aTime = new Date(a.posted_at || 0).getTime();
            const bTime = new Date(b.posted_at || 0).getTime();
            return bTime - aTime;
        });
    }

    // Manual slice pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginated = jobs.slice(from, to);

    return { data: paginated, total: jobs.length };
}
