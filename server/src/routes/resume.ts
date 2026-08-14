import { Router, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { PDFParse } from "pdf-parse";

const aiResumeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many AI requests. Please wait a moment." },
    // Falling back to a raw req.ip lets an IPv6 client sidestep the limit by
    // rotating addresses within its /64. ipKeyGenerator normalises the prefix,
    // so the fallback buckets per subnet rather than per address.
    keyGenerator: (req: any) => req.user?.userId || ipKeyGenerator(req.ip ?? ""),
});
import Groq from "groq-sdk";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
} from "docx";
import { parseLatex } from "../lib/latex-parser.js";
import { generateLatex } from "../lib/latex-generator.js";
import { enrichMissingSkills } from "../lib/learning-resources.js";
import { inferSemanticSkills, applyResumeFix, getAIReply } from "../services/chatService.js";
import { logActivity } from "../services/activityService.js";
import { denormalizeToSections, type ResumeData } from "../types/resumePatchTypes.js";

const router = Router();
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════════
// HELPERS — Section parsing & ATS scoring
// ═══════════════════════════════════════════════════════════════

interface ExperienceEntry {
    title: string;
    company: string;
    dates: string;
    bullets: string[];
}
interface EducationEntry {
    degree: string;
    school: string;
    dates: string;
    gpa: string;
    courses: string[];
}
interface SkillGroup {
    category: string;
    items: string[];
}
interface ProjectEntry {
    name: string;
    description: string;
    tech: string[];
    url?: string;
}
interface CertificationEntry {
    text: string;
}
export interface ParsedSections {
    name: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
    experience: ExperienceEntry[];
    education: EducationEntry[];
    skills: SkillGroup[];
    projects: ProjectEntry[];
    certifications: CertificationEntry[];
    links?: { linkedin?: string; github?: string; portfolio?: string; medium?: string; };
}
// Removed previous interfaces that were redefined with AdvancedATSResult.

// ── Extract social/portfolio URLs from header text ──────────────
function extractUrls(headerText: string): {
    linkedin?: string; github?: string; portfolio?: string; medium?: string;
} {
    const linkedinMatch = headerText.match(
        /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w-]+)\/?/i
    );
    const linkedin = linkedinMatch
        ? `https://linkedin.com/in/${linkedinMatch[1]}`
        : undefined;

    const githubMatch = headerText.match(
        /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)\/?/i
    );
    const github = githubMatch
        ? `https://github.com/${githubMatch[1]}`
        : undefined;

    // Medium handle (medium.com/@handle or handle.medium.com)
    const mediumMatch = headerText.match(
        /(?:https?:\/\/)?(?:www\.)?medium\.com\/(@?[\w.-]+)\/?/i
    ) || headerText.match(/(?:https?:\/\/)?([\w-]+)\.medium\.com\/?/i);
    const medium = mediumMatch
        ? (mediumMatch[0].startsWith("http") ? mediumMatch[0] : `https://${mediumMatch[0]}`)
        : undefined;

    const portfolioMatch = headerText.match(
        /https?:\/\/(?!(?:www\.)?(?:linkedin|github|medium)\.com)([\w\-./?=&#]+)/i
    );
    const portfolio = portfolioMatch ? portfolioMatch[0] : undefined;

    const hasLinks = linkedin || github || portfolio || medium;
    return hasLinks ? { linkedin, github, portfolio, medium } : {};
}

// ── Extract contact info from header lines (before first section) ─
function extractContactInfo(headerLines: string[]): {
    name: string; email: string; phone: string; location: string;
} {
    const fullText = headerLines.join(" ");

    const emailMatch = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.exec(fullText);
    const email = emailMatch ? emailMatch[0].trim() : "";

    const phoneMatch = /(\+?[\d][\d\s\-.()/]{7,}\d)/.exec(fullText);
    const phone = phoneMatch ? phoneMatch[0].trim() : "";

    const NAME_BLOCKLIST = /^(get\s+in\s+contact|curriculum\s+vitae|resume|cv|contact\s+me|contact\s+info|my\s+resume)$/i;
    const name = headerLines.find(
        (l) => l.length > 1 && l.length < 60 && !/@/.test(l) && !/^\+?[\d\s\-.()/]{7,}$/.test(l) && !NAME_BLOCKLIST.test(l.trim())
    ) ?? "";

    const locMatch = /\b([A-Z][a-z][\w ]*,\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*))\b/.exec(fullText);
    const location = locMatch ? locMatch[0].trim() : "";

    return { name, email, phone, location };
}

// ── Section heading patterns ────────────────────────────────────
const SECTION_PATTERNS: Record<string, RegExp> = {
    summary: /^(summary|professional\s+summary|profile|objective|about\s*me|career\s+summary)/i,
    experience: /^(experience|work\s+experience|professional\s+experience|employment|work\s+history)/i,
    education: /^(education|academic|academics|qualifications)/i,
    skills: /^(skills|technical\s+skills|core\s+competencies|competencies|technologies|tech\s+stack)/i,
    soft_skills: /^(soft\s*skills?|interpersonal\s*skills?|transferable\s*skills?|core\s+values?)/i,
    projects: /^(projects|personal\s+projects|key\s+projects|notable\s+projects|academic\s+projects)/i,
    certifications: /^(certifications?|certificates?|professional\s+certifications?|licenses?\s*(?:&|and)?\s*certifications?)/i,
    achievements: /^(achievements?|awards?|honors?|accomplishments?|awards?\s*(?:&|and)?\s*achievements?)/i,
};

function detectSectionBoundaries(lines: string[]): { section: string; startIdx: number }[] {
    const boundaries: { section: string; startIdx: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        const cleaned = lines[i].replace(/[:\-–—|•*#_=]/g, "").trim();
        if (!cleaned || cleaned.length > 60) continue;
        for (const [sec, re] of Object.entries(SECTION_PATTERNS)) {
            if (re.test(cleaned)) {
                boundaries.push({ section: sec, startIdx: i });
                break;
            }
        }
    }
    return boundaries;
}

function extractTextBetween(lines: string[], from: number, to: number): string[] {
    return lines.slice(from + 1, to).map((l) => l.trim()).filter(Boolean);
}

// ── Parse experience entries ────────────────────────────────────
const DATE_RE = /(\d{4}\s*[-–—]\s*(present|\d{4})|(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[-–—]\s*(?:present|\w+\s+\d{4})))/i;

function parseExperience(textLines: string[]): ExperienceEntry[] {
    const entries: ExperienceEntry[] = [];
    let current: ExperienceEntry | null = null;

    for (const line of textLines) {
        const dateMatch = line.match(DATE_RE);
        // Heuristic: line with a date that also has text before it is a new entry header
        const isBullet = /^[•\-–*▪◦◆➤❖►]/.test(line) || /^\d+[.)]\s/.test(line);

        if (dateMatch && !isBullet) {
            // Push previous entry
            if (current) entries.push(current);
            const datePart = dateMatch[0].trim();
            const rest = line.replace(datePart, "").replace(/[|·•,]/g, " ").trim();
            // Try to split title / company — look for common separators
            const parts = rest.split(/\s+(?:at|@|[-–—|,])\s+/i).map((s) => s.trim()).filter(Boolean);
            
            // Detect if parts[0] is a company name vs a job title
            // Common resume format: "Company Name    Oct 2025 - Present"
            // followed by "Associate Data Scientist" on the next line
            const ROLE_KW = /\b(engineer|developer|scientist|analyst|designer|manager|lead|architect|consultant|intern|associate|senior|junior|trainee|specialist|coordinator|devops|sre|qa|tester|director|vp|head)\b/i;
            let title = parts[0] || rest || "Role";
            let company = parts[1] || "";
            
            if (!ROLE_KW.test(title) && title.length < 40) {
                // Likely a company name, not a role — swap and leave title empty for next line
                company = title;
                title = "";
            }
            
            current = { title, company, dates: datePart, bullets: [] };
        } else if (current && current.title === "" && !isBullet && line.length > 3 && line.length < 60 && !dateMatch) {
            // This line is the job title following a company+date line
            current.title = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
        } else if (current && (isBullet || (line.length > 20 && !dateMatch))) {
            const clean = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
            if (clean) current.bullets.push(clean);
        } else if (!current && line.length > 5 && !dateMatch) {
            // Could be a title-only line before the date line
            current = { title: line.trim(), company: "", dates: "", bullets: [] };
        }
    }
    if (current) entries.push(current);

    // If nothing was extracted, create a single entry from all text
    if (entries.length === 0 && textLines.length > 0) {
        entries.push({
            title: "Professional Experience",
            company: "",
            dates: "",
            bullets: textLines.filter((l) => l.length > 10),
        });
    }

    return entries;
}

// ── Parse education ─────────────────────────────────────────────
function parseEducation(textLines: string[]): EducationEntry[] {
    const entries: EducationEntry[] = [];
    const fullText = textLines.join(" ");

    // Try to detect degree-like patterns
    const degreeRe =
        /\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|associate|diploma|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|graduation|graduate|degree)\b/gi;
    const gpaRe = /\b(?:gpa|cgpa|grade)[:\s]*(\d+\.?\d*)\b/i;
    const courseRe = /\b(?:courses?|coursework|relevant\s+courses?)[:\s]*(.*)/i;

    const gpaMatch = fullText.match(gpaRe);
    const courseMatch = fullText.match(courseRe);

    let degree = "";
    const degreeMatch = fullText.match(degreeRe);
    if (degreeMatch) {
        // Get the line that has the degree
        const degreeLine = textLines.find((l) => degreeRe.test(l)) || textLines[0] || "";
        degree = degreeLine.replace(DATE_RE, "").trim();
    }

    const dateMatch = fullText.match(DATE_RE);
    // Reset regex lastIndex since degreeRe is global (used above with .test())
    degreeRe.lastIndex = 0;
    const rawSchool = textLines.find(
        (l) => !degreeRe.test(l) && !gpaRe.test(l) && !courseRe.test(l) && l.length > 3 && !DATE_RE.test(l)
    ) || "";
    // Avoid "Graduation — Graduation" when school text echoes the degree text
    const school = rawSchool.toLowerCase() === degree.toLowerCase() ? "" : rawSchool;

    entries.push({
        degree: degree || textLines[0] || "Degree",
        school: school,
        dates: dateMatch ? dateMatch[0] : "",
        gpa: gpaMatch ? gpaMatch[1] : "",
        courses: courseMatch
            ? courseMatch[1].split(/[,;|•]/).map((c) => c.trim()).filter(Boolean)
            : [],
    });

    return entries;
}

// ── Parse skills ────────────────────────────────────────────────
// Filters out education metadata and interests that bleed in from multi-column PDF layouts
const SKILLS_JUNK_RE = /year\s+of\s+passing|class\s+x(ii)?|grade\s+[\d.]+%?|board\s+|medium\s+english|medium\s+hindi|languages?\s+known|special\s+interests?|other\s+interests?|^course$|^college$|^b\.?tech|^b\.?e\.|^m\.?tech|^graduation$/i;

function parseSkills(textLines: string[]): SkillGroup[] {
    const groups: SkillGroup[] = [];
    let currentCategory = "General";
    let currentItems: string[] = [];

    for (const line of textLines) {
        // Check if line is a sub-heading (e.g., "Languages:", "Frontend:")
        const catMatch = line.match(/^([A-Za-z\s&/]+)[:\-–—]\s*(.*)/);
        if (catMatch && catMatch[1].trim().length < 30) {
            if (currentItems.length > 0) {
                groups.push({ category: currentCategory, items: currentItems });
            }
            currentCategory = catMatch[1].trim();
            currentItems = catMatch[2]
                .split(/[,;|•·]/)
                .map((s) => s.trim())
                .filter((s) => Boolean(s) && !SKILLS_JUNK_RE.test(s));
        } else {
            // Split by common separators
            const items = line
                .split(/[,;|•·]/)
                .map((s) => s.replace(/^[•\-–*▪◦◆]+\s*/, "").trim())
                .filter((s) => s.length > 0 && s.length < 40 && !SKILLS_JUNK_RE.test(s));
            currentItems.push(...items);
        }
    }
    if (currentItems.length > 0) {
        groups.push({ category: currentCategory, items: currentItems });
    }

    // If still nothing, put everything as one group
    if (groups.length === 0 && textLines.length > 0) {
        groups.push({
            category: "Skills",
            items: textLines.flatMap((l) =>
                l.split(/[,;|•·]/).map((s) => s.trim()).filter(Boolean)
            ),
        });
    }

    return groups;
}

// ── Parse projects ──────────────────────────────────────────────
function parseProjects(textLines: string[]): ProjectEntry[] {
    const entries: ProjectEntry[] = [];
    let current: ProjectEntry | null = null;

    // Common tech keywords to detect in project descriptions
    const TECH_KEYWORDS = /\b(react|angular|vue|next\.?js|node\.?js|express|django|flask|spring|fastapi|graphql|rest|mongodb|postgresql|mysql|redis|docker|kubernetes|aws|azure|gcp|python|javascript|typescript|java|golang|rust|kotlin|swift|flutter|tensorflow|pytorch|pandas|numpy|firebase|supabase|tailwind|html|css|sass|webpack|vite|git|linux|nginx|selenium|cypress|jest|socket\.?io|websocket|kafka|rabbitmq|elasticsearch|prisma|sequelize|mongoose|blockchain|solidity|figma|tableau|powerbi|opencv|scikit|bert|gpt|langchain|openai|streamlit|gradio|huggingface|transformers|nltk|spacy|matplotlib|seaborn|plotly|airflow|spark|hadoop|databricks|snowflake|dbt|terraform|ansible|jenkins|github\s*actions|gitlab\s*ci|circleci|vercel|netlify|heroku|render|railway|stripe|twilio|sendgrid|auth0|clerk|jwt|oauth|graphql|trpc|drizzle|zod|shadcn)\b/gi;

    // Description/bullet lines usually open with a past-tense action verb. Project
    // TITLES almost never do — used to reject wrapped description lines that happen
    // to start with a capital (e.g. "Built a CNN-based classifier trained on").
    const DESC_VERB = /^(built|developed|designed|created|implemented|engineered|used|applied|trained|achieved|optimized|integrated|deployed|led|reduced|improved|worked|leveraged|managed|conducted|performed|analyzed|architected|automated|delivered|spearheaded|orchestrated|collaborated|researched|wrote|programmed|coded|configured|maintained|tested|debugged|scaled|enabled|reaching|using)\b/i;

    for (const line of textLines) {
        const isBullet = /^[•\-–*▪◦◆➤❖►]/.test(line) || /^\d+[.)]\s/.test(line);
        // A real project title starts with a capital/digit, does NOT read like a
        // wrapped sentence fragment (no trailing sentence punctuation), and does NOT
        // open with an action verb. This rejects description fragments such as
        // "the FER-2013 dataset." or "Built a CNN-based classifier trained on".
        const startsTitle = /^[A-Z0-9]/.test(line);
        const endsSentence = /[.,:;]\)?["']?$/.test(line.trim());
        const looksLikeName = !isBullet && startsTitle && !endsSentence
            && !DESC_VERB.test(line) && line.length >= 3 && line.length < 70;

        if (looksLikeName || (!current && !isBullet && line.length > 2)) {
            if (current) entries.push(current);
            // Capture an inline URL (e.g. a GitHub repo link) and strip it from the name
            const inlineUrlMatch = line.match(/https?:\/\/[\w\-./?=&#%]+/i)
                || line.match(/(?:www\.)?github\.com\/[\w-]+\/[\w-]+/i);
            let nameLine = line.replace(/https?:\/\/[\w\-./?=&#%]+/gi, "").trim();
            // "Project Name | Python, React" — split title from an inline tech stack
            let inlineTech: string[] = [];
            const pipeIdx = nameLine.indexOf("|");
            if (pipeIdx > 0) {
                inlineTech = nameLine.slice(pipeIdx + 1).split(/[,;•]/).map((s) => s.trim()).filter(Boolean);
                nameLine = nameLine.slice(0, pipeIdx).trim();
            }
            current = {
                name: nameLine || line.trim(),
                description: "",
                tech: inlineTech,
                ...(inlineUrlMatch ? { url: inlineUrlMatch[0].startsWith("http") ? inlineUrlMatch[0] : `https://${inlineUrlMatch[0]}` } : {}),
            };
        } else if (current) {
            const clean = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
            // Explicit "Tech:"/"Stack:"/"Tools:" line. Anchored at the start and a
            // separator is required so prose words ("using", "techniques") are not
            // mistaken for a tech-stack declaration.
            const techMatch = clean.match(/^(?:tech(?:nologies)?|tech\s*stack|stack|tools|built\s+with)\s*[:\-–]\s*(.*)/i);
            if (techMatch) {
                current.tech = Array.from(new Set([
                    ...current.tech,
                    ...techMatch[1].split(/[,;|•]/).map((s) => s.trim()).filter(Boolean),
                ]));
            } else if (clean) {
                // Repair PDF line-break hyphenation: a description ending in "-" was
                // split mid-word ("augmentation tech-" + "niques" → "...techniques").
                if (/\w-$/.test(current.description)) {
                    current.description = current.description.replace(/-$/, "") + clean;
                } else {
                    current.description += (current.description ? " " : "") + clean;
                }
                // Also extract known tech keywords from description text
                const foundTech = clean.match(TECH_KEYWORDS);
                if (foundTech) {
                    const newTech = foundTech.map(t => t.trim());
                    current.tech = Array.from(new Set([...current.tech, ...newTech]));
                }
            }
        }
    }
    if (current) entries.push(current);

    if (entries.length === 0 && textLines.length > 0) {
        const fullText = textLines.join(" ");
        const foundTech = fullText.match(TECH_KEYWORDS) || [];
        entries.push({
            name: "Project",
            description: fullText,
            tech: Array.from(new Set(foundTech.map(t => t.trim()))),
        });
    }

    return entries;
}

// ── Full section parser ─────────────────────────────────────────
export function parseSections(rawText: string): ParsedSections {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim());
    const boundaries = detectSectionBoundaries(lines);

    const result: ParsedSections = {
        name: "",
        email: "",
        phone: "",
        location: "",
        summary: "",
        experience: [],
        education: [],
        skills: [],
        projects: [],
        certifications: [],
    };

    // Extract name/email/phone/location from text before the first section heading
    if (boundaries.length > 0) {
        const headerLines = lines.slice(0, boundaries[0].startIdx).filter(Boolean);
        const contact = extractContactInfo(headerLines);
        result.name = contact.name;
        result.email = contact.email;
        result.phone = contact.phone;
        result.location = contact.location;
        const headerText = headerLines.join(" ");
        const urls = extractUrls(headerText);
        if (urls.linkedin || urls.github || urls.portfolio) {
            result.links = urls;
        }
    }

    for (let i = 0; i < boundaries.length; i++) {
        const b = boundaries[i];
        const nextStart = i + 1 < boundaries.length ? boundaries[i + 1].startIdx : lines.length;
        const sectionLines = extractTextBetween(lines, b.startIdx, nextStart);

        switch (b.section) {
            case "summary":
                result.summary = sectionLines.join(" ");
                break;
            case "experience":
                result.experience = parseExperience(sectionLines);
                break;
            case "education":
                result.education = parseEducation(sectionLines);
                break;
            case "skills":
                result.skills = parseSkills(sectionLines);
                break;
            case "projects":
                result.projects = parseProjects(sectionLines);
                break;
            case "soft_skills":
                // Recognized but not stored — prevents content from bleeding into projects
                break;
            case "certifications":
            case "achievements": {
                // Store certifications & achievements as bullet entries (target template
                // renders a combined "Certifications & Achievements" section).
                const entries = sectionLines
                    .map((l) => l.replace(/^[\s•*\-–—]+/, "").trim())
                    .filter((l) => l.length > 2);
                for (const text of entries) result.certifications.push({ text });
                break;
            }
        }
    }

    // If no summary section found, use first paragraph before any section
    if (!result.summary && boundaries.length > 0) {
        const beforeFirst = lines.slice(0, boundaries[0].startIdx).filter(Boolean);
        // Skip the name (first 1-2 short lines) and use the rest as summary
        const textLines = beforeFirst.filter((l) => l.length > 30);
        if (textLines.length > 0) {
            result.summary = textLines.join(" ");
        }
    }

    return result;
}

// ── Serialize structured sections back into resume-like plain text ──
// Used after an AI edit so the ATS scorer (which reads keywords, contact info,
// bullet density and word count from rawText) reflects the CURRENT sections
// instead of the stale uploaded text. Section headers match SECTION_PATTERNS
// so the scorer's regex extraction lines up with the structured content.
export function serializeSectionsToText(sections: ParsedSections): string {
    const out: string[] = [];

    if (sections.name) out.push(sections.name);
    const contactBits = [sections.location, sections.phone, sections.email].filter(Boolean);
    if (contactBits.length) out.push(contactBits.join(" | "));
    const links = (sections.links || {}) as Record<string, string | undefined>;
    const linkBits = [links.linkedin, links.github, links.medium, links.portfolio].filter(Boolean);
    if (linkBits.length) out.push(linkBits.join(" | "));
    out.push("");

    if (sections.summary) {
        out.push("PROFESSIONAL SUMMARY", sections.summary, "");
    }

    if (sections.skills?.length) {
        out.push("TECHNICAL SKILLS");
        for (const g of sections.skills) {
            const items = (g.items || []).join(", ");
            out.push(g.category && g.category !== "General" ? `${g.category}: ${items}` : items);
        }
        out.push("");
    }

    if (sections.experience?.length) {
        out.push("PROFESSIONAL EXPERIENCE");
        for (const e of sections.experience) {
            out.push([[e.title, e.company].filter(Boolean).join(" | "), e.dates].filter(Boolean).join("  "));
            for (const b of e.bullets || []) out.push(`• ${b}`);
        }
        out.push("");
    }

    if (sections.projects?.length) {
        out.push("PROJECTS");
        for (const p of sections.projects) {
            out.push([p.name, (p.tech || []).join(", ")].filter(Boolean).join(" | "));
            if (p.description) out.push(`• ${p.description}`);
            for (const b of ((p as any).bullets || [])) out.push(`• ${b}`);
        }
        out.push("");
    }

    if (sections.education?.length) {
        out.push("EDUCATION");
        for (const ed of sections.education) {
            out.push([ed.degree, ed.school].filter(Boolean).join(" | "));
            const meta = [ed.dates, ed.gpa ? `GPA: ${ed.gpa}` : ""].filter(Boolean).join("  ");
            if (meta) out.push(meta);
            if (ed.courses?.length) out.push(`Relevant coursework: ${ed.courses.join(", ")}`);
        }
        out.push("");
    }

    const certs = (sections as any).certifications as Array<{ text?: string } | string> | undefined;
    if (certs?.length) {
        out.push("CERTIFICATIONS & ACHIEVEMENTS");
        for (const c of certs) out.push(`• ${typeof c === "string" ? c : (c.text || "")}`.trimEnd());
        out.push("");
    }

    return out.join("\n");
}

// ── Profile Extraction & Sync Helpers ──────────────────────────
export function calculateExperienceYears(sections: any, rawText: string): number {
    let expYears = 0;
    const summaryText = ((sections?.summary || "") + " " + rawText.substring(0, 1500)).toLowerCase();
    const expRegexes = [
        /(\d+)\+?\s*years?\s+(?:of\s+)?(?:production\s+)?(?:ml|machine\s+learning|data\s+science|software|sde|technical)?\s*experience/i,
        /(\d+)\+?\s*years?\s+(?:of\s+)?experience/i,
        /experience[:\s]*(\d+)\+?\s*years?/i
    ];

    for (const regex of expRegexes) {
        const match = summaryText.match(regex);
        if (match) {
            const val = parseFloat(match[1]);
            if (val > 0 && val < 30) {
                expYears = val;
                break;
            }
        }
    }

    let calculatedSpan = 0;
    const experienceEntries = sections?.experience || [];
    if (experienceEntries.length > 0) {
        let minYear = new Date().getFullYear();
        let maxYear = 0;
        let hasPresent = false;

        for (const exp of experienceEntries) {
            const dateStr = (exp.dates || "").toLowerCase();
            const years = dateStr.match(/\b(19|20)\d{2}\b/g);
            if (years) {
                const parsedYears = years.map((y: string) => parseInt(y, 10));
                for (const yr of parsedYears) {
                    if (yr < minYear) minYear = yr;
                    if (yr > maxYear) maxYear = yr;
                }
            }
            if (dateStr.includes("present") || dateStr.includes("current")) {
                hasPresent = true;
            }
        }

        const endYear = hasPresent ? new Date().getFullYear() : (maxYear || new Date().getFullYear());
        if (maxYear > 0 && minYear < new Date().getFullYear()) {
            calculatedSpan = Math.max(0, endYear - minYear);
        }
    }

    let finalExp = Math.max(expYears, calculatedSpan);
    if (finalExp === 0 && (summaryText.includes("1+ year") || summaryText.includes("1 year"))) {
        finalExp = 1;
    }
    return Math.max(0, Math.min(30, finalExp));
}

export function detectUserDegree(sections: any, rawText: string): "phd" | "masters" | "bachelors" | "none" {
    const text = (((sections?.education || []).map((e: any) => e.degree + " " + e.school).join(" ") + " " + rawText)).toLowerCase();
    
    if (/\b(ph\.?d\.?|doctor\s+of\s+philosophy|doctorate)\b/i.test(text)) {
        return "phd";
    }
    if (/\b(m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|m\.?tech|m\.?e\.?|master|masters)\b/i.test(text)) {
        return "masters";
    }
    if (/\b(b\.?s\.?|b\.?a\.?|b\.?tech|b\.?e\.?|bachelor|bachelors)\b/i.test(text)) {
        return "bachelors";
    }
    return "none";
}

export function detectSeniorityLevel(expYears: number, currentRole: string): string {
    const roleLower = (currentRole || "").toLowerCase();
    if (roleLower.includes("senior") || roleLower.includes("sr.") || roleLower.includes("sr ")) return "senior";
    if (roleLower.includes("lead") || roleLower.includes("staff") || roleLower.includes("principal")) return "senior";
    if (roleLower.includes("intern") || roleLower.includes("co-op")) return "intern";
    if (roleLower.includes("fresher") || roleLower.includes("trainee") || roleLower.includes("associate")) return "entry";
    
    if (expYears <= 1) return "intern";
    if (expYears <= 3) return "entry";
    if (expYears <= 6) return "mid";
    return "senior";
}

export async function upsertUserProfileFromResume(userId: string, parsedData: any): Promise<void> {
    try {
        if (!parsedData || !parsedData.sections) return;

        const sections = parsedData.sections;
        const rawText = parsedData.rawText || "";

        // 1. Extract clean skills
        const skillGroups = sections.skills || [];
        const rawSkills = skillGroups.flatMap((g: any) => g.items || []);
        const cleanSkills = rawSkills.flatMap((s: string) => {
            const base = s.replace(/\s*\([^)]*\)/g, '').trim();
            const parenMatch = s.match(/\(([^)]+)\)/);
            const parenItems = parenMatch ? parenMatch[1].split(/[,;]/).map((i: string) => i.trim()).filter(Boolean) : [];
            return [base, ...parenItems].filter(i => i.length > 0);
        });
        const inferred = parsedData.ats?.inferredSkills || [];
        const allSkills = Array.from(new Set([...cleanSkills, ...inferred]));

        // 2. Extract experience years
        const expYears = calculateExperienceYears(sections, rawText);

        // 3. Detect highest degree
        const degree = detectUserDegree(sections, rawText);
        const educationStr = sections.education?.[0]?.degree || (degree !== "none" ? degree.toUpperCase() : "");

        // 4. Current job title
        const currentRole = sections.experience?.[0]?.title || "";

        // 5. Seniority level
        const seniorityLevel = detectSeniorityLevel(expYears, currentRole);

        // 6. Target roles based on current role
        const targetRoles = currentRole ? [currentRole] : [];

        // 7. Preferred locations
        const preferredLocations = sections.location ? [sections.location] : [];

        // Perform the upsert into user_profiles
        const profileData = {
            user_id: userId,
            skills: allSkills,
            experience_years: expYears,
            education: educationStr,
            current_role: currentRole,
            target_roles: targetRoles,
            preferred_locations: preferredLocations,
            seniority_level: seniorityLevel,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseAdmin
            .from("user_profiles")
            .upsert(profileData, { onConflict: "user_id" });

        if (error) {
            console.error("[upsertUserProfileFromResume] Error upserting profile:", error.message);
        } else {
            console.log(`[upsertUserProfileFromResume] Profile upserted for user ${userId}: ${expYears} yrs experience, degree ${degree}, role ${currentRole}`);
        }
    } catch (err: any) {
        console.error("[upsertUserProfileFromResume] Unexpected error:", err.message);
    }
}


import { computeAdvancedATS, AdvancedATSResult } from "../lib/advanced-scorer.js";
import { scoreJobMatch, buildResumeFromScratch } from "../services/chatService.js";
import { LATEX_TEMPLATES } from "../lib/latex-templates.js";
import { simulateGreenhouse, simulateLever } from "../lib/ats-simulator.js";

interface ParsedData {
    sections: ParsedSections;
    ats: AdvancedATSResult;
    rawText?: string;
    isLatex?: boolean;
    /** Normalized, UUID-based resume model (set by Aria edits); optional. */
    resume_data?: ResumeData;
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// ── GET /api/resume — latest resume metadata ──────────────
router.get("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("id, file_name, storage_path, created_at")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") {
            res.status(400).json({ error: error.message });
            return;
        }

        res.json({ resume: data || null });
    } catch (err: any) {
        console.error("Get resume error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /api/resume/parsed — full parsed data + ATS ───────
router.get("/parsed", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") {
            res.status(400).json({ error: error.message });
            return;
        }

        if (!data || !data.parsed_data) {
            res.json({ parsed: null });
            return;
        }

        // Clean up common parser artifacts from stored data
        const parsed = data.parsed_data as any;
        const STORED_NAME_BLOCKLIST = /^(get\s+in\s+contact|curriculum\s+vitae|resume|cv|contact\s+me|contact\s+info|my\s+resume)$/i;
        if (parsed?.sections?.name && STORED_NAME_BLOCKLIST.test(parsed.sections.name.trim())) {
            parsed.sections.name = "";
        }

        res.json({ parsed });
    } catch (err: any) {
        console.error("Get parsed resume error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /api/resume/history — fetch all previous resumes ──
router.get("/history", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("id, file_name, created_at, parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: true }); // Chronological order

        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }

        // Map to a clean frontend model
        const history = (data || []).map(row => {
            const parsed = row.parsed_data as any;
            return {
                id: row.id,
                fileName: row.file_name,
                createdAt: row.created_at,
                atsScore: parsed?.ats?.score || 0,
                parsedData: parsed
            };
        });

        res.json({ history });
    } catch (err: any) {
        console.error("Get resume history error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/resume/upload — accept base64 PDF, parse & store ──
router.post("/upload", async (req: AuthRequest, res: Response) => {
    try {
        const { fileName, fileData } = req.body;

        if (!fileName || !fileData) {
            res.status(400).json({ error: "fileName and fileData are required" });
            return;
        }

        if (!fileName.toLowerCase().endsWith(".pdf")) {
            res.status(400).json({ error: "Only PDF files are allowed" });
            return;
        }

        // Decode base64 to Buffer
        const fileBuffer = Buffer.from(fileData, "base64");

        // Limit: 10MB
        if (fileBuffer.length > 10 * 1024 * 1024) {
            res.status(400).json({ error: "File exceeds 10MB limit" });
            return;
        }

        const storagePath = `${req.user!.userId}/${Date.now()}-${fileName}`;

        // We no longer delete the old resume.
        // It remains in storage and in the database to preserve history.

        // Upload to Supabase Storage with Retry Logic
        let uploadError = null;
        let uploadSuccess = false;

        for (let attempt = 1; attempt <= 3; attempt++) {
            const { error } = await supabaseAdmin.storage
                .from("resumes")
                .upload(storagePath, fileBuffer, {
                    contentType: "application/pdf",
                    upsert: true,
                });

            if (!error) {
                uploadSuccess = true;
                break;
            }

            uploadError = error;
            console.warn(`[Resume] Storage upload attempt ${attempt} failed:`, error.message);

            if (attempt < 3) {
                await new Promise(r => setTimeout(r, 1500 * attempt)); // Exponential backoff: 1.5s, 3s
            }
        }

        if (!uploadSuccess) {
            console.error("[Resume] Final storage upload error:", uploadError);
            res.status(400).json({ error: uploadError?.message || "Upload failed after retries due to database timeout." });
            return;
        }

        // ── Parse PDF text ──────────────────────────────────
        let parsedData: ParsedData | null = null;
        try {
            const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
            const textResult = await parser.getText();
            const rawText = textResult.text || "";
            const sections = parseSections(rawText);
            const ats = computeAdvancedATS(
                sections, 
                rawText, 
                req.user!.userId,
                { fileSizeMB: fileBuffer.length / (1024 * 1024), isPdf: true, fileName }
            );
            
            // ── AI Semantic Skill Inference ──
            const semanticSkills = await inferSemanticSkills(rawText);
            // Merge heuristic skills with AI semantic skills and deduplicate
            ats.inferredSkills = Array.from(new Set([...ats.inferredSkills, ...semanticSkills]));
            
            // Store the full extracted text (capped generously) so later rescores after
            // edits are computed on the same amount of text as the original score.
            parsedData = { sections, ats, rawText: rawText.substring(0, 20000) };
        } catch (parseErr) {
            console.error("PDF parse warning (non-fatal):", parseErr);
            // Continue even if parsing fails — file is still stored
        }

        // Save metadata + parsed data to DB
        const { data: resumeRow, error: dbError } = await supabaseAdmin
            .from("resumes")
            .insert({
                user_id: req.user!.userId,
                file_name: fileName,
                storage_path: storagePath,
                parsed_data: parsedData,
            })
            .select()
            .single();

        if (dbError) {
            res.status(400).json({ error: dbError.message });
            return;
        }

        // ── Auto-Sync to user_profiles ──
        if (parsedData) {
            await upsertUserProfileFromResume(req.user!.userId, parsedData).catch(err => {
                console.error("[Resume Upload] Non-fatal profile sync error:", err.message);
            });
        }

        // ── Log activity event (non-blocking) ──
        if (parsedData?.ats?.score) {
            const score = parsedData.ats.score;
            logActivity({
                user_id: req.user!.userId,
                type: "ats_score",
                title: `AI Resume scan completed — ATS score: ${score}%`,
                meta: { score, fileName },
            });
        } else {
            logActivity({
                user_id: req.user!.userId,
                type: "resume_upload",
                title: `Resume uploaded: ${fileName}`,
                meta: { fileName },
            });
        }

        res.json({ resume: resumeRow, parsed: parsedData });
    } catch (err: any) {
        console.error("Upload resume error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/resume/upload-latex ── Upload raw LaTeX code ──
router.post("/upload-latex", async (req: AuthRequest, res: Response) => {
    try {
        const { latexText } = req.body;
        if (!latexText) {
            res.status(400).json({ error: "Latex text is required" });
            return;
        }

        const sections = parseLatex(latexText);
        
        // Flatten for scoring compilation
        const flatExp = sections.experience.map(e => e.title + " " + e.company + " " + e.bullets.join(" ")).join(" ");
        const flatEdu = sections.education.map(e => e.degree + " " + e.courses.join(" ")).join(" ");
        const flatSkills = sections.skills.map(s => s.items.join(" ")).join(" ");
        const rawText = sections.summary + " " + flatExp + " " + flatEdu + " " + flatSkills;
        
        const ats = computeAdvancedATS(sections, rawText, req.user!.userId); // Pass userId for A/B testing
        
        const parsedData = { 
            sections, 
            ats, 
            rawText: rawText.substring(0, 20000),
            isLatex: true
        };

        res.json({ parsed: parsedData });
    } catch (err: any) {
        console.error("Latex upload error:", err);
        res.status(500).json({ error: "Latex parsing failed: " + err.message });
    }
});

// ── POST /api/resume/score-with-job ── Score existing resume vs JD ──
router.post("/score-with-job", aiResumeLimiter, async (req: AuthRequest, res: Response) => {
    try {
        const { jobDescription, rawText } = req.body;
        
        if (!jobDescription) {
            res.status(400).json({ error: "Job description is required" });
            return;
        }

        let resumeTextToScore = rawText;

        // If no raw text was passed directly from the client, try to get their saved resume text
        if (!resumeTextToScore) {
            const { data: resumeRow, error } = await supabaseAdmin
                .from("resumes")
                .select("parsed_data")
                .eq("user_id", req.user!.userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (error || !resumeRow) {
                res.status(404).json({ error: "No resume found. Please upload one first." });
                return;
            }
            
            // Reconstruct text from parsed sections if rawText wasn't saved or is missing
            const parsed = resumeRow.parsed_data as any;
            resumeTextToScore = parsed?.rawText || JSON.stringify(parsed?.sections || {});
        }

        const aiResponse = await scoreJobMatch(resumeTextToScore, jobDescription);
        
        // Parse the AI response (expecting our strict JSON schema)
        let gapAnalysis;
        try {
            const cleaned = aiResponse.reply
                .replace(/```json\s*/gi, "")
                .replace(/```\s*/g, "")
                .trim();
            try {
                gapAnalysis = JSON.parse(cleaned);
            } catch {
                const match = cleaned.match(/\{[\s\S]*\}/);
                if (!match) throw new Error("no JSON object found");
                gapAnalysis = JSON.parse(match[0]);
            }
        } catch (e) {
            console.error("Failed to parse Gemini JD match response:", aiResponse.reply);
            res.status(500).json({ error: "Failed to parse AI response. Please try again." });
            return;
        }

        // ── Enrich missing skills with course links + salary impact ──
        const missingSkills: string[] = gapAnalysis.missingKeywords || [];
        const learningRecommendations = enrichMissingSkills(missingSkills);

        res.json({ 
            gapAnalysis,
            learningRecommendations 
        });

    } catch (err: any) {
        console.error("Score with job error:", err);
        res.status(500).json({ error: "Failed to score job match: " + err.message });
    }
});

// ── GET /api/resume/download/pdf — stream original PDF ─────
router.get("/download/pdf", async (req: AuthRequest, res: Response) => {
    try {
        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("file_name, storage_path")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        if (!row) {
            res.status(404).json({ error: "No resume found" });
            return;
        }

        const { data: fileData, error: dlError } = await supabaseAdmin.storage
            .from("resumes")
            .download(row.storage_path);

        if (dlError || !fileData) {
            res.status(400).json({ error: dlError?.message || "Download failed" });
            return;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${row.file_name}"`);
        res.send(buffer);
    } catch (err: any) {
        console.error("Download PDF error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /api/resume/download/docx — generate DOCX from parsed data ──
router.get("/download/docx", async (req: AuthRequest, res: Response) => {
    try {
        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("file_name, parsed_data")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        if (!row || !row.parsed_data) {
            res.status(404).json({ error: "No parsed resume data available" });
            return;
        }

        const pd: ParsedData = row.parsed_data;
        // Prefer Aria-patched resume_data when available; fall back to original sections
        const sections = pd.resume_data ? denormalizeToSections(pd.resume_data) : pd.sections;
        const children: Paragraph[] = [];

        // Title — prefer the extracted name, fall back to file name
        const baseName = row.file_name.replace(/\.pdf$/i, "");
        const displayName = pd.sections.name || baseName;
        children.push(
            new Paragraph({
                text: displayName,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
            })
        );

        // Contact line (email · phone · location)
        const contactParts = [pd.sections.email, pd.sections.phone, pd.sections.location].filter(Boolean);
        if (contactParts.length > 0) {
            children.push(
                new Paragraph({
                    children: contactParts.map((part, i) => [
                        new TextRun({ text: part }),
                        ...(i < contactParts.length - 1 ? [new TextRun({ text: "  ·  " })] : []),
                    ]).flat(),
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                })
            );
        }

        // Summary
        if (sections.summary) {
            children.push(
                new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            children.push(new Paragraph({ text: sections.summary, spacing: { after: 200 } }));
        }

        // Experience
        if (sections.experience.length > 0) {
            children.push(
                new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const exp of sections.experience) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: exp.title, bold: true }),
                            new TextRun({ text: exp.company ? ` — ${exp.company}` : "" }),
                            new TextRun({ text: exp.dates ? ` (${exp.dates})` : "", italics: true }),
                        ],
                        spacing: { before: 150, after: 50 },
                    })
                );
                for (const bullet of exp.bullets) {
                    children.push(
                        new Paragraph({ text: bullet, bullet: { level: 0 }, spacing: { after: 30 } })
                    );
                }
            }
        }

        // Education
        if (sections.education.length > 0) {
            children.push(
                new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const edu of sections.education) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: edu.degree, bold: true }),
                            new TextRun({ text: edu.school ? ` — ${edu.school}` : "" }),
                            new TextRun({ text: edu.dates ? ` (${edu.dates})` : "", italics: true }),
                            new TextRun({ text: edu.gpa ? ` | GPA: ${edu.gpa}` : "" }),
                        ],
                        spacing: { after: 80 },
                    })
                );
            }
        }

        // Skills
        if (sections.skills.length > 0) {
            children.push(
                new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const group of sections.skills) {
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${group.category}: `, bold: true }),
                            new TextRun({ text: group.items.join(", ") }),
                        ],
                        spacing: { after: 50 },
                    })
                );
            }
        }

        // Projects
        if (sections.projects.length > 0) {
            children.push(
                new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const proj of sections.projects) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: proj.name, bold: true })],
                        spacing: { before: 150, after: 30 },
                    })
                );
                if (proj.description) {
                    children.push(new Paragraph({ text: proj.description, spacing: { after: 30 } }));
                }
                if (proj.tech.length > 0) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Tech: ", bold: true }),
                                new TextRun({ text: proj.tech.join(", ") }),
                            ],
                            spacing: { after: 50 },
                        })
                    );
                }
            }
        }

        const doc = new Document({
            sections: [{ children }],
        });

        const docxBuffer = await Packer.toBuffer(doc);
        const docxName = baseName + ".docx";

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        res.setHeader("Content-Disposition", `attachment; filename="${docxName}"`);
        res.send(Buffer.from(docxBuffer));
    } catch (err: any) {
        console.error("Download DOCX error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/resume/ai-edit — HugPDF-style: Gemini Flash edits sections → preview updates ──
router.post("/ai-edit", aiResumeLimiter, async (req: AuthRequest, res: Response) => {
    const { prompt, sections } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        res.status(400).json({ error: "prompt is required" });
        return;
    }
    if (!sections || typeof sections !== "object") {
        res.status(400).json({ error: "sections is required" });
        return;
    }

    const safePrompt = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, 500);

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
        // Show activity tokens while Gemini processes (HugPDF-style thinking indicator)
        send({ type: "token", text: "Gemini Flash is analyzing your resume" });
        send({ type: "token", text: "..." });

        const userPrompt = `Current resume sections:\n${JSON.stringify(sections, null, 2)}\n\nInstruction: "${safePrompt}"\n\nReturn the complete updated sections JSON. Preserve all "id" fields exactly. Only change what was requested.`;

        const { reply } = await getAIReply(
            [{ role: "user", content: userPrompt }],
            "resume_section_edit"
        );

        // Parse the returned JSON
        let updatedSections: ParsedSections;
        try {
            const cleaned = reply.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            updatedSections = JSON.parse(cleaned);
        } catch {
            const match = reply.match(/\{[\s\S]*\}/);
            if (!match) throw new Error("Gemini returned malformed sections JSON");
            updatedSections = JSON.parse(match[0]);
        }

        // Recompute ATS and persist
        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("id, parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        let newAts: AdvancedATSResult | undefined;
        if (row?.parsed_data) {
            const existing = row.parsed_data as ParsedData;
            // Score the EDITED sections against text regenerated from those same
            // sections — not the stale uploaded rawText — so improvements register.
            const regeneratedText = serializeSectionsToText(updatedSections);
            newAts = computeAdvancedATS(updatedSections, regeneratedText);
            await supabaseAdmin
                .from("resumes")
                .update({ parsed_data: { ...existing, sections: updatedSections, ats: newAts, rawText: regeneratedText } })
                .eq("id", row.id);
        }

        send({ type: "result", sections: updatedSections, ats: newAts, summary: `Applied: "${safePrompt}"` });
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (err: any) {
        console.error("[ai-edit] Error:", err?.message ?? err);
        send({ type: "error", message: err?.message ?? "AI edit failed" });
        res.write("data: [DONE]\n\n");
        res.end();
    }
});

// ── PUT /api/resume/sections — save manually edited sections ──
router.put("/sections", async (req: AuthRequest, res: Response) => {
    try {
        const { sections } = req.body;
        if (!sections) { res.status(400).json({ error: "sections required" }); return; }

        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("id, parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (!row) { res.status(404).json({ error: "No resume found" }); return; }

        const existing = row.parsed_data ?? {};
        // Re-derive rawText from the edited sections so the scorer reflects the
        // current content (keywords, contact, bullet density) rather than the
        // stale uploaded text.
        const regeneratedText = serializeSectionsToText(sections as ParsedSections);
        const updatedAts = computeAdvancedATS(sections as ParsedSections, regeneratedText);
        const newParsedData = { ...existing, sections, ats: updatedAts, rawText: regeneratedText };

        await supabaseAdmin
            .from("resumes")
            .update({ parsed_data: newParsedData })
            .eq("id", row.id);

        res.json({ sections, ats: updatedAts });
    } catch (err: any) {
        console.error("Save sections error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── GET /api/resume/versions ───────────────────────────────
router.get("/versions", async (req: AuthRequest, res: Response) => {
    try {
        const { data } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        res.json({ versions: (data?.parsed_data as any)?.versions ?? [] });
    } catch (err: any) {
        console.error("Get versions error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/resume/versions — save a named version ──────
router.post("/versions", async (req: AuthRequest, res: Response) => {
    try {
        const { label, sections } = req.body;
        if (!sections) { res.status(400).json({ error: "sections required" }); return; }

        const version = {
            id: crypto.randomUUID(),
            label: (label || new Date().toLocaleString()).slice(0, 100),
            sections,
            createdAt: new Date().toISOString(),
        };

        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        const existing = (row?.parsed_data as any) ?? {};
        const versions = [...((existing.versions as unknown[]) ?? []), version].slice(-10);
        await supabaseAdmin
            .from("resumes")
            .update({ parsed_data: { ...existing, versions } })
            .eq("user_id", req.user!.userId);

        res.json({ version });
    } catch (err: any) {
        console.error("Save version error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── DELETE /api/resume/versions/:id ───────────────────────
router.delete("/versions/:id", async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data: row } = await supabaseAdmin
            .from("resumes")
            .select("parsed_data")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        const existing = (row?.parsed_data as any) ?? {};
        const versions = ((existing.versions as any[]) ?? []).filter((v: any) => v.id !== id);
        await supabaseAdmin
            .from("resumes")
            .update({ parsed_data: { ...existing, versions } })
            .eq("user_id", req.user!.userId);

        res.json({ success: true });
    } catch (err: any) {
        console.error("Delete version error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /api/resume/download/latex
router.post("/download/latex", async (req: AuthRequest, res: Response) => {
    try {
        const { sections, templateId, userInfo } = req.body;

        if (!sections) {
            res.status(400).json({ error: "Missing resume sections" });
            return;
        }

        const latexContent = generateLatex(sections, templateId, userInfo);
        res.setHeader("Content-Type", "application/x-tex");
        res.setHeader("Content-Disposition", `attachment; filename="ATS_Optimized_Resume.tex"`);
        res.send(latexContent);
    } catch (err: any) {
        console.error("LaTeX Download error:", err);
        res.status(500).json({ error: "Failed to generate LaTeX" });
    }
});

// ── DELETE /api/resume ─────────────────────────────────────
router.delete("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from("resumes")
            .select("id, storage_path")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !existing) {
            res.status(404).json({ error: "No resume found" });
            return;
        }

        await supabaseAdmin.storage.from("resumes").remove([existing.storage_path]);

        const { error: dbError } = await supabaseAdmin
            .from("resumes")
            .delete()
            .eq("id", existing.id);

        if (dbError) {
            res.status(400).json({ error: dbError.message });
            return;
        }

        res.json({ message: "Resume deleted successfully" });
    } catch (err: any) {
        console.error("Delete resume error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ── POST /api/resume/simulate-ats ──
router.post("/simulate-ats", async (req: AuthRequest, res: Response) => {
    try {
        let { resumeText, jobDescription } = req.body;

        // Auto-fetch saved resume if not provided
        if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
            try {
                const { data: resumeRow, error } = await supabaseAdmin
                    .from("resumes")
                    .select("parsed_data")
                    .eq("user_id", req.user!.userId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                if (!error && resumeRow?.parsed_data) {
                    const parsed = resumeRow.parsed_data as any;
                    resumeText = parsed?.rawText || JSON.stringify(parsed?.sections || {});
                }
            } catch (err) {
                console.warn("[Simulate ATS] Failed to fetch resume from DB:", err);
            }

            if (!resumeText || resumeText.trim().length < 20) {
                res.status(400).json({
                    error: "resumeText is required. Paste your resume text or upload a resume first."
                });
                return;
            }
        }

        let sections: ParsedSections;
        try {
            sections = parseSections(resumeText);
        } catch (parseFail) {
            console.error("[Simulate ATS] parseSections utterly failed, falling back to empty:", parseFail);
            // If the parser completely bombs out on weird text, pass an empty structure
            // This ensures the ATS simulators still run and correctly dock points for missing headers!
            sections = { name: "", email: "", phone: "", location: "", summary: "", experience: [], education: [], skills: [], projects: [], certifications: [] };
        }

        const greenhouse = simulateGreenhouse(sections, resumeText, jobDescription);
        const lever = simulateLever(sections, resumeText, jobDescription);

        res.json({
            greenhouse,
            lever,
            combinedScore: Math.round((greenhouse.overallScore + lever.overallScore) / 2)
        });
    } catch (err: any) {
         console.error("simulate-ats error:", err);
         res.status(500).json({ error: "Failed to simulate parsing" });
    }
});

// ── POST /api/resume/create-new ──
router.post("/create-new", aiResumeLimiter, async (req: any, res: any) => {
    try {
        const { templateType, userData } = req.body;
        
        if (!templateType || !userData) {
            return res.status(400).json({ error: "Missing required form fields (templateType, userData)" });
        }
        
        // 1. Give LLM a minimal starting state to generate a basic JSON struct
        const sparseContext = `Contact: ${userData.Contact}\nObjective: ${userData.Objective || ""}\nExperience: ${userData.Experience}\nEducation: ${userData.Education}\nSkills: ${userData.Skills}\nProjects: ${userData.Projects}\nTask: Generate a starter resume JSON structure suitable for the provided Objective/Target Role, extrapolating and formatting the raw user input into professional ATS-friendly sections. Make bullet points sound extremely professional using the input blocks.`;
        
        // 2. Predict sections

        const starterResume = await buildResumeFromScratch(sparseContext) as any;
        
        if (!starterResume || !starterResume.sections) {
            return res.status(500).json({ error: "Failed to generate starter structure from AI" });
        }
        
        // 3. Render LaTeX using the already-imported generateLatex
        const compiledLatex = generateLatex(starterResume.sections, templateType, starterResume.userInfo || userData);
        
        return res.json({
            sections: starterResume.sections,
            latex: compiledLatex
        });
    } catch (err: any) {
        console.error("create-new error:", err);
        return res.status(500).json({ error: "Failed to create new resume" });
    }
});

// ── POST /api/resume/ai-fix ──
router.post("/ai-fix", async (req: any, res: any) => {
    try {
        const { currentText, fixType, issueDescription, editorMode } = req.body;
        
        if (!currentText || !fixType) {
            return res.status(400).json({ error: "Missing required fields (currentText, fixType)" });
        }
        
        const result = await applyResumeFix(
            currentText, 
            fixType, 
            issueDescription || "Fix this issue", 
            editorMode || "text"
        );
        
        return res.json(result);
    } catch (err: any) {
        console.error("ai-fix error:", err);
        return res.status(500).json({ error: "Failed to apply AI fix" });
    }
});


// ── POST /api/resume/rescore ──
// Lightweight endpoint for live inline editing. No DB writes.
router.post("/rescore", (req: any, res: any) => {
    try {
        const { rawText, fileSizeMB, isPdf, fileName } = req.body;
        if (!rawText || typeof rawText !== "string" || rawText.trim().length < 20) {
            res.status(400).json({ error: "rawText is required (min 20 chars)" });
            return;
        }

        const sections = parseSections(rawText);
        const ats = computeAdvancedATS(sections, rawText, req.user?.userId, { fileSizeMB, isPdf, fileName });

        res.json({ sections, ats });
    } catch (err: any) {
        console.error("rescore error:", err);
        res.status(500).json({ error: "Failed to rescore" });
    }
});


// ── POST /api/resume/reparse — re-run parser on stored rawText & save ──
router.post("/reparse", async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("resumes")
            .select("id, parsed_data")
            .eq("user_id", req.user!.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            res.status(404).json({ error: "No resume found" });
            return;
        }

        const existingParsed = data.parsed_data as any;
        const rawText = existingParsed?.rawText;
        if (!rawText || rawText.trim().length < 20) {
            res.status(400).json({ error: "No stored raw text to reparse" });
            return;
        }

        const sections = parseSections(rawText);
        const ats = computeAdvancedATS(sections, rawText, req.user!.userId, {});
        const newParsed = { ...existingParsed, sections, ats };

        await supabaseAdmin
            .from("resumes")
            .update({ parsed_data: newParsed })
            .eq("id", data.id);

        res.json({ parsed: newParsed });
    } catch (err: any) {
        console.error("reparse error:", err);
        res.status(500).json({ error: "Failed to reparse" });
    }
});

// ── POST /api/resume/compile-latex ──
import { compileLatexToPdf } from "../lib/latex-compile.js";

router.post("/compile-latex", aiResumeLimiter, async (req: any, res: any) => {
    const { latexContent } = req.body;
    if (!latexContent) return res.status(400).json({ error: "latexContent is required" });

    try {
        const pdfBuffer = await compileLatexToPdf(latexContent);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Resume.pdf"`);
        return res.send(pdfBuffer);
    } catch (err: any) {
        console.error("LaTeX compile error:", err.message);
        return res.status(500).json({ error: "LaTeX compilation failed. " + err.message });
    }
});

// ── POST /api/resume/download/pdf-latex ──────────────────────────
// Combines latex generation + compilation into a single endpoint.
// Used by the frontend when AI edits exist, to produce a proper PDF
// with embedded hyperlinks (instead of html2canvas raster export).
router.post("/download/pdf-latex", async (req: AuthRequest, res: Response) => {
    const { sections, templateId, userInfo } = req.body;
    if (!sections) {
        res.status(400).json({ error: "sections is required" });
        return;
    }
    try {
        const tex = generateLatex(sections as ParsedSections, templateId || "classic-academic", userInfo || {});
        const pdfBuffer = await compileLatexToPdf(tex);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Resume.pdf"`);
        res.send(pdfBuffer);
    } catch (err: any) {
        console.error("pdf-latex error:", err.message);
        res.status(500).json({ error: "PDF generation failed: " + err.message });
    }
});

export default router;
