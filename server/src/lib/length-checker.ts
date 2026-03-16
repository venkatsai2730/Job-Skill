/**
 * ── LENGTH CHECKER ──
 * Analyzes bullet count, word count, and section depth depending on candidate experience level.
 */

export function checkLength(wordCount: number, level: "Fresher" | "Medium" | "Senior", totalBullets: number) {
    const issues: string[] = [];
    
    // 1. Overall Length
    if (level === "Fresher") {
        if (wordCount < 250) issues.push(`Your resume is very short (${wordCount} words). Add more details to projects and coursework.`);
        else if (wordCount > 600) issues.push(`Your resume is too long (${wordCount} words). Fresher resumes should rarely exceed 1 page (400-500 words).`);
    } else if (level === "Medium") {
        if (wordCount < 350) issues.push(`Your resume is quite brief (${wordCount} words) given your experience. Detail your impact more thoroughly.`);
        else if (wordCount > 900) issues.push(`Your resume is lengthy (${wordCount} words). Consider trimming older roles to keep it concicse and punchy.`);
    } else {
        if (wordCount < 400) issues.push(`Senior resumes usually require more detail (${wordCount} words found). Mention high-level strategy and team management.`);
        else if (wordCount > 1300) issues.push(`Your resume is extremely long (${wordCount} words). Try to summarize experience older than 10 years.`);
    }

    // 2. Bullet Point Density
    if (totalBullets < 3 && level !== "Fresher") {
        issues.push("Very few bullet points detected. Use bulleted lists to describe your experience rather than dense paragraphs.");
    } else if (totalBullets > 20 && level === "Fresher") {
        // Just an alert, not necessarily penalizing heavily
        issues.push("You have a high number of bullet points. Ensure they only highlight the most critical achievements.");
    }

    return issues;
}
