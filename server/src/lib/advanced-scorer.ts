// ═══════════════════════════════════════════════════════════════
// ADVANCED SCORER — Base + Penalty Architecture (Rebuilt)
// Uses calibrated weights from scorer/ modules.
// Backward compatible with existing call sites.
// ═══════════════════════════════════════════════════════════════

import { computeBaseScore } from './scorer/base-score.js';
import { detectAllPenalties, PenaltyResult } from './scorer/penalties.js';
import { sectionsToResume } from './scorer/helpers.js';
import type { ParsedResume } from './scorer/helpers.js';

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
    metadata?: { fileSizeMB?: number; isPdf?: boolean; fileName?: string }
): AdvancedATSResult {
    const level = detectLevel(sections);
    const resume = sectionsToResume(sections, rawText, metadata);

    // ── PHASE 1: Base Score ──────────────────────────────────
    const baseScore = computeBaseScore(resume);

    // ── PHASE 2: Penalty Deductions ─────────────────────────
    const allPenalties = detectAllPenalties(resume);
    const triggered    = allPenalties.filter(p => p.triggered);
    const totalPenalty = triggered.reduce((s, p) => s + p.deduction, 0);

    // THE ONLY ALLOWED FLOOR
    const finalScore = Math.max(3, Math.round(baseScore - totalPenalty));

    // ── Grade ────────────────────────────────────────────────
    const grade =
        finalScore >= 88 ? 'A+' : finalScore >= 78 ? 'A'  :
        finalScore >= 68 ? 'B+' : finalScore >= 58 ? 'B'  :
        finalScore >= 45 ? 'C+' : finalScore >= 32 ? 'C'  :
        finalScore >= 20 ? 'D'  : 'F';

    // ── Percentile ───────────────────────────────────────────
    const percentile =
        finalScore >= 88 ? 'Top 5%'     : finalScore >= 78 ? 'Top 15%'    :
        finalScore >= 68 ? 'Top 30%'    : finalScore >= 58 ? 'Top 45%'    :
        finalScore >= 45 ? 'Top 55%'    : finalScore >= 32 ? 'Bottom 40%' :
        finalScore >= 20 ? 'Bottom 20%' : 'Bottom 10%';

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
        vague_achievement:  "Achievements"
    };

    const mappedIssues = triggered.map(p => {
        // Estimate sub-issue count by looking at deduction vs base weight, or fallback to 1
        return {
            category: CATEGORY_MAP[p.id] || "Other Issues",
            penalty_key: p.id,
            count: p.id === 'vague_outcomes' || p.id === 'typos' ? Math.max(1, Math.round(p.deduction / (p.id === 'vague_outcomes' ? 1.2 : 2.5))) : 1,
            point_gain: p.deduction,
            is_locked: false,
            sub_issues: [{ text: p.fix, gain: p.deduction }]
        };
    }).sort((a, b) => b.point_gain - a.point_gain);

    const topIssuesMapped = mappedIssues.map((issue, idx) => ({
        ...issue,
        is_locked: idx >= 3
    }));

    const COMPLETED_MAP: Record<string, { name: string, pts: number }> = {
        personal_details:  { name: "No Personal Details", pts: 9 },
        full_zero_quant:   { name: "Quantified Impact", pts: 19.3 },
        no_github:         { name: "Contact Details", pts: 3.5 },
        duplicate_metrics: { name: "No Repeated Metrics", pts: 14 },
        trivial_projects:  { name: "Strong Projects", pts: 5.5 },
        filler_objective:  { name: "No Filler Language", pts: 6.5 },
        hobbies_section:   { name: "No Irrelevant Sections", pts: 3.0 }
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
        if (p.triggered) {
            issues.push({
                type: "warning",
                text: `${p.fix} (${p.scoreGain} if fixed)`,
                category: p.priority === 1 ? "Impact" : p.priority === 2 ? "Style" : "Advanced",
                fixId: p.id,
            });
        }
    }

    // Add success items for non-triggered penalties
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
            };
            if (successTexts[p.id]) {
                issues.push({
                    type: "success",
                    text: successTexts[p.id],
                    category: "ATS",
                });
            }
        }
    }

    // Sort: warnings first
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
        finalScore < 45 ? 'HIGH' : finalScore < 65 ? 'MEDIUM' : 'LOW';

    // ── Label ───────────────────────────────────────────────
    let label = "Needs Work";
    if (finalScore >= 85) label = "Excellent";
    else if (finalScore >= 70) label = "Good";
    else if (finalScore >= 50) label = "Fair";

    // ── Breakdown (approximate from base score components) ──
    // We distribute the final score proportionally for UI display
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
    };
}
