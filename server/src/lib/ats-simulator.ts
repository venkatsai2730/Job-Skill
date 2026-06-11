// ═══════════════════════════════════════════════════════════════
// ATS SIMULATOR — Phase 3 rewrite
//
// Platform profiles are config-driven and consume the Phase 2
// parse-fidelity report. Each platform's strictness determines
// how hard formatting issues hit the simulation score.
//
// Backward compat: fidelity param is optional so existing call
// sites in routes/chatbot.ts and routes/resume.ts keep working.
// ═══════════════════════════════════════════════════════════════

import type { ParseFidelityReport } from './scorer/parse-fidelity.js';
import type { CanonicalSection } from './scorer/section-synonyms.js';
import { DEFAULT_CONFIG, type AtsSimDeductions } from './scorer/scoring-config.js';
import { GLOBAL_TECH_SKILLS } from "./keywords.js";
import { analyzeAllBullets } from "./bullet-scorer.js";
import { expandSynonyms } from "./synonym-map.js";

// ── Public types ─────────────────────────────────────────────

export interface ATSParsedField {
    extracted: string | string[] | null;
    status: "success" | "warning" | "dropped";
    suggestion?: string;
}

/** A single parse-fidelity finding attached to a simulation */
export interface FidelityFlag {
    /** What was checked (e.g. "layout", "image_pdf", "table_artifacts") */
    field: string;
    /** pass = no issue; warn = moderate risk; fail = ATS likely drops content */
    severity: "pass" | "warn" | "fail";
    /** One-line reason grounded in the fidelity report */
    reason: string;
}

export interface ATSSimulationResult {
    platform: "Greenhouse" | "Lever" | "Ashby" | "Naukri" | "Workday" | "Legacy";
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
    /** Fidelity-driven checks — pass/warn/fail per structural concern */
    fidelityFlags?: FidelityFlag[];
    /** Parser strictness tier for this platform */
    parserStrictness?: "lenient" | "medium" | "strict";
}

interface RawParsedSections {
    summary: string;
    experience: any[];
    education: any[];
    skills: any[];
    projects: any[];
}

type Strictness = "lenient" | "medium" | "strict";

// ── Shared helpers ───────────────────────────────────────────

/** Extract contact fields from raw text (same for all platforms) */
function extractContact(rawText: string) {
    const email       = rawText.match(/[\w.+%-]+@[\w.-]+\.\w{2,}/)?.[0] ?? null;
    const phone       = rawText.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? null;
    const indianPhone = rawText.match(/(?:\+91[\s.-]?)?\d{10}/)?.[0]
                     || rawText.match(/(?:\+91[\s.-]?)?\d{5}[\s.-]?\d{5}/)?.[0]
                     || null;
    const hasLinkedIn = rawText.toLowerCase().includes("linkedin.com");
    const hasGitHub   = rawText.toLowerCase().includes("github.com");
    const hasUrl      = rawText.includes("http://") || rawText.includes("https://") || hasLinkedIn || hasGitHub;
    const hasClearName = rawText.split('\n').slice(0, 5).some(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l));
    return { email, phone, indianPhone, hasLinkedIn, hasGitHub, hasUrl, hasClearName };
}

/**
 * Whether a canonical section was detected — prefers fidelity's synonym-aware
 * header scan over the raw parsed sections array.
 */
function sectionDetected(
    canonical: CanonicalSection,
    sections: RawParsedSections,
    fidelity?: ParseFidelityReport,
): boolean {
    if (fidelity && fidelity.recognizedSections.length > 0) {
        return fidelity.recognizedSections.includes(canonical);
    }
    switch (canonical) {
        case 'experience': return sections.experience.length > 0;
        case 'education':  return sections.education.length > 0;
        case 'skills':     return sections.skills.length > 0;
        case 'projects':   return sections.projects.length > 0;
        default:           return false;
    }
}

/**
 * Build fidelity-driven structural flags for a given strictness level.
 * Returns both the flags and the total score penalty to apply.
 */
function buildFidelityFlags(
    fidelity: ParseFidelityReport | undefined,
    strictness: Strictness,
    platform: string,
): { flags: FidelityFlag[]; penalty: number } {
    if (!fidelity) return { flags: [], penalty: 0 };

    const D = DEFAULT_CONFIG.atsSimulator.deductions[strictness];
    const flags: FidelityFlag[] = [];
    let penalty = 0;

    // Image-only PDF
    if (!fidelity.extractable) {
        const sev: FidelityFlag["severity"] = strictness === 'lenient' ? 'warn' : 'fail';
        flags.push({
            field: "image_pdf",
            severity: sev,
            reason: sev === 'fail'
                ? `${platform} cannot extract text from an image-only PDF. Convert to a text-based PDF immediately.`
                : `PDF appears to be image-based. ${platform} may struggle to extract your details.`,
        });
        penalty += D.imagePdf;
    }

    // Multi-column layout
    if (fidelity.multiColumnRisk !== 'LOW') {
        const isHigh = fidelity.multiColumnRisk === 'HIGH';
        const sev: FidelityFlag["severity"] =
            strictness === 'lenient' ? 'pass' :
            (strictness === 'medium' || !isHigh) ? 'warn' : 'fail';
        flags.push({
            field: "layout",
            severity: sev,
            reason: sev === 'pass'
                ? `${platform} reviewers read the original PDF directly — multi-column layout is not a concern here.`
                : sev === 'warn'
                ? `Multi-column layout detected. ${platform}'s parser may read sections out of order.`
                : `Multi-column layout will likely scramble ${platform}'s structured parser, causing sections to be dropped.`,
        });
        penalty += isHigh ? D.multiColHigh : D.multiColMedium;
    }

    // Table artifacts
    if (fidelity.tableArtifactRisk === 'HIGH') {
        const sev: FidelityFlag["severity"] = strictness === 'lenient' ? 'pass' : 'warn';
        flags.push({
            field: "table_artifacts",
            severity: sev,
            reason: sev === 'pass'
                ? `Table formatting is visible in the PDF — ${platform} reviewers will see it as intended.`
                : `Table cell separators (pipes/tabs) may appear as garbled text in ${platform}'s parsed view.`,
        });
        penalty += D.tableArtifact;
    }

    return { flags, penalty };
}

/** Build keyword match field if a JD is provided (shared across all platforms) */
function buildKeywords(
    rawText: string,
    jobDescription: string | undefined,
    matched_threshold_low: number,
    matched_threshold_high: number,
    penalty_low: number,
    penalty_high: number,
): { field: ATSSimulationResult["fields"]["keywords"]; penalty: number } | null {
    if (!jobDescription || jobDescription.trim().length < 50) return null;

    const expandedRes = expandSynonyms(rawText.toLowerCase());
    const lowerJd = jobDescription.toLowerCase();
    const jdSkills = GLOBAL_TECH_SKILLS.filter(kw => {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|\\s[^a-z0-9]|\\b)${esc}(?:[^a-z0-9]\\s|\\b|$)`, "i").test(lowerJd);
    });

    if (jdSkills.length === 0) return null;

    const matched = jdSkills.filter(kw => expandedRes.includes(kw));
    const missing = jdSkills.filter(kw => !expandedRes.includes(kw));
    const rate = matched.length / jdSkills.length;

    let status: "success" | "warning" | "dropped" = "success";
    let suggestion = "Strong keyword match rate.";
    let penalty = 0;

    if (rate < matched_threshold_low) {
        status = "dropped";
        suggestion = "Critical keyword gap — low match rate may cause auto-rejection.";
        penalty = penalty_high;
    } else if (rate < matched_threshold_high) {
        status = "warning";
        suggestion = "Moderate keyword match. Add more JD-specific skills to rank higher.";
        penalty = penalty_low;
    }

    return {
        field: { extracted: `${Math.round(rate * 100)}% JD Keyword Match`, status, suggestion, matched, missing, scorePoints: -penalty },
        penalty,
    };
}

/** Build bullet analysis field (shared across all platforms) */
function buildBulletAnalysis(
    sections: RawParsedSections,
    lowThreshold: number,
    highThreshold: number,
    penaltyLow: number,
    penaltyHigh: number,
): { field: ATSSimulationResult["fields"]["bulletAnalysis"]; penalty: number } {
    const allBullets = sections.experience?.flatMap((exp: any) => exp.bullets || []) || [];
    if (allBullets.length === 0) {
        return { field: { extracted: null, status: "warning", overallScore: 0, suggestion: "No experience bullets to analyze." }, penalty: 0 };
    }
    const data = analyzeAllBullets(allBullets);
    let status: "success" | "warning" | "dropped" = "success";
    let suggestion = "Bullets are impactful with strong action verbs and metrics.";
    let penalty = 0;
    if (data.overallScore < lowThreshold) {
        status = "dropped"; suggestion = "Bullets lack action verbs and quantified metrics."; penalty = penaltyHigh;
    } else if (data.overallScore < highThreshold) {
        status = "warning"; suggestion = "Bullets need more quantified metrics and action verbs."; penalty = penaltyLow;
    }
    return { field: { extracted: `Analyzed ${allBullets.length} bullet points`, status, overallScore: data.overallScore, suggestion }, penalty };
}


// ── GREENHOUSE — Lenient ─────────────────────────────────────
/**
 * Greenhouse recruiters primarily view the rendered PDF; parsed fields
 * are sidebar metadata. Only image-only PDFs and missing contact info
 * are critical. Formatting issues (columns, tables) carry LOW severity.
 */
export function simulateGreenhouse(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    // Handle old signature simulateGreenhouse(sections, rawText, jobDescription?)
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'lenient', 'Greenhouse');
    const C = extractContact(rawText);
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    // Name
    fields.name = C.hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Place your full name as the first text on the page." };
    if (!C.hasClearName) score -= 10;

    // Email
    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "No email detected. Avoid embedding contact info in images." };
    if (!C.email) score -= DEFAULT_CONFIG.atsSimulator.deductions.lenient.missingContact;

    // Phone
    fields.phone = C.phone
        ? { extracted: C.phone, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Use a standard phone format." };
    if (!C.phone) score -= 3;

    // Location
    fields.location = { extracted: "Parsed from Profile", status: "success" };

    // Links — Greenhouse wants full URLs
    fields.links = C.hasLinkedIn
        ? { extracted: "LinkedIn detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Include a full LinkedIn URL (e.g. linkedin.com/in/...)." };

    // Experience — lenient: synonym headers pass; image PDF → dropped
    const hasExp = !fidelity || fidelity.extractable
        ? sectionDetected('experience', sections, fidelity)
        : false;
    if (!hasExp) {
        fields.experience = { extracted: null, status: fidelity && !fidelity.extractable ? "dropped" : "warning",
            suggestion: "Experience section not found. Ensure a clear section header is present." };
        score -= DEFAULT_CONFIG.atsSimulator.deductions.lenient.missingSection;
    } else {
        fields.experience = { extracted: `${sections.experience.length} role(s) found`, status: "success" };
    }

    // Education
    const hasEdu = sectionDetected('education', sections, fidelity);
    fields.education = hasEdu
        ? { extracted: `${sections.education.length} degree(s) found`, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Education section missing." };
    if (!hasEdu) score -= DEFAULT_CONFIG.atsSimulator.deductions.lenient.missingSection;

    // Skills
    const hasSkills = sectionDetected('skills', sections, fidelity);
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills
        ? { extracted: `${skillCount} skills extracted`, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Skills section not detected. Use a clear Skills header." };
    if (!hasSkills) score -= 5;

    // Keywords
    const kw = buildKeywords(rawText, jobDescription, 0.30, 0.60, 15, 30);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    // Bullets
    const ba = buildBulletAnalysis(sections, 50, 75, 5, 15);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Greenhouse", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "lenient" };
}


// ── LEVER — Parse-first ──────────────────────────────────────
/**
 * Lever's structured profile is the recruiter's primary view.
 * Section detection failures and column/table issues are HIGH severity.
 * Synonym headers pass via semantic matching.
 */
export function simulateLever(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'strict', 'Lever');
    const C = extractContact(rawText);
    const D = DEFAULT_CONFIG.atsSimulator.deductions.strict;
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    fields.name = { extracted: "Found", status: "success" }; // Lever is robust at name

    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Email is required for Lever structured profile." };
    if (!C.email) score -= D.missingContact;

    fields.phone = C.phone
        ? { extracted: C.phone, status: "success" }
        : { extracted: null, status: "warning", suggestion: "No phone number detected." };
    if (!C.phone) score -= 5;

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    fields.links = C.hasUrl
        ? { extracted: "URL(s) extracted", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Lever parses inline URLs well — add LinkedIn/GitHub." };

    // Lever: synonym headers pass; multi-column degrades to warning
    const hasExp = !fidelity || fidelity.extractable
        ? sectionDetected('experience', sections, fidelity)
        : false;
    const layoutDegrades = fidelity && (fidelity.multiColumnRisk !== 'LOW' || fidelity.tableArtifactRisk === 'HIGH');

    if (!hasExp) {
        fields.experience = { extracted: null, status: "dropped", suggestion: "Experience section not recognized. Use a standard or common header (e.g. Work Experience, Professional Experience)." };
        score -= D.missingSection;
    } else if (layoutDegrades && fidelity!.multiColumnRisk === 'HIGH') {
        fields.experience = { extracted: `${sections.experience.length} role(s) (layout risk)`, status: "warning",
            suggestion: "Multi-column layout may cause Lever's parser to scramble experience entries." };
    } else {
        fields.experience = { extracted: `${sections.experience.length} role(s) found`, status: "success" };
    }

    const hasEdu = sectionDetected('education', sections, fidelity);
    fields.education = hasEdu
        ? { extracted: `${sections.education.length} degree(s) found`, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Education section not detected." };
    if (!hasEdu) score -= D.missingSection;

    const hasSkills = sectionDetected('skills', sections, fidelity);
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills
        ? { extracted: `${skillCount} skills mapped`, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Skills section not detected. Lever's structured view expects an explicit Skills section." };
    if (!hasSkills) score -= 8;

    const kw = buildKeywords(rawText, jobDescription, 0.25, 0.55, 10, 25);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    const ba = buildBulletAnalysis(sections, 50, 75, 5, 15);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Lever", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "strict" };
}


// ── WORKDAY — Strict + job-title match ───────────────────────
/**
 * Workday is the dominant enterprise ATS. It weights job-title match
 * heavily and relies on structured form fields as much as resume text.
 * Multi-column and table layouts cause HIGH-severity drops.
 */
export function simulateWorkday(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'strict', 'Workday');
    const C = extractContact(rawText);
    const D = DEFAULT_CONFIG.atsSimulator.deductions.strict;
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    fields.name = C.hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Ensure full name is prominently placed at the top." };
    if (!C.hasClearName) score -= 10;

    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Email required for Workday application form." };
    if (!C.email) score -= D.missingContact;

    fields.phone = C.phone
        ? { extracted: C.phone, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Phone number not detected." };
    if (!C.phone) score -= 5;

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    fields.links = C.hasLinkedIn
        ? { extracted: "LinkedIn detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Add LinkedIn URL — Workday auto-imports from LinkedIn." };

    // Workday: multi-column/table → fail
    const layoutFail = fidelity && (fidelity.multiColumnRisk === 'HIGH' || fidelity.tableArtifactRisk === 'HIGH');

    const hasExp = !fidelity || fidelity.extractable
        ? sectionDetected('experience', sections, fidelity)
        : false;
    if (!hasExp) {
        fields.experience = { extracted: null, status: "dropped", suggestion: "Experience not detected. Use standard header." };
        score -= D.missingSection;
    } else if (layoutFail) {
        fields.experience = { extracted: `${sections.experience.length} role(s) (layout risk)`, status: "warning",
            suggestion: "Multi-column/table layout degrades Workday's structured parsing." };
    } else {
        fields.experience = { extracted: `${sections.experience.length} role(s) found`, status: "success" };
    }

    const hasEdu = sectionDetected('education', sections, fidelity);
    fields.education = hasEdu
        ? { extracted: `${sections.education.length} degree(s) found`, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Education section missing." };
    if (!hasEdu) score -= D.missingSection;

    const hasSkills = sectionDetected('skills', sections, fidelity);
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills
        ? { extracted: `${skillCount} skills extracted`, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Skills section not detected." };
    if (!hasSkills) score -= 8;

    // Workday always adds form-fields advisory as a fidelity flag
    flags.push({
        field: "form_fields",
        severity: "warn",
        reason: "Workday requires manual data entry into structured form fields after upload. Ensure dates, titles, and company names are parseable.",
    });

    const kw = buildKeywords(rawText, jobDescription, 0.30, 0.60, 12, 28);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    const ba = buildBulletAnalysis(sections, 50, 75, 5, 15);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Workday", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "strict" };
}


// ── ASHBY — Medium strictness ────────────────────────────────
/**
 * Ashby is a modern ATS with medium strictness.
 * Warns if any role has > 7 bullets; otherwise well-suited to
 * standard resume formats.
 */
export function simulateAshby(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'medium', 'Ashby');
    const C = extractContact(rawText);
    const D = DEFAULT_CONFIG.atsSimulator.deductions.medium;
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    const hasClearName = rawText.split('\n').slice(0, 3).some(l => /[A-Z][a-z]+ [A-Z][a-z]+/.test(l));
    fields.name = hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Place name as the first element — Ashby reads it from the top." };
    if (!hasClearName) score -= 10;

    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "No email detected." };
    if (!C.email) score -= D.missingContact;

    fields.phone = C.phone
        ? { extracted: C.phone, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Phone number not found." };
    if (!C.phone) score -= 5;

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    fields.links = (C.hasLinkedIn || C.hasGitHub)
        ? { extracted: "Profile URL(s) detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Include full LinkedIn/GitHub URLs." };

    // Experience
    const hasExp = !fidelity || fidelity.extractable
        ? sectionDetected('experience', sections, fidelity)
        : false;
    if (!hasExp) {
        fields.experience = { extracted: null, status: "dropped", suggestion: "Experience section not found." };
        score -= D.missingSection;
    } else {
        // Ashby: warn if any role has > 7 bullets
        const overBulletRoles = sections.experience.filter((e: any) => (e.bullets || []).length > 7);
        if (overBulletRoles.length > 0) {
            fields.experience = {
                extracted: `${sections.experience.length} role(s) found`,
                status: "warning",
                suggestion: `${overBulletRoles.length} role(s) exceed 7 bullets. Ashby may truncate long bullet lists — aim for 4–6 per role.`,
            };
            score -= 5;
        } else {
            fields.experience = { extracted: `${sections.experience.length} role(s) found`, status: "success" };
        }

        // Date format check
        const badDates = sections.experience.filter((e: any) => {
            const d = e.dates || "";
            return d.length > 0 && !/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i.test(d);
        });
        if (badDates.length > 0) score -= 5;
    }

    const hasEdu = sectionDetected('education', sections, fidelity);
    fields.education = hasEdu
        ? { extracted: `${sections.education.length} degree(s) found`, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Education section missing." };
    if (!hasEdu) score -= D.missingSection;

    const hasSkills = sectionDetected('skills', sections, fidelity);
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills
        ? { extracted: `${skillCount} skills extracted`, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Use a clear Skills header." };
    if (!hasSkills) score -= 8;

    const kw = buildKeywords(rawText, jobDescription, 0.30, 0.60, 12, 25);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    const ba = buildBulletAnalysis(sections, 50, 75, 5, 15);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Ashby", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "medium" };
}


// ── NAUKRI — India-specific ──────────────────────────────────
/**
 * Naukri serves the Indian job market. Checks Indian phone format and
 * CGPA for freshers. Does NOT flag DOB or photo as failures
 * (conventional in IN market — see Phase 6 region rules).
 */
export function simulateNaukri(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'medium', 'Naukri');
    const C = extractContact(rawText);
    const D = DEFAULT_CONFIG.atsSimulator.deductions.medium;
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    fields.name = C.hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Place full name prominently at the top." };
    if (!C.hasClearName) score -= 5;

    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Email required for Naukri profile." };
    if (!C.email) score -= D.missingContact;

    // Indian phone format
    if (C.indianPhone) {
        fields.phone = { extracted: C.indianPhone, status: "success" };
    } else if (C.phone) {
        fields.phone = { extracted: C.phone, status: "warning", suggestion: "Use Indian format: +91 XXXXX XXXXX or 10-digit." };
        score -= 3;
    } else {
        fields.phone = { extracted: null, status: "dropped", suggestion: "No phone number found. Naukri requires a valid Indian mobile number." };
        score -= 10;
    }

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    fields.links = C.hasLinkedIn
        ? { extracted: "LinkedIn detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Add a LinkedIn URL to boost profile visibility on Naukri." };

    // Experience
    const hasExp = sectionDetected('experience', sections, fidelity);
    fields.experience = hasExp
        ? { extracted: `${sections.experience.length} role(s) found`, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "No experience section. Even freshers should list internships or projects." };
    if (!hasExp) score -= D.missingSection;

    // Education — CGPA check for freshers
    const hasEdu = sectionDetected('education', sections, fidelity);
    if (hasEdu) {
        fields.education = { extracted: `${sections.education.length} degree(s) found`, status: "success" };
        const isFresher = sections.experience.length <= 1;
        if (isFresher && !/\b(cgpa|gpa|percentage|marks)\s*[:\s]?\s*\d/i.test(rawText)) {
            fields.education.status = "warning";
            fields.education.suggestion = "As a fresher, include CGPA/percentage — many Naukri recruiters filter by academic scores.";
            score -= 5;
        }
        // Indian university bonus
        const knownUnis = ["iit","nit","iiit","bits","vit","srm","manipal","amity","delhi university","mumbai university","pune university","anna university","jadavpur","bhu","jnu","ism","iisc","isb","iim","osmania","hyderabad university","calcutta university"];
        const eduText = sections.education.map((e: any) => (e.school || "").toLowerCase()).join(" ");
        if (knownUnis.some(u => eduText.includes(u))) score = Math.min(100, score + 2);
    } else {
        fields.education = { extracted: null, status: "dropped", suggestion: "Education section missing — critical for Naukri profiles." };
        score -= D.missingSection;
    }

    const hasSkills = sectionDetected('skills', sections, fidelity);
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills
        ? { extracted: `${skillCount} skills mapped`, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Naukri's skill-based search relies heavily on an explicit Skills section." };
    if (!hasSkills) score -= 8;

    // Resume length (Naukri recommends ≤ 2 pages ≈ 800 words)
    if (rawText.split(/\s+/).length > 900) score -= 5;

    // Summary length
    if (sections.summary && sections.summary.split(/\s+/).length > 60) score -= 3;

    const kw = buildKeywords(rawText, jobDescription, 0.30, 0.55, 8, 20);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    const ba = buildBulletAnalysis(sections, 50, 75, 3, 10);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Naukri", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "medium" };
}


// ── LEGACY STRICT — Taleo / iCIMS class ─────────────────────
/**
 * Legacy parsers (Taleo, iCIMS) are where formatting genuinely kills
 * resumes. Every fidelity flag is HIGH severity. Multi-column PDFs cause
 * sections to be completely dropped. Non-standard headers fail silently.
 */
export function simulateLegacyStrict(
    sections: RawParsedSections,
    rawText: string,
    fidelityOrJd?: ParseFidelityReport | string,
    maybeJd?: string,
): ATSSimulationResult {
    const fidelity = (fidelityOrJd && typeof fidelityOrJd === 'object') ? fidelityOrJd as ParseFidelityReport : undefined;
    const jobDescription = fidelity ? maybeJd : (fidelityOrJd as string | undefined);

    const { flags, penalty: fidelityPenalty } = buildFidelityFlags(fidelity, 'strict', 'legacy Taleo/iCIMS parsers');
    const C = extractContact(rawText);
    const D = DEFAULT_CONFIG.atsSimulator.deductions.strict;
    const fields: ATSSimulationResult["fields"] = {} as any;
    let score = 100 - fidelityPenalty;

    fields.name = C.hasClearName
        ? { extracted: "Found", status: "success" }
        : { extracted: null, status: "dropped", suggestion: "Legacy parsers expect name as plain text on line 1." };
    if (!C.hasClearName) score -= 15;

    fields.email = C.email
        ? { extracted: C.email, status: "success" }
        : { extracted: null, status: "dropped", suggestion: "No email detected." };
    if (!C.email) score -= D.missingContact;

    fields.phone = C.phone
        ? { extracted: C.phone, status: "success" }
        : { extracted: null, status: "warning", suggestion: "Use standard phone format." };
    if (!C.phone) score -= 5;

    fields.location = { extracted: "Parsed from Profile", status: "success" };

    fields.links = C.hasUrl
        ? { extracted: "URL detected", status: "success" }
        : { extracted: null, status: "warning", suggestion: "Include plain-text URLs — legacy parsers cannot click hyperlinks." };

    // Multi-column → all sections potentially scrambled
    const multiColFail = fidelity && fidelity.multiColumnRisk === 'HIGH';
    const imageFail    = fidelity && !fidelity.extractable;

    const hasExp = !imageFail ? sectionDetected('experience', sections, fidelity) : false;

    if (!hasExp) {
        fields.experience = { extracted: null, status: "dropped",
            suggestion: imageFail
                ? "Image-only PDF — no text was extracted."
                : "Experience section not found. Legacy parsers require exactly the header 'Experience'." };
        score -= D.missingSection;
    } else if (multiColFail) {
        fields.experience = { extracted: null, status: "dropped",
            suggestion: "Multi-column layout causes legacy parsers to scramble or drop the experience section." };
        score -= D.missingSection;
    } else {
        fields.experience = { extracted: `${sections.experience.length} role(s) found`, status: "success" };
    }

    const hasEdu = !imageFail ? sectionDetected('education', sections, fidelity) : false;
    fields.education = hasEdu && !multiColFail
        ? { extracted: `${sections.education.length} degree(s) found`, status: "success" }
        : { extracted: null, status: "dropped",
            suggestion: multiColFail
                ? "Multi-column layout may have dropped the Education section."
                : "Education section not detected. Use header 'Education' exactly." };
    if (!hasEdu || multiColFail) score -= D.missingSection;

    const hasSkills = !imageFail ? sectionDetected('skills', sections, fidelity) : false;
    const skillCount = sections.skills.reduce((a: number, g: any) => a + (g.items?.length ?? 0), 0);
    fields.skills = hasSkills && !multiColFail
        ? { extracted: `${skillCount} skills extracted`, status: "success" }
        : { extracted: null, status: "dropped",
            suggestion: multiColFail
                ? "Multi-column layouts cause skills to be scattered across text — legacy parsers cannot reconstruct them."
                : "Skills section not detected." };
    if (!hasSkills || multiColFail) score -= 10;

    const kw = buildKeywords(rawText, jobDescription, 0.30, 0.60, 15, 30);
    if (kw) { fields.keywords = kw.field; score -= kw.penalty; }

    const ba = buildBulletAnalysis(sections, 50, 75, 5, 15);
    fields.bulletAnalysis = ba.field; score -= ba.penalty;

    return { platform: "Legacy", fields, overallScore: Math.max(0, score), fidelityFlags: flags, parserStrictness: "strict" };
}


// ── Convenience: run all 6 platforms ────────────────────────

export function simulateAll(
    sections: RawParsedSections,
    rawText: string,
    fidelity?: ParseFidelityReport,
    jobDescription?: string,
): ATSSimulationResult[] {
    return [
        simulateGreenhouse(sections, rawText, fidelity, jobDescription),
        simulateLever(sections, rawText, fidelity, jobDescription),
        simulateWorkday(sections, rawText, fidelity, jobDescription),
        simulateAshby(sections, rawText, fidelity, jobDescription),
        simulateNaukri(sections, rawText, fidelity, jobDescription),
        simulateLegacyStrict(sections, rawText, fidelity, jobDescription),
    ];
}
