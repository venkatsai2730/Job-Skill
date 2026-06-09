import * as cheerio from 'cheerio';

async function test() {
    console.log("Fetching Google Jobs...");
    const res = await fetch('https://www.google.com/search?q=intern+jobs+india&ibp=htl;jobs&hl=en', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    let jobs = [];
    $('.BjJfJf, .vzgEcf, .PUp5mb, li, div[role="treeitem"]').each((i, el) => {
        const text = $(el).text();
        if(text.includes('Days') || text.includes('Hours') || text.length > 50) {
            // Probably a job card
        }
    });

    // Actually, Google Jobs JSON-LD or script blocks
    $('script').each((i, el) => {
        const content = $(el).html() || '';
        if(content.includes('company_name')) {
            console.log("Found company_name in script", i);
        }
    });
}

test();
