const cheerio = require('cheerio');
fetch('https://www.linkedin.com/jobs/search/?keywords=intern&location=India', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}).then(r => r.text()).then(html => {
    const $ = cheerio.load(html);
    const jobs = [];
    $('.base-card').each((_, el) => {
        const title = $(el).find('.base-search-card__title').text().trim();
        const company = $(el).find('.base-search-card__subtitle').text().trim();
        const loc = $(el).find('.job-search-card__location').text().trim();
        const url = $(el).find('a.base-card__full-link').attr('href');
        if(title) jobs.push({ title, company, location: loc, job_url: url, source: 'linkedin' });
    });
    console.log('LinkedIn Jobs Class-based:', jobs.length);
    console.log(jobs.slice(0, 2));
});
