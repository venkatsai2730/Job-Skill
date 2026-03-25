// ═══════════════════════════════════════════════════════════════
// Job Scrapers — Freshersworld, Apna.co
// NOTE: NCS Government Portal scraper has been removed (no gov/PSU jobs)
// ═══════════════════════════════════════════════════════════════

import * as cheerio from "cheerio";

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

const SCRAPER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADERS = {
    "User-Agent": SCRAPER_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1"
};

// ── Freshersworld.com Scraper ───────────────────────────────
export async function fetchFreshersWorldJobs(): Promise<RawJob[]> {
    try {
        const url = "https://www.freshersworld.com/jobs/it-software-jobs";
        const res = await fetch(url, {
            signal: AbortSignal.timeout(25000),
            headers: HEADERS,
        });
        if (!res.ok) return [];

        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: RawJob[] = [];

        $(".job-container, .job-listings, .job_listing_block, .latest-jobs-block").each((_: any, el: any) => {
            const title = $(el).find(".job-title, .jobtitle, h3 a, .job_title").text().trim();
            const company = $(el).find(".company-name, .company, .comp_name").text().trim();
            const location = $(el).find(".job-location, .location, .loc").text().trim() || "India";
            const link = $(el).find("a").attr("href");
            const job_url = link?.startsWith("http") ? link : link ? `https://www.freshersworld.com${link}` : "";

            if (title && job_url) {
                jobs.push({
                    title,
                    company: company || "Various Companies",
                    location,
                    job_url,
                    source: "scrape",
                    posted_at: new Date().toISOString(),
                    description: `Freshersworld Listing. Apply directly at Freshersworld.`,
                    category: "Internships & Fresher",
                });
            }
        });

        // Politeness delay
        await new Promise(r => setTimeout(r, 1500));
        return jobs;
    } catch (err: any) {
        console.warn("[Scraper] Freshersworld failed:", err.message);
        return [];
    }
}

// ── Apna.co Scraper ─────────────────────────────────────────
export async function fetchApnaJobs(): Promise<RawJob[]> {
    try {
        const url = "https://apna.co/jobs?category=technology";
        const res = await fetch(url, {
            signal: AbortSignal.timeout(25000),
            headers: HEADERS,
        });
        if (!res.ok) return [];

        const html = await res.text();
        const $ = cheerio.load(html);
        const jobs: RawJob[] = [];

        $(".job-card, .job-listing, [data-testid='job-card']").each((_: any, el: any) => {
            const title = $(el).find(".job-title, h3, h2").first().text().trim();
            const company = $(el).find(".company-name, .company").first().text().trim();
            const location = $(el).find(".location, .job-location").first().text().trim() || "India";
            const link = $(el).find("a").attr("href");
            const job_url = link?.startsWith("http") ? link : link ? `https://apna.co${link}` : "";

            if (title && job_url) {
                jobs.push({
                    title,
                    company: company || "Various Companies",
                    location,
                    job_url,
                    source: "scrape",
                    posted_at: new Date().toISOString(),
                    description: `Apna.co Listing. Apply directly at Apna.`,
                    category: "Field & Operations",
                });
            }
        });

        await new Promise(r => setTimeout(r, 1500));
        return jobs;
    } catch (err: any) {
        console.warn("[Scraper] Apna.co failed:", err.message);
        return [];
    }
}
