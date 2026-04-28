// ═══════════════════════════════════════════════════════════════
// BASE SCORE — Calibrated against Resume Worded (5 resumes)
//
// Architecture: 6 components summing to ~98 max.
// Calibration target: a resume scoring 92 on Resume Worded
// should score 85-95 here. A resume scoring 40 on RW should
// score 35-45 here.
//
// No hardcoded institution names. No hardcoded company names.
// Pure universal signal detection only.
// ═══════════════════════════════════════════════════════════════

import type { ParsedResume } from './helpers.js';
import { countTypos, countMatchedSkills, getAllBullets, extractBullets } from './helpers.js';

export function computeBaseScore(resume: ParsedResume): number {
    const raw      = resume.rawText;
    const sections = resume.sections;
    const wc       = raw.split(/\s+/).length;

    // ── STEP 0: BULLET EXTRACTION ───────────────────────────
    let expBullets  = extractBullets(sections.experience?.raw);
    let projBullets = extractBullets(sections.projects?.raw);

    // CRITICAL FALLBACK: If section-specific extraction yields too few bullets,
    // extract from rawText between section headers. This handles cases where
    // the sectionsToResume bridge doesn't reconstruct raw text properly.
    if (expBullets.length < 2 && raw.length > 200) {
        const expMatch = raw.match(/(?:^|\n)\s*(?:experience|work\s+experience|professional\s+experience|employment)\b/i);
        if (expMatch) {
            const startIdx = expMatch.index! + expMatch[0].length;
            const nextSection = raw.slice(startIdx).match(/\n\s*(?:projects?|education|skills?|technical\s+skills|certifications?|achievements?|summary|profile)\s*(?:\n|$)/i);
            const expText = nextSection
                ? raw.slice(startIdx, startIdx + nextSection.index!)
                : raw.slice(startIdx, startIdx + 3000);
            const rawExpBullets = extractBullets(expText);
            if (rawExpBullets.length > expBullets.length) {
                expBullets = rawExpBullets;
            }
        }
    }

    if (projBullets.length < 2 && raw.length > 200) {
        const projMatch = raw.match(/(?:^|\n)\s*(?:projects?|personal\s+projects|key\s+projects)\b/i);
        if (projMatch) {
            const startIdx = projMatch.index! + projMatch[0].length;
            const nextSection = raw.slice(startIdx).match(/\n\s*(?:experience|education|skills?|technical\s+skills|certifications?|achievements?|summary|profile)\s*(?:\n|$)/i);
            const projText = nextSection
                ? raw.slice(startIdx, startIdx + nextSection.index!)
                : raw.slice(startIdx, startIdx + 3000);
            const rawProjBullets = extractBullets(projText);
            if (rawProjBullets.length > projBullets.length) {
                projBullets = rawProjBullets;
            }
        }
    }

    let allBullets  = [...expBullets, ...projBullets];

    if (allBullets.length === 0 && raw.length > 100) {
        allBullets = extractBullets(raw)
            .filter(line => !/^(education|skills|summary|objective|contact|personal)/i.test(line));
    }

    console.log('[BulletCheck]', {
        file:       resume.metadata?.fileName,
        expCount:   expBullets.length,
        projCount:  projBullets.length,
        expSample:  expBullets[0]?.slice(0, 80),
        projSample: projBullets[0]?.slice(0, 80),
    });

    // ══════════════════════════════════════════════════════════
    // COMPONENT 1: QUANTIFICATION (0–38)
    // ══════════════════════════════════════════════════════════

    // STRONG_NUM: numbers with contextual units or metric patterns
    const STRONG_NUM = /\d+(?:\.\d+)?\s*(%|x\b|times\b|ms\b|users?|requests?|records?|rows?|accuracy|throughput|lakh|million|billion|\$|₹|hrs?|hours?|days?|reduction|improvement|increase|decrease|faster|slower|latency|chunks?|queries|transactions?|customers?|score|f1|precision|recall|auc|iou|fps|tps|rps|qps|ops|rpm|rps|savings?|revenue|cost|budget|efficiency|uptime|downtime|availability)/i;
    // METRIC_CONTEXT: catches "R² of 0.97", "achieving 95%", "top 5", "3x faster" etc.
    const METRIC_CONTEXT = /(\d+(?:\.\d+)?)\s*(%|x\b)|(?:by|of|to|over|under|within|achieving|reduced|increased|improved|boosted|cut|slashed)\s+\d+|(?:top|rank)\s+\d+|\d+\s*\+/i;
    // ANY_NUM: any digit in a bullet
    const ANY_NUM = /\d+/;

    let quantScore = 0;
    if (expBullets.length > 0) {
        const strongCount = expBullets.filter(b => STRONG_NUM.test(b) || METRIC_CONTEXT.test(b)).length;
        const anyCount    = expBullets.filter(b => ANY_NUM.test(b)).length;
        const strongRatio = strongCount / expBullets.length;
        const anyRatio    = anyCount / expBullets.length;

        const projStrongCount = projBullets.filter(b => STRONG_NUM.test(b) || METRIC_CONTEXT.test(b)).length;
        const projAnyCount    = projBullets.filter(b => ANY_NUM.test(b)).length;
        const projRatio       = (projStrongCount + projAnyCount * 0.5) / Math.max(1, projBullets.length);

        // Experience quantification: up to 28 pts
        // 100% strong = 28, 75% strong = 24, 50% = 18, 25% = 12
        const expQuantPts = strongRatio > 0
            ? Math.min(28, Math.round(strongRatio * 26 + anyRatio * 4))
            : Math.min(20, Math.round(anyRatio * 22));

        // Projects: up to 10 pts on top
        const projQuantPts = Math.min(10, Math.round(Math.min(1, projRatio) * 12));

        quantScore = Math.min(35, expQuantPts + projQuantPts);
    } else {
        // No experience — freshers score from projects only
        const projCount = projBullets.filter(b => STRONG_NUM.test(b) || METRIC_CONTEXT.test(b) || ANY_NUM.test(b)).length;
        const projRatio = projCount / Math.max(1, projBullets.length);
        quantScore = Math.min(22, Math.round(projRatio * 24));
    }

    // IMPACT LANGUAGE: Action verbs at start of bullets
    const POWER_VERBS_RE = /^(built|engineered|developed|designed|implemented|deployed|optimized|optimised|improved|reduced|increased|automated|architected|led|delivered|launched|created|achieved|scaled|migrated|refactored|streamlined|authored|drove|generated|spearheaded|orchestrated|boosted|containerized|containerised|trained|analysed|analyzed|configured|integrated|maintained|established|produced|managed|executed|modelled|modeled|diagnosed|debugged|resolved|coordinated|negotiated|secured|demonstrated|constructed|evaluated|conducted|slashed|cut|elevated|accelerated)\b/i;

    const verbRatio = allBullets.length > 0
        ? allBullets.filter(b => POWER_VERBS_RE.test(b.trim())).length / allBullets.length
        : 0;
    const verbScore = Math.min(3, Math.round(verbRatio * 4));

    const quantificationScore = Math.min(38, quantScore + verbScore);

    // ══════════════════════════════════════════════════════════
    // COMPONENT 2: EXPERIENCE PRESENCE BONUS (0–14)
    // ══════════════════════════════════════════════════════════

    const proExpPattern = /\b(intern|internship|engineer|developer|analyst|associate|trainee|consultant|researcher|scientist|designer|assistant|coordinator\s+at|freelance)\b/i;
    const expSectionRaw = sections.experience?.raw ?? '';
    const isProfessionalExp = proExpPattern.test(expSectionRaw);
    const profExpBullets = isProfessionalExp ? expBullets : [];

    let experienceBonus = 0;
    if (profExpBullets.length >= 5)      experienceBonus = 14;
    else if (profExpBullets.length >= 3) experienceBonus = 13;
    else if (profExpBullets.length >= 2) experienceBonus = 10;
    else if (profExpBullets.length >= 1) experienceBonus = 6;

    // Org/club experience bonus (non-professional)
    const orgBonus = (expBullets.length > 0 && !isProfessionalExp) ? 6 : 0;

    // ══════════════════════════════════════════════════════════
    // COMPONENT 3: ATS COMPATIBILITY (0–20)
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
    // ══════════════════════════════════════════════════════════

    const hasExp  = expBullets.length > 0;
    const minWC   = hasExp ? 300 : 200;
    const maxWC   = hasExp ? 1000 : 700;

    let lengthScore = 7;
    if (wc < minWC) lengthScore = Math.max(3, 7 - Math.floor((minWC - wc) / 30));
    if (wc > maxWC) lengthScore = Math.max(3, 7 - Math.floor((wc - maxWC) / 100));

    const typoCount        = countTypos(raw);
    const consistencyScore = Math.max(2, 5 - Math.round(typoCount * 1.5));

    const bulletCount      = getAllBullets(resume).length;
    const readabilityScore = bulletCount >= 5 ? 3 : 1;

    const styleScore = Math.min(14, Math.round((lengthScore + consistencyScore + readabilityScore) * 0.93));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 5: SKILLS & CONTACT (0–10)
    // ══════════════════════════════════════════════════════════

    const skillCount  = countMatchedSkills(raw);
    const skillScore  = Math.min(4, Math.round(skillCount / 3));

    const contactScore = [
        /[\w.+]+@[\w.]+\.[a-z]{2,}/i.test(raw),
        /(\+?\d[\d\s\-]{8,}\d)/.test(raw),
        /linkedin/i.test(raw),
        /github/i.test(raw),
    ].filter(Boolean).length;

    const eduPresent = sections.education?.raw ? 2 : 0;
    const pubBonus = /\b(ieee|arxiv|springer|acm|published|conference\s+proceedings|journal|paper\s+presented)\b/i.test(raw) ? 2 : 0;

    const skillsContactScore = Math.min(10, Math.round((skillScore + contactScore + eduPresent + pubBonus) * 0.78));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 6: ACHIEVEMENT BONUS (0–3)
    // ══════════════════════════════════════════════════════════

    const achBullets = extractBullets(sections.achievements?.raw);
    const achievementBonus = Math.min(3, achBullets.length);

    // ══════════════════════════════════════════════════════════
    // FRESHER BONUS
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
        fresherBonus:    (!hasWorkExp && hasEducation) ? 6 : 0,
    });

    if (!hasWorkExp && hasEducation) {
        return Math.min(98, baseTotal + 6);
    }

    return Math.min(98, baseTotal);
}
