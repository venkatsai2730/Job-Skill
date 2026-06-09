const cheerio = require('cheerio');

async function scrapeGoogleJobs(query, location, limit) {
    try {
        const q = encodeURIComponent(`${query} jobs in ${location}`);
        const url = `https://www.google.com/search?q=${q}&ibp=htl;jobs&hl=en`;
        console.log("fetching", url);
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) { console.log('res not ok', res.status); return []; }
        const html = await res.text();

        // Google embeds job data in script tags as JSON-LD
        const jobs = [];
        const $ = cheerio.load(html);

        // Try extracting from structured data in script tags
        $("script").each((_, el) => {
            const scriptContent = $(el).html() || "";
            // Look for job posting structured data
            const jobMatches = scriptContent.matchAll(/"title"\s*:\s*"([^"]+)"[^}]*?"company_name"\s*:\s*"([^"]+)"/g);
            for (const match of jobMatches) {
                if (jobs.length >= limit) break;
                jobs.push({
                    title: match[1],
                    company: match[2],
                });
            }
        });
        return jobs.slice(0, limit);
    } catch (err) {
        console.warn(err.message);
        return [];
    }
}

scrapeGoogleJobs("software engineer intern", "India", 10).then(console.log);
