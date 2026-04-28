// ═══════════════════════════════════════════════════════════════
// Chunking — Split text into overlapping chunks for RAG
//
// Produces ~500 token chunks with 50-token overlap.
// Each chunk carries metadata for filtering during retrieval.
// ═══════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────
export interface TextChunk {
    chunkId: string;
    text: string;
    section: string;
    metadata: Record<string, any>;
}

// ── Config ────────────────────────────────────────────────────
const CHUNK_SIZE = 500;      // ~500 tokens ≈ 2000 chars
const CHUNK_OVERLAP = 50;    // ~50 tokens ≈ 200 chars
const CHARS_PER_TOKEN = 4;   // Rough approximation

const MAX_CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN;
const OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN;

// ═══════════════════════════════════════════════════════════════
// Resume Chunking — section-aware
// ═══════════════════════════════════════════════════════════════
export function chunkResume(params: {
    resumeText: string;
    userId: string;
    resumeId: string;
    sections?: any;
    atsScore?: number | null;
}): TextChunk[] {
    const { resumeText, userId, resumeId, sections, atsScore } = params;
    const chunks: TextChunk[] = [];

    // Try section-based chunking first
    if (sections) {
        const sectionEntries = [
            { name: "summary", text: sections.summary || "" },
            { name: "experience", text: formatExperience(sections.experience || []) },
            { name: "skills", text: formatSkills(sections.skills || []) },
            { name: "projects", text: formatProjects(sections.projects || []) },
            { name: "education", text: formatEducation(sections.education || []) },
        ];

        for (const entry of sectionEntries) {
            if (!entry.text || entry.text.trim().length < 20) continue;

            const sectionChunks = splitTextWithOverlap(entry.text);
            for (let i = 0; i < sectionChunks.length; i++) {
                chunks.push({
                    chunkId: `${resumeId}_${entry.name}_${i}`,
                    text: sectionChunks[i],
                    section: entry.name,
                    metadata: {
                        user_id: userId,
                        resume_id: resumeId,
                        section: entry.name,
                        ats_score: atsScore || null,
                        chunk_index: i,
                    },
                });
            }
        }
    }

    // Fallback: if no section chunks, chunk raw text
    if (chunks.length === 0 && resumeText) {
        const rawChunks = splitTextWithOverlap(resumeText);
        for (let i = 0; i < rawChunks.length; i++) {
            chunks.push({
                chunkId: `${resumeId}_raw_${i}`,
                text: rawChunks[i],
                section: "full_resume",
                metadata: {
                    user_id: userId,
                    resume_id: resumeId,
                    section: "full_resume",
                    ats_score: atsScore || null,
                    chunk_index: i,
                },
            });
        }
    }

    return chunks;
}

// ═══════════════════════════════════════════════════════════════
// Job Description Chunking
// ═══════════════════════════════════════════════════════════════
export function chunkJobDescription(params: {
    description: string;
    jobId: string;
    title: string;
    company: string;
    source: string;
    location: string;
    skills: string[];
    salary?: number | null;
}): TextChunk[] {
    const { description, jobId, title, company, source, location, skills, salary } = params;
    const chunks: TextChunk[] = [];

    if (!description || description.trim().length < 20) {
        // At minimum, create one chunk from title+company
        chunks.push({
            chunkId: `${jobId}_title_0`,
            text: `${title} at ${company}. Location: ${location}. Skills: ${skills.join(", ")}`,
            section: "job_header",
            metadata: {
                job_id: jobId,
                title,
                company,
                source,
                location,
                required_skills: skills,
                normalized_salary: salary || null,
            },
        });
        return chunks;
    }

    const textChunks = splitTextWithOverlap(description);
    for (let i = 0; i < textChunks.length; i++) {
        chunks.push({
            chunkId: `${jobId}_desc_${i}`,
            text: textChunks[i],
            section: "job_description",
            metadata: {
                job_id: jobId,
                title,
                company,
                source,
                location,
                required_skills: skills,
                normalized_salary: salary || null,
                chunk_index: i,
            },
        });
    }

    return chunks;
}

// ═══════════════════════════════════════════════════════════════
// Text splitting with overlap
// ═══════════════════════════════════════════════════════════════
function splitTextWithOverlap(text: string): string[] {
    if (text.length <= MAX_CHUNK_CHARS) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = start + MAX_CHUNK_CHARS;

        // Try to break at sentence boundary
        if (end < text.length) {
            const nearEnd = text.substring(end - 200, end + 200);
            const sentenceBreak = nearEnd.search(/[.!?]\s/);
            if (sentenceBreak > 0) {
                end = end - 200 + sentenceBreak + 2; // Include period + space
            }
        }

        chunks.push(text.substring(start, Math.min(end, text.length)).trim());
        start = end - OVERLAP_CHARS;

        if (start >= text.length) break;
    }

    return chunks.filter(c => c.length > 10);
}

// ── Section formatters ────────────────────────────────────────
function formatExperience(entries: any[]): string {
    return entries.map(e =>
        `${e.title || ""} at ${e.company || ""}. ${e.dates || ""}. ${(e.bullets || []).join(". ")}`
    ).join("\n\n");
}

function formatSkills(groups: any[]): string {
    return groups.map(g =>
        `${g.category || "Skills"}: ${(g.items || []).join(", ")}`
    ).join(". ");
}

function formatProjects(projects: any[]): string {
    return projects.map(p =>
        `${p.name || "Project"}: ${p.description || ""}. Tech: ${(p.tech || []).join(", ")}`
    ).join("\n\n");
}

function formatEducation(entries: any[]): string {
    return entries.map(e =>
        `${e.degree || ""} from ${e.school || ""}. ${e.dates || ""}${e.gpa ? `. GPA: ${e.gpa}` : ""}`
    ).join(". ");
}
