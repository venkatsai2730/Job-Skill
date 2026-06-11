// ═══════════════════════════════════════════════════════════════
// ADVANCED SCORER — Base + Penalty Architecture (Rebuilt)
// Uses calibrated weights from scorer/ modules.
// Backward compatible with existing call sites.
// ═══════════════════════════════════════════════════════════════

import { computeBaseScore } from './scorer/base-score.js';
import { detectAllPenalties, PenaltyResult } from './scorer/penalties.js';
import { sectionsToResume } from './scorer/helpers.js';
import type { ParsedResume } from './scorer/helpers.js';
import { DEFAULT_CONFIG, type ScoringConfig } from './scorer/scoring-config.js';
import { analyzeParseFidelity, type ParseFidelityReport } from './scorer/parse-fidelity.js';

// ── Re-export ParsedSections for backward compatibility ─────
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

export interface TopIssueCategory {
    category: string;
    penalty_key: string;
    count: number;
    point_gain: number;
    is_locked: boolean;
    sub_issues: { text: string; gain: number }[];
}

export interface CompletedCheck {
    category: string;
    points_saved: number;
}

export interface AdvancedATSResult {
    score: number;
    label: string;
    level: "Fresher" | "Medium" | "Senior";
    abVariant?: "variant_a" | "variant_b";
    atsRisk: "LOW" | "MEDIUM" | "HIGH";
    indiaAtsScore: number;
    breakdown: {
        impact: { score: number; max: 38 };
        ats: { score: number; max: 20 };
        style: { score: number; max: 14 };
        advanced: { score: number; max: 10 };
    };
    issues: ATSIssue[];
    keywords: { found: string[]; missing: string[]; total: number; matched: number };
    inferredSkills: string[];
    // New fields from calibrated scorer
    overall_score: number;
    base_score: number;
    total_penalty: number;
    grade: string;
    percentile: string;
    all_penalties: PenaltyResult[];
    top_issues: TopIssueCategory[];
    completed_checks: CompletedCheck[];
    next_steps: { action: string; score_gain: string }[];
    /** Penalties detected but zeroed out by exclusion groups — UI may surface these as lower-priority hints */
    suppressedIssues?: PenaltyResult[];
    /** Phase 2: parse-fidelity analysis — PDF structure issues that hurt ATS compatibility */
    parseFidelity?: ParseFidelityReport;
}


// ── Detect experience level ─────────────────────────────────
function detectLevel(sections: ParsedSections): "Fresher" | "Medium" | "Senior" {
    if (sections.experience.length === 0) return "Fresher";
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    sections.experience.forEach(exp => {
        const matches = exp.dates.match(/\b(19|20)\d{2}\b/g);
        if (matches) matches.forEach(m => {
            const yr = parseInt(m, 10);
            if (yr < minYear) minYear = yr;
        });
    });
    const yearsOfExp = currentYear - minYear;
    if (yearsOfExp < 2) return "Fresher";
    if (yearsOfExp <= 5) return "Medium";
    return "Senior";
}

// ── GLOBAL_TECH_SKILLS for keyword reporting ────────────────
import { countMatchedSkills, GLOBAL_TECH_SKILLS } from './scorer/helpers.js';

// ── Main Scorer Function (backward compatible) ─────────────
export function computeAdvancedATS(
    sections: ParsedSections,
    rawText: string,
    userId?: string,
    metadata?: { fileSizeMB?: number; isPdf?: boolean; fileName?: string },
    config: ScoringConfig = DEFAULT_CONFIG,
): AdvancedATSResult {
    const G = config.grades;
    const level = detectLevel(sections);
    const resume = sectionsToResume(sections, rawText, metadata);

    // ── PHASE 2: Parse-Fidelity ──────────────────────────────
    const parseFidelity = analyzeParseFidelity(rawText, metadata, config);

    // ── PHASE 1: Base Score ──────────────────────────────────
    const baseScore = computeBaseScore(resume, config, parseFidelity);

    // ── PHASE 2: Penalty Deductions ─────────────────────────
    const allPenalties = detectAllPenalties(resume, config);
    const triggered    = allPenalties.filter(p => p.triggered && !p.suppressed);
    const totalPenalty = triggered.reduce((s, p) => s + p.deduction, 0);

    // THE ONLY ALLOWED FLOOR
    const finalScore = Math.max(config.scoreFloor, Math.round(baseScore - totalPenalty));

    console.log('[AdvancedATS]', {
        baseScore,
        totalPenalty: Math.round(totalPenalty * 10) / 10,
        finalScore,
        triggeredPenalties: triggered.map(p => `${p.id}(-${p.deduction})`).join(', '),
        suppressed: allPenalties.filter(p => p.suppressed).map(p => p.id).join(', '),
        expRawLen: resume.sections.experience?.raw?.length ?? 0,
        projRawLen: resume.sections.projects?.raw?.length ?? 0,
        skillsRawLen: resume.sections.skills?.raw?.length ?? 0,
        summaryRawLen: resume.sections.summary?.raw?.length ?? 0,
        rawTextLen: rawText.length,
        sectionsExpCount: sections.experience.length,
        sectionsBulletCount: sections.experience.reduce((s, e) => s + e.bullets.length, 0),
        sectionsProjCount: sections.projects.length,
    });

    // ── Grade ────────────────────────────────────────────────
    const grade =
        finalScore >= G.Aplus  ? 'A+' : finalScore >= G.A     ? 'A'  :
        finalScore >= G.Bplus  ? 'B+' : finalScore >= G.B     ? 'B'  :
        finalScore >= G.Cplus  ? 'C+' : finalScore >= G.C     ? 'C'  :
        finalScore >= G.D      ? 'D'  : 'F';

    // ── Percentile ───────────────────────────────────────────
    const percentile =
        finalScore >= G.Aplus  ? 'Top 5%'      : finalScore >= G.A    ? 'Top 15%'    :
        finalScore >= G.Bplus  ? 'Top 30%'     : finalScore >= G.B    ? 'Top 45%'    :
        finalScore >= G.Cplus  ? 'Top 55%'     : finalScore >= G.C    ? 'Bottom 40%' :
        finalScore >= G.D      ? 'Bottom 20%'  : 'Bottom 10%';

    const CATEGORY_MAP: Record<string, string> = {
        duplicate_metrics:  "Repetition",
        vague_outcomes:     "Responsibilities",
        filler_objective:   "Buzzwords",
        personal_details:   "Unnecessary Sections",
        no_github:          "Contact Details",
        exp_zero_quant:     "Growth Signals",
        trivial_projects:   "Project Impact",
        hobbies_section:    "Unnecessary Sections",
        soft_in_tech:       "Skills Section",
        typos:              "Spelling & Grammar",
        no_summary:         "Profile Summary",
        full_zero_quant:    "Quantified Impact",
        vague_achievement:  "Achievements",
        short_bullets:      "Bullet Detail",
        long_bullets:       "Bullet Length",
        weak_verbs:         "Action Verbs",
        no_linkedin:        "Contact Details",
        repetitive_language: "Language Variety",
        missing_dates:      "Date Formatting",
        too_few_bullets:    "Experience Detail",
        excessive_skills:   "Skills Section",
    };

    const mappedIssues = triggered.map(p => ({
        category: CATEGORY_MAP[p.id] || "Other Issues",
        penalty_key: p.id,
        count: p.id === 'vague_outcomes' || p.id === 'typos'
            ? Math.max(1, Math.round(p.deduction / (p.id === 'vague_outcomes' ? 1.2 : 2.5)))
            : 1,
        point_gain: p.deduction,
        is_locked: false,
        sub_issues: [{ text: p.fix, gain: p.deduction }]
    })).sort((a, b) => b.point_gain - a.point_gain);

    const topIssuesMapped = mappedIssues.map((issue, idx) => ({
        ...issue,
        is_locked: idx >= 3
    }));

    const COMPLETED_MAP: Record<string, { name: string, pts: number }> = {
        personal_details:  { name: "No Personal Details", pts: config.penalties.personal_details },
        full_zero_quant:   { name: "Quantified Impact", pts: config.penalties.full_zero_quant },
        no_github:         { name: "GitHub Profile Linked", pts: config.penalties.no_github },
        duplicate_metrics: { name: "No Repeated Metrics", pts: config.penalties.duplicate_metrics },
        trivial_projects:  { name: "Strong Projects", pts: config.penalties.trivial_projects },
        filler_objective:  { name: "No Filler Language", pts: config.penalties.filler_objective },
        hobbies_section:   { name: "No Irrelevant Sections", pts: config.penalties.hobbies_section },
        no_summary:        { name: "Summary Section Present", pts: config.penalties.no_summary },
        short_bullets:     { name: "Detailed Bullets", pts: config.penalties.short_bullets },
        long_bullets:      { name: "Concise Bullets", pts: config.penalties.long_bullets },
        weak_verbs:        { name: "Strong Action Verbs", pts: config.penalties.weak_verbs },
        no_linkedin:       { name: "LinkedIn Profile Linked", pts: config.penalties.no_linkedin },
        repetitive_language: { name: "Varied Language", pts: config.penalties.repetitive_language },
        missing_dates:     { name: "Dates Present", pts: config.penalties.missing_dates },
        too_few_bullets:   { name: "Sufficient Detail", pts: config.penalties.too_few_bullets },
        excessive_skills:  { name: "Focused Skills List", pts: config.penalties.excessive_skills },
    };

    const completedChecks: CompletedCheck[] = [];
    allPenalties.forEach(p => {
        if (!p.triggered && COMPLETED_MAP[p.id]) {
            completedChecks.push({
                category: COMPLETED_MAP[p.id].name,
                points_saved: COMPLETED_MAP[p.id].pts
            });
        }
    });

    // ── Convert penalties to legacy ATSIssue format ──────────
    const issues: ATSIssue[] = [];
    for (const p of allPenalties) {
        if (p.triggered && !p.suppressed) {
            issues.push({
                type: "warning",
                text: `${p.fix} (${p.scoreGain} if fixed)`,
                category: p.priority === 1 ? "Impact" : p.priority === 2 ? "Style" : "Advanced",
                fixId: p.id,
            });
        }
    }

    for (const p of allPenalties) {
        if (!p.triggered) {
            const successTexts: Record<string, string> = {
                'personal_details': 'No personal details (DOB/gender) found. Good!',
                'full_zero_quant': 'Resume contains quantified metrics.',
                'exp_zero_quant': 'Experience bullets have numbers.',
                'vague_outcomes': 'No vague improvement claims without numbers.',
                'trivial_projects': 'Projects are non-trivial.',
                'filler_objective': 'Summary/objective is specific and professional.',
                'hobbies_section': 'No hobbies/interests section wasting space.',
                'no_github': 'GitHub profile URL linked.',
                'soft_in_tech': 'Technical skills section contains only hard skills.',
                'typos': 'No spelling errors detected.',
                'duplicate_metrics': 'Metrics are unique across bullets.',
                'no_summary': 'Summary/profile section present.',
                'vague_achievement': 'Achievements reference specific organisations.',
                'short_bullets': 'All bullets have sufficient detail.',
                'long_bullets': 'Bullets are concise and scannable.',
                'weak_verbs': 'Bullets use strong action verbs.',
                'no_linkedin': 'LinkedIn profile URL linked.',
                'repetitive_language': 'Action verbs are varied across bullets.',
                'missing_dates': 'Experience entries have date ranges.',
                'too_few_bullets': 'Experience section has sufficient detail.',
                'excessive_skills': 'Skills list is focused and relevant.',
            };
            if (successTexts[p.id]) {
                issues.push({ type: "success", text: successTexts[p.id], category: "ATS" });
            }
        }
    }

    issues.sort((a, b) => {
        if (a.type === 'warning' && b.type === 'success') return -1;
        if (a.type === 'success' && b.type === 'warning') return 1;
        return 0;
    });

    // ── Keywords report ─────────────────────────────────────
    const lowerText = rawText.toLowerCase();
    const foundKeywords = GLOBAL_TECH_SKILLS.filter(kw => lowerText.includes(kw));
    const missingKeywords = GLOBAL_TECH_SKILLS.filter(kw => !lowerText.includes(kw));

    // ── ATS Risk ────────────────────────────────────────────
    const atsRisk: "LOW" | "MEDIUM" | "HIGH" =
        finalScore < config.atsRisk.high   ? 'HIGH'   :
        finalScore < config.atsRisk.medium ? 'MEDIUM' : 'LOW';

    // ── Label ───────────────────────────────────────────────
    let label = "Needs Work";
    if      (finalScore >= config.labels.excellent) label = "Excellent";
    else if (finalScore >= config.labels.good)      label = "Good";
    else if (finalScore >= config.labels.fair)      label = "Fair";

    // ── Breakdown (approximate from base score components) ──
    const totalBase = Math.max(1, baseScore);
    const ratio = finalScore / totalBase;

    return {
        // Legacy fields (backward compat)
        score: finalScore,
        label,
        level,
        abVariant: undefined,
        atsRisk,
        indiaAtsScore: 0,
        breakdown: {
            impact:   { score: Math.round(Math.min(38, 38 * ratio)), max: 38 },
            ats:      { score: Math.round(Math.min(20, 20 * ratio)), max: 20 },
            style:    { score: Math.round(Math.min(14, 14 * ratio)), max: 14 },
            advanced: { score: Math.round(Math.min(10, 10 * ratio)), max: 10 },
        },
        issues,
        keywords: {
            found: foundKeywords.slice(0, 15),
            missing: missingKeywords.slice(0, 10),
            total: GLOBAL_TECH_SKILLS.length,
            matched: foundKeywords.length,
        },
        inferredSkills: [],

        // New calibrated fields
        overall_score:  finalScore,
        base_score:     baseScore,
        total_penalty:  Math.round(totalPenalty * 10) / 10,
        grade,
        percentile,
        all_penalties:  allPenalties,
        top_issues:     topIssuesMapped,
        completed_checks: completedChecks,
        next_steps: topIssuesMapped.slice(0, 3).map(p => ({
            action:     p.sub_issues[0].text.split('\n')[0],
            score_gain: `+${p.point_gain} pts`,
        })),
        suppressedIssues: allPenalties.filter(p => p.suppressed === true),
        parseFidelity,
    };
}
