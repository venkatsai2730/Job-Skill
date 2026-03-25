export interface ATSParsedField {
    extracted: string | string[] | null;
    status: "success" | "warning" | "dropped";
    suggestion?: string;
}

export interface ATSSimulationResult {
    platform: "Greenhouse" | "Lever" | "Ashby" | "Naukri";
    fields: {
        name: ATSParsedField;
        email: ATSParsedField;
        phone: ATSParsedField;
        location: ATSParsedField;
        links: ATSParsedField;
        experience: ATSParsedField;
        education: ATSParsedField;
        skills: ATSParsedField;
        keywords?: {
            extracted: string;
            status: "success" | "warning" | "dropped";
            suggestion?: string;
            matched: string[];
            missing: string[];
            scorePoints: number;
        };
        bulletAnalysis?: {
            extracted: string | null;
            status: "success" | "warning" | "dropped";
            overallScore: number;
            suggestion?: string;
        };
    };
    overallScore: number;
}

// Minimal structure matched from our parsers
interface RawParsedSections {
    summary: string;
    experience: any[];
    education: any[];
    skills: any[];
    projects: any[];
}

import { GLOBAL_TECH_SKILLS } from "./keywords.js";
import { analyzeAllBullets } from "./bullet-scorer.js";
import { expandSynonyms } from "./synonym-map.js";

/**
 * Greenhouse is notoriously struct-heavy.
 * - Drops "Work History" or "Employment" if it isn't specifically "Experience".
 * - Frequently fails on custom multi-column skills.
 * - Requires standard Contact headers.
 */
export function simulateGreenhouse(sections: RawParsedSections, rawText: string, jobDescription?: string): ATSSimulationResult {
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100;

    // Name (Usually first line, but Greenhouse drops non-standard header formats)
    const hasClearName = rawText.split('\n').slice(0, 3).some(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l));
    if (hasClearName) {
        fields.name = { extracted: "Found", status: "success" };
    } else {
        fields.name = { extracted: null, status: "dropped", suggestion: "Greenhouse could not find a standard Name header. Ensure name is the largest, first text on the page." };
        score -= 15;
    }

    // Email
    const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
         fields.email = { extracted: emailMatch[0], status: "success" };
    } else {
         fields.email = { extracted: null, status: "dropped", suggestion: "No standard email detected. Avoid inserting emails into images or icons." };
         score -= 10;
    }

    // Phone
    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (phoneMatch) {
        fields.phone = { extracted: phoneMatch[0], status: "success" };
    } else {
        fields.phone = { extracted: null, status: "warning", suggestion: "Phone number parsing failed. Use a standard format like (555) 555-5555" };
        score -= 5;
    }

    // Location
    fields.location = { extracted: "Parsed from Profile", status: "success" }; // Placeholder

    // Links (Greenhouse strictly looks for linkedin.com or github.com strings)
    const isLinkedin = rawText.toLowerCase().includes("linkedin.com");
    if (isLinkedin) {
        fields.links = { extracted: "LinkedIn Detected", status: "success" };
    } else {
         fields.links = { extracted: null, status: "warning", suggestion: "Greenhouse requires full URLs (e.g., https://linkedin.com/in/...). Hyperlinked text is often dropped." };
         score -= 5;
    }

    // Experience (Greenhouse strictly needs 'Experience')
    if (sections.experience.length > 0) {
        // Did they use a standard header? Let's check raw text.
        if (!/experience/i.test(rawText)) {
             fields.experience = { extracted: "Partial / Dropped", status: "dropped", suggestion: "Greenhouse strictly looks for the header 'Experience'. Custom headers like 'Work History' often cause this section to be dropped entirely." };
             score -= 25;
        } else {
             fields.experience = { extracted: `${sections.experience.length} Roles Found`, status: "success" };
        }
    } else {
        fields.experience = { extracted: null, status: "dropped", suggestion: "No experience section found." };
        score -= 25;
    }

    // Education
    if (sections.education.length > 0) {
        fields.education = { extracted: `${sections.education.length} Degrees Found`, status: "success" };
    } else {
        fields.education = { extracted: null, status: "dropped", suggestion: "Education section missing or used a non-standard title." };
        score -= 15;
    }

    // Skills
    if (sections.skills.length > 0) {
        fields.skills = { extracted: `${sections.skills.reduce((acc, g) => acc + g.items.length, 0)} Skills Extracted`, status: "success" };
    } else {
        fields.skills = { extracted: null, status: "warning", suggestion: "Greenhouse failed to extract skills. Avoid multi-column formatting for this section." };
        score -= 10;
    }

    // Keyword Match against JD (If JD provided)
    if (jobDescription && jobDescription.trim().length > 50) {
        const lowerRes = rawText.toLowerCase();
        const lowerJd = jobDescription.toLowerCase();
        const expandedRes = expandSynonyms(lowerRes);
        
        // Find core skills requested in JD
        const jdSkills = GLOBAL_TECH_SKILLS.filter(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|\\s[^a-z0-9]|\\b)${escaped}(?:[^a-z0-9]\\s|\\b|$)`, "i");
            return regex.test(lowerJd);
        });

        if (jdSkills.length > 0) {
            const matchedSkills = jdSkills.filter(kw => expandedRes.includes(kw));
            const missingSkills = jdSkills.filter(kw => !expandedRes.includes(kw));
            const matchRate = matchedSkills.length / jdSkills.length;
            
            let keywordStatus: "success" | "warning" | "dropped" = "success";
            let suggestion = "";
            let penalty = 0;

            if (matchRate < 0.3) {
                keywordStatus = "dropped";
                suggestion = "Catastrophic keyword miss. Most ATS systems will auto-reject you.";
                penalty = 30;
            } else if (matchRate < 0.6) {
                keywordStatus = "warning";
                suggestion = "Moderate keyword match. Try to include more of the missing skills to pass initial ATS filters.";
                penalty = 15;
            } else {
                suggestion = "Excellent keyword match rate.";
            }

            score -= penalty;
            fields.keywords = {
                extracted: `${Math.round(matchRate * 100)}% JD Keyword Match`,
                status: keywordStatus,
                suggestion,
                matched: matchedSkills,
                missing: missingSkills,
                scorePoints: -penalty
            };
        }
    }

    // Bullet Analysis
    const allBullets = sections.experience?.flatMap(exp => exp.bullets || []) || [];
    if (allBullets.length > 0) {
        const bulletData = analyzeAllBullets(allBullets);
        let status: "success" | "warning" | "dropped" = "success";
        let suggestion = "Bullets are highly impactful with action verbs and metrics.";
        
        if (bulletData.overallScore < 50) {
            status = "dropped";
            suggestion = "Bullets are weak. They lack action verbs and quantified metrics.";
            score -= 15;
        } else if (bulletData.overallScore < 75) {
            status = "warning";
            suggestion = "Bullets could be better optimized for ATS parsing (add more metrics & power verbs).";
            score -= 5;
        }

        fields.bulletAnalysis = {
            extracted: `Analyzed ${allBullets.length} bullet points`,
            status,
            overallScore: bulletData.overallScore,
            suggestion
        };
    } else {
         fields.bulletAnalysis = {
            extracted: null,
            status: "warning",
            overallScore: 0,
            suggestion: "No experience bullets to analyze."
        };
    }

    return {
        platform: "Greenhouse",
        fields,
        overallScore: Math.max(0, score)
    };
}

/**
 * Lever is better at semantic matching and fuzzy matching.
 * - Extracts "Work History" easily.
 * - Extremely good at grabbing raw links.
 * - Often merges Summary and Education if no line break exists.
 */
export function simulateLever(sections: RawParsedSections, rawText: string, jobDescription?: string): ATSSimulationResult {
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100;

    fields.name = { extracted: "Found", status: "success" }; // Lever is very robust at name extraction

    const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.\w+/);
    fields.email = emailMatch 
        ? { extracted: emailMatch[0], status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Missing standard email." };
    if (!emailMatch) score -= 10;

    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    fields.phone = phoneMatch
        ? { extracted: phoneMatch[0], status: "success" }
        : { extracted: null, status: "warning", suggestion: "Phone number parsing failed." };
    if (!phoneMatch) score -= 5;

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    // Links (Lever extracts ANY hyperlink)
    const hasHttp = rawText.includes("http://") || rawText.includes("https://") || rawText.toLowerCase().includes("github.com") || rawText.toLowerCase().includes("linkedin.com");
    if (hasHttp) {
        fields.links = { extracted: "URLs Extracted", status: "success" };
    } else {
         fields.links = { extracted: null, status: "warning", suggestion: "Lever easily parses inline links and full URLs, but none were detected." };
    }

    // Experience (Lever allows "Work History", etc.)
    if (sections.experience.length > 0) {
        fields.experience = { extracted: `${sections.experience.length} Roles Found`, status: "success" };
    } else {
        fields.experience = { extracted: null, status: "dropped", suggestion: "No experience roles could be parsed. Consider using simple block limits." };
        score -= 25;
    }

    // Education
    if (sections.education.length > 0) {
        // Lever merging bug heuristic: If spacing between exp & edu is tight, it merges them.
        const mergedBug = !rawText.includes("\n\nEducation") && !rawText.includes("\n\nEDUCATION");
        if (mergedBug) {
             fields.education = { extracted: "Merged with Experience", status: "warning", suggestion: "Lever frequently merges Education into Experience if there is insufficient spacing between sections. Add whitespace." };
             score -= 10;
        } else {
             fields.education = { extracted: `${sections.education.length} Degrees Found`, status: "success" };
        }
    } else {
        fields.education = { extracted: null, status: "dropped", suggestion: "Education section missing." };
        score -= 15;
    }

    // Skills
    if (sections.skills.length > 0) {
        fields.skills = { extracted: `${sections.skills.reduce((acc, g) => acc + g.items.length, 0)} Skills Mapped`, status: "success" };
    } else {
        fields.skills = { extracted: null, status: "warning", suggestion: "No skills grouped." };
        score -= 10;
    }

    // Keyword Match against JD (If JD provided)
    if (jobDescription && jobDescription.trim().length > 50) {
        const lowerRes = rawText.toLowerCase();
        const lowerJd = jobDescription.toLowerCase();
        const expandedRes = expandSynonyms(lowerRes);
        
        // Find core skills requested in JD
        const jdSkills = GLOBAL_TECH_SKILLS.filter(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|\\s[^a-z0-9]|\\b)${escaped}(?:[^a-z0-9]\\s|\\b|$)`, "i");
            return regex.test(lowerJd);
        });

        if (jdSkills.length > 0) {
            const matchedSkills = jdSkills.filter(kw => expandedRes.includes(kw));
            const missingSkills = jdSkills.filter(kw => !expandedRes.includes(kw));
            const matchRate = matchedSkills.length / jdSkills.length;
            
            // Lever is slightly more forgiving on semantic matches, so penalty is slightly lower
            let keywordStatus: "success" | "warning" | "dropped" = "success";
            let suggestion = "";
            let penalty = 0;

            if (matchRate < 0.25) {
                keywordStatus = "dropped";
                suggestion = "Severe keyword miss. Most ATS systems will deprioritize your application.";
                penalty = 25;
            } else if (matchRate < 0.55) {
                keywordStatus = "warning";
                suggestion = "Average keyword match. Include more missing skills to rank higher in searches.";
                penalty = 10;
            } else {
                suggestion = "Strong keyword match rate.";
            }

            score -= penalty;
            fields.keywords = {
                extracted: `${Math.round(matchRate * 100)}% JD Keyword Match`,
                status: keywordStatus,
                suggestion,
                matched: matchedSkills,
                missing: missingSkills,
                scorePoints: -penalty
            };
        }
    }

    // Bullet Analysis
    const allBullets = sections.experience?.flatMap(exp => exp.bullets || []) || [];
    if (allBullets.length > 0) {
        const bulletData = analyzeAllBullets(allBullets);
        let status: "success" | "warning" | "dropped" = "success";
        let suggestion = "Bullets are highly impactful with action verbs and metrics.";
        
        if (bulletData.overallScore < 50) {
            status = "dropped";
            suggestion = "Bullets are weak. They lack action verbs and quantified metrics.";
            score -= 15;
        } else if (bulletData.overallScore < 75) {
            status = "warning";
            suggestion = "Bullets could be better optimized for ATS parsing (add more metrics & power verbs).";
            score -= 5;
        }

        fields.bulletAnalysis = {
            extracted: `Analyzed ${allBullets.length} bullet points`,
            status,
            overallScore: bulletData.overallScore,
            suggestion
        };
    } else {
         fields.bulletAnalysis = {
            extracted: null,
            status: "warning",
            overallScore: 0,
            suggestion: "No experience bullets to analyze."
        };
    }

    return {
        platform: "Lever",
        fields,
        overallScore: Math.max(0, score)
    };
}

/**
 * Ashby is strict about section structure and formatting.
 * - Extracts: title, company, skills, location
 * - Strict: drops content outside standard section tags
 * - Warns if: bullet count > 7 per role
 * - Warns if: dates not in "Month Year" format
 */
export function simulateAshby(sections: RawParsedSections, rawText: string, jobDescription?: string): ATSSimulationResult {
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100;

    // Name
    const hasClearName = rawText.split('\n').slice(0, 3).some(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l));
    if (hasClearName) {
        fields.name = { extracted: "Found", status: "success" };
    } else {
        fields.name = { extracted: null, status: "dropped", suggestion: "Ashby expects the candidate name to be clearly the first text element. Avoid fancy formatting." };
        score -= 10;
    }

    // Email
    const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.\w+/);
    fields.email = emailMatch
        ? { extracted: emailMatch[0], status: "success" }
        : { extracted: null, status: "dropped", suggestion: "No standard email detected." };
    if (!emailMatch) score -= 10;

    // Phone
    const phoneMatch = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    fields.phone = phoneMatch
        ? { extracted: phoneMatch[0], status: "success" }
        : { extracted: null, status: "warning", suggestion: "Phone number parsing failed." };
    if (!phoneMatch) score -= 5;

    // Location
    fields.location = { extracted: "Parsed from Profile", status: "success" };

    // Links
    const hasLinks = rawText.toLowerCase().includes("linkedin.com") || rawText.toLowerCase().includes("github.com");
    fields.links = hasLinks
        ? { extracted: "URLs Detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Ashby prefers full URLs for LinkedIn/GitHub profiles." };

    // Experience — Ashby strictly parses standard "Experience" headers
    if (sections.experience.length > 0) {
        const hasStandardHeader = /\b(experience|work\s+experience|professional\s+experience)\b/i.test(rawText);
        if (!hasStandardHeader) {
            fields.experience = { extracted: "Partial / Dropped", status: "dropped", suggestion: "Ashby requires a standard 'Experience' section header. Non-standard headers like 'Career History' may be dropped." };
            score -= 20;
        } else {
            fields.experience = { extracted: `${sections.experience.length} Roles Found`, status: "success" };
        }

        // Ashby warns if > 7 bullets per role
        const overBulletRoles = sections.experience.filter(exp => (exp.bullets || []).length > 7);
        if (overBulletRoles.length > 0) {
            score -= 5;
            // Add to experience suggestion
            if (fields.experience.status === "success") {
                fields.experience.suggestion = `${overBulletRoles.length} role(s) have more than 7 bullet points. Ashby may truncate or deprioritize long bullet lists. Aim for 4-6 bullets per role.`;
                fields.experience.status = "warning";
            }
        }

        // Ashby warns if dates are not in "Month Year" format
        const badDateRoles = sections.experience.filter(exp => {
            const dates = exp.dates || "";
            // Valid: "Jan 2020 - Present", "January 2020 - Dec 2021"
            const validPattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i;
            return dates.length > 0 && !validPattern.test(dates);
        });
        if (badDateRoles.length > 0) {
            score -= 5;
        }
    } else {
        fields.experience = { extracted: null, status: "dropped", suggestion: "No experience section found." };
        score -= 25;
    }

    // Education
    if (sections.education.length > 0) {
        fields.education = { extracted: `${sections.education.length} Degrees Found`, status: "success" };
    } else {
        fields.education = { extracted: null, status: "dropped", suggestion: "Education section missing." };
        score -= 15;
    }

    // Skills
    if (sections.skills.length > 0) {
        fields.skills = { extracted: `${sections.skills.reduce((acc, g) => acc + g.items.length, 0)} Skills Extracted`, status: "success" };
    } else {
        fields.skills = { extracted: null, status: "warning", suggestion: "Ashby could not extract a structured skills section. Use a clear 'Skills' header." };
        score -= 10;
    }

    // Keyword Match (if JD provided)
    if (jobDescription && jobDescription.trim().length > 50) {
        const lowerRes = rawText.toLowerCase();
        const lowerJd = jobDescription.toLowerCase();
        const expandedRes = expandSynonyms(lowerRes);

        const jdSkills = GLOBAL_TECH_SKILLS.filter(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|\\s[^a-z0-9]|\\b)${escaped}(?:[^a-z0-9]\\s|\\b|$)`, "i");
            return regex.test(lowerJd);
        });

        if (jdSkills.length > 0) {
            const matchedSkills = jdSkills.filter(kw => expandedRes.includes(kw));
            const missingSkills = jdSkills.filter(kw => !expandedRes.includes(kw));
            const matchRate = matchedSkills.length / jdSkills.length;

            let keywordStatus: "success" | "warning" | "dropped" = "success";
            let suggestion = "Excellent keyword match rate.";
            let penalty = 0;

            if (matchRate < 0.3) {
                keywordStatus = "dropped";
                suggestion = "Ashby's strict matching flagged a critical keyword gap. Your application may be auto-screened out.";
                penalty = 25;
            } else if (matchRate < 0.6) {
                keywordStatus = "warning";
                suggestion = "Moderate keyword match. Ashby heavily weights exact skill terms from the JD.";
                penalty = 12;
            }

            score -= penalty;
            fields.keywords = {
                extracted: `${Math.round(matchRate * 100)}% JD Keyword Match`,
                status: keywordStatus,
                suggestion,
                matched: matchedSkills,
                missing: missingSkills,
                scorePoints: -penalty
            };
        }
    }

    // Bullet Analysis
    const allBullets = sections.experience?.flatMap(exp => exp.bullets || []) || [];
    if (allBullets.length > 0) {
        const bulletData = analyzeAllBullets(allBullets);
        let bStatus: "success" | "warning" | "dropped" = "success";
        let bSuggestion = "Bullets are highly impactful.";

        if (bulletData.overallScore < 50) {
            bStatus = "dropped";
            bSuggestion = "Bullets are weak. Ashby penalizes low-impact descriptions.";
            score -= 15;
        } else if (bulletData.overallScore < 75) {
            bStatus = "warning";
            bSuggestion = "Bullets need more quantified metrics and action verbs for Ashby.";
            score -= 5;
        }

        fields.bulletAnalysis = {
            extracted: `Analyzed ${allBullets.length} bullet points`,
            status: bStatus,
            overallScore: bulletData.overallScore,
            suggestion: bSuggestion
        };
    } else {
        fields.bulletAnalysis = {
            extracted: null,
            status: "warning",
            overallScore: 0,
            suggestion: "No experience bullets to analyze."
        };
    }

    return {
        platform: "Ashby",
        fields,
        overallScore: Math.max(0, score)
    };
}

/**
 * Naukri — Indian-specific ATS simulation.
 * - Checks: phone number in Indian format (+91 or 10-digit)
 * - Checks: CGPA/GPA if fresh graduate
 * - Checks: Indian university name recognition
 * - Warns if: resume > 2 pages (Naukri recommends max 2)
 * - Warns if: objective/summary > 3 lines
 */
export function simulateNaukri(sections: RawParsedSections, rawText: string, jobDescription?: string): ATSSimulationResult {
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100;

    // Name — Naukri is quite lenient
    const hasClearName = rawText.split('\n').slice(0, 5).some(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l));
    fields.name = hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Naukri could not find a clear name. Ensure your full name is prominently placed." };
    if (!hasClearName) score -= 5;

    // Email
    const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.\w+/);
    fields.email = emailMatch
        ? { extracted: emailMatch[0], status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Email is required for Naukri profile completion." };
    if (!emailMatch) score -= 10;

    // Phone — Indian format check (+91 or 10-digit)
    const indianPhoneMatch = rawText.match(/(?:\+91[\s.-]?)?\d{10}/) || rawText.match(/(?:\+91[\s.-]?)?\d{5}[\s.-]?\d{5}/);
    if (indianPhoneMatch) {
        fields.phone = { extracted: indianPhoneMatch[0], status: "success" };
    } else {
        const anyPhone = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
        if (anyPhone) {
            fields.phone = { extracted: anyPhone[0], status: "warning", suggestion: "Phone number detected but not in standard Indian format (+91 XXXXX XXXXX or 10-digit). Naukri prefers Indian format." };
            score -= 3;
        } else {
            fields.phone = { extracted: null, status: "dropped", suggestion: "No phone number found. Naukri requires a valid Indian mobile number." };
            score -= 10;
        }
    }

    // Location
    fields.location = { extracted: "Parsed from Profile", status: "success" };

    // Links
    const hasLinkedIn = rawText.toLowerCase().includes("linkedin.com");
    fields.links = hasLinkedIn
        ? { extracted: "LinkedIn Detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Adding a LinkedIn profile URL helps Naukri auto-populate your profile." };

    // Experience
    if (sections.experience.length > 0) {
        fields.experience = { extracted: `${sections.experience.length} Roles Found`, status: "success" };
    } else {
        fields.experience = { extracted: null, status: "dropped", suggestion: "No experience section found. Even freshers should list internships or projects." };
        score -= 20;
    }

    // Education — CGPA/GPA check for freshers
    if (sections.education.length > 0) {
        fields.education = { extracted: `${sections.education.length} Degrees Found`, status: "success" };

        // Check for CGPA/GPA if fresher
        const isFresher = sections.experience.length <= 1;
        if (isFresher) {
            const hasCGPA = /\b(cgpa|gpa|percentage|marks)\s*[:\s]?\s*\d/i.test(rawText);
            if (!hasCGPA) {
                fields.education.status = "warning";
                fields.education.suggestion = "As a fresher, Naukri recommends including your CGPA/GPA or percentage. Many recruiters filter by academic scores.";
                score -= 5;
            }
        }

        // Indian university recognition check
        const KNOWN_INDIAN_UNIS = [
            "iit", "nit", "iiit", "bits", "vit", "srm", "manipal", "amity",
            "delhi university", "mumbai university", "pune university", "anna university",
            "jadavpur", "bhu", "jnu", "ism", "iisc", "isb", "iim",
            "osmania", "hyderabad university", "calcutta university",
        ];
        const lowerEdu = sections.education.map(e => (e.school || "").toLowerCase()).join(" ");
        const hasKnownUni = KNOWN_INDIAN_UNIS.some(u => lowerEdu.includes(u));
        if (hasKnownUni) {
            // Bonus for recognized university
            score = Math.min(100, score + 2);
        }
    } else {
        fields.education = { extracted: null, status: "dropped", suggestion: "Education section missing. This is critical for Naukri profiles." };
        score -= 15;
    }

    // Skills
    if (sections.skills.length > 0) {
        fields.skills = { extracted: `${sections.skills.reduce((acc, g) => acc + g.items.length, 0)} Skills Mapped`, status: "success" };
    } else {
        fields.skills = { extracted: null, status: "warning", suggestion: "Naukri's skill-based search relies heavily on an explicit Skills section." };
        score -= 10;
    }

    // Resume length check (Naukri recommends max 2 pages ≈ 800 words)
    const wordCount = rawText.split(/\s+/).length;
    if (wordCount > 900) {
        score -= 5;
    }

    // Objective/Summary length check (Naukri warns > 3 lines ≈ 60 words)
    if (sections.summary) {
        const summaryWords = sections.summary.split(/\s+/).length;
        if (summaryWords > 60) {
            score -= 3;
        }
    }

    // Keyword Match (if JD provided)
    if (jobDescription && jobDescription.trim().length > 50) {
        const lowerRes = rawText.toLowerCase();
        const lowerJd = jobDescription.toLowerCase();
        const expandedRes = expandSynonyms(lowerRes);

        const jdSkills = GLOBAL_TECH_SKILLS.filter(kw => {
            const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|\\s[^a-z0-9]|\\b)${escaped}(?:[^a-z0-9]\\s|\\b|$)`, "i");
            return regex.test(lowerJd);
        });

        if (jdSkills.length > 0) {
            const matchedSkills = jdSkills.filter(kw => expandedRes.includes(kw));
            const missingSkills = jdSkills.filter(kw => !expandedRes.includes(kw));
            const matchRate = matchedSkills.length / jdSkills.length;

            let keywordStatus: "success" | "warning" | "dropped" = "success";
            let suggestion = "Strong keyword match for Naukri search visibility.";
            let penalty = 0;

            if (matchRate < 0.3) {
                keywordStatus = "dropped";
                suggestion = "Very low keyword match. Naukri search results are heavily keyword-driven.";
                penalty = 20;
            } else if (matchRate < 0.55) {
                keywordStatus = "warning";
                suggestion = "Average keyword match. Adding more JD-specific skills will improve Naukri search ranking.";
                penalty = 8;
            }

            score -= penalty;
            fields.keywords = {
                extracted: `${Math.round(matchRate * 100)}% JD Keyword Match`,
                status: keywordStatus,
                suggestion,
                matched: matchedSkills,
                missing: missingSkills,
                scorePoints: -penalty
            };
        }
    }

    // Bullet Analysis
    const allBullets = sections.experience?.flatMap(exp => exp.bullets || []) || [];
    if (allBullets.length > 0) {
        const bulletData = analyzeAllBullets(allBullets);
        let bStatus: "success" | "warning" | "dropped" = "success";
        let bSuggestion = "Bullets demonstrate quantified impact.";

        if (bulletData.overallScore < 50) {
            bStatus = "dropped";
            bSuggestion = "Bullets lack quantification and strong verbs. Indian recruiters on Naukri skim quickly — make every bullet count.";
            score -= 10;
        } else if (bulletData.overallScore < 75) {
            bStatus = "warning";
            bSuggestion = "Bullets could be more impactful with numbers and metrics.";
            score -= 3;
        }

        fields.bulletAnalysis = {
            extracted: `Analyzed ${allBullets.length} bullet points`,
            status: bStatus,
            overallScore: bulletData.overallScore,
            suggestion: bSuggestion
        };
    } else {
        fields.bulletAnalysis = {
            extracted: null,
            status: "warning",
            overallScore: 0,
            suggestion: "No experience bullets to analyze."
        };
    }

    return {
        platform: "Naukri",
        fields,
        overallScore: Math.max(0, score)
    };
}
