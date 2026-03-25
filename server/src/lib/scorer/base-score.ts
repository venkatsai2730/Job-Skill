// ═══════════════════════════════════════════════════════════════
// BASE SCORE — Structure-based generous scoring (4 categories)
// Range: ~65–98 for any well-formed PDF. Avg complete fresher: ~86
// ═══════════════════════════════════════════════════════════════

import type { ParsedResume } from './helpers.js';
import { countTypos, countMatchedSkills, computePowerVerbRatio } from './helpers.js';

const STRONG_NUM = /\d+\s*(%|x\b|times\b|users?|people|requests?|queries|ms\b|seconds?|records?|rows?|million|lakh|crore|\$|₹|lpa)/i;

export function computeBaseScore(resume: ParsedResume): number {
    const raw       = resume.rawText;
    const sections  = resume.sections;
    const wordCount = raw.split(/\s+/).length;
    const fileMB    = (resume.metadata?.fileSizeMB ?? 0);

    // ── ATS COMPATIBILITY (0–25 pts) ────────────────────────

    // File quality (0–8)
    const fileScore = (fileMB < 5 ? 4 : 2) +
                      (wordCount >= 150 && wordCount <= 1200 ? 4 : 2);

    // Format quality (0–9)
    const specialCharCount = (raw.match(/[^\w\s.,;:\-()\[\]|•\/\n@+#%]/g) ?? []).length;
    const formatScore = specialCharCount > 30 ? 6 : 9;

    // Section headers (0–8)
    const sectionPresence = [
        !!(sections.experience?.raw || sections.projects?.raw),
        !!sections.education?.raw,
        !!sections.skills?.raw,
        !!sections.projects?.raw,
    ];
    const headerScore = Math.round((sectionPresence.filter(Boolean).length / 4) * 8);

    const atsScore = Math.min(25, fileScore + formatScore + headerScore);

    // ── STYLE (0–25 pts) ────────────────────────────────────

    const hasExp  = (sections.experience?.bullets?.length ?? 0) > 0;
    const minWC   = hasExp ? 300 : 200;
    const maxWC   = hasExp ? 900 : 650;

    let lengthScore = 10;
    if (wordCount < minWC) lengthScore = Math.max(4, 10 - Math.floor((minWC - wordCount) / 25));
    if (wordCount > maxWC) lengthScore = Math.max(4, 10 - Math.floor((wordCount - maxWC) / 60));

    // Penalise old-style objective vs modern summary
    const hasObjective = !!sections.objective?.raw?.trim();
    const hasSummary   = !!sections.summary?.raw?.trim();
    if (hasObjective && !hasSummary) lengthScore = Math.max(0, lengthScore - 3);

    const typoCount        = countTypos(raw);
    const consistencyScore = Math.max(3, 7 - typoCount * 2);

    const expBullets  = sections.experience?.bullets ?? [];
    const projBullets = sections.projects?.bullets   ?? [];
    const allBullets  = [...expBullets, ...projBullets];
    const bulletTotal = allBullets.length;
    const readabilityScore = bulletTotal >= 5 ? 5 : 3;

    const styleScore = Math.min(25, lengthScore + consistencyScore + readabilityScore);

    // ── KEYWORDS (0–15 pts) ─────────────────────────────────

    const skillCount = countMatchedSkills(raw);
    const skillScore = Math.min(8, Math.round(skillCount / 2.0));

    const contactScore = [
        /[\w.+]+@[\w.]+\.[a-z]{2,}/i.test(raw),
        /(\+91[\s-]?)?\d{10}/.test(raw),
        /linkedin\.com\/in\//i.test(raw),
        /github\.com\/[a-zA-Z0-9_-]+/i.test(raw),
    ].filter(Boolean).length;

    const eduScore = sections.education?.raw ? 3 : 0;

    // Premium institution bonus
    const eduText = (sections.education?.raw ?? '').toLowerCase();
    const institutionBonus = /\b(iit|nit\s|iiit|bits\s+pilani|bits,\s*pilani|iim\b|xlri|sp\s+jain)\b/.test(eduText) ? 3 : 0;

    // Publication bonus
    const pubBonus = /\b(ieee|arxiv|springer|acm\s+dl|published|conference\s+proceedings)\b/i.test(raw) ? 2 : 0;

    const keywordScore = Math.min(15, skillScore + contactScore + eduScore + institutionBonus + pubBonus);

    // ── IMPACT (0–35 pts) ───────────────────────────────────

    let quantScore = 0;
    if (expBullets.length > 0) {
        const eRatio = expBullets.filter(b => STRONG_NUM.test(b)).length / expBullets.length;
        const pRatio = projBullets.filter(b => STRONG_NUM.test(b)).length / Math.max(1, projBullets.length);
        quantScore   = Math.min(20, eRatio * 14 + pRatio * 6);
    } else {
        const pRatio = projBullets.filter(b => STRONG_NUM.test(b)).length / Math.max(1, projBullets.length);
        quantScore   = Math.min(12, pRatio * 12);
    }

    const powerVerbRatio = computePowerVerbRatio(allBullets);
    const verbScore      = Math.min(15, Math.round(powerVerbRatio * 15));

    const impactScore = Math.min(35, Math.round(quantScore + verbScore));

    return impactScore + atsScore + styleScore + keywordScore;
}
