/**
 * ── READABILITY SCORER ──
 * Calculates the Flesch-Kincaid Grade Level of the resume text.
 * Good for identifying if the resume is too complex (hard to read rapidly) or too simple.
 */

// Heuristic syllable counter for English words
function countSyllables(word: string): number {
    word = word.toLowerCase().trim();
    if (word.length <= 3) return 1;
    
    // Remove silent e
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    // Replace consecutive vowels with a single vowel for counting
    word = word.replace(/^y/, '');
    
    const count = word.match(/[aeiouy]{1,2}/g)?.length || 1;
    return count;
}

export function calculateFleschKincaid(text: string) {
    // 1. Clean the text of special characters to get true sentences
    const cleanText = text.replace(/[^a-zA-Z0-9\s\.\!\?]/g, ' ');
    
    // 2. Count Sentences (roughly split by ., !, ?)
    // Bullet points acts as sentences in resumes
    let sentences = (cleanText.match(/[\.\!\?]+/g) || []).length;
    
    // Fallback: If no punctuation, split by newlines as sentences
    if (sentences === 0) {
        sentences = text.split('\n').filter(l => l.trim().length > 5).length;
    }
    // Prevent Division by 0
    if (sentences === 0) sentences = 1;

    // 3. Count Words
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length || 1;

    // 4. Count Syllables
    const totalSyllables = words.reduce((acc, word) => acc + countSyllables(word), 0);

    // 5. Formula: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    const gradeLevel = (0.39 * (wordCount / sentences)) + (11.8 * (totalSyllables / wordCount)) - 15.59;

    return {
        wordCount,
        sentences,
        totalSyllables,
        gradeLevel: Math.max(0, parseFloat(gradeLevel.toFixed(1))), // Clamp to 0
    };
}
