import { GLOBAL_TECH_SKILLS, GLOBAL_CERTIFICATIONS, getIndiaKeywordsPoints } from './keywords.js';
import { normalizeSynonyms, inferSkills } from './synonym-map.js';
import { calculateFleschKincaid } from './readability-scorer.js';
import { checkGrammar } from './grammar-checker.js';
import { checkLength } from './length-checker.js';
import { detectEmploymentGaps } from './gap-detector.js';
import { POWER_VERBS } from './bullet-scorer.js';
export interface ParsedSections {
    summary: string;
    experience: { title: string; company: string; dates: string; bullets: string[] }[];
    education: { degree: string; school: string; dates: string; gpa: string; courses: string[] }[];
    skills: { category: string; items: string[] }[];
    projects: { name: string; description: string; tech: string[] }[];
}

export interface ATSIssue {
    type: "warning" | "success";
    text: string;
    category: "Impact" | "ATS" | "Style" | "Advanced" | "Bonus";
    fixId?: string;
}

export interface AdvancedATSResult {
    score: number;
    label: string;
    level: "Fresher" | "Medium" | "Senior";
    abVariant?: "variant_a" | "variant_b";
    atsRisk: "LOW" | "MEDIUM" | "HIGH";
    indiaAtsScore: number;
    breakdown: {
        impact: { score: number; max: 35 };
        ats: { score: number; max: 25 };
        style: { score: number; max: 25 };
        advanced: { score: number; max: 15 };
    };
    issues: ATSIssue[];
    keywords: { found: string[]; missing: string[]; total: number; matched: number };
    inferredSkills: string[];
}

// Use the comprehensive POWER_VERBS from bullet-scorer (160+ verbs) instead of a tiny 29-verb list
// Also add verb stem matching so "improving" matches "improved", "conducting" matches "conducted"
function matchesActionVerb(text: string): boolean {
    const lowerText = text.toLowerCase();
    // Direct match against 160+ power verbs
    for (const verb of POWER_VERBS) {
        if (lowerText.includes(verb)) return true;
    }
    // Stem matching: handle gerund (-ing), present tense, and -s/-es forms
    const words = lowerText.split(/\s+/);
    for (const word of words.slice(0, 3)) { // Only check first 3 words
        const cleaned = word.replace(/[^a-z]/g, '');
        if (!cleaned || cleaned.length < 4) continue;
        // Strip -ing suffix and check base form + 'd'/'ed'
        if (cleaned.endsWith('ing')) {
            const stem = cleaned.slice(0, -3); // "improving" → "improv"
            if (POWER_VERBS.has(stem + 'ed') || POWER_VERBS.has(stem + 'e') || POWER_VERBS.has(stem + 'ed'.replace(/t$/, 'ted'))) return true;
            // Handle doubling: "planning" → "plan" → "planned"
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
                const shortStem = stem.slice(0, -1);
                if (POWER_VERBS.has(shortStem + 'ed') || POWER_VERBS.has(shortStem + 'e')) return true;
            }
            // Direct: "conducting" → "conducted" (remove 'ing', add 'ed')
            if (POWER_VERBS.has(stem + 'ed') || POWER_VERBS.has(cleaned.slice(0, -3) + 'ed')) return true;
            // "reducing" → "reduc" + "ed" = "reduced" ✓ (handled above)
            // "enabling" → "enabl" → need "enabled" → stem + 'ed' = "enabl" + "ed" ≠ "enabled"
            // Try: strip 'ing', add 'e' + 'd'
            if (POWER_VERBS.has(stem + 'e' + 'd')) return true;
        }
        // Strip -s/-es suffix
        if (cleaned.endsWith('es') && POWER_VERBS.has(cleaned.slice(0, -2))) return true;
        if (cleaned.endsWith('s') && !cleaned.endsWith('ss') && POWER_VERBS.has(cleaned.slice(0, -1))) return true;
    }
    return false;
}

const WEAK_VERBS = [
    "helped", "assisted", "responsible for", "duties included", "worked on", "handled"
];

// Determine level based on experience dates
function detectLevel(sections: ParsedSections): "Fresher" | "Medium" | "Senior" {
    if (sections.experience.length === 0) return "Fresher";
    
    // Very rough heuristic to calculate total active years
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    
    sections.experience.forEach(exp => {
        const matches = exp.dates.match(/\b(19|20)\d{2}\b/g);
        if (matches) {
            matches.forEach(m => {
                const yr = parseInt(m, 10);
                if (yr < minYear) minYear = yr;
            });
        }
    });

    const yearsOfExp = currentYear - minYear;
    if (yearsOfExp < 2) return "Fresher";
    if (yearsOfExp <= 5) return "Medium";
    return "Senior";
}

function getUserIdHash(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

// LEVEL 1: CORE GLOBAL (Impact 35, ATS 25, Style 25, Advanced 15)
export function computeAdvancedATS(
    sections: ParsedSections, 
    rawText: string, 
    userId?: string,
    metadata?: { fileSizeMB?: number; isPdf?: boolean; fileName?: string }
): AdvancedATSResult {
    const issues: ATSIssue[] = [];
    const normalizedText = normalizeSynonyms(rawText);
    const lowerText = normalizedText.toLowerCase();
    const level = detectLevel(sections);
    const levelLower = level.toLowerCase() as "fresher" | "medium" | "senior";

    // ── A/B TESTING SPLIT ──
    let abVariant: "variant_a" | "variant_b" = "variant_a";
    if (userId) {
        const hash = getUserIdHash(userId);
        abVariant = hash % 2 === 0 ? "variant_a" : "variant_b";
    }

    // ── SCORING CATEGORIES (Industry Standard Weights) ──
    let impactScore = 0; // Max 35
    let atsScore = 0;    // Max 25
    let styleScore = 0;  // Max 25
    let advancedScore = 0; // Max 15 (includes global tech + india keywords)

    // ──────────────────────────────────────────────
    // 1. IMPACT (35 pts max)
    // ──────────────────────────────────────────────
    // ──────────────────────────────────────────────
    // 1. IMPACT (35 pts max)
    // ──────────────────────────────────────────────
    const allBullets = sections.experience.flatMap((e) => e.bullets);
    const projectBullets = sections.projects.flatMap(p => {
        // Evaluate project descriptions as bullets if no bullets are provided
        return p.description ? p.description.split(/[.\n]+/).filter(s => s.trim().length > 20) : [];
    });
    // For impact analysis (quantification, strong verbs), use only actionable bullets, not raw paragraphs
    const allActionText = [...allBullets, ...projectBullets];

    if (allActionText.length > 0) {
        // Quantification (Numbers, %, $, ₹) — Up to 17 pts
        const quantified = allActionText.filter(b => /\d+/.test(b) || /%|\$|₹|lpa|metric/.test(b));
        const quantRatio = quantified.length / allActionText.length;
        
        let qScore = Math.round(quantRatio * 17);
        impactScore += qScore;
        
        if (quantRatio >= 0.4) issues.push({ type: "success", text: `Strong quantification (${quantified.length}/${allActionText.length} bullets have metrics)`, category: "Impact" });
        else issues.push({ type: "warning", text: `Low quantification. Add more numbers, %, and specific metrics to your bullets.`, category: "Impact", fixId: "low_quantification" });

        // Action Verbs (STAR Method) — Up to 13 pts
        let verbCount = 0;
        allActionText.forEach(bullet => {
            if (matchesActionVerb(bullet)) verbCount++;
        });
        
        const verbRatio = verbCount / allActionText.length;
        let vScore = Math.round(verbRatio * 13);
        impactScore += vScore;

        if (verbRatio >= 0.5) issues.push({ type: "success", text: `Excellent use of strong action verbs.`, category: "Impact" });
        else issues.push({ type: "warning", text: `Start more bullet points with strong action verbs (e.g., spearheaded, architected).`, category: "Impact", fixId: "weak_action_verbs" });

        // Penalize Weak Verbs — Up to 5 pts
        const hasWeak = WEAK_VERBS.some(w => lowerText.includes(w));
        if (!hasWeak) {
            impactScore += 5;
            issues.push({ type: "success", text: `No passive/weak language detected.`, category: "Impact" });
        } else {
            issues.push({ type: "warning", text: `Avoid weak phrases like "responsible for" or "helped with". Focus on your ownership.`, category: "Impact", fixId: "weak_verbs" });
        }

        // --- RESUME WORDED STYLE CHECKS ---
        
        // 1. Repetition Check
        const firstWords = allActionText.map(b => b.trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toLowerCase()).filter(w => w.length > 3);
        const wordCounts = firstWords.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const repeatedVerbs = Object.keys(wordCounts).filter(w => wordCounts[w] >= 3);
        if (repeatedVerbs.length > 0) {
            issues.push({ type: "warning", text: `Repetition: You started 3+ bullets with "${repeatedVerbs[0]}". Vary your action verbs.`, category: "Style", fixId: "repetitive_verbs" });
            styleScore = Math.max(0, styleScore - 2);
        } else {
            issues.push({ type: "success", text: `Great variety in action verbs. No repetitive exact matches found.`, category: "Style" });
        }

        // 2. Core Competencies (Leadership, Teamwork, Drive)
        const leadershipMatch = /\b(managed|led|directed|mentored|spearheaded|orchestrated|supervised|oversaw)\b/i.test(rawText);
        const teamworkMatch = /\b(collaborated|partnered|coordinated|communicated|co-authored|team)\b/i.test(rawText);
        const driveMatch = /\b(initiated|drove|pioneered|founded|created|achieved|surpassed|innovated)\b/i.test(rawText);
        
        if (leadershipMatch) { impactScore += 1; issues.push({ type: "success", text: "Leadership/Management skills demonstrated.", category: "Impact" }); }
        else { issues.push({ type: "warning", text: "Low Leadership score. Use words like 'managed', 'led', or 'spearheaded'.", category: "Impact", fixId: "missing_leadership" }); }
        
        if (teamworkMatch) { impactScore += 1; issues.push({ type: "success", text: "Strong Collaboration/Teamwork communication.", category: "Impact" }); }
        else { issues.push({ type: "warning", text: "Teamwork missing. Include words like 'collaborated' or 'partnered'.", category: "Impact", fixId: "missing_teamwork" }); }
        
        if (driveMatch) { impactScore += 1; issues.push({ type: "success", text: "Shows strong Drive/Initiative.", category: "Impact" }); }
        else { issues.push({ type: "warning", text: "Show more Initiative. Use words like 'initiated', 'drove', or 'created'.", category: "Impact", fixId: "missing_drive" }); }


        // Fresher floor: if a fresher has any experience/projects, guarantee minimum 10/35
        if (level === "Fresher" && impactScore < 10 && allActionText.length >= 2) {
            impactScore = 10;
        }
    } else {
        issues.push({ type: "warning", text: `No experience bullets found to score impact.`, category: "Impact", fixId: "no_bullets" });
    }

    // ──────────────────────────────────────────────
    // 2. ATS COMPATIBILITY (25 pts max)
    // ──────────────────────────────────────────────
    
    // 1. Standard Headings (5 pts)
    const hasExp = sections.experience.length > 0;
    const hasEdu = sections.education.length > 0;
    const hasSkills = sections.skills.length > 0;
    let headingScore = 0;
    if (hasExp) headingScore += 2;
    if (hasEdu) headingScore += 2;
    if (hasSkills) headingScore += 1;
    atsScore += headingScore;

    if (headingScore === 5) issues.push({ type: "success", text: "Standard ATS sections (Experience, Education, Skills) detected clearly.", category: "ATS" });
    else issues.push({ type: "warning", text: "Missing standard sections. Use standard headings like 'Experience', 'Education', 'Skills'.", category: "ATS", fixId: "missing_sections" });

    // 2. File Size (4 pts)
    if (metadata && metadata.fileSizeMB !== undefined) {
        if (metadata.fileSizeMB <= 5) {
            atsScore += 4;
            issues.push({ type: "success", text: `File size is ATS-friendly (${metadata.fileSizeMB.toFixed(1)}MB). Limit is 5MB.`, category: "ATS" });
        } else {
            issues.push({ type: "warning", text: `File exceeds 5MB (${metadata.fileSizeMB.toFixed(1)}MB). Some older ATS systems may reject it.`, category: "ATS", fixId: "file_too_large" });
        }
    } else {
        atsScore += 4; // Assume passing if not a file (e.g., raw text / LinkedIn)
    }

    // 3. Text Layer vs Scanned PDF (4 pts)
    const atsWordCount = rawText.split(/\s+/).length;
    if (metadata && metadata.isPdf && atsWordCount < 50) {
        // High risk: PDF uploaded but almost no text found = likely a scanned image
        issues.push({ type: "warning", text: "Resume appears to be a scanned image or lacks a readable text layer. ATS cannot read this.", category: "ATS", fixId: "scanned_image" });
    } else {
        atsScore += 4;
        if (metadata?.isPdf) issues.push({ type: "success", text: "Readable text layer detected. ATS can parse your content.", category: "ATS" });
    }

    // 4. Unknown/Special Characters / Font Heuristic (4 pts)
    // High junk characters usually mean a fancy font (like Wingdings or custom SVGs) that breaks ATS
    const specialChars = rawText.match(/[^\w\s\.,;:\-\(\)\[\]\|•\/]/g);
    if (!specialChars || specialChars.length < 50) {
        atsScore += 4;
        issues.push({ type: "success", text: "Standard fonts and characters detected. High parseability.", category: "ATS" });
    } else {
        atsScore += 1;
        issues.push({ type: "warning", text: "High number of unknown/special symbols detected. Avoid custom fonts or complex SVGs which break parsing.", category: "ATS", fixId: "special_chars" });
    }

    // 5. Tables & Columns check (4 pts)
    // Multiple consecutive massive gaps of spaces/tabs often indicate tables or multi-column layouts
    const blocksOfWhitespace = (rawText.match(/[ \t]{5,}/g) || []).length;
    if (blocksOfWhitespace < 15) {
        atsScore += 4;
        issues.push({ type: "success", text: "Safe single-column layout formatting detected.", category: "ATS" });
    } else {
        atsScore += 1;
        issues.push({ type: "warning", text: "Possible complex tables or multi-column layouts detected. These severely scramble ATS reading order.", category: "ATS", fixId: "multi_column" });
    }

    // 6. Header/Footer duplication check (4 pts)
    // Checks if first 100 chars and last 100 chars share significant overlaps (indicating header/footer abuse)
    const startStr = rawText.slice(0, 50).toLowerCase().replace(/\s/g, '');
    const endStr = rawText.slice(-50).toLowerCase().replace(/\s/g, '');
    // Simple fast substring heuristic
    if (startStr.length > 20 && endStr.length > 20 && (startStr.includes(endStr.slice(0, 15)) || endStr.includes(startStr.slice(0, 15)))) {
        atsScore += 2;
        issues.push({ type: "warning", text: "Important text seems to be in the document header/footer. ATS systems completely ignore headers and footers.", category: "ATS", fixId: "header_footer" });
    } else {
        atsScore += 4;
        issues.push({ type: "success", text: "No critical text lost in headers or footers.", category: "ATS" });
    }

    // 7. Unnecessary Sections (2 pts max)
    const hasUnnecessary = /\b(hobbies|references|declaration|objective)\b/i;
    if (hasUnnecessary.test(rawText)) {
        issues.push({ type: "warning", text: "Remove unnecessary sections like 'Hobbies', 'References', or 'Declaration'. Use space for skills/impact instead.", category: "Style", fixId: "unnecessary_sections" });
    } else {
        atsScore += 2;
        issues.push({ type: "success", text: "No unnecessary or outdated sections (Hobbies/References) found.", category: "ATS" });
    }


    // ──────────────────────────────────────────────
    // 3. STYLE (25 pts max)
    // ──────────────────────────────────────────────
    const wordCount = rawText.split(/\s+/).length;
    let lengthScore = 0;
    
    // Ideal length: Fresher (300-600), Mid/Senior (400-900) — Up to 10 pts
    if (level === "Fresher") {
        if (wordCount >= 250 && wordCount <= 650) lengthScore = 10;
        else if (wordCount > 650) { lengthScore = 4; issues.push({ type: "warning", text: `Resume is too long for a Fresher (${wordCount} words). Aim for 1 page.`, category: "Style", fixId: "too_long" }); }
        else { lengthScore = 3; issues.push({ type: "warning", text: `Resume is too short (${wordCount} words). Elaborate on projects.`, category: "Style", fixId: "too_short" }); }
    } else {
        if (wordCount >= 350 && wordCount <= 1000) lengthScore = 10;
        else if (wordCount > 1000) { lengthScore = 5; issues.push({ type: "warning", text: `Resume is quite long (${wordCount} words). Try to condense older experience.`, category: "Style", fixId: "too_long" }); }
        else { lengthScore = 3; issues.push({ type: "warning", text: `Resume is extremely brief (${wordCount} words) for your experience level.`, category: "Style", fixId: "too_short" }); }
    }
    styleScore += lengthScore;

    // Contact info presence — Up to 5 pts
    const hasEmail = /[\w.-]+@[\w.-]+\.\w+/.test(rawText);
    const hasPhone = /\+?\d{10,14}/.test(rawText);
    // Match LinkedIn even if just the word without full URL
    const hasLinkedIn = /linkedin\.com|\blinkedin\b/i.test(rawText);
    
    let contactScore = 0;
    if (hasEmail) contactScore += 2;
    if (hasPhone) contactScore += 2;
    if (hasLinkedIn) contactScore += 1;
    styleScore += contactScore;

    if (contactScore === 5) issues.push({ type: "success", text: "Contact information clearly found.", category: "Style" });
    else if (contactScore >= 4) issues.push({ type: "success", text: "Core contact info found (email + phone).", category: "Style" });
    else issues.push({ type: "warning", text: "Missing some contact info (Phone, Email, or LinkedIn).", category: "Style", fixId: "missing_contact" });

    // ──────────────────────────────────────────────
    // 3.5 ADVANCED HEURISTICS (Grammar, Readability, Gaps) — Up to 12 pts within Style
    // ──────────────────────────────────────────────
    const allBulletsStrings = sections.experience.flatMap((e) => e.bullets);
    
    // Grammar — Up to 4 pts (proportional bonuses instead of all-or-nothing)
    const grammarIssues = checkGrammar(rawText, allBulletsStrings);
    if (grammarIssues.length > 0) {
        grammarIssues.forEach(m => issues.push({ type: "warning", text: m, category: "Style" }));
        // Cap grammar deduction at -2 total
        const grammarPenalty = Math.min(2, Math.floor(grammarIssues.length * 1));
        styleScore = Math.max(0, styleScore - grammarPenalty);
        // Still award partial bonus
        const partialGrammarBonus = Math.max(0, 4 - grammarIssues.length);
        styleScore = Math.min(25, styleScore + partialGrammarBonus);
    } else {
        issues.push({ type: "success", text: "Grammar: No obvious repeated words or first-person pronouns.", category: "Style" });
        styleScore = Math.min(25, styleScore + 4);
    }

    // Readability — Up to 4 pts (proportional bonuses)
    const readability = calculateFleschKincaid(rawText);
    if (readability.gradeLevel > 16) {
        issues.push({ type: "warning", text: `Readability: Graduate level (${readability.gradeLevel}). May be too dense for recruiters to skim. Use shorter sentences.`, category: "Style" });
    } else if (readability.gradeLevel < 8) {
        issues.push({ type: "warning", text: `Readability: Middle-school level (${readability.gradeLevel}). Elevate vocabulary to match professional standards.`, category: "Style" });
        // Still give partial credit for having readable text
        styleScore = Math.min(25, styleScore + 2);
    } else {
        issues.push({ type: "success", text: `Readability: Excellent Grade Level (${readability.gradeLevel}). Highly scannable.`, category: "Style" });
        styleScore = Math.min(25, styleScore + 4);
    }

    // Length Check
    const lengthIssues = checkLength(readability.wordCount, level, allBulletsStrings.length);
    if (lengthIssues.length > 0) {
        lengthIssues.forEach(m => issues.push({ type: "warning", text: m, category: "Style" }));
    }

    // Gap Detection
    const gaps = detectEmploymentGaps(sections.experience);
    if (gaps.length > 0) {
        gaps.forEach(m => issues.push({ type: "warning", text: m, category: "ATS" }));
    }

    // ──────────────────────────────────────────────
    // 4. ADVANCED: Global Tech, Certs, Links + India Logic (15 pts max)
    // ──────────────────────────────────────────────
    // Core Tech Keywords matching (8 pts)
    const foundKeywords = GLOBAL_TECH_SKILLS.filter(kw => lowerText.includes(kw));
    const missingKeywords = GLOBAL_TECH_SKILLS.filter(kw => !lowerText.includes(kw));
    
    // ── Semantic Skill Inference ──
    // Detect implied skills from context (e.g., "built web apps" → html, css, javascript)
    const inferredRaw = inferSkills(rawText);
    // Filter to only skills NOT already explicitly found
    const inferredNew = inferredRaw.filter(s => !foundKeywords.includes(s) && !lowerText.includes(s));
    
    // Count inferred skills toward matching at half weight (each inferred = 0.5 of an explicit match)
    const effectiveKeywordCount = foundKeywords.length + Math.round(inferredNew.length * 0.5);

    // Unify scoring for all users to keep A/B test focused purely on UI/UX
    const techScore = Math.min(8, Math.round((effectiveKeywordCount / 15) * 8));
    advancedScore += techScore;

    if (foundKeywords.length > 8) {
        issues.push({ type: "success", text: `Strong tech stack highlighted (${foundKeywords.length} global skills detected).`, category: "Advanced" });
    } else {
        issues.push({ type: "warning", text: `Your technical keywords are very low (${foundKeywords.length}). ATS systems easily reject resumes lacking core tech skills.`, category: "Advanced", fixId: "low_tech_keywords" });
    }

    // Show inferred / hidden skills
    if (inferredNew.length > 0) {
        issues.push({ type: "success", text: `Hidden skills we detected: ${inferredNew.slice(0, 8).join(", ")}${inferredNew.length > 8 ? ` (+${inferredNew.length - 8} more)` : ""}`, category: "Advanced" });
    }
    
    // Links / Tech Proof (3 pts)
    // Match GitHub even if just the word without full URL
    const hasGithub = /github\.com|\bgithub\b/i.test(rawText);
    const hasPortfolio = /(portfolio|website|medium|dev\.to|blog|leetcode|codechef|codeforces|hackerrank)/i.test(rawText);
    let linkScore = 0;
    if (hasGithub) { linkScore += 2; issues.push({ type: "success", text: "GitHub profile linked.", category: "Advanced" }); }
    if (hasPortfolio) { linkScore += 1; issues.push({ type: "success", text: "Portfolio/coding profile linked.", category: "Advanced" }); }
    advancedScore += linkScore;
    
    if (linkScore === 0) issues.push({ type: "warning", text: "No GitHub or Portfolio links detected. Highly recommended for tech roles.", category: "Advanced", fixId: "missing_links" });

    // Certifications (2 pts)
    const foundCerts = GLOBAL_CERTIFICATIONS.filter(c => lowerText.includes(c));
    if (foundCerts.length > 0) {
        advancedScore += 2;
        issues.push({ type: "success", text: `Industry certifications found: ${foundCerts[0].toUpperCase()}`, category: "Advanced" });
    }

    // India/Region Specific Bonus (2 pts max mapped from the 8/7/5 raw bonus)
    const indiaResult = getIndiaKeywordsPoints(rawText, levelLower);
    // Normalize India score (max ~8) to max 2 bounds
    const normalizedIndiaScore = Math.min(2, Math.round(indiaResult.score / 4));
    advancedScore += normalizedIndiaScore;
    
    if (indiaResult.matches.length > 0) {
        issues.push({ 
            type: "success", 
            text: `Market-specific signals found: ${indiaResult.matches.join(", ")}`, 
            category: "Bonus" 
        });
    }

    // ──────────────────────────────────────────────
    // TOTAL CALCULATION
    // ──────────────────────────────────────────────
    const totalScore = impactScore + atsScore + styleScore + advancedScore;
    const finalScore = Math.min(100, Math.max(0, totalScore));

    let finalLabel = "Needs Work";
    if (finalScore >= 85) finalLabel = "Excellent";
    else if (finalScore >= 70) finalLabel = "Good";
    else if (finalScore >= 50) finalLabel = "Fair";

    // Reorder issues to show warnings at the top, then categorize
    const sortedIssues = issues.sort((a, b) => {
        if (a.type === 'warning' && b.type === 'success') return -1;
        if (a.type === 'success' && b.type === 'warning') return 1;
        return 0;
    });

    // Calculate overall ATS Risk
    let atsRisk: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (atsScore < 15) atsRisk = "HIGH";
    else if (atsScore < 20) atsRisk = "MEDIUM";

    return {
        score: finalScore,
        label: finalLabel,
        level: level,
        abVariant: abVariant, // Assuming abVariant is available in scope
        atsRisk,
        indiaAtsScore: indiaResult.indiaAtsScore,
        breakdown: {
            impact: { score: Math.min(35, impactScore), max: 35 },
            ats: { score: Math.min(25, atsScore), max: 25 },
            style: { score: Math.min(25, styleScore), max: 25 },
            advanced: { score: Math.min(15, advancedScore), max: 15 },
        },
        issues: sortedIssues, // Use the already sorted issues
        keywords: {
            found: foundKeywords.slice(0, 15),
            missing: missingKeywords.slice(0, 10),
            total: GLOBAL_TECH_SKILLS.length,
            matched: foundKeywords.length,
        },
        inferredSkills: inferredNew.slice(0, 15),
    };
}
