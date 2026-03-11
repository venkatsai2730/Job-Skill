import { Router, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { authenticateToken, AuthRequest } from "../middleware/auth.js";
import { PDFParse } from "pdf-parse";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
} from "docx";

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
}
interface ParsedSections {
    summary: string;
    experience: ExperienceEntry[];
    education: EducationEntry[];
    skills: SkillGroup[];
    projects: ProjectEntry[];
}
interface ATSResult {
    score: number;
    label: string;
    issues: { type: "warning" | "success"; text: string }[];
    keywords: { found: string[]; missing: string[]; total: number; matched: number };
}
interface ParsedData {
    sections: ParsedSections;
    ats: ATSResult;
    rawText: string;
}

// ── Section heading patterns ────────────────────────────────────
const SECTION_PATTERNS: Record<string, RegExp> = {
    summary: /^(summary|professional\s+summary|profile|objective|about\s*me|career\s+summary)/i,
    experience: /^(experience|work\s+experience|professional\s+experience|employment|work\s+history)/i,
    education: /^(education|academic|academics|qualifications)/i,
    skills: /^(skills|technical\s+skills|core\s+competencies|competencies|technologies|tech\s+stack)/i,
    projects: /^(projects|personal\s+projects|key\s+projects|notable\s+projects|academic\s+projects)/i,
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
            current = {
                title: parts[0] || rest || "Role",
                company: parts[1] || "",
                dates: datePart,
                bullets: [],
            };
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
        /\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|associate|diploma|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?)\b/gi;
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
    const school = textLines.find(
        (l) => !degreeRe.test(l) && !gpaRe.test(l) && !courseRe.test(l) && l.length > 3 && !DATE_RE.test(l)
    ) || "";

    entries.push({
        degree: degree || textLines[0] || "Degree",
        school: school || "",
        dates: dateMatch ? dateMatch[0] : "",
        gpa: gpaMatch ? gpaMatch[1] : "",
        courses: courseMatch
            ? courseMatch[1].split(/[,;|•]/).map((c) => c.trim()).filter(Boolean)
            : [],
    });

    return entries;
}

// ── Parse skills ────────────────────────────────────────────────
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
                .filter(Boolean);
        } else {
            // Split by common separators
            const items = line
                .split(/[,;|•·]/)
                .map((s) => s.replace(/^[•\-–*▪◦◆]+\s*/, "").trim())
                .filter((s) => s.length > 0 && s.length < 40);
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

    for (const line of textLines) {
        const isBullet = /^[•\-–*▪◦◆➤❖►]/.test(line) || /^\d+[.)]\s/.test(line);
        // Heuristic: short lines that aren't bullets are project names
        if (!isBullet && line.length < 60 && line.length > 2) {
            if (current) entries.push(current);
            current = { name: line.trim(), description: "", tech: [] };
        } else if (current) {
            const clean = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
            // Try to detect tech stack lines
            const techMatch = clean.match(/\b(?:tech|technologies|stack|built\s+with|using)[:\s]*(.*)/i);
            if (techMatch) {
                current.tech = techMatch[1].split(/[,;|•]/).map((s) => s.trim()).filter(Boolean);
            } else if (clean) {
                current.description += (current.description ? " " : "") + clean;
            }
        }
    }
    if (current) entries.push(current);

    if (entries.length === 0 && textLines.length > 0) {
        entries.push({
            name: "Project",
            description: textLines.join(" "),
            tech: [],
        });
    }

    return entries;
}

// ── Full section parser ─────────────────────────────────────────
function parseSections(rawText: string): ParsedSections {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim());
    const boundaries = detectSectionBoundaries(lines);

    const result: ParsedSections = {
        summary: "",
        experience: [],
        education: [],
        skills: [],
        projects: [],
    };

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

// ── ATS scoring ─────────────────────────────────────────────────
const ACTION_VERBS = [
    "achieved", "built", "created", "delivered", "designed", "developed",
    "directed", "enhanced", "established", "generated", "implemented",
    "improved", "increased", "initiated", "launched", "led", "managed",
    "optimized", "orchestrated", "produced", "reduced", "resolved",
    "scaled", "spearheaded", "streamlined", "transformed",
];

const TECH_KEYWORDS = [
    "javascript", "typescript", "python", "java", "react", "angular",
    "vue", "node", "express", "django", "flask", "spring", "aws",
    "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd",
    "git", "sql", "nosql", "mongodb", "postgresql", "redis", "graphql",
    "rest", "api", "microservices", "agile", "scrum", "html", "css",
    "linux", "devops", "machine learning", "data", "cloud",
];

function computeATS(sections: ParsedSections, rawText: string): ATSResult {
    const issues: ATSResult["issues"] = [];
    let score = 0;
    const lowerText = rawText.toLowerCase();

    // 1. Section completeness (up to 30 points)
    const sectionScores = {
        summary: sections.summary.length > 20 ? 6 : 0,
        experience: sections.experience.length > 0 ? 8 : 0,
        education: sections.education.length > 0 ? 6 : 0,
        skills: sections.skills.length > 0 ? 6 : 0,
        projects: sections.projects.length > 0 ? 4 : 0,
    };
    const sectionTotal = Object.values(sectionScores).reduce((a, b) => a + b, 0);
    score += sectionTotal;

    if (sectionScores.summary > 0) issues.push({ type: "success", text: "Strong summary section detected" });
    else issues.push({ type: "warning", text: "No summary/objective section found" });

    if (sectionScores.experience === 0) issues.push({ type: "warning", text: "No experience section found" });
    if (sectionScores.skills === 0) issues.push({ type: "warning", text: "No skills section found" });

    // 2. Bullet quality — quantification (up to 25 points)
    const allBullets = sections.experience.flatMap((e) => e.bullets);
    const quantifiedBullets = allBullets.filter((b) => /\d+/.test(b));
    const quantRatio = allBullets.length > 0 ? quantifiedBullets.length / allBullets.length : 0;
    score += Math.round(quantRatio * 25);

    if (quantRatio >= 0.5) {
        issues.push({ type: "success", text: `Good quantification — ${quantifiedBullets.length}/${allBullets.length} bullets have numbers` });
    } else if (allBullets.length > 0) {
        issues.push({ type: "warning", text: `Weak quantification — only ${quantifiedBullets.length}/${allBullets.length} bullets have metrics` });
    }

    // 3. Action verbs (up to 15 points)
    const usedVerbs = ACTION_VERBS.filter((v) => lowerText.includes(v));
    const verbScore = Math.min(usedVerbs.length * 2, 15);
    score += verbScore;

    if (usedVerbs.length >= 5) issues.push({ type: "success", text: `Strong action verbs used (${usedVerbs.length} found)` });
    else issues.push({ type: "warning", text: `Use more action verbs (only ${usedVerbs.length} found)` });

    // 4. Keyword matching (up to 20 points)
    const found = TECH_KEYWORDS.filter((kw) => lowerText.includes(kw));
    const missing = TECH_KEYWORDS.filter((kw) => !lowerText.includes(kw));
    const kwScore = Math.min(Math.round((found.length / TECH_KEYWORDS.length) * 20), 20);
    score += kwScore;

    // 5. Length & formatting (up to 10 points)
    const wordCount = rawText.split(/\s+/).length;
    if (wordCount >= 200 && wordCount <= 1200) {
        score += 10;
        issues.push({ type: "success", text: `Good resume length (${wordCount} words)` });
    } else if (wordCount < 200) {
        score += 3;
        issues.push({ type: "warning", text: `Resume is too short (${wordCount} words). Aim for 300-800.` });
    } else {
        score += 5;
        issues.push({ type: "warning", text: `Resume may be too long (${wordCount} words). Keep it concise.` });
    }

    // Cap at 100
    score = Math.min(score, 100);

    const label = score >= 80 ? "Great!" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs Work";

    return {
        score,
        label,
        issues,
        keywords: {
            found: found.slice(0, 15),
            missing: missing.slice(0, 10),
            total: TECH_KEYWORDS.length,
            matched: found.length,
        },
    };
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

        res.json({ parsed: data.parsed_data });
    } catch (err: any) {
        console.error("Get parsed resume error:", err);
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

        // Delete old resume from storage if exists
        const { data: existing } = await supabaseAdmin
            .from("resumes")
            .select("storage_path")
            .eq("user_id", req.user!.userId)
            .limit(1)
            .single();

        if (existing?.storage_path) {
            await supabaseAdmin.storage.from("resumes").remove([existing.storage_path]);
            await supabaseAdmin.from("resumes").delete().eq("user_id", req.user!.userId);
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from("resumes")
            .upload(storagePath, fileBuffer, {
                contentType: "application/pdf",
                upsert: true,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            res.status(400).json({ error: uploadError.message });
            return;
        }

        // ── Parse PDF text ──────────────────────────────────
        let parsedData: ParsedData | null = null;
        try {
            const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
            const textResult = await parser.getText();
            const rawText = textResult.text || "";
            const sections = parseSections(rawText);
            const ats = computeATS(sections, rawText);
            parsedData = { sections, ats, rawText: rawText.substring(0, 5000) }; // cap stored raw text
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

        res.json({ resume: resumeRow, parsed: parsedData });
    } catch (err: any) {
        console.error("Upload resume error:", err);
        res.status(500).json({ error: "Internal server error" });
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
        const children: Paragraph[] = [];

        // Title
        const baseName = row.file_name.replace(/\.pdf$/i, "");
        children.push(
            new Paragraph({
                text: baseName,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            })
        );

        // Summary
        if (pd.sections.summary) {
            children.push(
                new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            children.push(new Paragraph({ text: pd.sections.summary, spacing: { after: 200 } }));
        }

        // Experience
        if (pd.sections.experience.length > 0) {
            children.push(
                new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const exp of pd.sections.experience) {
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
        if (pd.sections.education.length > 0) {
            children.push(
                new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const edu of pd.sections.education) {
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
        if (pd.sections.skills.length > 0) {
            children.push(
                new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const group of pd.sections.skills) {
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
        if (pd.sections.projects.length > 0) {
            children.push(
                new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } })
            );
            for (const proj of pd.sections.projects) {
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

// ── DELETE /api/resume ─────────────────────────────────────
router.delete("/", async (req: AuthRequest, res: Response) => {
    try {
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from("resumes")
            .select("storage_path")
            .eq("user_id", req.user!.userId)
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
            .eq("user_id", req.user!.userId);

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

export default router;
