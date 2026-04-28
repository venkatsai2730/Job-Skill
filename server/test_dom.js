const cheerio = require('cheerio');
fetch('https://www.google.com/search?q=intern+jobs+india&ibp=htl;jobs&hl=en', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}).then(r => r.text()).then(html => {
    const $ = cheerio.load(html);
    let count = 0;
    $('*').each((i, el) => {
        const t = $(el).text();
        if(t.includes('Software') || t.includes('Intern')) count++;
    });
    console.log('Class-based matches:', count);
    
    // Test alternative JSON-LD block
    let ldScripts = $('script[type="application/ld+json"]').length;
    console.log('JSON-LD scripts:', ldScripts);
});
