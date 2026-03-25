// ═══════════════════════════════════════════════════════════════
// PENALTY DETECTION — All 13 calibrated penalties
// ═══════════════════════════════════════════════════════════════

import { PENALTY_WEIGHTS } from './penalty-weights.js';
import type { ParsedResume } from './helpers.js';
import { TYPO_LIST } from './helpers.js';

const W = PENALTY_WEIGHTS;

export interface PenaltyResult {
    id:        string;
    triggered: boolean;
    deduction: number;
    evidence:  string;
    fix:       string;
    priority:  1 | 2 | 3;
    scoreGain: string;
}

const STRONG_NUM = /\d+\s*(%|x\b|times\b|users?|people|requests?|queries|ms\b|seconds?|records?|rows?|million|lakh|crore|\$|₹|lpa)/i;
const ANY_NUM    = /\d+/;

const VAGUE_VERBS = /\b(improving|improved|enhancing|enhanced|boosting|boosted|increasing|increased|reducing|reduced|decreasing|decreased|optimizing|optimised|optimized|streamlining|streamlined|accelerating|accelerated|strengthening|strengthened|maximizing|maximised|minimizing|minimised)\b/i;

const FILLER_PHRASES = [
    'motivated and dedicated', 'motivated and hardworking',
    'seeking an entry-level',  'seeking a challenging position',
    'seeking a position where', 'to obtain a position',
    'zeal to',                 'winning career',
    'dynamic professional',    'results-driven individual',
    'go-getter',               'hard-working individual',
    'team player who',         'contribute to team goals',
    'contribute to organizational', 'where i can apply my',
    'grow professionally',     'eager to learn and grow',
    'self-motivated individual', 'dedicated and motivated',
    'passion for learning',    'enthusiastic fresher',
];

const SOFT_TERMS = [
    'team collaboration', 'communication', 'problem solving',
    'problem-solving',    'curiosity to learn', 'time management',
    'leadership skills',  'interpersonal skills', 'adaptability',
    'teamwork',           'critical thinking', 'attention to detail',
    'multitasking',       'self-motivated',    'work ethic',
    'analytical thinking',
];

export function detectAllPenalties(resume: ParsedResume): PenaltyResult[] {
    const raw      = resume.rawText;
    const lower    = raw.toLowerCase();
    const sections = resume.sections;
    const results: PenaltyResult[] = [];

    const expBullets  = sections.experience?.bullets ?? [];
    const projBullets = sections.projects?.bullets   ?? [];
    const allBullets  = [...expBullets, ...projBullets];

    // ── P1. PERSONAL DETAILS ────────────────────────────────
    const personalHits = (raw.match(
        /\b(date\s+of\s+birth|d\.?o\.?b\.?|gender\s*:|marital\s+status|nationality\s*:|religion\s*:|caste\s*:|father'?s?\s+name|mother'?s?\s+name)\b/gi
    ) ?? []);

    results.push({
        id: 'personal_details', priority: 1,
        triggered:  personalHits.length > 0,
        deduction:  personalHits.length > 0 ? W.personal_details : 0,
        evidence:   personalHits.join(', '),
        fix:        'Remove DOB, gender, and marital status. Illegal screening criteria in most countries.',
        scoreGain:  `+${W.personal_details} pts`,
    });

    // ── P2. FULL ZERO QUANTIFICATION ────────────────────────
    const anyStrongNum     = allBullets.some(b => STRONG_NUM.test(b));
    const anyNumber        = allBullets.some(b => ANY_NUM.test(b));
    const fullZeroTriggered = allBullets.length > 0 && !anyStrongNum && !anyNumber;

    results.push({
        id: 'full_zero_quant', priority: 1,
        triggered:  fullZeroTriggered,
        deduction:  fullZeroTriggered ? W.full_zero_quant : 0,
        evidence:   fullZeroTriggered
            ? `Checked ${allBullets.length} bullets — no numbers found anywhere.`
            : '',
        fix:        'Add at least one number to every bullet: users reached, requests/day, % improvement.',
        scoreGain:  `+${W.full_zero_quant} pts`,
    });

    // ── P3. EXPERIENCE ZERO QUANTIFICATION ──────────────────
    const expHasNumbers    = expBullets.some(b => ANY_NUM.test(b));
    const expZeroTriggered = expBullets.length > 0 && !expHasNumbers && !fullZeroTriggered;

    results.push({
        id: 'exp_zero_quant', priority: 1,
        triggered:  expZeroTriggered,
        deduction:  expZeroTriggered ? W.exp_zero_quant : 0,
        evidence:   expZeroTriggered
            ? `Experience bullets with zero metrics:\n${expBullets.slice(0, 2).map(b => `"${b.slice(0, 90)}"`).join('\n')}`
            : '',
        fix:        'Every work experience bullet needs a number. Add requests/day, % latency reduction, team size.',
        scoreGain:  `+${W.exp_zero_quant} pts`,
    });

    // ── P4. VAGUE OUTCOMES WITHOUT NUMBERS ──────────────────
    const vagueBullets = allBullets.filter(b => VAGUE_VERBS.test(b) && !ANY_NUM.test(b));

    results.push({
        id: 'vague_outcomes', priority: 2,
        triggered:  vagueBullets.length > 0,
        deduction:  vagueBullets.length > 0
            ? Math.round(vagueBullets.length * W.vague_per_bullet * 10) / 10
            : 0,
        evidence:   vagueBullets.slice(0, 3).map(b => `"${b.slice(0, 90)}"`).join('\n'),
        fix:        'Add a number after every improvement verb: "improving latency" → "improving latency by 40%"',
        scoreGain:  `+${(vagueBullets.length * W.vague_per_bullet).toFixed(1)} pts`,
    });

    // ── P5. TRIVIAL PROJECTS ────────────────────────────────
    const projRaw        = (sections.projects?.raw ?? '').toLowerCase();
    const trivialByTime  = /\b[1-7]\s*days?\b/gi.test(projRaw);
    const trivialByTitle = /\b(todo|to-do\s+list|calculator\s+app|weather\s+app|landing\s+page|static\s+website|portfolio\s+site)\b/gi.test(projRaw);
    const trivialFired   = trivialByTime || trivialByTitle;

    results.push({
        id: 'trivial_projects', priority: 1,
        triggered:  trivialFired,
        deduction:  trivialFired ? W.trivial_projects : 0,
        evidence:   trivialFired
            ? (trivialByTime ? 'Project duration in days detected.' : 'Known trivial project type detected.')
            : '',
        fix:        'Replace with projects that show system thinking: full-stack apps with auth + DB + API.',
        scoreGain:  `+${W.trivial_projects} pts`,
    });

    // ── P6. FILLER OBJECTIVE / SUMMARY ──────────────────────
    const summaryText = (
        sections.summary?.raw  ||
        sections.objective?.raw ||
        sections.profile?.raw  ||
        raw.slice(0, 500)
    ).toLowerCase();

    const fillerHits = FILLER_PHRASES.filter(f => summaryText.includes(f));

    results.push({
        id: 'filler_objective', priority: 2,
        triggered:  fillerHits.length >= 2,
        deduction:  fillerHits.length >= 2 ? W.filler_objective : 0,
        evidence:   fillerHits.slice(0, 3).map(f => `"${f}"`).join(', '),
        fix:        'Replace with a 3-line professional summary with specific skills, projects, and target role.',
        scoreGain:  `+${W.filler_objective} pts`,
    });

    // ── P7. HOBBIES / INTERESTS SECTION ─────────────────────
    const hobbiesHits = raw.match(
        /\b(hobbies|other interests|special interests|extracurricular activities|personal interests|outside interests)\b/gi
    ) ?? [];

    results.push({
        id: 'hobbies_section', priority: 2,
        triggered:  hobbiesHits.length > 0,
        deduction:  hobbiesHits.length > 0 ? W.hobbies_section : 0,
        evidence:   [...new Set(hobbiesHits)].join(', '),
        fix:        'Remove hobbies and interests sections entirely. Use the space for projects or certifications.',
        scoreGain:  `+${W.hobbies_section} pts`,
    });

    // ── P8. MISSING GITHUB URL ──────────────────────────────
    const hasGitHubUrl = /github\.com\/[a-zA-Z0-9_-]+/i.test(raw);

    results.push({
        id: 'no_github', priority: 2,
        triggered:  !hasGitHubUrl,
        deduction:  !hasGitHubUrl ? W.no_github : 0,
        evidence:   !hasGitHubUrl ? 'No github.com/username URL found.' : '',
        fix:        'Add your full GitHub URL to the contact header: github.com/yourusername.',
        scoreGain:  `+${W.no_github} pts`,
    });

    // ── P9. SOFT SKILLS IN TECHNICAL SECTION ────────────────
    const skillsRaw  = (sections.skills?.raw ?? '').toLowerCase();
    const softHits = SOFT_TERMS.filter(s => skillsRaw.includes(s));

    results.push({
        id: 'soft_in_tech', priority: 3,
        triggered:  softHits.length >= 2,
        deduction:  softHits.length >= 2 ? W.soft_in_tech : 0,
        evidence:   softHits.slice(0, 3).join(', '),
        fix:        'Remove soft skills from the technical skills section. ATS parses this for hard skills only.',
        scoreGain:  `+${W.soft_in_tech} pts`,
    });

    // ── P10. SPELLING TYPOS ─────────────────────────────────
    const typosFound = Object.entries(TYPO_LIST)
        .filter(([typo]) => lower.includes(typo));

    results.push({
        id: 'typos', priority: 3,
        triggered:  typosFound.length > 0,
        deduction:  typosFound.length > 0
            ? Math.round(typosFound.length * W.typo_per * 10) / 10
            : 0,
        evidence:   typosFound.map(([t, c]) => `"${t}" → "${c}"`).join(', '),
        fix:        `Fix spelling: ${typosFound.map(([t, c]) => `"${t}" should be "${c}"`).join(', ')}`,
        scoreGain:  `+${(typosFound.length * W.typo_per).toFixed(1)} pts`,
    });

    // ── P11. DUPLICATE METRICS ──────────────────────────────
    const pctValues: string[] = [];
    allBullets.forEach(b => {
        (b.match(/\d+\s*%/g) ?? []).forEach(m => pctValues.push(m.replace(/\s/, '')));
    });
    const pctCounts: Record<string, number> = {};
    pctValues.forEach(p => { pctCounts[p] = (pctCounts[p] ?? 0) + 1; });
    const dupeMetrics = Object.entries(pctCounts)
        .filter(([, n]) => n >= 3)
        .map(([p, n]) => `${p} appears ${n}×`);

    results.push({
        id: 'duplicate_metrics', priority: 3,
        triggered:  dupeMetrics.length > 0,
        deduction:  dupeMetrics.length > 0 ? W.duplicate_metrics : 0,
        evidence:   dupeMetrics.join(', '),
        fix:        'Using the same percentage 3+ times looks fabricated. Use distinct, specific metrics.',
        scoreGain:  `+${W.duplicate_metrics} pts`,
    });

    // ── P12. NO SUMMARY / PROFILE ───────────────────────────
    const hasSummary   = !!sections.summary?.raw?.trim();
    const hasProfile   = !!sections.profile?.raw?.trim();
    const hasObjective = !!sections.objective?.raw?.trim();

    results.push({
        id: 'no_summary', priority: 3,
        triggered:  !hasSummary && !hasProfile && !hasObjective,
        deduction:  !hasSummary && !hasProfile && !hasObjective ? W.no_summary : 0,
        evidence:   'No summary, profile, or objective section found.',
        fix:        'Add a 3-line summary at the top. Recruiters spend 6 seconds on first scan.',
        scoreGain:  `+${W.no_summary} pts`,
    });

    // ── P13. VAGUE ACHIEVEMENT ──────────────────────────────
    const achRaw     = sections.achievements?.raw ?? '';
    const hasVagueAch = /\b(national|international|global)\s+(level\s+)?(hackathon|competition|contest|event)\b/i.test(achRaw)
                     && !/\b(iit|nit|iiit|bits|ieee|acm|google|amazon|microsoft|unstop|devfolio|hackerearth|topcoder|kaggle)\b/i.test(achRaw);

    results.push({
        id: 'vague_achievement', priority: 3,
        triggered:  hasVagueAch,
        deduction:  hasVagueAch ? W.vague_achievement : 0,
        evidence:   hasVagueAch ? 'Achievement uses "national/international" without naming the organiser' : '',
        fix:        'Name the org and scale: "Top 5 at IIT Bombay ML Hackathon on Unstop (2024, 800+ teams)"',
        scoreGain:  `+${W.vague_achievement} pts`,
    });

    return results;
}
