import * as cheerio from "cheerio";

async function scrapeGoogleJobs(query: string, location: string, limit: number) {
    try {
        const q = encodeURIComponent(`${query} jobs in ${location}`);
        const url = `https://www.google.com/search?q=${q}&ibp=htl;jobs&hl=en`;
        console.log("fetching", url);
        const res = await fetch(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36", 
                "Accept-Language": "en-US,en;q=0.9" 
            },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) { console.log('res not ok', res.status); return []; }
        const html = await res.text();

        const jobs: any[] = [];
        const $ = cheerio.load(html);

        $("script").each((_, el) => {
            const scriptContent = $(el).html() || "";
            const jobMatches = scriptContent.matchAll(/"title"\s*:\s*"([^"]+)"[^}]*?"company_name"\s*:\s*"([^"]+)"/g);
            for (const match of jobMatches) {
                if (jobs.length >= limit) break;
                jobs.push({
                    title: match[1].replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
                    company: match[2],
                });
            }
        });
        return jobs.slice(0, limit);
    } catch (err: any) {
        console.warn(err.message);
        return [];
    }
}

scrapeGoogleJobs("software engineer intern", "India", 10).then(res => {
    console.log("found:", res.length);
    console.dir(res);
});
