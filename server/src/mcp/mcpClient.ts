// ═══════════════════════════════════════════════════════════════
// MCP Client Layer — Built-in job scraping (NO external deps)
//
// WHY: The original version spawned `npx -y jobspy-mcp-server`
//      but that npm package doesn't exist (it's Python-only).
//      This replaces it with a self-contained Node.js scraper
//      that hits free, public job board pages directly.
//      → No Python, no RapidAPI key, no rate-limit 429s.
// ═══════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";
import { traceStandalone } from "../observability/langfuse.js";

// ── Public scraping sources (zero API keys) ─────────────────
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface ScrapedJob {
    title: string;
    company: string;
    location: string;
    description: string;
    job_url: string;
    source: string;
    salary_min: number | null;
    salary_max: number | null;
    posted_at: string;
}

// ── 1. Google Jobs via SerpAPI-style scraping ────────────────
//    Scrapes Google's public job listing HTML (no API key).
async function scrapeGoogleJobs(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(`${query} jobs in ${location}`);
        const url = `https://www.google.com/search?q=${q}&ibp=htl;jobs&hl=en`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const html = await res.text();

        // Google embeds job data in script tags as JSON-LD
        const jobs: ScrapedJob[] = [];
        const $ = cheerio.load(html);

        // Try extracting from structured data in script tags
        $("script").each((_, el) => {
            const scriptContent = $(el).html() || "";
            // Look for job posting structured data
            const jobMatches = scriptContent.matchAll(/"title"\s*:\s*"([^"]+)"[^}]*?"company_name"\s*:\s*"([^"]+)"/g);
            for (const match of jobMatches) {
                if (jobs.length >= limit) break;
                jobs.push({
                    title: match[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
                    company: match[2],
                    location: location,
                    description: `${match[1]} at ${match[2]}`,
                    job_url: `https://www.google.com/search?q=${encodeURIComponent(match[1] + " " + match[2] + " job")}`,
                    source: "google_jobs",
                    salary_min: null,
                    salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });

        return jobs.slice(0, limit);
    } catch (err: any) {
        console.warn("[MCP-Scraper] Google Jobs scrape failed:", err.message);
        return [];
    }
}

// ── 2. RemoteOK — Free JSON API (no key) ────────────────────
async function scrapeRemoteOK(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const res = await fetch("https://remoteok.com/api", {
            headers: { "User-Agent": "JobSkillAI/2.0" },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const items = Array.isArray(data) ? data.slice(1) : []; // First item is metadata

        const queryLower = query.toLowerCase();
        const filtered = items.filter((j: any) => {
            const text = `${j.position || ""} ${j.description || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
            return queryLower.split(" ").some(word => text.includes(word));
        });

        return filtered.slice(0, limit).map((j: any) => ({
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
        console.warn("[MCP-Scraper] RemoteOK failed:", err.message);
        return [];
    }
}

// ── 3. Arbeitnow — Free public API (no key) ─────────────────
async function scrapeArbeitnow(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const res = await fetch(`https://www.arbeitnow.com/api/job-board-api`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const items = data?.data || [];

        const queryLower = query.toLowerCase();
        const filtered = items.filter((j: any) => {
            const text = `${j.title || ""} ${j.description || ""} ${(j.tags || []).join(" ")}`.toLowerCase();
            return queryLower.split(" ").some(word => text.includes(word));
        });

        return filtered.slice(0, limit).map((j: any) => ({
            title: j.title || "",
            company: j.company_name || "",
            location: j.location || "Remote",
            description: (j.description || "").replace(/<[^>]*>/g, " ").substring(0, 10000),
            job_url: j.url || "",
            source: "arbeitnow",
            salary_min: null,
            salary_max: null,
            posted_at: j.created_at ? new Date(j.created_at * 1000).toISOString() : new Date().toISOString(),
        }));
    } catch (err: any) {
        console.warn("[MCP-Scraper] Arbeitnow failed:", err.message);
        return [];
    }
}

// ── 4. Remotive — Free RSS → JSON (no key) ──────────────────
async function scrapeRemotive(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const res = await fetch(`https://remotive.com/api/remote-jobs?search=${q}&limit=${limit}`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const items = data?.jobs || [];

        return items.slice(0, limit).map((j: any) => ({
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
        console.warn("[MCP-Scraper] Remotive failed:", err.message);
        return [];
    }
}

// ── 5. Internshala scraper (free, India-focused) ─────────────
async function scrapeInternshala(query: string, limit: number): Promise<ScrapedJob[]> {
    try {
        // Internshala uses /internships/keywords-xyz for search
        const q = encodeURIComponent(query.toLowerCase());
        const url = `https://internshala.com/internships/keywords-${q}`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);

        const jobs: ScrapedJob[] = [];
        $(".individual_internship, .individual-job").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find(".job-title-href, .heading_4_5 a").first().text().trim();
            const company = $(el).find(".company-name, .company_name a").first().text().trim();
            const loc = $(el).find(".location_link, .locations a").map((_, l) => $(l).text().trim()).get().join(", ") || "India";
            const link = $(el).attr("data-href") || $(el).find(".job-title-href, .heading_4_5 a").attr("href");
            const jobUrl = link ? (link.startsWith("http") ? link : `https://internshala.com${link}`) : "";

            if (title && company && jobUrl) {
                jobs.push({
                    title, company, location: loc, description: `${title} at ${company}`,
                    job_url: jobUrl, source: "internshala",
                    salary_min: null, salary_max: null,
                    posted_at: new Date().toISOString(),
                });
            }
        });

        return jobs;
    } catch (err: any) {
        console.warn("[MCP-Scraper] Internshala failed:", err.message);
        return [];
    }
}

// ── 6. LinkedIn Public Scraper ─────────────
async function scrapeLinkedIn(query: string, location: string, limit: number): Promise<ScrapedJob[]> {
    try {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        const url = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}`;
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const html = await res.text();
        const $ = cheerio.load(html);

        const jobs: ScrapedJob[] = [];
        $(".base-card").each((_, el) => {
            if (jobs.length >= limit) return;
            const title = $(el).find(".base-search-card__title").text().trim();
            const company = $(el).find(".base-search-card__subtitle").text().trim();
            const locText = $(el).find(".job-search-card__location").text().trim();
            const link = $(el).find("a.base-card__full-link").attr("href");

            if (title && company && link) {
                // Determine category dynamically (avoids senior leakage into Fresher)
                const isIntern = title.toLowerCase().includes("intern") || title.toLowerCase().includes("fresher");
                
                jobs.push({
                    title, company, location: locText || location, description: `${title} at ${company}`,
                    job_url: link.split("?")[0], source: "linkedin",
                    salary_min: null, salary_max: null,
                    category: isIntern ? "Internships & Fresher" : "Software Development",
                    posted_at: new Date().toISOString(),
                });
            }
        });

        return jobs;
    } catch (err: any) {
        console.warn("[MCP-Scraper] LinkedIn failed:", err.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — Drop-in replacement for old callMCPTool()
// ═══════════════════════════════════════════════════════════════

export async function callMCPTool(
    _serverName: string,
    _toolName: string,
    args: Record<string, any>
): Promise<ScrapedJob[]> {
    const query = args.search_term || args.query || "Software Engineer";
    const location = args.location || "India";
    const limit = args.results_wanted || args.limit || 20;

    console.log(`[MCP] Built-in scraper: "${query}" in ${location} (limit ${limit})`);

    // Fire all scrapers in parallel, combine results.
    // We pass `limit` to all scrapers so if some fail, the others can fulfill the request.
    const [google, remoteok, arbeitnow, remotive, internshala, linkedin] = await Promise.allSettled([
        scrapeGoogleJobs(query, location, limit),
        scrapeRemoteOK(query, limit),
        scrapeArbeitnow(query, limit),
        scrapeRemotive(query, limit),
        scrapeInternshala(query, limit),
        scrapeLinkedIn(query, location, limit)
    ]);

    const all: ScrapedJob[] = [];
    for (const result of [google, remoteok, arbeitnow, remotive, internshala, linkedin]) {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
            all.push(...result.value);
        }
    }

    // Deduplicate by job_url
    const seen = new Set<string>();
    const unique = all.filter(j => {
        if (!j.job_url || seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    });

    console.log(`[MCP] Scraped ${unique.length} jobs from ${[google, remoteok, arbeitnow, remotive, internshala].filter(r => r.status === "fulfilled" && (r.value as any[]).length > 0).length} sources`);

    // Trace MCP tool call
    traceStandalone({
        name: "tool:mcp_scraper",
        input: { query, location, limit },
        output: { totalJobs: unique.length },
        metadata: { sources: 4, deduplicatedCount: all.length - unique.length },
    });

    return unique.slice(0, limit);
}

// ── Backward-compatible exports ──────────────────────────────
export function getMCPServerNames(): string[] {
    return ["builtin_scraper"];
}

export function getMCPServerDescription(name: string): string {
    if (name === "builtin_scraper") return "Built-in multi-source job scraper (RemoteOK, Arbeitnow, Remotive, Internshala)";
    return "Unknown";
}

export async function listMCPTools(_serverName: string): Promise<string[]> {
    return ["search_jobs"];
}
