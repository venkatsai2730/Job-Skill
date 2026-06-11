// ═══════════════════════════════════════════════════════════════
// PENALTY DETECTION — All 21 calibrated penalties
// All numeric constants live in scoring-config.ts — none here.
// ═══════════════════════════════════════════════════════════════

import { DEFAULT_CONFIG, type ScoringConfig } from './scoring-config.js';
import type { ParsedResume } from './helpers.js';
import { TYPO_LIST, extractBullets } from './helpers.js';

export interface PenaltyResult {
    id:           string;
    triggered:    boolean;
    deduction:    number;
    evidence:     string;
    fix:          string;
    priority:     1 | 2 | 3;
    scoreGain:    string;
    /** True when this penalty was detected but zeroed out by an exclusion group */
    suppressed?:  boolean;
    /** ID of the penalty that caused suppression */
    suppressedBy?: string;
}

const STRONG_NUM = /\d+(?:\.\d+)?\s*(%|x\b|times\b|users?|people|requests?|queries|ms\b|seconds?|records?|rows?|million|lakh|crore|\$|₹|lpa|accuracy|score|chunks?|throughput)/i;
const METRIC_CONTEXT = /(\d+(?:\.\d+)?)\s*(%|x\b)|(?:by|of|to|over|under|within|achieving|reduced|increased|improved|boosted|cut|slashed)\s+\d+|(?:top|rank)\s+\d+|\d+\s*\+/i;
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
    'focused and goal-oriented',
    'goal-oriented engineering',
    'goal-oriented',
    'strong communication, coordination',
    'make a winning',
    'making a career in',
    'contributing effectively',
];

const SOFT_TERMS = [
    'team collaboration', 'communication', 'problem solving',
    'problem-solving',    'curiosity to learn', 'time management',
    'leadership skills',  'interpersonal skills', 'adaptability',
    'teamwork',           'critical thinking', 'attention to detail',
    'multitasking',       'self-motivated',    'work ethic',
    'analytical thinking',
];

export function detectAllPenalties(resume: ParsedResume, config: ScoringConfig = DEFAULT_CONFIG): PenaltyResult[] {
    const W       = config.penalties;
    const T       = config.thresholds;
    const raw     = resume.rawText;
    const lower   = raw.toLowerCase();
    const sections = resume.sections;
    const results: PenaltyResult[] = [];

    let expBullets  = extractBullets(sections.experience?.raw);
    let projBullets = extractBullets(sections.projects?.raw);

    // CRITICAL FALLBACK: extract from rawText if section-specific extraction is sparse
    if (expBullets.length < 2 && raw.length > 200) {
        const expMatch = raw.match(/(?:^|\n)\s*(?:experience|work\s+experience|professional\s+experience|employment)\b/i);
        if (expMatch) {
            const startIdx = expMatch.index! + expMatch[0].length;
            const nextSection = raw.slice(startIdx).match(/\n\s*(?:projects?|education|skills?|technical\s+skills|certifications?|achievements?|summary|profile)\s*(?:\n|$)/i);
            const expText = nextSection ? raw.slice(startIdx, startIdx + nextSection.index!) : raw.slice(startIdx, startIdx + 3000);
            const rawExpBullets = extractBullets(expText);
            if (rawExpBullets.length > expBullets.length) expBullets = rawExpBullets;
        }
    }

    if (projBullets.length < 2 && raw.length > 200) {
        const projMatch = raw.match(/(?:^|\n)\s*(?:projects?|personal\s+projects|key\s+projects)\b/i);
        if (projMatch) {
            const startIdx = projMatch.index! + projMatch[0].length;
            const nextSection = raw.slice(startIdx).match(/\n\s*(?:experience|education|skills?|technical\s+skills|certifications?|achievements?|summary|profile)\s*(?:\n|$)/i);
            const projText = nextSection ? raw.slice(startIdx, startIdx + nextSection.index!) : raw.slice(startIdx, startIdx + 3000);
            const rawProjBullets = extractBullets(projText);
            if (rawProjBullets.length > projBullets.length) projBullets = rawProjBullets;
        }
    }

    let allBullets  = [...expBullets, ...projBullets];

    if (allBullets.length === 0 && raw.length > 100) {
        allBullets = extractBullets(raw)
            .filter(line => !/^(education|skills|summary|objective|contact|personal)/i.test(line));
    }

    // ── P1. PERSONAL DETAILS ────────────────────────────────
    const personalHits = (raw.match(
        /\b(date\s+of\s+birth|d\.?o\.?b\.?|gender|marital\s+status|personal\s+details|nationality|religion|caste|father'?s?\s+name|mother'?s?\s+name)\b/gi
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
    const anyStrongNum      = allBullets.some(b => STRONG_NUM.test(b) || METRIC_CONTEXT.test(b));
    const anyNumber         = allBullets.some(b => ANY_NUM.test(b));
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
    const vagueBullets = allBullets.filter(b => VAGUE_VERBS.test(b) && !ANY_NUM.test(b) && !METRIC_CONTEXT.test(b));

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
    const projectsRaw = sections.projects?.raw ?? '';
    const projRawForSearch = projectsRaw.length > 10 ? projectsRaw : raw;

    const trivialByTime  = /,\s*\d*\s*days?\b/gi.test(projRawForSearch) || /\b[1-7]\s*days?\b/gi.test(projRawForSearch);
    const projLower = projRawForSearch.toLowerCase();
    const trivialByTitle = [
        'todo', 'to-do list', 'calculator', 'restaurant website',
        'tourism website', 'static website', 'static site',
        'weather app', 'landing page', 'portfolio site',
    ].some(t => projLower.includes(t));

    const trivialFired = trivialByTime || trivialByTitle;

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
        raw.slice(0, 600)
    ).toLowerCase();

    const fillerHits = FILLER_PHRASES.filter(f => summaryText.includes(f));
    const hasSummarySection = !!(sections.summary?.raw || sections.profile?.raw || sections.objective?.raw);
    const fillerThreshold = hasSummarySection ? T.fillerWithSection : T.fillerWithout;
    const fillerTriggered = fillerHits.length >= fillerThreshold;

    results.push({
        id: 'filler_objective', priority: 2,
        triggered:  fillerTriggered,
        deduction:  fillerTriggered ? W.filler_objective : 0,
        evidence:   fillerHits.slice(0, 3).map(f => `"${f}"`).join(', '),
        fix:        'Replace with a 3-line professional summary with specific skills, projects, and target role.',
        scoreGain:  `+${W.filler_objective} pts`,
    });

    // ── P7. HOBBIES / INTERESTS SECTION ─────────────────────
    const hobbiesHits = raw.match(
        /\b(hobbies|other\s+interests|special\s+interests|extracurricular\s+activities|personal\s+interests|outside\s+interests)\b/gi
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
    const hasGitHubUrl = /github/i.test(raw) || /gh\s*:/i.test(raw);

    results.push({
        id: 'no_github', priority: 2,
        triggered:  !hasGitHubUrl,
        deduction:  !hasGitHubUrl ? W.no_github : 0,
        evidence:   !hasGitHubUrl ? 'No GitHub profile reference found.' : '',
        fix:        'Add your full GitHub URL to the contact header: github.com/yourusername.',
        scoreGain:  `+${W.no_github} pts`,
    });

    // ── P9. SOFT SKILLS IN TECHNICAL SECTION ────────────────
    const skillsRaw  = (sections.skills?.raw ?? '').toLowerCase();
    const softHits = SOFT_TERMS.filter(s => skillsRaw.includes(s));

    results.push({
        id: 'soft_in_tech', priority: 3,
        triggered:  softHits.length >= T.softSkillsCount,
        deduction:  softHits.length >= T.softSkillsCount ? W.soft_in_tech : 0,
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
        const matches = b.match(/(\d+)\s*(%|percent\b)/gi) ?? [];
        matches.forEach(m => {
            const num = m.match(/\d+/)?.[0];
            if (num) pctValues.push(`${num}%`);
        });
    });

    const pctCounts: Record<string, number> = {};
    pctValues.forEach(p => { pctCounts[p] = (pctCounts[p] ?? 0) + 1; });

    const dupeMetrics = Object.entries(pctCounts)
        .filter(([, n]) => n >= T.duplicateMetricsCount)
        .map(([p, n]) => `${p} used ${n} times`);

    results.push({
        id: 'duplicate_metrics', priority: 2,
        triggered:  dupeMetrics.length > 0,
        deduction:  dupeMetrics.length > 0 ? W.duplicate_metrics : 0,
        evidence:   dupeMetrics.join(', '),
        fix:        dupeMetrics.length > 0
            ? `Duplicated percentage values detected: ${dupeMetrics.join(', ')}. Fabricated-looking metrics damage credibility. Use distinct, specific numbers for each achievement.`
            : 'Using the same percentage 3+ times looks fabricated. Use distinct, specific metrics.',
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

    // ── P14. SHORT BULLETS ──────────────────────────────────
    const shortBullets = allBullets.filter(b => b.length < T.shortBulletChars);
    const shortBulletTriggered = shortBullets.length >= T.shortBulletCount;

    results.push({
        id: 'short_bullets', priority: 2,
        triggered:  shortBulletTriggered,
        deduction:  shortBulletTriggered ? W.short_bullets : 0,
        evidence:   shortBullets.slice(0, 2).map(b => `"${b}"`).join(', '),
        fix:        'Expand short bullets with specific details: what you did, how, and the measurable result.',
        scoreGain:  `+${W.short_bullets} pts`,
    });

    // ── P15. LONG BULLETS ───────────────────────────────────
    const longBullets = allBullets.filter(b => b.length > T.longBulletChars);
    const longBulletTriggered = longBullets.length >= T.longBulletCount;

    results.push({
        id: 'long_bullets', priority: 3,
        triggered:  longBulletTriggered,
        deduction:  longBulletTriggered ? W.long_bullets : 0,
        evidence:   `${longBullets.length} bullets exceed ${T.longBulletChars} characters`,
        fix:        'Break long bullets into 2 concise points. Each bullet should be 1 line (50-150 chars).',
        scoreGain:  `+${W.long_bullets} pts`,
    });

    // ── P16. WEAK VERBS ─────────────────────────────────────
    const WEAK_VERB_RE = /^(responsible\s+for|worked\s+on|helped|assisted|participated|involved\s+in|tasked\s+with|duties\s+included|was\s+part\s+of|contributed\s+to)\b/i;
    const weakVerbBullets = allBullets.filter(b => WEAK_VERB_RE.test(b.trim()));
    const weakVerbTriggered = weakVerbBullets.length >= T.weakVerbCount;

    results.push({
        id: 'weak_verbs', priority: 2,
        triggered:  weakVerbTriggered,
        deduction:  weakVerbTriggered ? W.weak_verbs : 0,
        evidence:   weakVerbBullets.slice(0, 2).map(b => `"${b.slice(0, 60)}..."`).join(', '),
        fix:        'Replace "Responsible for X" with "Built/Designed/Implemented X, resulting in Y".',
        scoreGain:  `+${W.weak_verbs} pts`,
    });

    // ── P17. NO LINKEDIN ────────────────────────────────────
    const hasLinkedIn = /linkedin/i.test(raw);

    results.push({
        id: 'no_linkedin', priority: 3,
        triggered:  !hasLinkedIn,
        deduction:  !hasLinkedIn ? W.no_linkedin : 0,
        evidence:   !hasLinkedIn ? 'No linkedin.com/in/ URL found.' : '',
        fix:        'Add your LinkedIn profile URL to the contact header.',
        scoreGain:  `+${W.no_linkedin} pts`,
    });

    // ── P18. REPETITIVE LANGUAGE ────────────────────────────
    const firstVerbs: Record<string, number> = {};
    allBullets.forEach(b => {
        const firstWord = b.trim().replace(/^[•\-–—*▪►\s]+/, '').split(/\s+/)[0]?.toLowerCase();
        if (firstWord && firstWord.length > 2) {
            firstVerbs[firstWord] = (firstVerbs[firstWord] || 0) + 1;
        }
    });
    const repeatedVerbs = Object.entries(firstVerbs)
        .filter(([, n]) => n >= T.repetitiveVerbCount)
        .map(([v, n]) => `"${v}" (${n}x)`);
    const repetitiveTriggered = repeatedVerbs.length > 0;

    results.push({
        id: 'repetitive_language', priority: 2,
        triggered:  repetitiveTriggered,
        deduction:  repetitiveTriggered ? W.repetitive_language : 0,
        evidence:   repeatedVerbs.join(', '),
        fix:        'Vary your action verbs. Using the same verb 3+ times makes bullets feel repetitive.',
        scoreGain:  `+${W.repetitive_language} pts`,
    });

    // ── P19. MISSING DATES ──────────────────────────────────
    const expRaw = sections.experience?.raw ?? '';
    const hasExpSection = expRaw.trim().length > 30;
    const hasDateRange = /\b(19|20)\d{2}\b/.test(expRaw) || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present|current)\b/i.test(expRaw);
    const missingDatesTriggered = hasExpSection && !hasDateRange;

    results.push({
        id: 'missing_dates', priority: 2,
        triggered:  missingDatesTriggered,
        deduction:  missingDatesTriggered ? W.missing_dates : 0,
        evidence:   missingDatesTriggered ? 'Experience section has no date ranges.' : '',
        fix:        'Add date ranges to every experience entry: "Jan 2023 – Present" or "2022 – 2024".',
        scoreGain:  `+${W.missing_dates} pts`,
    });

    // ── P20. TOO FEW BULLETS ────────────────────────────────
    const tooFewTriggered = hasExpSection && expBullets.length < T.tooFewBulletsCount && expBullets.length > 0;

    results.push({
        id: 'too_few_bullets', priority: 1,
        triggered:  tooFewTriggered,
        deduction:  tooFewTriggered ? W.too_few_bullets : 0,
        evidence:   tooFewTriggered ? `Only ${expBullets.length} experience bullet(s) found.` : '',
        fix:        'Add 3-5 bullets per role describing your key contributions and measurable impact.',
        scoreGain:  `+${W.too_few_bullets} pts`,
    });

    // ── P21. EXCESSIVE SKILLS ───────────────────────────────
    const skillsRawText = sections.skills?.raw ?? '';
    const skillTokens = skillsRawText.split(/[,|•\n]/).map(s => s.trim()).filter(s => s.length > 1);
    const excessiveSkillsTriggered = skillTokens.length > T.excessiveSkillsCount;

    results.push({
        id: 'excessive_skills', priority: 3,
        triggered:  excessiveSkillsTriggered,
        deduction:  excessiveSkillsTriggered ? W.excessive_skills : 0,
        evidence:   excessiveSkillsTriggered ? `${skillTokens.length} skills listed — too many.` : '',
        fix:        'Trim to 15-20 most relevant skills. Long lists dilute your strongest skills.',
        scoreGain:  `+${W.excessive_skills} pts`,
    });

    // ══════════════════════════════════════════════════════════
    // EXCLUSION GROUPS — applied after all 21 penalties are built
    // ══════════════════════════════════════════════════════════

    const eg = config.exclusionGroups;

    // ── Group 1: Quantification (P2, P3, P4) ─────────────────
    const p2 = results.find(r => r.id === eg.quantification.p2Id);
    const p3 = results.find(r => r.id === eg.quantification.p3Id);
    const p4 = results.find(r => r.id === eg.quantification.p4Id);

    if (p2?.triggered) {
        // P2 fires → suppress P3 and P4 entirely
        if (p3?.triggered) {
            p3.suppressed   = true;
            p3.suppressedBy = eg.quantification.p2Id;
            p3.deduction    = 0;
        }
        if (p4?.triggered) {
            p4.suppressed   = true;
            p4.suppressedBy = eg.quantification.p2Id;
            p4.deduction    = 0;
        }
    } else if (p3?.triggered && p4?.triggered) {
        // P3 fires but not P2 → suppress P4 for experience bullets only
        const vagueExpBullets  = expBullets.filter(b => VAGUE_VERBS.test(b) && !ANY_NUM.test(b) && !METRIC_CONTEXT.test(b));
        const vagueProjBullets = projBullets.filter(b => VAGUE_VERBS.test(b) && !ANY_NUM.test(b) && !METRIC_CONTEXT.test(b));

        if (vagueProjBullets.length === 0) {
            // All vague bullets are in experience — P3 already covers this root cause
            p4.suppressed   = true;
            p4.suppressedBy = eg.quantification.p3Id;
            p4.deduction    = 0;
        } else {
            // Some vague bullets are in projects — P4 fires only for those
            p4.deduction = Math.round(vagueProjBullets.length * W.vague_per_bullet * 10) / 10;
        }
    }

    // Apply the combined quantification deduction cap
    const quantIds = [eg.quantification.p2Id, eg.quantification.p3Id, eg.quantification.p4Id];
    const quantTotal = results
        .filter(r => quantIds.includes(r.id) && r.triggered && !r.suppressed)
        .reduce((s, r) => s + r.deduction, 0);

    if (quantTotal > eg.quantification.maxCombinedDeduction) {
        // Reduce P4 first (lowest-priority in this group), then P3, then P2
        const overBy = quantTotal - eg.quantification.maxCombinedDeduction;
        const p4Active = p4 && p4.triggered && !p4.suppressed;
        const p3Active = p3 && p3.triggered && !p3.suppressed;

        if (p4Active && p4!.deduction >= overBy) {
            p4!.deduction = Math.max(0, p4!.deduction - overBy);
        } else if (p4Active && p3Active) {
            const remainder = overBy - p4!.deduction;
            p4!.deduction = 0;
            p3!.deduction = Math.max(0, p3!.deduction - remainder);
        }
    }

    // ── Group 2: Bullet quality cap (P14 + P15) ──────────────
    const p14 = results.find(r => r.id === eg.bulletQuality.p14Id);
    const p15 = results.find(r => r.id === eg.bulletQuality.p15Id);

    if (p14?.triggered && p15?.triggered) {
        const larger  = Math.max(p14.deduction, p15.deduction);
        const smaller = Math.min(p14.deduction, p15.deduction);
        const cap     = larger + eg.bulletQuality.combinedCapFactor * smaller;
        const current = p14.deduction + p15.deduction;

        if (current > cap) {
            // Reduce the penalty with the smaller deduction
            if (p14.deduction <= p15.deduction) {
                p14.deduction = Math.max(0, cap - p15.deduction);
            } else {
                p15.deduction = Math.max(0, cap - p14.deduction);
            }
        }
    }

    return results;
}
