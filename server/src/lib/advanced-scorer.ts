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
    // New fields from calibrated scorer
    overall_score: number;
    base_score: number;
    total_penalty: number;
    grade: string;
    percentile: string;
    all_penalties: PenaltyResult[];
    top_issues: PenaltyResult[];
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

    // ── Top Issues (sorted by priority then deduction) ──────
    const topIssues = triggered
        .sort((a, b) => a.priority - b.priority || b.deduction - a.deduction)
        .slice(0, 5);

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
            impact:   { score: Math.round(Math.min(35, 35 * ratio)), max: 35 },
            ats:      { score: Math.round(Math.min(25, 25 * ratio)), max: 25 },
            style:    { score: Math.round(Math.min(25, 25 * ratio)), max: 25 },
            advanced: { score: Math.round(Math.min(15, 15 * ratio)), max: 15 },
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
        top_issues:     topIssues,
        next_steps: topIssues.slice(0, 3).map(p => ({
            action:     p.fix.split('\n')[0],
            score_gain: p.scoreGain,
        })),
    };
}
