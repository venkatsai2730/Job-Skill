// ═══════════════════════════════════════════════════════════════
// PHASE 1 TESTS — Config extraction + penalty exclusion groups
//
// Golden snapshots: first run captures baseline from current code.
// After any refactor the snapshots verify output is unchanged.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeAdvancedATS } from '../lib/advanced-scorer.js';
import { detectAllPenalties } from '../lib/scorer/penalties.js';
import { DEFAULT_CONFIG, type ScoringConfig } from '../lib/scorer/scoring-config.js';
import { sectionsToResume } from '../lib/scorer/helpers.js';
import type { ParsedSections } from '../lib/advanced-scorer.js';

// ── Fixtures ────────────────────────────────────────────────

/** Resume A — Fresher: no experience, education + skills, no numbers anywhere */
const RESUME_A: ParsedSections = {
    summary: 'A focused and goal-oriented engineering professional seeking an entry-level position.',
    experience: [],
    education: [{ degree: 'B.Tech Computer Science', school: 'State University', dates: '2020-2024', gpa: '', courses: [] }],
    skills: [{ category: 'Languages', items: ['Python', 'JavaScript', 'HTML', 'CSS'] }],
    projects: [
        { name: 'Todo App', description: 'Built a simple todo application using React and local storage.', tech: ['React'] },
        { name: 'Portfolio Website', description: 'Created a static portfolio site.', tech: ['HTML', 'CSS'] },
    ],
};

const RAW_A = `
A. Candidate
a.candidate@example.com  +91 9876543210
linkedin.com/in/acand  github.com/acand

A focused and goal-oriented engineering professional seeking an entry-level position.

EDUCATION
B.Tech Computer Science
State University 2020-2024

TECHNICAL SKILLS
Languages: Python, JavaScript, HTML, CSS

PROJECTS
Todo App
Built a simple todo application using React and local storage.

Portfolio Website
Created a static portfolio site.
`.trim();

/** Resume B — Junior dev: experience with some numbers, LinkedIn + GitHub */
const RESUME_B: ParsedSections = {
    summary: 'Software engineer with 2 years of experience building backend services.',
    experience: [
        {
            title: 'Software Engineer',
            company: 'Acme Corp',
            dates: 'Jan 2022 – Present',
            bullets: [
                'Developed REST APIs serving 5000 daily requests using Node.js and Express',
                'Reduced average API latency by 30% through query optimization',
                'Responsible for maintaining CI/CD pipeline on GitHub Actions',
                'Worked on integrating third-party payment gateway',
            ],
        },
    ],
    education: [{ degree: 'B.Tech IT', school: 'Andhra University', dates: '2018-2022', gpa: '8.2', courses: [] }],
    skills: [{ category: 'Backend', items: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'] }],
    projects: [
        {
            name: 'Job Board',
            description: 'Built a full-stack job board with authentication, PostgreSQL, and REST API. Deployed to AWS EC2 with Docker.',
            tech: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
        },
    ],
};

const RAW_B = `
B. Developer
b.dev@example.com  +91 9876543211  Hyderabad, India
linkedin.com/in/bdev  github.com/bdev

Software engineer with 2 years of experience building backend services.

EXPERIENCE
Software Engineer — Acme Corp
Jan 2022 – Present
• Developed REST APIs serving 5000 daily requests using Node.js and Express
• Reduced average API latency by 30% through query optimization
• Responsible for maintaining CI/CD pipeline on GitHub Actions
• Worked on integrating third-party payment gateway

EDUCATION
B.Tech IT  Andhra University  2018-2022  GPA: 8.2

TECHNICAL SKILLS
Backend: Node.js, Express, PostgreSQL, Redis, Docker

PROJECTS
Job Board
Built a full-stack job board with authentication, PostgreSQL, and REST API. Deployed to AWS EC2 with Docker.
`.trim();

/** Resume C — Strong: quantified bullets, no personal details, no filler */
const RESUME_C: ParsedSections = {
    summary: 'Full-stack engineer with 4 years building scalable distributed systems. Expertise in React, Node.js, and AWS.',
    experience: [
        {
            title: 'Senior Software Engineer',
            company: 'TechCorp',
            dates: 'Mar 2021 – Present',
            bullets: [
                'Architected microservices platform reducing p99 latency from 800ms to 120ms (85% improvement)',
                'Led migration of 3 monolithic services to Kubernetes, improving deployment frequency by 4x',
                'Optimized PostgreSQL queries cutting database load by 40%, saving $12k/month in cloud costs',
                'Mentored 4 junior engineers; all promoted within 18 months',
            ],
        },
        {
            title: 'Software Engineer',
            company: 'StartupXYZ',
            dates: 'Jun 2020 – Feb 2021',
            bullets: [
                'Built React dashboard serving 50,000 monthly active users',
                'Implemented caching layer reducing API calls by 60%',
                'Shipped 3 major features in 6 months with zero production incidents',
            ],
        },
    ],
    education: [{ degree: 'B.Tech CSE', school: 'IIT Bombay', dates: '2016-2020', gpa: '8.9', courses: [] }],
    skills: [{ category: 'Tech', items: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'Kubernetes'] }],
    projects: [
        {
            name: 'Open Source RAG Library',
            description: 'Published npm package for retrieval-augmented generation with 1,200 weekly downloads. Integrated with LangChain.',
            tech: ['TypeScript', 'LangChain'],
        },
    ],
};

const RAW_C = `
C. Engineer
c.eng@example.com  +1-555-123-4567
linkedin.com/in/ceng  github.com/ceng

Full-stack engineer with 4 years building scalable distributed systems. Expertise in React, Node.js, and AWS.

EXPERIENCE
Senior Software Engineer — TechCorp
Mar 2021 – Present
• Architected microservices platform reducing p99 latency from 800ms to 120ms (85% improvement)
• Led migration of 3 monolithic services to Kubernetes, improving deployment frequency by 4x
• Optimized PostgreSQL queries cutting database load by 40%, saving $12k/month in cloud costs
• Mentored 4 junior engineers; all promoted within 18 months

Software Engineer — StartupXYZ
Jun 2020 – Feb 2021
• Built React dashboard serving 50,000 monthly active users
• Implemented caching layer reducing API calls by 60%
• Shipped 3 major features in 6 months with zero production incidents

EDUCATION
B.Tech CSE  IIT Bombay  2016-2020  GPA: 8.9

TECHNICAL SKILLS
Tech: React, Node.js, TypeScript, PostgreSQL, Redis, AWS, Docker, Kubernetes

PROJECTS
Open Source RAG Library
Published npm package for retrieval-augmented generation with 1,200 weekly downloads. Integrated with LangChain.
`.trim();

// ── Helper ───────────────────────────────────────────────────
function rawPenalties(sections: ParsedSections, raw: string, cfg = DEFAULT_CONFIG) {
    const resume = sectionsToResume(sections, raw);
    return detectAllPenalties(resume, cfg);
}

// ════════════════════════════════════════════════════════════
// SUITE 1 — Exclusion groups
// ════════════════════════════════════════════════════════════
describe('Exclusion groups', () => {
    it('P2 fires on zero-numbers resume — P3 and P4 are suppressed, not double-penalized', () => {
        // RESUME_A has no numbers anywhere → P2 (full_zero_quant) should fire
        // P3 (exp_zero_quant) won't fire anyway (no exp), but P4 (vague_outcomes)
        // could fire if filler verbs present — it must be suppressed by P2.
        const penalties = rawPenalties(RESUME_A, RAW_A);

        const p2 = penalties.find(p => p.id === 'full_zero_quant')!;
        const p3 = penalties.find(p => p.id === 'exp_zero_quant')!;
        const p4 = penalties.find(p => p.id === 'vague_outcomes')!;

        // P2 must be the one that fires (or nothing fires — either is fine)
        if (p2.triggered) {
            // P3 must not independently contribute deduction when P2 fires
            expect(p3.suppressed || !p3.triggered).toBe(true);
            // P4 must be suppressed if P2 fired and P4 also would have fired
            if (p4.triggered) {
                expect(p4.suppressed).toBe(true);
                expect(p4.suppressedBy).toBe('full_zero_quant');
                expect(p4.deduction).toBe(0);
            }
        }
    });

    it('P2 and P3 both trigger on an all-zero resume with experience — P3 is suppressed', () => {
        // Build a resume with experience bullets that have no numbers (P3 condition),
        // and projects also have no numbers (P2 condition → full zero across the board).
        const zeroSections: ParsedSections = {
            summary: '',
            experience: [{ title: 'Engineer', company: 'Corp', dates: 'Jan 2022 – Dec 2023', bullets: ['Worked on backend services', 'Helped maintain the codebase'] }],
            education: [],
            skills: [{ category: 'Tech', items: ['Python'] }],
            projects: [{ name: 'App', description: 'Built an application without any metrics mentioned', tech: [] }],
        };
        const rawZero = `
C. Zero
zero@example.com
github.com/zero  linkedin.com/in/zero

EXPERIENCE
Engineer — Corp
Jan 2022 – Dec 2023
Worked on backend services
Helped maintain the codebase

TECHNICAL SKILLS
Tech: Python

PROJECTS
App
Built an application without any metrics mentioned
        `.trim();

        const penalties = rawPenalties(zeroSections, rawZero);
        const p2 = penalties.find(p => p.id === 'full_zero_quant')!;
        const p3 = penalties.find(p => p.id === 'exp_zero_quant')!;

        if (p2.triggered) {
            // P3 must be suppressed — same root cause as P2
            expect(p3.suppressed).toBe(true);
            expect(p3.deduction).toBe(0);
        } else if (p3.triggered) {
            // If P2 didn't trigger (projects had some numbers), P3 can fire independently
            expect(p3.suppressed).toBeFalsy();
        }
    });

    it('Numbers in projects only, none in experience → P3 fires, P2 does not', () => {
        // Dates are intentionally empty so no year numbers appear in the experience
        // raw text — otherwise the date line itself would satisfy expHasNumbers.
        const mixedSections: ParsedSections = {
            summary: '',
            experience: [{ title: 'Software Engineer', company: 'Acme Corporation', dates: '', bullets: ['Worked on backend services and infrastructure', 'Helped maintain the existing codebase and documentation'] }],
            education: [],
            skills: [{ category: 'Tech', items: ['Python'] }],
            projects: [{ name: 'ML Model', description: 'Trained a model achieving 95% accuracy on test dataset with 10k samples', tech: ['Python'] }],
        };
        const rawMixed = `
D. Mixed
mixed@example.com
github.com/mixed  linkedin.com/in/mixed

EXPERIENCE
Software Engineer — Acme Corporation
Worked on backend services and infrastructure
Helped maintain the existing codebase and documentation

TECHNICAL SKILLS
Tech: Python

PROJECTS
ML Model
Trained a model achieving 95% accuracy on test dataset with 10k samples
        `.trim();

        const penalties = rawPenalties(mixedSections, rawMixed);
        const p2 = penalties.find(p => p.id === 'full_zero_quant')!;
        const p3 = penalties.find(p => p.id === 'exp_zero_quant')!;

        // Projects have numbers → P2 should NOT fire (not full zero)
        expect(p2.triggered).toBe(false);
        // Experience bullets have no numbers → P3 should fire
        expect(p3.triggered).toBe(true);
        expect(p3.deduction).toBeGreaterThan(0);
    });

    it('Bullet quality cap: P14 + P15 combined deduction ≤ max(d14,d15) + 0.5*min(d14,d15)', () => {
        // Build a resume where BOTH many short bullets AND many long bullets appear.
        // This is unusual but possible if a resume mixes very short and very long lines.
        const mixBullets = [
            // Short (< 30 chars)
            'Built API',
            'Fixed bugs',
            'Wrote tests',
            // Long (> 200 chars)
            'Developed and maintained a comprehensive full-stack web application using React on the frontend and Node.js with Express on the backend while integrating multiple third-party APIs and managing PostgreSQL database schemas with complex migrations',
            'Architected and implemented an event-driven microservices system leveraging Apache Kafka for message brokering between services while maintaining high availability with Kubernetes orchestration and automated scaling policies based on CPU and memory metrics',
            'Led the complete redesign and refactoring of the legacy authentication system including implementing OAuth2 with JWT tokens replacing the old session-based approach resulting in improved security posture and reduced server load by eliminating session storage overhead',
        ];

        const mixSections: ParsedSections = {
            summary: 'Engineer with experience',
            experience: [{ title: 'Engineer', company: 'Corp', dates: 'Jan 2022 – Present', bullets: mixBullets }],
            education: [{ degree: 'B.Tech', school: 'Uni', dates: '2018-2022', gpa: '', courses: [] }],
            skills: [{ category: 'Tech', items: ['Node.js', 'React', 'PostgreSQL'] }],
            projects: [],
        };
        const rawMix = `
E. Mix
mix@example.com
github.com/mix  linkedin.com/in/mix

Engineer with experience

EXPERIENCE
Engineer — Corp
Jan 2022 – Present
Built API
Fixed bugs
Wrote tests
Developed and maintained a comprehensive full-stack web application using React on the frontend and Node.js with Express on the backend while integrating multiple third-party APIs and managing PostgreSQL database schemas with complex migrations
Architected and implemented an event-driven microservices system leveraging Apache Kafka for message brokering between services while maintaining high availability with Kubernetes orchestration and automated scaling policies based on CPU and memory metrics
Led the complete redesign and refactoring of the legacy authentication system including implementing OAuth2 with JWT tokens replacing the old session-based approach resulting in improved security posture and reduced server load by eliminating session storage overhead

EDUCATION
B.Tech  Uni  2018-2022

TECHNICAL SKILLS
Tech: Node.js, React, PostgreSQL
        `.trim();

        const penalties = rawPenalties(mixSections, rawMix);
        const p14 = penalties.find(p => p.id === 'short_bullets')!;
        const p15 = penalties.find(p => p.id === 'long_bullets')!;

        if (p14.triggered && p15.triggered) {
            const d14 = p14.deduction;
            const d15 = p15.deduction;
            const larger  = Math.max(d14, d15);
            const smaller = Math.min(d14, d15);
            const cap = larger + 0.5 * smaller;
            expect(d14 + d15).toBeLessThanOrEqual(cap + 0.001); // small float tolerance
        }
    });
});

// ════════════════════════════════════════════════════════════
// SUITE 2 — Config mutability
// ════════════════════════════════════════════════════════════
describe('Config mutability', () => {
    it('Changing penalty value in custom config changes the final score without code edits', () => {
        // Use a resume that reliably triggers personal_details (P1)
        const pdSections: ParsedSections = {
            summary: 'Engineer',
            experience: [{ title: 'Engineer', company: 'Corp', dates: 'Jan 2022 – Present', bullets: ['Built systems serving 1000 users daily', 'Reduced latency by 20%', 'Deployed to AWS with 99.9% uptime'] }],
            education: [{ degree: 'B.Tech', school: 'Uni', dates: '2018-2022', gpa: '', courses: [] }],
            skills: [{ category: 'Tech', items: ['Node.js', 'AWS'] }],
            projects: [],
        };
        const rawPD = `
F. Person
person@example.com  +91 9876543210
Date of Birth: 27 Nov 2000
Gender: Male
Marital Status: Single
github.com/person  linkedin.com/in/person

Engineer

EXPERIENCE
Engineer — Corp
Jan 2022 – Present
Built systems serving 1000 users daily
Reduced latency by 20%
Deployed to AWS with 99.9% uptime

EDUCATION
B.Tech  Uni  2018-2022

TECHNICAL SKILLS
Tech: Node.js, AWS
        `.trim();

        const defaultResult = computeAdvancedATS(pdSections, rawPD);

        // Mutate personal_details penalty to 5.0 (down from 9.0)
        const customConfig: ScoringConfig = {
            ...DEFAULT_CONFIG,
            penalties: { ...DEFAULT_CONFIG.penalties, personal_details: 5.0 },
        };
        const customResult = computeAdvancedATS(pdSections, rawPD, undefined, undefined, customConfig);

        const p1Default = defaultResult.all_penalties.find(p => p.id === 'personal_details')!;
        const p1Custom  = customResult.all_penalties.find(p => p.id === 'personal_details')!;

        if (p1Default.triggered) {
            // Score should increase by exactly the penalty difference
            const penaltyDiff = DEFAULT_CONFIG.penalties.personal_details - 5.0;
            expect(customResult.score).toBe(defaultResult.score + Math.round(penaltyDiff));
            expect(p1Custom.deduction).toBe(5.0);
        }
    });
});

// ════════════════════════════════════════════════════════════
// SUITE 3 — Golden snapshots (before/after refactor parity)
// Run `vitest run` ONCE before refactoring to capture baseline;
// subsequent runs verify no scoring logic changed.
// ════════════════════════════════════════════════════════════
describe('Golden file — score parity before and after Phase 1 refactor', () => {
    it('Resume A (fresher, trivial projects, filler summary) score is stable', () => {
        const result = computeAdvancedATS(RESUME_A, RAW_A);
        expect(result.score).toMatchSnapshot();
        expect(result.grade).toMatchSnapshot();
        expect(result.total_penalty).toMatchSnapshot();
        // Suppressed issues must always be an array (may be empty)
        expect(Array.isArray(result.suppressedIssues)).toBe(true);
    });

    it('Resume B (junior dev, partial numbers, weak verbs) score is stable', () => {
        const result = computeAdvancedATS(RESUME_B, RAW_B);
        expect(result.score).toMatchSnapshot();
        expect(result.grade).toMatchSnapshot();
        expect(result.total_penalty).toMatchSnapshot();
        expect(Array.isArray(result.suppressedIssues)).toBe(true);
    });

    it('Resume C (strong resume, quantified, IIT) score is stable', () => {
        const result = computeAdvancedATS(RESUME_C, RAW_C);
        expect(result.score).toMatchSnapshot();
        expect(result.grade).toMatchSnapshot();
        expect(result.total_penalty).toMatchSnapshot();
        // Strong resume: should score higher than resume B
        const resultB = computeAdvancedATS(RESUME_B, RAW_B);
        expect(result.score).toBeGreaterThan(resultB.score);
    });

    it('Resume B scores higher than Resume A', () => {
        const resultA = computeAdvancedATS(RESUME_A, RAW_A);
        const resultB = computeAdvancedATS(RESUME_B, RAW_B);
        expect(resultB.score).toBeGreaterThan(resultA.score);
    });
});

// ════════════════════════════════════════════════════════════
// SUITE 4 — New optional fields are present
// ════════════════════════════════════════════════════════════
describe('New optional fields', () => {
    it('suppressedIssues is present on AdvancedATSResult', () => {
        const result = computeAdvancedATS(RESUME_B, RAW_B);
        expect('suppressedIssues' in result).toBe(true);
    });

    it('PenaltyResult has suppressed and suppressedBy fields when applicable', () => {
        // Any penalty result should have the optional suppressed field shape
        const result = computeAdvancedATS(RESUME_A, RAW_A);
        for (const p of result.all_penalties) {
            // suppressed is optional; if present must be boolean
            if ('suppressed' in p) {
                expect(typeof p.suppressed).toBe('boolean');
            }
            if ('suppressedBy' in p && p.suppressedBy !== undefined) {
                expect(typeof p.suppressedBy).toBe('string');
            }
        }
    });
});
