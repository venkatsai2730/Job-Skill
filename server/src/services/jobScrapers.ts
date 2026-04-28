// ═══════════════════════════════════════════════════════════════
// Job Scrapers — Freshersworld, Apna.co, LinkedIn (public), Indeed RSS
// Robust selectors with multiple fallback patterns
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

const SCRAPER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS: Record<string, string> = {
    "User-Agent": SCRAPER_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1"
};

// ── Freshersworld.com Scraper ───────────────────────────────
// Multiple URL patterns to maximize fresher job coverage
const FRESHERSWORLD_URLS = [
    "https://www.freshersworld.com/jobs/it-software-jobs",
    "https://www.freshersworld.com/jobs/fresher-jobs",
    "https://www.freshersworld.com/jobs/btech-jobs",
    "https://www.freshersworld.com/jobs/mca-jobs",
];

export async function fetchFreshersWorldJobs(): Promise<RawJob[]> {
    const allJobs: RawJob[] = [];
    for (const url of FRESHERSWORLD_URLS) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(25000),
                headers: HEADERS,
            });
            if (!res.ok) continue;

            const html = await res.text();
            const $ = cheerio.load(html);

            // Multiple selector strategies for robustness
            const selectors = [
                ".job-container",
                ".job-listings",
                ".job_listing_block",
                ".latest-jobs-block",
                ".job-list-item",
                "[class*='job-card']",
                "[class*='job_card']",
                ".wrap-list",
                "article[class*='job']",
            ];

            const jobElements = $(selectors.join(", "));

            jobElements.each((_: any, el: any) => {
                // Try multiple title selectors
                const title = $(el).find(".job-title, .jobtitle, h3 a, h2 a, .job_title, [class*='title'] a, a[class*='title']").first().text().trim();
                const company = $(el).find(".company-name, .company, .comp_name, [class*='company']").first().text().trim();
                const location = $(el).find(".job-location, .location, .loc, [class*='location']").first().text().trim() || "India";
                const link = $(el).find("a[href*='job'], a[href*='opening'], a").first().attr("href");
                const job_url = link?.startsWith("http") ? link : link ? `https://www.freshersworld.com${link}` : "";

                if (title && title.length > 3 && job_url) {
                    allJobs.push({
                        title,
                        company: company || "Various Companies",
                        location,
                        job_url,
                        source: "scrape",
                        posted_at: new Date().toISOString(),
                        description: `Freshersworld Listing — ${title} at ${company || "Various Companies"}. Apply directly.`,
                        category: "Internships & Fresher",
                    });
                }
            });

            // Fallback: if structured selectors fail, try extracting from links
            if (allJobs.length === 0) {
                $("a[href*='/jobs/'], a[href*='/opening/']").each((_: any, el: any) => {
                    const title = $(el).text().trim();
                    const href = $(el).attr("href") || "";
                    if (title.length > 10 && title.length < 120 && href) {
                        const job_url = href.startsWith("http") ? href : `https://www.freshersworld.com${href}`;
                        allJobs.push({
                            title,
                            company: "Various Companies",
                            location: "India",
                            job_url,
                            source: "scrape",
                            posted_at: new Date().toISOString(),
                            description: `Freshersworld Listing.`,
                            category: "Internships & Fresher",
                        });
                    }
                });
            }

            // Politeness delay
            await new Promise(r => setTimeout(r, 1500));
        } catch (err: any) {
            console.warn(`[Scraper] Freshersworld failed for ${url}:`, err.message);
        }
    }

    // Deduplicate by job_url
    const seen = new Set<string>();
    return allJobs.filter(j => {
        if (seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    });
}

// ── Apna.co Scraper ─────────────────────────────────────────
export async function fetchApnaJobs(): Promise<RawJob[]> {
    const urls = [
        "https://apna.co/jobs?category=technology",
        "https://apna.co/jobs?category=it-services",
    ];
    const allJobs: RawJob[] = [];

    for (const url of urls) {
        try {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(25000),
                headers: HEADERS,
            });
            if (!res.ok) continue;

            const html = await res.text();
            const $ = cheerio.load(html);

            // Multiple selector strategies
            const selectors = [
                ".job-card",
                ".job-listing",
                "[data-testid='job-card']",
                "[class*='JobCard']",
                "[class*='job-card']",
                "article[class*='job']",
            ];

            $(selectors.join(", ")).each((_: any, el: any) => {
                const title = $(el).find(".job-title, h3, h2, [class*='title']").first().text().trim();
                const company = $(el).find(".company-name, .company, [class*='company']").first().text().trim();
                const location = $(el).find(".location, .job-location, [class*='location']").first().text().trim() || "India";
                const link = $(el).find("a").first().attr("href");
                const job_url = link?.startsWith("http") ? link : link ? `https://apna.co${link}` : "";

                if (title && title.length > 3 && job_url) {
                    allJobs.push({
                        title,
                        company: company || "Various Companies",
                        location,
                        job_url,
                        source: "scrape",
                        posted_at: new Date().toISOString(),
                        description: `Apna.co Listing — ${title}. Apply directly at Apna.`,
                        category: "Internships & Fresher",
                    });
                }
            });

            await new Promise(r => setTimeout(r, 1500));
        } catch (err: any) {
            console.warn(`[Scraper] Apna.co failed for ${url}:`, err.message);
        }
    }

    const seen = new Set<string>();
    return allJobs.filter(j => {
        if (seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    });
}

// ── Indeed RSS Scraper (public feeds, no API key needed) ─────
const INDEED_RSS_FEEDS = [
    "https://www.indeed.com/rss?q=junior+developer&l=&sort=date",
    "https://www.indeed.com/rss?q=entry+level+software+engineer&l=&sort=date",
    "https://www.indeed.com/rss?q=fresher+developer&l=India&sort=date",
    "https://www.indeed.com/rss?q=intern+software&l=&sort=date",
];

export async function fetchIndeedRssJobs(): Promise<RawJob[]> {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false });
    const allJobs: RawJob[] = [];

    for (const feedUrl of INDEED_RSS_FEEDS) {
        try {
            const res = await fetch(feedUrl, {
                signal: AbortSignal.timeout(15000),
                headers: { "User-Agent": SCRAPER_UA },
            });
            if (!res.ok) continue;

            const xmlData = await res.text();
            const parsed = parser.parse(xmlData);
            const items = parsed?.rss?.channel?.item || [];
            const jobsArray = Array.isArray(items) ? items : [items];

            for (const item of jobsArray) {
                const fullTitle = (item.title || "").trim();
                // Indeed RSS titles are often "Job Title - Company - Location"
                const parts = fullTitle.split(" - ");
                const title = parts[0]?.trim() || fullTitle;
                const company = parts[1]?.trim() || "Various Companies";
                const location = parts[2]?.trim() || "Remote";

                if (title && item.link) {
                    allJobs.push({
                        title,
                        company,
                        location,
                        job_url: item.link,
                        source: "rss" as const,
                        posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                        description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                        category: /\b(intern|junior|entry|fresher|trainee|associate|graduate)\b/i.test(title)
                            ? "Internships & Fresher"
                            : "Software Development",
                    });
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) {
            console.warn(`[Scraper] Indeed RSS failed for ${feedUrl}:`, err.message);
        }
    }

    const seen = new Set<string>();
    return allJobs.filter(j => {
        if (seen.has(j.job_url)) return false;
        seen.add(j.job_url);
        return true;
    });
}

// ── Glassdoor RSS Scraper (public feeds) ─────────────────────
export async function fetchGlassdoorRssJobs(): Promise<RawJob[]> {
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false });
    const allJobs: RawJob[] = [];

    const feeds = [
        "https://www.glassdoor.com/partner/jobListing.htm?t.s=w-m-j&sc.keyword=junior+developer&locT=N&locId=115",
    ];

    for (const feedUrl of feeds) {
        try {
            const res = await fetch(feedUrl, {
                signal: AbortSignal.timeout(15000),
                headers: { "User-Agent": SCRAPER_UA },
            });
            if (!res.ok) continue;

            const text = await res.text();
            // Try parsing as XML/RSS first
            try {
                const parsed = parser.parse(text);
                const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
                const jobsArray = Array.isArray(items) ? items : [items];

                for (const item of jobsArray) {
                    const title = (item.title || "").trim();
                    const company = (item["employer"] || item["dc:creator"] || "").trim();
                    const link = item.link || item.url || "";

                    if (title && link) {
                        allJobs.push({
                            title,
                            company: company || "Various Companies",
                            location: "Various",
                            job_url: link,
                            source: "rss" as const,
                            posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
                            description: (item.description || "").replace(/<[^>]*>/g, " ").substring(0, 15000),
                        });
                    }
                }
            } catch {
                // Not valid RSS — skip
            }

            await new Promise(r => setTimeout(r, 1500));
        } catch (err: any) {
            console.warn(`[Scraper] Glassdoor RSS failed:`, err.message);
        }
    }

    return allJobs;
}
