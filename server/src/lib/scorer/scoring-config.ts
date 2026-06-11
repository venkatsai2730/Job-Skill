// ═══════════════════════════════════════════════════════════════
// SCORING CONFIG — Single source of truth for every numeric
// constant in the resume scoring pipeline.
//
// Rules:
//  • No scoring number may appear inline in base-score.ts,
//    penalties.ts, or advanced-scorer.ts — it must live here.
//  • The config is a plain object so a calibration script can
//    mutate individual keys and re-score without code changes.
//  • scoreResume() accepts an optional config param that defaults
//    to DEFAULT_CONFIG, making all call sites backward-compatible.
// ═══════════════════════════════════════════════════════════════

// ── Penalty key union ────────────────────────────────────────
export type PenaltyKey =
    | 'personal_details'
    | 'full_zero_quant'
    | 'exp_zero_quant'
    | 'vague_per_bullet'
    | 'trivial_projects'
    | 'filler_objective'
    | 'hobbies_section'
    | 'no_github'
    | 'soft_in_tech'
    | 'typo_per'
    | 'duplicate_metrics'
    | 'no_summary'
    | 'vague_achievement'
    | 'short_bullets'
    | 'long_bullets'
    | 'weak_verbs'
    | 'no_linkedin'
    | 'repetitive_language'
    | 'missing_dates'
    | 'too_few_bullets'
    | 'excessive_skills';

// ── Interface ────────────────────────────────────────────────
export interface ScoringConfig {
    components: {
        quantification: {
            /** Hard cap on combined quant + verb score */
            max: number;
            /** Max points purely from verb ratio */
            verbMax: number;
            /** Verb ratio → score multiplier */
            verbRatioMultiplier: number;
            /** Max exp quantification points */
            expQuantMax: number;
            /** Max project quantification points */
            projQuantMax: number;
            /** Cap before adding verbScore */
            quantMax: number;
            /** Project ratio multiplier (strong + 0.5×any) */
            projRatioMultiplier: number;
            /** Multiplier for "any number" ratio when no strong nums */
            anyNumMultiplier: number;
            /** Fresher (no exp): project-only quant max */
            fresherProjMax: number;
            /** Fresher project ratio multiplier */
            fresherProjMultiplier: number;
        };
        experience: {
            /** Max bonus for professional experience */
            max: number;
            /** Points by bullet count tier: [≥5, ≥3, ≥2, ≥1] */
            bonusByBullets: [number, number, number, number];
            /** Org/club (non-professional) experience bonus */
            orgBonus: number;
        };
        ats: {
            max: number;
            /** File < 5 MB score */
            fileGood: number;
            /** File ≥ 5 MB score */
            fileBad: number;
            /** Word count in range score */
            wcGood: number;
            /** Word count out of range score */
            wcBad: number;
            /** Special chars ≤ threshold score */
            fmtGood: number;
            /** Special chars > threshold score */
            fmtBad: number;
            /** Threshold for "too many special characters" */
            specialsThreshold: number;
            /** Max points from section header detection */
            headerMax: number;
        };
        style: {
            max: number;
            /** Applied to (lengthScore + consistencyScore + readabilityScore) */
            multiplier: number;
            /** Base length score */
            lengthBase: number;
            /** Floor for length score */
            lengthMin: number;
            /** Words below minWc that drop 1 length point */
            lengthBelowPerWords: number;
            /** Words above maxWc that drop 1 length point */
            lengthAbovePerWords: number;
            /** Typo count multiplier in consistency formula */
            typoMultiplier: number;
            /** Base for consistency score */
            typoBase: number;
            /** Floor for consistency score */
            typoMin: number;
            /** Readability score when bullets ≥ threshold */
            readabilityGood: number;
            /** Readability score when bullets < threshold */
            readabilityBad: number;
            /** Bullet count needed for good readability score */
            readabilityBulletThreshold: number;
            /** Min word count when experience is present */
            minWcWithExp: number;
            /** Max word count when experience is present */
            maxWcWithExp: number;
            /** Min word count for fresher resumes */
            minWcNoExp: number;
            /** Max word count for fresher resumes */
            maxWcNoExp: number;
        };
        skillsContact: {
            max: number;
            /** Applied to (skillScore + contactScore + eduBonus + pubBonus) */
            multiplier: number;
            /** Max skill score */
            skillMax: number;
            /** Divide matched skill count by this to get skill score */
            skillDivisor: number;
            /** Points for education section present */
            eduBonus: number;
            /** Points for publication detected */
            pubBonus: number;
        };
        achievement: {
            /** Max achievement bonus points */
            max: number;
        };
    };

    thresholds: {
        /** Chars below which a bullet is "too short" */
        shortBulletChars: number;
        /** Minimum short bullets to trigger P14 */
        shortBulletCount: number;
        /** Chars above which a bullet is "too long" */
        longBulletChars: number;
        /** Minimum long bullets to trigger P15 */
        longBulletCount: number;
        /** Minimum weak-verb bullets to trigger P16 */
        weakVerbCount: number;
        /** Times a verb must repeat across bullets to trigger P18 */
        repetitiveVerbCount: number;
        /** Exp bullets below this count trigger P20 */
        tooFewBulletsCount: number;
        /** Skills above this count trigger P21 */
        excessiveSkillsCount: number;
        /** Soft-skill hits needed to trigger P9 */
        softSkillsCount: number;
        /** Filler phrases needed when a summary section IS present */
        fillerWithSection: number;
        /** Filler phrases needed when NO summary section exists */
        fillerWithout: number;
        /** Same percentage value used this many times = duplicate metrics */
        duplicateMetricsCount: number;
    };

    grades: {
        Aplus: number;
        A: number;
        Bplus: number;
        B: number;
        Cplus: number;
        C: number;
        D: number;
    };

    /** atsRisk thresholds: score < high → HIGH, < medium → MEDIUM, else LOW */
    atsRisk: {
        high: number;
        medium: number;
    };

    /** label thresholds: score ≥ excellent → "Excellent", etc. */
    labels: {
        excellent: number;
        good: number;
        fair: number;
    };

    /** Absolute floor on the final computed score */
    scoreFloor: number;

    /** Cap on raw base score before penalty deduction */
    baseCap: number;

    /** Bonus applied to freshers (no work exp, has education) */
    fresherBonus: number;

    penalties: Record<PenaltyKey, number>;

    exclusionGroups: {
        /**
         * Quantification group: P2 (full_zero_quant), P3 (exp_zero_quant),
         * P4 (vague_outcomes).
         * - P2 fires → suppress both P3 and P4
         * - P3 fires (not P2) → suppress P4 for experience bullets only
         */
        quantification: {
            p2Id: string;
            p3Id: string;
            p4Id: string;
            /** Max combined deduction for this entire group */
            maxCombinedDeduction: number;
        };
        /**
         * Bullet quality group: P14 (short_bullets) + P15 (long_bullets).
         * Both can fire, but combined deduction is capped at
         * max(d14, d15) + combinedCapFactor × min(d14, d15).
         */
        bulletQuality: {
            p14Id: string;
            p15Id: string;
            combinedCapFactor: number;
        };
    };

    /**
     * Parse-fidelity deductions applied to the ATS component score.
     * These catch PDF structural issues that prevent ATS text extraction.
     */
    parseFidelity: {
        /** Deduction when the PDF appears to be image-only (no extractable text) */
        imageDeduction: number;
        /** Max ATS deduction for multi-column layout (MEDIUM gets half) */
        multiColDeduction: number;
        /** Deduction when table artifacts (pipes/tabs) are detected */
        tableArtifactDeduction: number;
    };

    /**
     * ATS simulator platform profiles.
     * Deductions are applied to the simulator's 100-point overallScore
     * based on each platform's parser strictness level.
     */
    atsSimulator: {
        /** Score deductions per strictness tier */
        deductions: {
            lenient: AtsSimDeductions;
            medium:  AtsSimDeductions;
            strict:  AtsSimDeductions;
        };
    };
}

export interface AtsSimDeductions {
    /** Image-only PDF — nothing can be extracted */
    imagePdf: number;
    /** Multi-column layout, HIGH risk */
    multiColHigh: number;
    /** Multi-column layout, MEDIUM risk */
    multiColMedium: number;
    /** Table artifact separators */
    tableArtifact: number;
    /** Missing critical contact field (email/phone) */
    missingContact: number;
    /** Missing key resume section (experience/education) */
    missingSection: number;
}

// ── Default config (all values from pre-existing code) ───────
export const DEFAULT_CONFIG: ScoringConfig = {
    components: {
        quantification: {
            max: 38,
            verbMax: 3,
            verbRatioMultiplier: 4,
            expQuantMax: 28,
            projQuantMax: 10,
            quantMax: 35,
            projRatioMultiplier: 12,
            anyNumMultiplier: 22,
            fresherProjMax: 22,
            fresherProjMultiplier: 24,
        },
        experience: {
            max: 14,
            bonusByBullets: [14, 13, 10, 6],
            orgBonus: 6,
        },
        ats: {
            max: 20,
            fileGood: 4,
            fileBad: 2,
            wcGood: 3,
            wcBad: 1,
            fmtGood: 7,
            fmtBad: 4,
            specialsThreshold: 30,
            headerMax: 7,
        },
        style: {
            max: 14,
            multiplier: 0.93,
            lengthBase: 7,
            lengthMin: 3,
            lengthBelowPerWords: 30,
            lengthAbovePerWords: 100,
            typoMultiplier: 1.5,
            typoBase: 5,
            typoMin: 2,
            readabilityGood: 3,
            readabilityBad: 1,
            readabilityBulletThreshold: 5,
            minWcWithExp: 300,
            maxWcWithExp: 1000,
            minWcNoExp: 200,
            maxWcNoExp: 700,
        },
        skillsContact: {
            max: 10,
            multiplier: 0.78,
            skillMax: 4,
            skillDivisor: 3,
            eduBonus: 2,
            pubBonus: 2,
        },
        achievement: {
            max: 3,
        },
    },

    thresholds: {
        shortBulletChars: 30,
        shortBulletCount: 3,
        longBulletChars: 200,
        longBulletCount: 3,
        weakVerbCount: 2,
        repetitiveVerbCount: 4,
        tooFewBulletsCount: 3,
        excessiveSkillsCount: 35,
        softSkillsCount: 2,
        fillerWithSection: 1,
        fillerWithout: 3,
        duplicateMetricsCount: 3,
    },

    grades: {
        Aplus: 88,
        A: 78,
        Bplus: 68,
        B: 58,
        Cplus: 45,
        C: 32,
        D: 20,
    },

    atsRisk: {
        high: 45,
        medium: 65,
    },

    labels: {
        excellent: 85,
        good: 70,
        fair: 50,
    },

    scoreFloor: 3,
    baseCap: 98,
    fresherBonus: 6,

    penalties: {
        personal_details:    9.0,
        full_zero_quant:    19.3,
        exp_zero_quant:      7.5,
        vague_per_bullet:    1.0,
        trivial_projects:    5.5,
        filler_objective:    6.5,
        hobbies_section:     3.0,
        no_github:           2.5,
        soft_in_tech:        2.5,
        typo_per:            2.0,
        duplicate_metrics:  10.0,
        no_summary:          2.0,
        vague_achievement:   1.5,
        short_bullets:       2.0,
        long_bullets:        1.5,
        weak_verbs:          2.5,
        no_linkedin:         1.5,
        repetitive_language: 2.0,
        missing_dates:       2.5,
        too_few_bullets:     4.0,
        excessive_skills:    1.5,
    },

    exclusionGroups: {
        quantification: {
            p2Id: 'full_zero_quant',
            p3Id: 'exp_zero_quant',
            p4Id: 'vague_outcomes',
            maxCombinedDeduction: 12.0,
        },
        bulletQuality: {
            p14Id: 'short_bullets',
            p15Id: 'long_bullets',
            combinedCapFactor: 0.5,
        },
    },

    parseFidelity: {
        imageDeduction:        8.0,
        multiColDeduction:     4.0,
        tableArtifactDeduction: 3.0,
    },

    atsSimulator: {
        deductions: {
            lenient: {
                imagePdf:       15,
                multiColHigh:    3,
                multiColMedium:  0,
                tableArtifact:   3,
                missingContact:  5,
                missingSection: 10,
            },
            medium: {
                imagePdf:       20,
                multiColHigh:    8,
                multiColMedium:  4,
                tableArtifact:   5,
                missingContact:  8,
                missingSection: 15,
            },
            strict: {
                imagePdf:       30,
                multiColHigh:   15,
                multiColMedium:  8,
                tableArtifact:  10,
                missingContact: 12,
                missingSection: 20,
            },
        },
    },
};
