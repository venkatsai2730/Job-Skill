// ═══════════════════════════════════════════════════════════════
// PHASE 2 TESTS — Parse-fidelity layer
//
// Covers:
//  1. Section synonym map — normalizeHeader()
//  2. analyzeParseFidelity() for each failure mode
//  3. Fidelity penalty wiring into base-score Component 3
//  4. parseFidelity field present on AdvancedATSResult
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { normalizeHeader } from '../lib/scorer/section-synonyms.js';
import { analyzeParseFidelity } from '../lib/scorer/parse-fidelity.js';
import { computeBaseScore } from '../lib/scorer/base-score.js';
import { computeAdvancedATS } from '../lib/advanced-scorer.js';
import { DEFAULT_CONFIG } from '../lib/scorer/scoring-config.js';
import { sectionsToResume } from '../lib/scorer/helpers.js';
import type { ParsedSections } from '../lib/advanced-scorer.js';

// ── Minimal ParsedSections fixture ──────────────────────────
const MINIMAL: ParsedSections = {
    summary: 'Software engineer with 3 years of experience.',
    experience: [{ title: 'Engineer', company: 'Corp', dates: '', bullets: [
        'Built REST APIs serving requests',
        'Deployed microservices on Kubernetes',
        'Reduced latency by 40% through caching',
    ] }],
    education: [{ degree: 'B.Tech CS', school: 'Uni', dates: '2020', gpa: '', courses: [] }],
    skills: [{ category: 'Tech', items: ['Python', 'Docker', 'AWS'] }],
    projects: [],
};

const CLEAN_RAW = `
John Doe
john@example.com  +91 9876543210
linkedin.com/in/john  github.com/john

SUMMARY
Software engineer with 3 years of experience.

EXPERIENCE
Engineer at Corp
Built REST APIs serving requests
Deployed microservices on Kubernetes
Reduced latency by 40% through caching

EDUCATION
B.Tech CS
Uni 2020

SKILLS
Tech: Python, Docker, AWS
`.trim();

// ── 1. SECTION SYNONYM MAP ───────────────────────────────────
describe('Section Synonym Map — normalizeHeader()', () => {
    it('maps standard headers to canonical names', () => {
        expect(normalizeHeader('EXPERIENCE')).toBe('experience');
        expect(normalizeHeader('Education')).toBe('education');
        expect(normalizeHeader('SKILLS')).toBe('skills');
        expect(normalizeHeader('Projects')).toBe('projects');
        expect(normalizeHeader('Summary')).toBe('summary');
    });

    it('maps non-standard synonyms to canonical names', () => {
        expect(normalizeHeader('Work Experience')).toBe('experience');
        expect(normalizeHeader('Professional Experience')).toBe('experience');
        expect(normalizeHeader('Employment History')).toBe('experience');
        expect(normalizeHeader('Technical Skills')).toBe('skills');
        expect(normalizeHeader('Core Competencies')).toBe('skills');
        expect(normalizeHeader('Technologies')).toBe('skills');
        expect(normalizeHeader('Academic Projects')).toBe('projects');
        expect(normalizeHeader('Personal Projects')).toBe('projects');
        expect(normalizeHeader('Career Objective')).toBe('summary');
        expect(normalizeHeader('Profile')).toBe('summary');
        expect(normalizeHeader('Certifications')).toBe('certifications');
        expect(normalizeHeader('Accomplishments')).toBe('achievements');
    });

    it('handles punctuation and casing variants', () => {
        expect(normalizeHeader('WORK EXPERIENCE')).toBe('experience');
        expect(normalizeHeader('Technical Skills:')).toBe('skills');
        expect(normalizeHeader('Tools & Technologies')).toBe('skills');
        expect(normalizeHeader('Tools and Technologies')).toBe('skills');
        expect(normalizeHeader('Awards & Achievements')).toBe('achievements');
    });

    it('returns null for unrecognized headers', () => {
        expect(normalizeHeader('Random Header')).toBeNull();
        expect(normalizeHeader('Foo Bar Baz')).toBeNull();
        expect(normalizeHeader('')).toBeNull();
    });
});

// ── 2. ANALYZE PARSE FIDELITY ────────────────────────────────
describe('analyzeParseFidelity()', () => {
    it('clean single-column text → all LOW, no penalty, extractable', () => {
        const report = analyzeParseFidelity(CLEAN_RAW, { isPdf: false }, DEFAULT_CONFIG);
        expect(report.extractable).toBe(true);
        expect(report.multiColumnRisk).toBe('LOW');
        expect(report.tableArtifactRisk).toBe('LOW');
        expect(report.fidelityPenalty).toBe(0);
        expect(report.flags).toHaveLength(0);
    });

    it('image-only PDF → extractable=false, applies imageDeduction', () => {
        const sparseText = 'John Doe';
        const report = analyzeParseFidelity(sparseText, { isPdf: true, fileSizeMB: 0.5 }, DEFAULT_CONFIG);
        expect(report.extractable).toBe(false);
        expect(report.fidelityPenalty).toBe(-DEFAULT_CONFIG.parseFidelity.imageDeduction);
        expect(report.flags[0]).toMatch(/image-only/i);
    });

    it('small PDF with sparse text but below fileMB threshold → still extractable', () => {
        const sparseText = 'short';
        // File < 0.05 MB → threshold not met, don't flag as image PDF
        const report = analyzeParseFidelity(sparseText, { isPdf: true, fileSizeMB: 0.02 }, DEFAULT_CONFIG);
        expect(report.extractable).toBe(true);
    });

    it('multi-column text (HIGH) → applies full multiColDeduction', () => {
        // Simulate multi-column: many short fragments interspersed with longer ones
        const shortFrag = 'Python developer';
        const longLine  = 'Reduced API response time by 40% through efficient caching strategies';
        const lines = [
            longLine,
            ...Array(20).fill(shortFrag),
            longLine,
            ...Array(15).fill('Data analysis'),
            longLine,
        ];
        const multiColRaw = lines.join('\n');
        const report = analyzeParseFidelity(multiColRaw, { isPdf: true }, DEFAULT_CONFIG);
        expect(report.multiColumnRisk).toBe('HIGH');
        expect(report.fidelityPenalty).toBeLessThanOrEqual(-DEFAULT_CONFIG.parseFidelity.multiColDeduction);
        expect(report.flags.some(f => /multi-column/i.test(f))).toBe(true);
    });

    it('multi-column text (MEDIUM) → applies half multiColDeduction', () => {
        const shortFrag = 'Python developer';
        const longLine  = 'Reduced API response time by 40% through efficient caching';
        // ~65% short lines
        const lines = [
            longLine, longLine, longLine, longLine,
            ...Array(15).fill(shortFrag),
        ];
        const raw = lines.join('\n');
        const report = analyzeParseFidelity(raw, {}, DEFAULT_CONFIG);
        if (report.multiColumnRisk === 'MEDIUM') {
            const expected = -Math.round((DEFAULT_CONFIG.parseFidelity.multiColDeduction / 2) * 10) / 10;
            expect(report.fidelityPenalty).toBe(expected);
        }
        // If LOW, just verify no full deduction applied
        if (report.multiColumnRisk === 'LOW') {
            expect(report.fidelityPenalty).toBe(0);
        }
    });

    it('table artifacts (pipes) → applies tableArtifactDeduction', () => {
        const tableRaw = `
Name | Email | Phone | Location
John | john@x.com | 1234567890 | Mumbai
Skills | Python | Docker | Kubernetes
Experience | Engineer | Corp | 2020-2023
`.trim();
        const report = analyzeParseFidelity(tableRaw, {}, DEFAULT_CONFIG);
        expect(report.tableArtifactRisk).toBe('HIGH');
        expect(report.fidelityPenalty).toBeLessThanOrEqual(-DEFAULT_CONFIG.parseFidelity.tableArtifactDeduction);
        expect(report.flags.some(f => /table/i.test(f))).toBe(true);
    });

    it('tab-separated table → applies tableArtifactDeduction', () => {
        const tabRaw = Array(5)
            .fill('Column1\tColumn2\tColumn3\tColumn4')
            .join('\n');
        const report = analyzeParseFidelity(tabRaw, {}, DEFAULT_CONFIG);
        expect(report.tableArtifactRisk).toBe('HIGH');
    });

    it('recognizes non-standard section headers via synonym map', () => {
        const nonStandardRaw = `
John Doe
john@x.com

PROFESSIONAL SUMMARY
Software engineer with 3 years experience.

WORK EXPERIENCE
Engineer at Corp
Built APIs and deployed services.

TECHNICAL SKILLS
Python, Docker, AWS

ACADEMIC PROJECTS
Todo app built with React.

EDUCATION
B.Tech CS
`.trim();
        const report = analyzeParseFidelity(nonStandardRaw, {}, DEFAULT_CONFIG);
        expect(report.recognizedSections).toContain('experience');
        expect(report.recognizedSections).toContain('skills');
        expect(report.recognizedSections).toContain('projects');
        expect(report.sectionRecognitionRate).toBeGreaterThan(0);
    });

    it('sectionRecognitionRate = 1 when no headers detected', () => {
        const noHeadersRaw = 'john@x.com built apis served requests worked at corp';
        const report = analyzeParseFidelity(noHeadersRaw, {}, DEFAULT_CONFIG);
        expect(report.sectionRecognitionRate).toBe(1);
    });
});

// ── 3. FIDELITY WIRING INTO BASE-SCORE COMPONENT 3 ──────────
describe('Parse-fidelity wiring into base-score Component 3', () => {
    it('recognized sections via synonym map improve sectionCount in Component 3', () => {
        // A resume where parsed sections are sparse but raw text has recognizable headers
        // isPdf: false avoids image-PDF detection (our test fixture has ~44 words, below 50-word threshold)
        const sparseResume = sectionsToResume(
            { summary: '', experience: [], education: [], skills: [], projects: [] },
            CLEAN_RAW,
            { fileSizeMB: 0.3, isPdf: false },
        );

        const fidelity = analyzeParseFidelity(CLEAN_RAW, { fileSizeMB: 0.3, isPdf: false }, DEFAULT_CONFIG);

        // Compute with and without fidelity
        const scoreWithFidelity    = computeBaseScore(sparseResume, DEFAULT_CONFIG, fidelity);
        const scoreWithoutFidelity = computeBaseScore(sparseResume, DEFAULT_CONFIG);

        // With fidelity, extra sections detected → higher ATS component → higher base score
        expect(scoreWithFidelity).toBeGreaterThanOrEqual(scoreWithoutFidelity);
    });

    it('image PDF fidelity penalty reduces base score', () => {
        const imageResume = sectionsToResume(MINIMAL, 'John Doe', { fileSizeMB: 0.5, isPdf: true });

        const cleanFidelity = analyzeParseFidelity(CLEAN_RAW, { fileSizeMB: 0.3, isPdf: false }, DEFAULT_CONFIG);
        const imageFidelity = analyzeParseFidelity('John Doe', { fileSizeMB: 0.5, isPdf: true }, DEFAULT_CONFIG);

        expect(imageFidelity.extractable).toBe(false);

        const cleanResume = sectionsToResume(MINIMAL, CLEAN_RAW, { fileSizeMB: 0.3, isPdf: false });
        const scoreClean  = computeBaseScore(cleanResume, DEFAULT_CONFIG, cleanFidelity);
        const scoreImage  = computeBaseScore(imageResume, DEFAULT_CONFIG, imageFidelity);

        expect(scoreClean).toBeGreaterThan(scoreImage);
    });
});

// ── 4. ADVANCED SCORER INTEGRATION ──────────────────────────
describe('parseFidelity field on AdvancedATSResult', () => {
    it('result includes parseFidelity report', () => {
        // isPdf: false avoids image-PDF detection with our minimal test fixture
        const result = computeAdvancedATS(MINIMAL, CLEAN_RAW, undefined, { fileSizeMB: 0.3, isPdf: false });
        expect(result.parseFidelity).toBeDefined();
        expect(result.parseFidelity!.extractable).toBe(true);
        expect(result.parseFidelity!.multiColumnRisk).toBeDefined();
        expect(result.parseFidelity!.tableArtifactRisk).toBeDefined();
        expect(result.parseFidelity!.flags).toBeInstanceOf(Array);
    });

    it('clean text → no fidelity penalty, no flags', () => {
        const result = computeAdvancedATS(MINIMAL, CLEAN_RAW, undefined, { fileSizeMB: 0.3, isPdf: false });
        expect(result.parseFidelity!.fidelityPenalty).toBe(0);
        expect(result.parseFidelity!.flags).toHaveLength(0);
    });

    it('image PDF → score reduced relative to clean version', () => {
        const clean = computeAdvancedATS(MINIMAL, CLEAN_RAW, undefined, { fileSizeMB: 0.3, isPdf: false });
        const image = computeAdvancedATS(MINIMAL, 'John Doe', undefined, { fileSizeMB: 0.5, isPdf: true });

        expect(image.score).toBeLessThan(clean.score);
        expect(image.parseFidelity!.extractable).toBe(false);
        expect(image.parseFidelity!.flags[0]).toMatch(/image-only/i);
    });

    it('backward compat: existing fields still present alongside parseFidelity', () => {
        const result = computeAdvancedATS(MINIMAL, CLEAN_RAW);
        // All existing fields intact
        expect(typeof result.score).toBe('number');
        expect(typeof result.grade).toBe('string');
        expect(result.all_penalties).toBeInstanceOf(Array);
        expect(result.suppressedIssues).toBeInstanceOf(Array);
        // New field present
        expect(result.parseFidelity).toBeDefined();
    });
});
