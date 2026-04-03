// ═══════════════════════════════════════════════════════════════
// BASE SCORE — Universal signal detection (6 components)
// Range: ~50 (terrible) to ~98 (exceptional)
// No hardcoded institution names. No hardcoded company names.
// Pure universal signal detection only.
// ═══════════════════════════════════════════════════════════════

import type { ParsedResume } from './helpers.js';
import { countTypos, countMatchedSkills, getAllBullets, extractBullets } from './helpers.js';

export function computeBaseScore(resume: ParsedResume): number {
    const raw      = resume.rawText;
    const sections = resume.sections;
    const wc       = raw.split(/\s+/).length;

    // ── STEP 0: BULLET EXTRACTION (critical fix) ────────────
    const expBullets  = extractBullets(sections.experience?.raw);
    const projBullets = extractBullets(sections.projects?.raw);
    let allBullets  = [...expBullets, ...projBullets];

    // Fallback: extract from rawText if sections are empty
    if (allBullets.length === 0 && raw.length > 100) {
        allBullets = extractBullets(raw)
            .filter(line => !/^(education|skills|summary|objective|contact|personal)/i.test(line));
    }

    console.log('[BulletCheck]', {
        file:       resume.metadata?.fileName,
        expCount:   expBullets.length,
        projCount:  projBullets.length,
        expSample:  expBullets[0]?.slice(0, 60),
        projSample: projBullets[0]?.slice(0, 60),
    });

    // ══════════════════════════════════════════════════════════
    // COMPONENT 1: QUANTIFICATION (0–38)
    // THE primary signal. Measures whether the candidate proves
    // impact with numbers. Universal for every field.
    // ══════════════════════════════════════════════════════════

    const STRONG_NUM = /\d+\s*(%|x\b|times\b|ms\b|users?|requests?|records?|rows?|accuracy|throughput|lakh|million|\$|₹|hrs?|hours?|days?|weeks?|months?|years?|pts?|points?|reduction|improvement|increase)/i;
    const ANY_NUM    = /\d+/;

    let quantScore = 0;
    if (expBullets.length > 0) {
        const eq = expBullets.filter(b => STRONG_NUM.test(b) || ANY_NUM.test(b)).length / expBullets.length;
        const pq = projBullets.filter(b => STRONG_NUM.test(b) || ANY_NUM.test(b)).length / Math.max(1, projBullets.length);

        if (eq > 0) {
            // Has quantified exp bullets — full scoring
            quantScore = Math.min(32, (eq * 22) + (pq * 12));
        } else {
            // Exp exists but 0 quantified — projects carry weight
            quantScore = Math.min(18, pq * 20);
        }
    } else {
        // No experience — only projects
        const pq = projBullets.filter(b => STRONG_NUM.test(b) || ANY_NUM.test(b)).length / Math.max(1, projBullets.length);
        quantScore = Math.min(13, pq * 14);
    }

    // IMPACT LANGUAGE: Action verbs at start of bullets. Universal signal.
    const POWER_VERBS_RE = /^(built|engineered|developed|designed|implemented|deployed|optimized|optimised|improved|reduced|increased|automated|architected|led|delivered|launched|created|achieved|scaled|migrated|refactored|streamlined|authored|drove|generated|spearheaded|orchestrated|boosted|containerized|containerised|trained|analysed|analyzed|configured|integrated|maintained|established|produced|managed|executed|modelled|modeled|diagnosed|debugged|resolved|coordinated|negotiated|secured|demonstrated)\b/i;

    const verbScore = allBullets.length > 0
        ? Math.min(11, Math.round(
            allBullets.filter(b => POWER_VERBS_RE.test(b.trim())).length
            / allBullets.length * 12
          ))
        : 0;

    const quantificationScore = Math.min(38, quantScore + verbScore);

    // ══════════════════════════════════════════════════════════
    // COMPONENT 2: EXPERIENCE PRESENCE BONUS (0–14)
    // UNIVERSAL: having real professional experience is a major
    // differentiator. Detects professional role keywords.
    // ══════════════════════════════════════════════════════════

    const proExpPattern = /\b(intern|internship|engineer|developer|analyst|associate|trainee|consultant|researcher|scientist|designer|assistant|coordinator\s+at|freelance)\b/i;
    const expSectionRaw = sections.experience?.raw ?? '';
    const isProfessionalExp = proExpPattern.test(expSectionRaw);
    const profExpBullets = isProfessionalExp ? expBullets : [];

    let experienceBonus = 0;
    if (profExpBullets.length >= 4)      experienceBonus = 14;
    else if (profExpBullets.length >= 2) experienceBonus = 10;
    else if (profExpBullets.length >= 1) experienceBonus = 7;

    // Org/club experience bonus — for non-professional but structured roles
    // (club coordinator, committee member, org officer, team lead, etc.)
    // Only fires when: experience section exists BUT isProfessionalExp = false
    const orgBonus = (expBullets.length > 0 && !isProfessionalExp) ? 8 : 0;

    // ══════════════════════════════════════════════════════════
    // COMPONENT 3: ATS COMPATIBILITY (0–20)
    // File quality, format quality, section headers presence.
    // ══════════════════════════════════════════════════════════

    const fileMB    = (resume.metadata?.fileSizeBytes ?? 0) / 1_048_576;
    const actualMB  = fileMB > 0 ? fileMB : (resume.metadata?.fileSizeMB ?? 0);
    const fileScore = (actualMB < 5 ? 4 : 2) + (wc >= 150 && wc <= 1200 ? 3 : 1);

    const specials  = (raw.match(/[^\w\s.,;:\-()\[\]|•\/\n@+#%]/g) ?? []).length;
    const fmtScore  = specials > 30 ? 4 : 7;

    const sectionCount = [
        !!(sections.experience?.raw || sections.projects?.raw),
        !!sections.education?.raw,
        !!sections.skills?.raw,
        !!sections.projects?.raw,
    ].filter(Boolean).length;
    const headerScore = Math.round((sectionCount / 4) * 7);

    const atsScore = Math.min(20, fileScore + fmtScore + headerScore);

    // ══════════════════════════════════════════════════════════
    // COMPONENT 4: STYLE & READABILITY (0–14)
    // Length, consistency, bullet structure.
    // ══════════════════════════════════════════════════════════

    const hasExp  = expBullets.length > 0;
    const minWC   = hasExp ? 300 : 200;
    const maxWC   = hasExp ? 900 : 650;

    let lengthScore = 7;
    if (wc < minWC) lengthScore = Math.max(3, 7 - Math.floor((minWC - wc) / 30));
    if (wc > maxWC) lengthScore = Math.max(3, 7 - Math.floor((wc - maxWC) / 70));

    const hasObjective = !!sections.objective?.raw?.trim();
    const hasSummary   = !!sections.summary?.raw?.trim();
    if (hasObjective && !hasSummary) lengthScore = Math.max(0, lengthScore - 2);

    const typoCount        = countTypos(raw);
    const consistencyScore = Math.max(2, 5 - Math.round(typoCount * 1.5));

    const bulletCount      = getAllBullets(resume).length;
    const readabilityScore = bulletCount >= 5 ? 3 : 1;

    const styleScore = Math.min(14, Math.round((lengthScore + consistencyScore + readabilityScore) * 0.88));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 5: SKILLS & CONTACT (0–10) — UNIVERSAL
    // No institution names. No company names.
    // Counts tech skills, contact links, education presence,
    // and publication signals.
    // ══════════════════════════════════════════════════════════

    const skillCount  = countMatchedSkills(raw);
    const skillScore  = Math.min(4, Math.round(skillCount / 3));

    const contactScore = [
        /[\w.+]+@[\w.]+\.[a-z]{2,}/i.test(raw),           // email
        /(\+?\d[\d\s\-]{8,}\d)/.test(raw),                 // phone (universal)
        /linkedin\.com\/in\//i.test(raw),                  // LinkedIn
        /github\.com\/[a-zA-Z0-9_-]+/i.test(raw),         // GitHub
    ].filter(Boolean).length;                               // 0–4

    const eduPresent = sections.education?.raw ? 2 : 0;

    // Publications — universal signal (any field)
    const pubBonus = /\b(ieee|arxiv|springer|acm|published|conference\s+proceedings|journal|paper\s+presented)\b/i.test(raw) ? 2 : 0;

    const skillsContactScore = Math.min(10, Math.round((skillScore + contactScore + eduPresent + pubBonus) * 0.72));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 6: ACHIEVEMENT BONUS (0–3)
    // Scaled by count: +1 per achievement bullet, capped at 3.
    // ══════════════════════════════════════════════════════════

    const achBullets = extractBullets(sections.achievements?.raw);
    const achievementBonus = Math.min(3, achBullets.length);

    // ══════════════════════════════════════════════════════════
    // FRESHER BONUS: resumes with no professional experience
    // get +8 to normalise against experienced candidates.
    // They compete in the fresher pool, not the experienced pool.
    // ══════════════════════════════════════════════════════════

    const hasWorkExp   = profExpBullets.length > 0;
    const hasEducation = !!sections.education?.raw;

    const baseTotal = quantificationScore + experienceBonus + orgBonus + atsScore + styleScore + skillsContactScore + achievementBonus;

    console.log('[BaseScore]', resume.metadata?.fileName ?? 'unknown', {
        qv:              quantificationScore,
        expBonus:        experienceBonus,
        orgBonus:        orgBonus,
        ats:             atsScore,
        style:           styleScore,
        skillsContact:   skillsContactScore,
        achBonus:        achievementBonus,
        baseTotal,
        fresherBonus:    (!hasWorkExp && hasEducation) ? 8 : 0,
    });

    if (!hasWorkExp && hasEducation) {
        return Math.min(98, baseTotal + 8);
    }

    return Math.min(98, baseTotal);
}
