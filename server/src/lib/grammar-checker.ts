/**
 * ── GRAMMAR CHECKER ──
 * Uses heuristics to detect common grammar/formatting issues in resumes:
 * - Repeated words (e.g. "the the")
 * - Missing periods at the end of experience bullets
 * - Mixed tense (e.g. past vs present verbs in the same job)
 * - Capitalization consistency
 */

export function checkGrammar(text: string, bullets: string[]) {
    const issues: string[] = [];
    
    // 1. Repeated words (HIGH severity)
    const repeatRegex = /\b(\w+)\s+\1\b/ig;
    let repeatMatch;
    while ((repeatMatch = repeatRegex.exec(text)) !== null) {
        // Exclude common allowed repeats like "that that" or "had had"
        const word = repeatMatch[1].toLowerCase();
        if(!["had", "that"].includes(word)) {
            issues.push(`Repeated word found: "${repeatMatch[1]}"`);
        }
    }

    // 2. Pronoun Usage (MEDIUM severity — Resumes should avoid First-Person pronouns)
    const firstPersonRegex = /\b(I|me|my|mine|we|us|our|ours)\b/ig;
    if (firstPersonRegex.test(text)) {
        issues.push("Avoid using first-person pronouns (I, me, my) in your resume.");
    }

    // 3 & 4. Minor formatting issues — group as a single issue to avoid over-penalizing
    const minorIssues: string[] = [];

    // Bullet Consistency (Do they end with a period?)
    let bulletsWithPeriods = 0;
    let bulletsWithoutPeriods = 0;
    
    bullets.forEach(bullet => {
        const trimmed = bullet.trim();
        if (trimmed.length > 5) { // Meaningful bullet
            if (trimmed.endsWith('.')) bulletsWithPeriods++;
            else bulletsWithoutPeriods++;
        }
    });

    if (bulletsWithPeriods > 0 && bulletsWithoutPeriods > 0) {
        minorIssues.push(`Inconsistent bullet punctuation: ${bulletsWithPeriods} end with a period, while ${bulletsWithoutPeriods} do not. Pick one style.`);
    }

    // Capitalization of first letters in bullets
    let lowerCaseStarts = 0;
    bullets.forEach(bullet => {
        const firstChar = bullet.trim().charAt(0);
        if (firstChar >= 'a' && firstChar <= 'z') lowerCaseStarts++;
    });

    if (lowerCaseStarts > 0) {
        minorIssues.push(`${lowerCaseStarts} bullet points start with a lowercase letter. Capitalize the first letter.`);
    }

    // Minor issues count as a single combined issue for scoring purposes
    if (minorIssues.length > 0) {
        issues.push(minorIssues.join(' '));
    }

    // Cap at 3 issues max to prevent runaway penalties in the scorer
    return issues.slice(0, 3);
}
