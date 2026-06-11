// ═══════════════════════════════════════════════════════════════
// BASE SCORE — Calibrated against Resume Worded (5 resumes)
//
// Architecture: 6 components summing to ~98 max.
// All numeric constants live in scoring-config.ts — none here.
// ═══════════════════════════════════════════════════════════════

import type { ParsedResume } from './helpers.js';
import { countTypos, countMatchedSkills, getAllBullets, extractBullets } from './helpers.js';
import { DEFAULT_CONFIG, type ScoringConfig } from './scoring-config.js';
import type { ParseFidelityReport } from './parse-fidelity.js';

export function computeBaseScore(
    resume: ParsedResume,
    config: ScoringConfig = DEFAULT_CONFIG,
    fidelity?: ParseFidelityReport,
): number {
    const raw      = resume.rawText;
    const sections = resume.sections;
    const wc       = raw.split(/\s+/).length;
    const C        = config.components;
    const T        = config.thresholds;

    // ── STEP 0: BULLET EXTRACTION ───────────────────────────
    let expBullets  = extractBullets(sections.experience?.raw);
    let projBullets = extractBullets(sections.projects?.raw);

    // CRITICAL FALLBACK: If section-specific extraction yields too few bullets,
    // extract from rawText between section headers.
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

    const STRONG_NUM = /\d+(?:\.\d+)?\s*(%|x\b|times\b|ms\b|users?|requests?|records?|rows?|accuracy|throughput|lakh|million|billion|\$|₹|hrs?|hours?|days?|reduction|improvement|increase|decrease|faster|slower|latency|chunks?|queries|transactions?|customers?|score|f1|precision|recall|auc|iou|fps|tps|rps|qps|ops|rpm|rps|savings?|revenue|cost|budget|efficiency|uptime|downtime|availability)/i;
    const METRIC_CONTEXT = /(\d+(?:\.\d+)?)\s*(%|x\b)|(?:by|of|to|over|under|within|achieving|reduced|increased|improved|boosted|cut|slashed)\s+\d+|(?:top|rank)\s+\d+|\d+\s*\+/i;
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

        const expQuantPts = strongRatio > 0
            ? Math.min(C.quantification.expQuantMax, Math.round(strongRatio * 26 + anyRatio * 4))
            : Math.min(20, Math.round(anyRatio * C.quantification.anyNumMultiplier));

        const projQuantPts = Math.min(
            C.quantification.projQuantMax,
            Math.round(Math.min(1, projRatio) * C.quantification.projRatioMultiplier)
        );

        quantScore = Math.min(C.quantification.quantMax, expQuantPts + projQuantPts);
    } else {
        const projCount = projBullets.filter(b => STRONG_NUM.test(b) || METRIC_CONTEXT.test(b) || ANY_NUM.test(b)).length;
        const projRatio = projCount / Math.max(1, projBullets.length);
        quantScore = Math.min(C.quantification.fresherProjMax, Math.round(projRatio * C.quantification.fresherProjMultiplier));
    }

    const POWER_VERBS_RE = /^(built|engineered|developed|designed|implemented|deployed|optimized|optimised|improved|reduced|increased|automated|architected|led|delivered|launched|created|achieved|scaled|migrated|refactored|streamlined|authored|drove|generated|spearheaded|orchestrated|boosted|containerized|containerised|trained|analysed|analyzed|configured|integrated|maintained|established|produced|managed|executed|modelled|modeled|diagnosed|debugged|resolved|coordinated|negotiated|secured|demonstrated|constructed|evaluated|conducted|slashed|cut|elevated|accelerated)\b/i;

    const verbRatio = allBullets.length > 0
        ? allBullets.filter(b => POWER_VERBS_RE.test(b.trim())).length / allBullets.length
        : 0;
    const verbScore = Math.min(C.quantification.verbMax, Math.round(verbRatio * C.quantification.verbRatioMultiplier));

    const quantificationScore = Math.min(C.quantification.max, quantScore + verbScore);

    // ══════════════════════════════════════════════════════════
    // COMPONENT 2: EXPERIENCE PRESENCE BONUS (0–14)
    // ══════════════════════════════════════════════════════════

    const proExpPattern = /\b(intern|internship|engineer|developer|analyst|associate|trainee|consultant|researcher|scientist|designer|assistant|coordinator\s+at|freelance)\b/i;
    const expSectionRaw = sections.experience?.raw ?? '';
    const isProfessionalExp = proExpPattern.test(expSectionRaw);
    const profExpBullets = isProfessionalExp ? expBullets : [];

    let experienceBonus = 0;
    const [b5, b3, b2, b1] = C.experience.bonusByBullets;
    if (profExpBullets.length >= 5)      experienceBonus = b5;
    else if (profExpBullets.length >= 3) experienceBonus = b3;
    else if (profExpBullets.length >= 2) experienceBonus = b2;
    else if (profExpBullets.length >= 1) experienceBonus = b1;

    const orgBonus = (expBullets.length > 0 && !isProfessionalExp) ? C.experience.orgBonus : 0;

    // ══════════════════════════════════════════════════════════
    // COMPONENT 3: ATS COMPATIBILITY (0–20)
    // ══════════════════════════════════════════════════════════

    const fileMB    = (resume.metadata?.fileSizeBytes ?? 0) / 1_048_576;
    const actualMB  = fileMB > 0 ? fileMB : (resume.metadata?.fileSizeMB ?? 0);
    const fileScore = (actualMB < 5 ? C.ats.fileGood : C.ats.fileBad)
                    + (wc >= C.style.minWcWithExp && wc <= C.style.maxWcWithExp ? C.ats.wcGood : C.ats.wcBad);

    const specials  = (raw.match(/[^\w\s.,;:\-()\[\]|•\/\n@+#%]/g) ?? []).length;
    const fmtScore  = specials > C.ats.specialsThreshold ? C.ats.fmtBad : C.ats.fmtGood;

    // Use parse-fidelity recognized sections to supplement parsed section detection
    const fidelitySections = new Set(fidelity?.recognizedSections ?? []);
    const sectionCount = [
        !!(sections.experience?.raw || sections.projects?.raw) || fidelitySections.has('experience'),
        !!sections.education?.raw || fidelitySections.has('education'),
        !!sections.skills?.raw || fidelitySections.has('skills'),
        !!sections.projects?.raw || fidelitySections.has('projects'),
    ].filter(Boolean).length;
    const headerScore = Math.round((sectionCount / 4) * C.ats.headerMax);

    const fidelityAdj = fidelity?.fidelityPenalty ?? 0;
    const atsScore = Math.min(C.ats.max, Math.max(0, fileScore + fmtScore + headerScore + fidelityAdj));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 4: STYLE & READABILITY (0–14)
    // ══════════════════════════════════════════════════════════

    const hasExp  = expBullets.length > 0;
    const minWC   = hasExp ? C.style.minWcWithExp : C.style.minWcNoExp;
    const maxWC   = hasExp ? C.style.maxWcWithExp : C.style.maxWcNoExp;

    let lengthScore = C.style.lengthBase;
    if (wc < minWC) lengthScore = Math.max(C.style.lengthMin, C.style.lengthBase - Math.floor((minWC - wc) / C.style.lengthBelowPerWords));
    if (wc > maxWC) lengthScore = Math.max(C.style.lengthMin, C.style.lengthBase - Math.floor((wc - maxWC) / C.style.lengthAbovePerWords));

    const typoCount        = countTypos(raw);
    const consistencyScore = Math.max(C.style.typoMin, C.style.typoBase - Math.round(typoCount * C.style.typoMultiplier));

    const bulletCount      = getAllBullets(resume).length;
    const readabilityScore = bulletCount >= C.style.readabilityBulletThreshold
        ? C.style.readabilityGood
        : C.style.readabilityBad;

    const styleScore = Math.min(C.style.max, Math.round((lengthScore + consistencyScore + readabilityScore) * C.style.multiplier));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 5: SKILLS & CONTACT (0–10)
    // ══════════════════════════════════════════════════════════

    const skillCount  = countMatchedSkills(raw);
    const skillScore  = Math.min(C.skillsContact.skillMax, Math.round(skillCount / C.skillsContact.skillDivisor));

    const contactScore = [
        /[\w.+]+@[\w.]+\.[a-z]{2,}/i.test(raw),
        /(\+?\d[\d\s\-]{8,}\d)/.test(raw),
        /linkedin/i.test(raw),
        /github/i.test(raw),
    ].filter(Boolean).length;

    const eduPresent = sections.education?.raw ? C.skillsContact.eduBonus : 0;
    const pubBonus = /\b(ieee|arxiv|springer|acm|published|conference\s+proceedings|journal|paper\s+presented)\b/i.test(raw)
        ? C.skillsContact.pubBonus
        : 0;

    const skillsContactScore = Math.min(C.skillsContact.max, Math.round((skillScore + contactScore + eduPresent + pubBonus) * C.skillsContact.multiplier));

    // ══════════════════════════════════════════════════════════
    // COMPONENT 6: ACHIEVEMENT BONUS (0–3)
    // ══════════════════════════════════════════════════════════

    const achBullets = extractBullets(sections.achievements?.raw);
    const achievementBonus = Math.min(C.achievement.max, achBullets.length);

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
        fresherBonus:    (!hasWorkExp && hasEducation) ? config.fresherBonus : 0,
    });

    if (!hasWorkExp && hasEducation) {
        return Math.min(config.baseCap, baseTotal + config.fresherBonus);
    }

    return Math.min(config.baseCap, baseTotal);
}
