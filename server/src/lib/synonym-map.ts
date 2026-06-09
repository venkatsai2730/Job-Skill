/**
 * ATS Semantic Fuzzy Matcher & Synonym Map.
 * Prevents unfair ATS penalties for acronyms vs full names.
 */

const SYNONYM_MAP: Record<string, string[]> = {
    // Cloud & DevOps
    "aws": ["amazon web services", "amazon cloud", "aws cloud"],
    "gcp": ["google cloud", "google cloud platform"],
    "k8s": ["kubernetes"],
    "docker": ["containers", "containerization"],
    "ci/cd": ["continuous integration", "continuous deployment", "continuous delivery", "cicd"],
    // Frontend
    "js": ["javascript", "ecmascript"],
    "ts": ["typescript"],
    "react": ["react.js", "reactjs", "react native"],
    "vue": ["vue.js", "vuejs"],
    "node": ["node.js", "nodejs"],
    "a11y": ["accessibility"],
    "i18n": ["internationalization"],
    // Backend & DBs
    "sql": ["structured query language", "mysql", "postgresql", "postgres"],
    "nosql": ["mongo", "mongodb", "cassandra"],
    "ml": ["machine learning"],
    "ai": ["artificial intelligence", "generative ai", "llm"],
    "nlp": ["natural language processing"],
    // Security & Networking
    "vpn": ["virtual private network"],
    "tls": ["transport layer security", "ssl"],
    // HR & Biz
    "sme": ["subject matter expert"],
    "kpi": ["key performance indicator"],
    "roi": ["return on investment"],
    "seo": ["search engine optimization"],
    "qa": ["quality assurance", "testing"]
};

/**
 * Normalizes text so that searching for 'aws' will safely match 'amazon web services', and vice/versa.
 */
export function normalizeSynonyms(text: string): string {
    let expandedText = text.toLowerCase();
    
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
        // If the text has any synonym, append the base key so exact matchers find it
        if (synonyms.some(syn => expandedText.includes(syn))) {
            expandedText += ` ${key} `;
        }
        // If the text has the base key, append all synonyms
        const exactKeyRegex = new RegExp(`\\b${key}\\b`, 'i');
        if (exactKeyRegex.test(expandedText)) {
            expandedText += ` ${synonyms.join(" ")} `;
        }
    }
    
    return expandedText;
}

/** Alias for backward compatibility */
export const expandSynonyms = normalizeSynonyms;

/**
 * Detects implicit skills based on context (synonyms).
 */
export function inferSkills(text: string): string[] {
    const lowerText = text.toLowerCase();
    const inferred: string[] = [];
    
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
        // If the text has any synonym but doesn't explicitly mention the standardized key
        if (synonyms.some(syn => lowerText.includes(syn))) {
            const exactKeyRegex = new RegExp(`\\b${key}\\b`, 'i');
            if (!exactKeyRegex.test(lowerText)) {
                inferred.push(key);
            }
        }
    }
    
    return [...new Set(inferred)];
}
