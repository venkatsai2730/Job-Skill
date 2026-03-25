// ═══════════════════════════════════════════════════════════════
// PENALTY WEIGHTS — Calibrated via L-BFGS-B on 5 resumes
// DO NOT modify these values.
// ═══════════════════════════════════════════════════════════════

export const PENALTY_WEIGHTS = {
    personal_details:    9.4,
    full_zero_quant:    26.4,
    exp_zero_quant:     14.5,
    vague_per_bullet:    1.72,
    trivial_projects:    7.4,
    filler_objective:   15.3,
    hobbies_section:     3.9,
    no_github:           4.4,
    soft_in_tech:        4.0,
    typo_per:            3.0,
    duplicate_metrics:   6.5,
    no_summary:          3.1,
    vague_achievement:   2.6,
} as const;
