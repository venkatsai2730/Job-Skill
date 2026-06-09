/**
 * ── GAP DETECTOR ──
 * Analyzes the parsed experience dates to find employment gaps larger than 6 months.
 */

export function detectEmploymentGaps(experienceItems: { dates: string }[]) {
    const issues: string[] = [];
    if (!experienceItems || experienceItems.length < 2) return issues;

    const parsedDates: { startYear: number, endYear: number, raw: string }[] = [];

    // Simple heuristic to extract years and roughly order them
    for (const exp of experienceItems) {
        const str = exp.dates.toLowerCase();
        const yearMatches = str.match(/\b(19|20)\d{2}\b/g);
        
        if (yearMatches && yearMatches.length > 0) {
            const isPresent = str.includes("present") || str.includes("current") || str.includes("now");
            const startYear = parseInt(yearMatches[0], 10);
            const endYear = isPresent ? new Date().getFullYear() : parseInt(yearMatches[yearMatches.length - 1], 10);
            
            parsedDates.push({ startYear, endYear, raw: str });
        }
    }

    // Sort descending by endYear
    parsedDates.sort((a, b) => b.endYear - a.endYear);

    // Look for gaps of > 1 year between consecutive roles
    for (let i = 0; i < parsedDates.length - 1; i++) {
        const currentRole = parsedDates[i];
        const nextRole = parsedDates[i + 1]; // "Next" chronologically backwards
        
        // If current role started in 2022, but the role immediately before it ended in 2020:
        const gap = currentRole.startYear - nextRole.endYear;
        
        if (gap > 1) {
            issues.push(`A potential employment gap of ${gap} years detected between ${nextRole.endYear} and ${currentRole.startYear}. Consider addressing this in a summary or cover letter if relevant.`);
        }
    }

    return issues;
}
