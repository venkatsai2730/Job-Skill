// ═══════════════════════════════════════════════════════════════
// PENALTY WEIGHTS — Calibrated against Resume Worded on 5 resumes
// ═══════════════════════════════════════════════════════════════

export const PENALTY_WEIGHTS = {
    personal_details:    9.0,
    // DOB/gender/marital: illegal screening criteria

    full_zero_quant:    19.3,
    // ENTIRE resume (exp + projects) has zero numbers

    exp_zero_quant:      7.5,
    // Has work experience BUT all exp bullets lack any numbers

    vague_per_bullet:    1.2,
    // Per bullet: improvement verb present but no number

    trivial_projects:    5.5,
    // Todo/calculator/static site OR "X days" duration

    filler_objective:    6.5,
    // Generic opener phrases detected

    hobbies_section:     3.0,
    // Hobbies/interests section present

    no_github:           3.5,
    // No github.com/username URL

    soft_in_tech:        3.5,
    // Soft skills inside technical skills section

    typo_per:            2.5,
    // Per spelling error

    duplicate_metrics:  14.0,
    // Same % value in 3+ different bullets

    no_summary:          2.0,
    // No summary/profile/objective section at all

    vague_achievement:   2.0,
    // "national hackathon" without naming the org
} as const;
