// ═══════════════════════════════════════════════════════════════
// MCP Client Layer — Primary Job Fetching Engine (Zero API Keys)
//
// This is the MAIN job fetching system. No RapidAPI, no JSearch,
// no paid APIs. All sources are free public endpoints or HTML scraping.
//
// Sources:
//   1. Google Jobs (structured data from search HTML)
//   2. RemoteOK (free JSON API)
//   3. Arbeitnow (free JSON API)
//   4. Remotive (free JSON API)
//   5. Internshala (HTML scrape — India freshers)
//   6. LinkedIn Public (HTML scrape — global)
//   7. Indeed (HTML scrape — global)
//   8. SimplyHired (HTML scrape — global)
//   9. Naukri (HTML scrape — India)
//  10. Glassdoor (HTML scrape — global)
// ═══════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { traceStandalone } from "../observability/langfuse.js";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
};

export interface ScrapedJob {
    title: string;
    company: string;
    location: string;
    description: string;
    job_url: string;
    source: string;
    salary_min: number | null;
    salary_max: number | null;
    posted_at: string;
    category?: string;
}

// ── Helper: safe fetch with timeout ─────────────────────────
async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
    try {
        const res = await fetch(url, {
            headers: HEADERS,
            signal: AbortSignal.timeout(15000),
            ...opts,
        });
        if (!res.ok) return null;
        return res;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 1: Google Jobs (structured data extraction)
// ═══════════════════════════════════════════════════════════════
async function scrapeGoogleJobs(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(`${query} jobs in ${location}`);
        const url = `https://www.google.com/search?q=${q}&ibp=htl;jobs&hl=en`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const jobs: ScrapedJob[] = [];
        const $ = cheerio.load(html);

        // Google embeds job data in script tags
        $("script").each((_, el) => {
            const content = $(el).html() || "";
            const matches = content.matchAll(/"title"\s*:\s*"([^"]+)"[^}]*?"company_name"\s*:\s*"([^"]+)"/g);
            for (const m of matches) {
                if (jobs.length >= limit) break;
                jobs.push({
                    title: m[1].replace(/\\u[\da-f]{4}/gi, ""),
                    company: m[2],
                    location,
                    description: `${m[1]} at ${m[2]}`,
                    job_url: `https://www.google.com/search?q=${encodeURIComponent(m[1] + " " + m[2] + " job")}`,
                    source: "google_jobs",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });

        return jobs.slice(0, limit);
    } catch (err: any) {
        console.warn("[MCP] Google Jobs failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 2: RemoteOK (free JSON API, no key)
// ═══════════════════════════════════════════════════════════════
async function scrapeRemoteOK(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const res = await safeFetch("https://remoteok.com/api", {
            headers: { "User-Agent": "JobSkillAI/2.0" },
        });
        if (!res) return [];
        const data = await res.json();
        const items = Array.isArray(data) ? data.slice(1) : [];

        const qLower = query.toLowerCase();
        return items
            .filter((j: any) => {
                const text = `${j.position || ""} ${j.description || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
                return qLower.split(" ").some(w => w.length > 2 && text.includes(w));
            })
            .slice(0, limit)
            .map((j: any) => ({
                title: j.position || "Remote Job",
                company: j.company || "Remote Company",
                location: j.location || "Remote Worldwide",
                description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 10000),
                job_url: j.url || `https://remoteok.com/jobs/${j.id || ""}`,
                source: "remoteok",
                salary_min: j.salary_min ? parseInt(j.salary_min) : null,
                salary_max: j.salary_max ? parseInt(j.salary_max) : null,
                posted_at: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
            }));
    } catch (err: any) {
        console.warn("[MCP] RemoteOK failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 3: Arbeitnow (free JSON API, no key)
// ═══════════════════════════════════════════════════════════════
async function scrapeArbeitnow(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const res = await safeFetch("https://www.arbeitnow.com/api/job-board-api");
        if (!res) return [];
        const data = await res.json();
        const items = data?.data || [];

        const qLower = query.toLowerCase();
        return items
            .filter((j: any) => {
                const text = `${j.title || ""} ${j.description || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
                return qLower.split(" ").some(w => w.length > 2 && text.includes(w));
            })
            .slice(0, limit)
            .map((j: any) => ({
                title: j.title || "",
                company: j.company_name || "",
                location: j.location || "Remote",
                description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 10000),
                job_url: j.url || "",
                source: "arbeitnow",
                salary_min: null, salary_max: null,
                posted_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
            }));
    } catch (err: any) {
        console.warn("[MCP] Arbeitnow failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 4: Remotive (free JSON API, no key)
// ═══════════════════════════════════════════════════════════════
async function scrapeRemotive(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const res = await safeFetch(`https://remotive.com/api/remote-jobs?search=${q}&limit=${limit}`);
        if (!res) return [];
        const data = await res.json();
        return (data?.jobs || []).slice(0, limit).map((j: any) => ({
            title: j.title || "",
            company: j.company_name || "",
            location: j.candidate_required_location || "Remote",
            description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 10000),
            job_url: j.url || "",
            source: "remotive",
            salary_min: j.salary ? parseInt(j.salary) : null,
            salary_max: null,
            posted_at: j.publication_date || new Date().toISOString(),
        }));
    } catch (err: any) {
        console.warn("[MCP] Remotive failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 5: Internshala (HTML scrape — India freshers)
// ═══════════════════════════════════════════════════════════════
async function scrapeInternshala(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query.toLowerCase().replace(/\s+/g, "-"));
        const urls = [
            `https://internshala.com/internships/keywords-${q}`,
            `https://internshala.com/jobs/keywords-${q}`,
        ];
        const jobs: ScrapedJob[] = [];

        for (const url of urls) {
            if (jobs.length >= limit) break;
            const res = await safeFetch(url);
            if (!res) continue;
            const html = await res.text();
            const $ = cheerio.load(html);

            $(".individual_internship, .individual-job, [class*='internship_meta']").each((_, el) => {
                if (jobs.length >= limit) return;
                const title = $(el).find(".job-title-href, .heading_4_5 a, h3 a, [class*='title'] a").first().text().trim();
                const company = $(el).find(".company-name, .company_name a, [class*='company']").first().text().trim();
                const loc = $(el).find(".location_link, .locations a, [class*='location']").map((_, l) => $(l).text().trim()).get().join(", ") || "India";
                const link = $(el).attr("data-href") || $(el).find("a[href*='/internship/'], a[href*='/job/']").first().attr("href");
                const jobUrl = link ? (link.startsWith("http") ? link : `https://internshala.com${link}`) : "";

                if (title && title.length > 3 && jobUrl) {
                    // TECH GATE: Only include tech internships
                    // Internshala returns ALL internships (marketing, HR, finance etc.)
                    // Filter non-tech at scrape time to keep the DB clean
                    const isTechRole = /\b(engineer|developer|sde|software|data|devops|qa|tester|frontend|backend|fullstack|machine\s*learn|ml\b|ai\b|python|java|react|node|web\s*dev|android|ios|cloud|cyber|security|tech|it\b|network|database|embedded|automation|sre|sdet)\b/i.test(title);
                    const isNonTech = /\b(telecaller|fundrais|charity|marketing|sales|hr\b|human\s*resource|legal|finance|account|video\s*edit|graphic\s*design|content\s*writ|blog\s*writ|business\s*develop|business\s*strat|client\s*acqui|customer\s*success|real\s*estate|teaching|tutor|event\s*manag|hospitality|medical|pharma|fashion)\b/i.test(title);
                    if (isNonTech || !isTechRole) return; // skip non-tech

                    jobs.push({
                        title, company: company || "Various Companies", location: loc,
                        description: `${title} at ${company || "Various Companies"} — Internshala`,
                        job_url: jobUrl, source: "internshala",
                        salary_min: null, salary_max: null,
                        posted_at: new Date().toISOString(),
                        category: "Internships & Fresher",
                    });
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        }
        return jobs;
    } catch (err: any) {
        console.warn("[MCP] Internshala failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 6: LinkedIn Public (HTML scrape)
// ═══════════════════════════════════════════════════════════════
async function scrapeLinkedIn(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        const url = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&sortBy=DD`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: ScrapedJob[] = [];

        $(".base-card, .job-search-card").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find(".base-search-card__title, [class*='title']").first().text().trim();
            const company = $(el).find(".base-search-card__subtitle, [class*='subtitle']").first().text().trim();
            const locText = $(el).find(".job-search-card__location, [class*='location']").first().text().trim();
            const link = $(el).find("a.base-card__full-link, a[href*='/jobs/view/']").first().attr("href");

            if (title && company && link) {
                jobs.push({
                    title, company, location: locText || location,
                    description: `${title} at ${company}`,
                    job_url: link.split("?")[0],
                    source: "linkedin",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });
        return jobs;
    } catch (err: any) {
        console.warn("[MCP] LinkedIn failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 7: Indeed (HTML scrape — global)
// ═══════════════════════════════════════════════════════════════
async function scrapeIndeed(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        // Use the India domain for India queries, .com otherwise
        const isIndia = location.toLowerCase().includes("india") || /\b(bangalore|hyderabad|mumbai|pune|chennai|delhi|kolkata|noida|gurugram)\b/i.test(location);
        const domain = isIndia ? "in.indeed.com" : "www.indeed.com";
        const url = `https://${domain}/jobs?q=${q}&l=${loc}&sort=date`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: ScrapedJob[] = [];

        // Indeed uses various card selectors
        $(".job_seen_beacon, .jobsearch-ResultsList .result, [data-jk], .tapItem, .job-card-list .cardOutline").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find(".jobTitle span, h2.jobTitle a, [class*='jobTitle'] span, a[data-jk]").first().text().trim();
            const company = $(el).find(".companyName, [data-testid='company-name'], .company, [class*='company']").first().text().trim();
            const locText = $(el).find(".companyLocation, [data-testid='text-location'], .location, [class*='location']").first().text().trim();
            const jk = $(el).attr("data-jk") || $(el).find("a[data-jk]").attr("data-jk");
            const href = $(el).find("a[href*='/rc/clk'], a[href*='/viewjob'], a[href*='jk=']").first().attr("href");
            const jobUrl = jk
                ? `https://${domain}/viewjob?jk=${jk}`
                : href
                    ? (href.startsWith("http") ? href : `https://${domain}${href}`)
                    : "";

            if (title && title.length > 3 && jobUrl) {
                jobs.push({
                    title, company: company || "Various Companies",
                    location: locText || location,
                    description: `${title} at ${company || "Various Companies"} — Indeed`,
                    job_url: jobUrl, source: "indeed",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });
        return jobs;
    } catch (err: any) {
        console.warn("[MCP] Indeed failed:", err.message);
        return [];
    }
}


// ═══════════════════════════════════════════════════════════════
// SOURCE 8: SimplyHired (HTML scrape — global)
// ═══════════════════════════════════════════════════════════════
async function scrapeSimplyHired(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        const url = `https://www.simplyhired.com/search?q=${q}&l=${loc}&sb=dd`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: ScrapedJob[] = [];

        $("[data-testid='searchSerpJob'], .SerpJob, article[class*='job'], .css-0").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find("h2 a, [data-testid='searchSerpJobTitle'] a, h3 a, [class*='jobTitle']").first().text().trim();
            const company = $(el).find("[data-testid='companyName'], .jobposting-company, [class*='company']").first().text().trim();
            const locText = $(el).find("[data-testid='searchSerpJobLocation'], .jobposting-location, [class*='location']").first().text().trim();
            const link = $(el).find("h2 a, h3 a, a[href*='/job/']").first().attr("href");
            const jobUrl = link ? (link.startsWith("http") ? link : `https://www.simplyhired.com${link}`) : "";

            if (title && title.length > 3 && jobUrl) {
                jobs.push({
                    title, company: company || "Various Companies",
                    location: locText || location,
                    description: `${title} at ${company || "Various Companies"} — SimplyHired`,
                    job_url: jobUrl, source: "simplyhired",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });
        return jobs;
    } catch (err: any) {
        console.warn("[MCP] SimplyHired failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 9: Naukri (HTML scrape — India)
// ═══════════════════════════════════════════════════════════════
async function scrapeNaukri(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = query.toLowerCase().replace(/\s+/g, "-");
        const loc = location.toLowerCase().replace(/\s+/g, "-");
        const url = `https://www.naukri.com/${q}-jobs-in-${loc}?experience=0`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: ScrapedJob[] = [];

        // Naukri uses article.jobTuple or srp-jobtuple
        $("article.jobTuple, .srp-jobtuple, [class*='jobTuple'], .cust-job-tuple, .list").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find(".title, .desig, a.title, [class*='jobTitle'], [class*='desig']").first().text().trim();
            const company = $(el).find(".subTitle, .comp-name, [class*='companyInfo'] a, [class*='comp-name']").first().text().trim();
            const locText = $(el).find(".locWdth, .loc, [class*='location'], [class*='loc ']").first().text().trim();
            const link = $(el).find("a.title, a[class*='title'], a[href*='/job-listings']").first().attr("href");
            const jobUrl = link ? (link.startsWith("http") ? link : `https://www.naukri.com${link}`) : "";

            if (title && title.length > 3 && jobUrl) {
                jobs.push({
                    title, company: company || "Various Companies",
                    location: locText || location,
                    description: `${title} at ${company || "Various Companies"} — Naukri`,
                    job_url: jobUrl, source: "naukri",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });

        // Fallback: extract from JSON-LD or script data
        if (jobs.length === 0) {
            $("script[type='application/ld+json']").each((_, el) => {
                try {
                    const data = JSON.parse($(el).html() || "{}");
                    if (data["@type"] === "JobPosting" || (Array.isArray(data) && data[0]?.["@type"] === "JobPosting")) {
                        const postings = Array.isArray(data) ? data : [data];
                        for (const p of postings) {
                            if (jobs.length >= limit) break;
                            jobs.push({
                                title: p.title || "",
                                company: p.hiringOrganization?.name || "",
                                location: p.jobLocation?.address?.addressLocality || location,
                                description: (p.description || "").replace(/<[^>]*>/g, " ").substring(0, 5000),
                                job_url: p.url || "",
                                source: "naukri",
                                salary_min: null, salary_max: null,
                                posted_at: p.datePosted || new Date().toISOString(),
                            });
                        }
                    }
                } catch { /* invalid JSON-LD */ }
            });
        }

        return jobs;
    } catch (err: any) {
        console.warn("[MCP] Naukri failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE 10: Glassdoor (HTML scrape — global)
// ═══════════════════════════════════════════════════════════════
async function scrapeGlassdoor(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const url = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}&locT=C&locKeyword=${encodeURIComponent(location)}`;
        const res = await safeFetch(url);
        if (!res) return [];
        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: ScrapedJob[] = [];

        // Glassdoor job cards
        $("[data-test='jobListing'], .react-job-listing, li[data-id], .JobsList_jobListItem__wjTHv").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find("[data-test='job-title'], .job-title, a[class*='jobTitle']").first().text().trim();
            const company = $(el).find("[data-test='emp-name'], .job-search-key-l2hmii, [class*='employer']").first().text().trim();
            const locText = $(el).find("[data-test='emp-location'], .job-search-key-iii1i5, [class*='location']").first().text().trim();
            const link = $(el).find("a[href*='/job-listing/'], a[href*='/partner/']").first().attr("href");
            const jobUrl = link ? (link.startsWith("http") ? link : `https://www.glassdoor.com${link}`) : "";

            if (title && title.length > 3 && jobUrl) {
                jobs.push({
                    title, company: company || "Various Companies",
                    location: locText || location,
                    description: `${title} at ${company || "Various Companies"} — Glassdoor`,
                    job_url: jobUrl, source: "glassdoor",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });
        return jobs;
    } catch (err: any) {
        console.warn("[MCP] Glassdoor failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Main entry point for all MCP job fetching
// ═══════════════════════════════════════════════════════════════

/**
 * Scrape jobs from ALL sources in parallel.
 * This is the primary job fetching function — no API keys needed.
 */
export async function callMCPTool(
    _serverName: string,
    _toolName: string,
    args: Record<string, any>
): Promise<ScrapedJob[]> {
    const query = args.search_term || args.query || "Software Engineer";
    const location = args.location || "India";
    const limit = args.results_wanted || args.limit || 50;

    console.log(`[MCP] Scraping: "${query}" in ${location} (limit ${limit})`);

    // Determine which scrapers to run based on location
    const isIndiaSearch = /\b(india|bangalore|bengaluru|hyderabad|mumbai|pune|chennai|delhi|kolkata|noida|gurugram|gurgaon|ahmedabad|jaipur|kochi|indore)\b/i.test(location);

    // Fire all scrapers in parallel — each one is independent and fault-tolerant
    const scraperPromises: Promise<ScrapedJob[]>[] = [
        scrapeRemoteOK(query, limit),
        scrapeArbeitnow(query, limit),
        scrapeRemotive(query, limit),
        scrapeLinkedIn(query, location, limit),
        scrapeIndeed(query, location, limit),
        scrapeSimplyHired(query, location, limit),
        scrapeGoogleJobs(query, location, limit),
    ];

    // Add India-specific scrapers
    if (isIndiaSearch) {
        scraperPromises.push(
            scrapeInternshala(query, limit),
            scrapeNaukri(query, location, limit),
        );
    }

    // Add Glassdoor for non-India or broad searches
    if (!isIndiaSearch || query.toLowerCase().includes("remote")) {
        scraperPromises.push(scrapeGlassdoor(query, location, limit));
    }

    const results = await Promise.allSettled(scraperPromises);

    const all: ScrapedJob[] = [];
    const sourceStats: Record<string, number> = {};

    for (const result of results) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
            for (const job of result.value) {
                all.push(job);
                sourceStats[job.source] = (sourceStats[job.source] || 0) + 1;
            }
        }
    }

    // Deduplicate by job_url
    const seen = new Set<string>();
    const unique = all.filter(j => {
        if (!j.job_url || seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    });

    const activeSources = Object.keys(sourceStats).length;
    console.log(`[MCP] Scraped ${unique.length} unique jobs from ${activeSources} sources:`, sourceStats);

    traceStandalone({
        name: "tool:mcp_scraper",
        input: { query, location, limit },
        output: { totalJobs: unique.length, sources: sourceStats },
        metadata: { activeSources, deduplicatedCount: all.length - unique.length },
    });

    return unique.slice(0, limit);
}

/**
 * Live search — used by the route when DB results are insufficient.
 * Runs a focused subset of fast scrapers for real-time results.
 */
export async function mcpLiveSearch(query: string, location: string, limit: number = 20): Promise<ScrapedJob[]> {
    console.log(`[MCP-Live] Quick search: "${query}" in ${location}`);

    const isIndiaSearch = /\b(india|bangalore|bengaluru|hyderabad|mumbai|pune|chennai|delhi|kolkata|noida|gurugram)\b/i.test(location);

    // Use only the fastest scrapers for live search (< 5s total)
    const scraperPromises: Promise<ScrapedJob[]>[] = [
        scrapeRemoteOK(query, limit),
        scrapeRemotive(query, limit),
        scrapeLinkedIn(query, location, limit),
        scrapeIndeed(query, location, limit),
    ];

    if (isIndiaSearch) {
        scraperPromises.push(scrapeNaukri(query, location, limit));
    }

    const results = await Promise.allSettled(scraperPromises);
    const all: ScrapedJob[] = [];
    for (const r of results) {
        if (r.status === "fulfilled") all.push(...r.value);
    }

    const seen = new Set<string>();
    return all.filter(j => {
        if (!j.job_url || seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    }).slice(0, limit);
}

// ── Backward-compatible exports ──────────────────────────────
export function getMCPServerNames(): string[] {
    return ["builtin_scraper"];
}

export function getMCPServerDescription(name: string): string {
    if (name === "builtin_scraper") {
        return "Built-in multi-source job scraper (LinkedIn, Indeed, Naukri, RemoteOK, Remotive, Arbeitnow, Internshala, SimplyHired, Glassdoor, Google Jobs)";
    }
    return "Unknown";
}

export async function listMCPTools(_serverName: string): Promise<string[]> {
    return ["search_jobs", "live_search"];
}
