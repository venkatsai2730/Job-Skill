// ═══════════════════════════════════════════════════════════════
// SECTION SYNONYMS — Non-standard header → canonical section map
//
// Used by parse-fidelity.ts to detect whether an ATS can map
// a resume's headers even when they deviate from standard names.
// ═══════════════════════════════════════════════════════════════

export type CanonicalSection =
    | 'summary'
    | 'experience'
    | 'education'
    | 'skills'
    | 'projects'
    | 'achievements'
    | 'certifications'
    | 'contact';

/** Lowercase, punctuation-stripped header → canonical section name */
export const SECTION_SYNONYMS: Record<string, CanonicalSection> = {
    // Summary / Objective
    'summary':                   'summary',
    'professional summary':      'summary',
    'career summary':            'summary',
    'executive summary':         'summary',
    'profile':                   'summary',
    'professional profile':      'summary',
    'about me':                  'summary',
    'about':                     'summary',
    'objective':                 'summary',
    'career objective':          'summary',
    'professional objective':    'summary',
    'personal statement':        'summary',

    // Experience
    'experience':                'experience',
    'work experience':           'experience',
    'professional experience':   'experience',
    'employment history':        'experience',
    'work history':              'experience',
    'career history':            'experience',
    'internship':                'experience',
    'internships':               'experience',
    'internship experience':     'experience',
    'relevant experience':       'experience',
    'industry experience':       'experience',
    'clinical experience':       'experience',
    'research experience':       'experience',

    // Education
    'education':                 'education',
    'academic background':       'education',
    'educational background':    'education',
    'academics':                 'education',
    'academic qualifications':   'education',
    'education and training':    'education',
    'education certifications':  'education',

    // Skills
    'skills':                    'skills',
    'technical skills':          'skills',
    'core competencies':         'skills',
    'competencies':              'skills',
    'technologies':              'skills',
    'tools technologies':        'skills',
    'tools and technologies':    'skills',
    'programming languages':     'skills',
    'technical expertise':       'skills',
    'key skills':                'skills',
    'areas of expertise':        'skills',
    'expertise':                 'skills',
    'languages and frameworks':  'skills',
    'languages frameworks':      'skills',
    'hard skills':               'skills',

    // Projects
    'projects':                  'projects',
    'personal projects':         'projects',
    'academic projects':         'projects',
    'technical projects':        'projects',
    'side projects':             'projects',
    'key projects':              'projects',
    'relevant projects':         'projects',
    'selected projects':         'projects',
    'notable projects':          'projects',
    'open source projects':      'projects',
    'open source':               'projects',

    // Achievements
    'achievements':              'achievements',
    'accomplishments':           'achievements',
    'awards':                    'achievements',
    'awards and achievements':   'achievements',
    'honors':                    'achievements',
    'honours':                   'achievements',
    'honors and awards':         'achievements',
    'publications':              'achievements',
    'recognition':               'achievements',
    'achievements and awards':   'achievements',
    'extra curricular activities': 'achievements',
    'extracurricular activities':'achievements',
    'leadership':                'achievements',

    // Certifications
    'certifications':            'certifications',
    'certificates':              'certifications',
    'certification':             'certifications',
    'licenses':                  'certifications',
    'credentials':               'certifications',
    'professional development':  'certifications',
    'training':                  'certifications',
    'courses':                   'certifications',
    'online courses':            'certifications',
    'professional certifications':'certifications',

    // Contact
    'contact':                   'contact',
    'contact information':       'contact',
    'contact details':           'contact',
    'personal details':          'contact',
    'personal information':      'contact',
};

/**
 * Normalize a raw header string and look it up in the synonym map.
 * Returns the canonical section name, or null if unrecognized.
 */
export function normalizeHeader(raw: string): CanonicalSection | null {
    const key = raw
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[:\-–—\/+|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return SECTION_SYNONYMS[key] ?? null;
}
