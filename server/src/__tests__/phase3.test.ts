// ═══════════════════════════════════════════════════════════════
// PHASE 3 TESTS — ATS simulator rebuilt on real platform behavior
//
// Required by spec:
//  1. Two-column resume: FAIL legacy-strict, WARN Lever, PASS Greenhouse
//  2. "Work History" header passes Lever via synonym matching
//  3. Workday always includes form-fields advisory
//  4. All 6 platforms are present
//  5. Backward compat: old 3-arg call signature still works
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
    simulateGreenhouse,
    simulateLever,
    simulateWorkday,
    simulateAshby,
    simulateNaukri,
    simulateLegacyStrict,
    simulateAll,
    type ATSSimulationResult,
} from '../lib/ats-simulator.js';
import { analyzeParseFidelity } from '../lib/scorer/parse-fidelity.js';

// ── Fixtures ────────────────────────────────────────────────

const STANDARD_SECTIONS = {
    summary: 'Senior software engineer with 5 years experience.',
    experience: [
        { title: 'Senior Engineer', company: 'TechCorp', dates: 'Jan 2021 - Present',
          bullets: ['Built REST API serving 100k requests/day', 'Reduced latency by 40%', 'Led team of 5'] },
    ],
    education: [{ degree: 'B.Tech CS', school: 'IIT Delhi', dates: '2016-2020', gpa: '8.5', courses: [] }],
    skills: [{ category: 'Tech', items: ['Python', 'Docker', 'AWS', 'React', 'PostgreSQL'] }],
    projects: [],
};

const CLEAN_RAW = `
Anil Kumar
anil@example.com  +91 9876543210
linkedin.com/in/anil  github.com/anil

SUMMARY
Senior software engineer with 5 years experience.

EXPERIENCE
Senior Engineer at TechCorp  Jan 2021 - Present
Built REST API serving 100k requests/day
Reduced latency by 40%
Led team of 5

EDUCATION
B.Tech CS
IIT Delhi 2016-2020 CGPA 8.5

SKILLS
Python, Docker, AWS, React, PostgreSQL
`.trim();

// Two-column simulation: many short lines interleaved with long ones
// Represents what pdf-parse extracts from a multi-column PDF
const TWO_COLUMN_LINES = [
    'Anil Kumar                            Senior Engineer',
    'anil@example.com',
    '+91 9876543210',
    'linkedin.com/in/anil',
    'EXPERIENCE',
    'Senior Engineer',
    'TechCorp',
    'Jan 2021',
    'Present',
    'Built REST API',
    'serving requests',
    'SKILLS',
    'Python Docker',
    'AWS React',
    'PostgreSQL',
    'EDUCATION',
    'B.Tech CS',
    'IIT Delhi',
    '2016-2020',
    'CGPA 8.5',
    // Add a few longer lines to satisfy multi-column heuristic
    'Built REST API serving over 100k requests per day with 99.9% uptime',
    'Reduced end-to-end latency by 40% through intelligent caching layer',
    'Led a cross-functional team of 5 engineers across two time zones',
];
// Repeat short lines to push shortRatio above 0.60
const TWO_COLUMN_RAW = [
    ...TWO_COLUMN_LINES,
    ...Array(25).fill('Short fragment line here'),
].join('\n');

// Resume using non-standard headers (synonym map test)
const SYNONYM_SECTIONS = {
    ...STANDARD_SECTIONS,
    experience: [
        { title: 'Engineer', company: 'Corp', dates: 'Jan 2022 - Present',
          bullets: ['Built systems', 'Deployed services'] },
    ],
};

const SYNONYM_RAW = `
Anil Kumar
anil@example.com  +91 9876543210
linkedin.com/in/anil

CAREER OBJECTIVE
Senior software engineer seeking challenging roles.

WORK HISTORY
Engineer at Corp  Jan 2022 - Present
Built systems
Deployed services

ACADEMIC BACKGROUND
B.Tech CS IIT Delhi 2016-2020

TECHNICAL SKILLS
Python, Docker, AWS
`.trim();

// ── 1. PASS/WARN/FAIL tests ──────────────────────────────────
describe('Two-column resume: FAIL legacy, WARN Lever, PASS Greenhouse', () => {
    it('Greenhouse — multi-column is PASS (layout note only, experience stays success)', () => {
        const fidelity = analyzeParseFidelity(TWO_COLUMN_RAW, { isPdf: true, fileSizeMB: 0.3 }, undefined);

        const result = simulateGreenhouse(STANDARD_SECTIONS, TWO_COLUMN_RAW, fidelity);

        expect(result.parserStrictness).toBe('lenient');

        // Layout flag should be 'pass' for Greenhouse
        const layoutFlag = result.fidelityFlags?.find(f => f.field === 'layout');
        if (layoutFlag) {
            expect(layoutFlag.severity).toBe('pass');
        }

        // Experience should not be dropped due to layout
        expect(result.fields.experience.status).not.toBe('dropped');
    });

    it('Lever — multi-column causes WARN-level layout flag or experience warning', () => {
        const fidelity = analyzeParseFidelity(TWO_COLUMN_RAW, { isPdf: true, fileSizeMB: 0.3 }, undefined);
        // Ensure fidelity detected multi-column
        expect(fidelity.multiColumnRisk).not.toBe('LOW');

        const result = simulateLever(STANDARD_SECTIONS, TWO_COLUMN_RAW, fidelity);

        expect(result.parserStrictness).toBe('strict');

        // Layout flag should be 'warn' or 'fail' (not 'pass')
        const layoutFlag = result.fidelityFlags?.find(f => f.field === 'layout');
        expect(layoutFlag).toBeDefined();
        expect(layoutFlag!.severity).not.toBe('pass');

        // Score should be lower than a clean resume
        const cleanFidelity = analyzeParseFidelity(CLEAN_RAW, { isPdf: false }, undefined);
        const cleanResult = simulateLever(STANDARD_SECTIONS, CLEAN_RAW, cleanFidelity);
        expect(result.overallScore).toBeLessThan(cleanResult.overallScore);
    });

    it('Legacy-strict — multi-column causes FAIL flag and dropped experience', () => {
        const fidelity = analyzeParseFidelity(TWO_COLUMN_RAW, { isPdf: true, fileSizeMB: 0.3 }, undefined);
        expect(fidelity.multiColumnRisk).not.toBe('LOW');

        const result = simulateLegacyStrict(STANDARD_SECTIONS, TWO_COLUMN_RAW, fidelity);

        expect(result.parserStrictness).toBe('strict');

        // Layout flag should be 'fail' for legacy
        const layoutFlag = result.fidelityFlags?.find(f => f.field === 'layout');
        expect(layoutFlag).toBeDefined();
        expect(layoutFlag!.severity).toBe('fail');

        // Experience should be dropped due to multi-column scrambling
        expect(result.fields.experience.status).toBe('dropped');

        // Overall score should be significantly lower than clean
        const cleanFidelity = analyzeParseFidelity(CLEAN_RAW, { isPdf: false }, undefined);
        const cleanResult = simulateLegacyStrict(STANDARD_SECTIONS, CLEAN_RAW, cleanFidelity);
        expect(result.overallScore).toBeLessThan(cleanResult.overallScore);
    });
});

// ── 2. SYNONYM HEADER DETECTION ─────────────────────────────
describe('Synonym header detection via Phase 2 fidelity report', () => {
    it('"Work History" passes Lever — experience status is success (not dropped)', () => {
        const fidelity = analyzeParseFidelity(SYNONYM_RAW, { isPdf: false }, undefined);

        // Fidelity should recognize "WORK HISTORY" as 'experience' via synonym map
        expect(fidelity.recognizedSections).toContain('experience');

        const result = simulateLever(SYNONYM_SECTIONS, SYNONYM_RAW, fidelity);

        // Because fidelity found the synonym, experience should not be dropped
        expect(result.fields.experience.status).not.toBe('dropped');
    });

    it('"Technical Skills" header is recognized and Skills not dropped on Lever', () => {
        const fidelity = analyzeParseFidelity(SYNONYM_RAW, { isPdf: false }, undefined);
        expect(fidelity.recognizedSections).toContain('skills');

        const result = simulateLever(SYNONYM_SECTIONS, SYNONYM_RAW, fidelity);
        expect(result.fields.skills.status).not.toBe('dropped');
    });

    it('"Academic Background" header recognized as education', () => {
        const fidelity = analyzeParseFidelity(SYNONYM_RAW, { isPdf: false }, undefined);
        expect(fidelity.recognizedSections).toContain('education');
    });

    it('"Career Objective" recognized as summary', () => {
        const fidelity = analyzeParseFidelity(SYNONYM_RAW, { isPdf: false }, undefined);
        expect(fidelity.recognizedSections).toContain('summary');
    });
});

// ── 3. PLATFORM-SPECIFIC BEHAVIORS ──────────────────────────
describe('Platform-specific behaviors', () => {
    it('Workday always includes form-fields advisory flag', () => {
        const cleanFidelity = analyzeParseFidelity(CLEAN_RAW, { isPdf: false }, undefined);
        const result = simulateWorkday(STANDARD_SECTIONS, CLEAN_RAW, cleanFidelity);
        const formFlag = result.fidelityFlags?.find(f => f.field === 'form_fields');
        expect(formFlag).toBeDefined();
        expect(formFlag!.severity).toBe('warn');
    });

    it('Naukri recognizes Indian phone format (+91)', () => {
        const result = simulateNaukri(STANDARD_SECTIONS, CLEAN_RAW);
        expect(result.fields.phone.status).toBe('success');
        expect(result.platform).toBe('Naukri');
    });

    it('Naukri warns fresher without CGPA', () => {
        const fresherSections = { ...STANDARD_SECTIONS, experience: [] };
        const fresherRaw = CLEAN_RAW.replace(/CGPA 8\.5/, '');
        const result = simulateNaukri(fresherSections, fresherRaw);
        expect(result.fields.education.status).toBe('warning');
        expect(result.fields.education.suggestion).toMatch(/cgpa|gpa|percentage/i);
    });

    it('Ashby warns when a role has > 7 bullets', () => {
        const manyBullets = {
            ...STANDARD_SECTIONS,
            experience: [{
                title: 'Engineer', company: 'Corp', dates: 'Jan 2021 - Present',
                bullets: ['A','B','C','D','E','F','G','H'], // 8 bullets
            }],
        };
        const result = simulateAshby(manyBullets, CLEAN_RAW);
        expect(result.fields.experience.status).toBe('warning');
        expect(result.fields.experience.suggestion).toMatch(/7|bullet/i);
    });

    it('Image-only PDF → experience dropped on legacy, warning on Greenhouse', () => {
        const imageFidelity = analyzeParseFidelity('John Doe', { isPdf: true, fileSizeMB: 0.5 }, undefined);
        expect(imageFidelity.extractable).toBe(false);

        const legacy = simulateLegacyStrict(STANDARD_SECTIONS, 'John Doe', imageFidelity);
        expect(legacy.fields.experience.status).toBe('dropped');

        const greenhouse = simulateGreenhouse(STANDARD_SECTIONS, 'John Doe', imageFidelity);
        const imageFlag = greenhouse.fidelityFlags?.find(f => f.field === 'image_pdf');
        expect(imageFlag).toBeDefined();
        // Greenhouse is lenient so image PDF is 'warn' not 'fail'
        expect(imageFlag!.severity).toBe('warn');
    });
});

// ── 4. ALL 6 PLATFORMS PRESENT ───────────────────────────────
describe('simulateAll() returns all 6 platforms', () => {
    it('returns exactly 6 results', () => {
        const results = simulateAll(STANDARD_SECTIONS, CLEAN_RAW);
        expect(results).toHaveLength(6);
    });

    it('includes Greenhouse, Lever, Workday, Ashby, Naukri, Legacy', () => {
        const results = simulateAll(STANDARD_SECTIONS, CLEAN_RAW);
        const platforms = results.map(r => r.platform);
        expect(platforms).toContain('Greenhouse');
        expect(platforms).toContain('Lever');
        expect(platforms).toContain('Workday');
        expect(platforms).toContain('Ashby');
        expect(platforms).toContain('Naukri');
        expect(platforms).toContain('Legacy');
    });

    it('all results have fidelityFlags and parserStrictness', () => {
        const fidelity = analyzeParseFidelity(CLEAN_RAW, { isPdf: false }, undefined);
        const results = simulateAll(STANDARD_SECTIONS, CLEAN_RAW, fidelity);
        for (const r of results) {
            expect(r.fidelityFlags).toBeDefined();
            expect(r.parserStrictness).toBeDefined();
        }
    });
});

// ── 5. BACKWARD COMPAT ───────────────────────────────────────
describe('Backward compatibility — old 3-arg call sites', () => {
    it('simulateGreenhouse(sections, rawText, jobDescription?) still works', () => {
        const result = simulateGreenhouse(STANDARD_SECTIONS, CLEAN_RAW);
        expect(typeof result.overallScore).toBe('number');
        expect(result.fields.email).toBeDefined();
        expect(result.platform).toBe('Greenhouse');
    });

    it('simulateLever(sections, rawText) still works', () => {
        const result = simulateLever(STANDARD_SECTIONS, CLEAN_RAW);
        expect(typeof result.overallScore).toBe('number');
        expect(result.platform).toBe('Lever');
    });

    it('simulateAshby(sections, rawText) still works', () => {
        const result = simulateAshby(STANDARD_SECTIONS, CLEAN_RAW);
        expect(typeof result.overallScore).toBe('number');
        expect(result.platform).toBe('Ashby');
    });

    it('simulateNaukri(sections, rawText) still works', () => {
        const result = simulateNaukri(STANDARD_SECTIONS, CLEAN_RAW);
        expect(typeof result.overallScore).toBe('number');
        expect(result.platform).toBe('Naukri');
    });
});
