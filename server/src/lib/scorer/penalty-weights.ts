// ═══════════════════════════════════════════════════════════════
// PENALTY WEIGHTS — Calibrated against Resume Worded
//
// KEY PRINCIPLE: Resume Worded gives 92 to a resume with
// strong quantification, good experience, GitHub/LinkedIn,
// but NO summary section. Our penalties must not push that
// resume below ~85.
//
// Total possible penalty if ALL fire: ~55 pts (impossible in practice)
// Typical penalty for a good resume: 5-15 pts
// Typical penalty for a weak resume: 25-40 pts
// ═══════════════════════════════════════════════════════════════

export const PENALTY_WEIGHTS = {
    personal_details:    9.0,
    // DOB/gender/marital: illegal screening criteria — harsh penalty justified

    full_zero_quant:    19.3,
    // ENTIRE resume (exp + projects) has zero numbers — devastating

    exp_zero_quant:      7.5,
    // Has work experience BUT all exp bullets lack any numbers

    vague_per_bullet:    1.0,
    // Per bullet: improvement verb present but no number (was 1.2, reduced)

    trivial_projects:    5.5,
    // Todo/calculator/static site OR "X days" duration

    filler_objective:    6.5,
    // Generic opener phrases detected

    hobbies_section:     3.0,
    // Hobbies/interests section present

    no_github:           2.5,
    // No github.com/username URL (was 3.5, reduced — not critical)

    soft_in_tech:        2.5,
    // Soft skills inside technical skills section (was 3.5, reduced)

    typo_per:            2.0,
    // Per spelling error (was 2.5, reduced)

    duplicate_metrics:  10.0,
    // Same % value in 3+ different bullets (was 14, reduced — too harsh)

    no_summary:          2.0,
    // No summary/profile/objective section
    // Resume Worded gives 92 without summary — this is a suggestion, not a penalty.
    // Keep it low so strong resumes without summary still score 88+.

    vague_achievement:   1.5,
    // "national hackathon" without naming the org

    // ── SECONDARY PENALTIES (lighter touch) ─────────────────

    short_bullets:       2.0,
    // Bullets that are too short (<30 chars) — only if 3+ short bullets

    long_bullets:        1.5,
    // Bullets that are too long (>200 chars) — only if 3+ long bullets

    weak_verbs:          2.5,
    // Bullets starting with weak/passive verbs (responsible for, worked on)

    no_linkedin:         1.5,
    // Missing LinkedIn profile URL (minor)

    repetitive_language: 2.0,
    // Same action verb used 4+ times across bullets (was 3+, raised threshold)

    missing_dates:       2.5,
    // Experience entries without date ranges

    too_few_bullets:     4.0,
    // Experience section with fewer than 3 bullets total

    excessive_skills:    1.5,
    // Skills section listing 35+ skills (was 30, raised threshold)
} as const;
