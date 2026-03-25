// ═══════════════════════════════════════════════════════════════
// SCORER HELPERS — Power verbs, tech skills, typo counter, bullet extractor
// ═══════════════════════════════════════════════════════════════

import type { ParsedSections } from '../advanced-scorer.js';

export interface ParsedResume {
    rawText: string;
    sections: {
        summary?: { raw: string };
        objective?: { raw: string };
        profile?: { raw: string };
        experience?: { raw: string; bullets: string[] };
        education?: { raw: string };
        skills?: { raw: string };
        projects?: { raw: string; bullets: string[] };
        achievements?: { raw: string };
        [key: string]: { raw: string; bullets?: string[] } | undefined;
    };
    metadata?: { fileSizeBytes?: number; fileSizeMB?: number; isPdf?: boolean; fileName?: string };
}

// ── POWER VERBS ─────────────────────────────────────────────
export const POWER_VERBS = new Set([
    'built','engineered','developed','created','designed','architected',
    'implemented','deployed','shipped','launched','released','published',
    'optimised','optimized','improved','enhanced','accelerated','automated',
    'modernised','modernized','refactored','upgraded','scaled','migrated',
    'led','managed','mentored','directed','spearheaded','orchestrated',
    'achieved','delivered','generated','drove','grew','increased','reduced',
    'analysed','analyzed','researched','evaluated','diagnosed','resolved',
    'debugged','troubleshot','identified','investigated','assessed',
    'crafted','authored','wrote','conceptualised','conceptualized','pioneered',
    'bootstrapped','revamped','streamlined','integrated','configured',
    'trained','fine-tuned','containerised','containerized',
]);

export function computePowerVerbRatio(bullets: string[]): number {
    if (bullets.length === 0) return 0;
    const strong = bullets.filter(b => {
        const firstWord = b.trim()
            .replace(/^[•\-–—*▪►\s]+/, '')
            .split(/\s+/)[0]
            ?.toLowerCase()
            .replace(/(ing|ed|es|d)$/, '');
        return firstWord ? POWER_VERBS.has(firstWord) : false;
    }).length;
    return strong / bullets.length;
}

// ── GLOBAL TECH SKILLS ──────────────────────────────────────
export const GLOBAL_TECH_SKILLS = [
    'python','javascript','typescript','java','c++','c#','go','rust',
    'kotlin','swift','r','scala','php','ruby','dart',
    'react','vue','angular','next.js','nuxt','tailwind','html','css',
    'bootstrap','svelte','redux',
    'node.js','express','django','flask','spring','fastapi','graphql',
    'rest api','grpc','kafka','rabbitmq',
    'sql','postgresql','mysql','mongodb','redis','elasticsearch',
    'pandas','numpy','tensorflow','pytorch','scikit-learn','keras',
    'langchain','huggingface','llm','rag','nlp','computer vision',
    'machine learning','deep learning','power bi','tableau',
    'apache airflow','spark','hadoop','dbt','etl','snowflake',
    'bigquery','databricks',
    'aws','gcp','azure','docker','kubernetes','terraform',
    'ci/cd','github actions','jenkins','linux','bash','git',
    'postman','figma','jira','agile','scrum',
];

export function countMatchedSkills(rawText: string): number {
    const lower = rawText.toLowerCase();
    return GLOBAL_TECH_SKILLS.filter(s => lower.includes(s)).length;
}

// ── TYPO COUNTER ────────────────────────────────────────────
export const TYPO_LIST: Record<string, string> = {
    'certifcations':  'certifications',  'certifictions': 'certifications',
    'expereince':     'experience',      'managment':     'management',
    'developement':   'development',     'implementaion': 'implementation',
    'recieved':       'received',        'achivements':   'achievements',
    'achivement':     'achievement',     'sumary':        'summary',
    'progamming':     'programming',     'programing':    'programming',
    'knowlege':       'knowledge',       'enviroment':    'environment',
    'seperately':     'separately',      'definately':    'definitely',
    'calender':       'calendar',        'begining':      'beginning',
    'concious':       'conscious',       'occured':       'occurred',
};

export function countTypos(rawText: string): number {
    const lower = rawText.toLowerCase();
    return Object.keys(TYPO_LIST).filter(t => lower.includes(t)).length;
}

// ── BULLET EXTRACTOR ────────────────────────────────────────
export function getAllBullets(resume: ParsedResume): string[] {
    const raw = [
        resume.sections.experience?.raw,
        resume.sections.projects?.raw,
        resume.sections.summary?.raw,
    ].filter(Boolean).join('\n');

    return raw
        .split('\n')
        .map(l => l.replace(/^[\s•\-–—*▪►]+/, '').trim())
        .filter(l => l.length > 15 && l.length < 350);
}

// ── CONVERT ParsedSections to ParsedResume ──────────────────
// Bridge from old interface to new
export function sectionsToResume(
    sections: ParsedSections,
    rawText: string,
    metadata?: { fileSizeMB?: number; isPdf?: boolean; fileName?: string }
): ParsedResume {
    const expBullets = sections.experience.flatMap(e => e.bullets);
    const expRaw = sections.experience.map(e =>
        `${e.title} ${e.company} ${e.dates}\n${e.bullets.join('\n')}`
    ).join('\n');

    const projBullets = sections.projects.flatMap(p => {
        return p.description ? p.description.split(/[.\n]+/).filter(s => s.trim().length > 20) : [];
    });
    const projRaw = sections.projects.map(p =>
        `${p.name}\n${p.description}\n${p.tech.join(', ')}`
    ).join('\n');

    const skillsRaw = sections.skills.map(g => `${g.category}: ${g.items.join(', ')}`).join('\n');
    const eduRaw = sections.education.map(e =>
        `${e.degree} ${e.school} ${e.dates} ${e.gpa} ${e.courses.join(', ')}`
    ).join('\n');

    return {
        rawText,
        sections: {
            summary: { raw: sections.summary || '' },
            experience: { raw: expRaw, bullets: expBullets },
            education: { raw: eduRaw },
            skills: { raw: skillsRaw },
            projects: { raw: projRaw, bullets: projBullets },
        },
        metadata: metadata ? {
            fileSizeMB: metadata.fileSizeMB,
            isPdf: metadata.isPdf,
            fileName: metadata.fileName,
        } : undefined,
    };
}
