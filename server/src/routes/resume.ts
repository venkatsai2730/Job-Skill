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
import { parseLatex } from "../lib/latex-parser.js";
import { generateLatex } from "../lib/latex-generator.js";
import { enrichMissingSkills } from "../lib/learning-resources.js";
import { inferSemanticSkills, applyResumeFix } from "../services/chatService.js";

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
export interface ParsedSections {
    summary: string;
    experience: ExperienceEntry[];
    education: EducationEntry[];
    skills: SkillGroup[];
    projects: ProjectEntry[];
}
// Removed previous interfaces that were redefined with AdvancedATSResult.

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
export function parseSections(rawText: string): ParsedSections {
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

import { computeAdvancedATS, AdvancedATSResult } from "../lib/advanced-scorer.js";
import { scoreJobMatch, buildResumeFromScratch } from "../services/chatService.js";
import { LATEX_TEMPLATES } from "../lib/latex-templates.js";
import { simulateGreenhouse, simulateLever } from "../lib/ats-simulator.js";

interface ParsedData {
    sections: ParsedSections;
    ats: AdvancedATSResult;
    rawText?: string;
    isLatex?: boolean;
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
            rawText: rawText.substring(0, 5000),
            isLatex: true 
        };

        res.json({ parsed: parsedData });
    } catch (err: any) {
        console.error("Latex upload error:", err);
        res.status(500).json({ error: "Latex parsing failed: " + err.message });
    }
});

// ── POST /api/resume/score-with-job ── Score existing resume vs JD ──
router.post("/score-with-job", async (req: AuthRequest, res: Response) => {
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
            const jsonStr = aiResponse.reply.match(/\{[\s\S]*\}/)?.[0] || aiResponse.reply;
            gapAnalysis = JSON.parse(jsonStr);
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

/**
 * POST /api/resume/download/latex
 * Accepts ParsedSections + Template preference -> Streams a .tex file
 */
router.post("/download/latex", async (req: AuthRequest, res: Response) => {
    try {
        const { sections, templateId, userInfo } = req.body;
        
        if (!sections) {
            res.status(400).json({ error: "Missing resume sections" });
            return;
        }

        // Generate the LaTeX string with the chosen template
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
            sections = { summary: "", experience: [], education: [], skills: [], projects: [] };
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
router.post("/create-new", async (req: any, res: any) => {
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

// ── POST /api/resume/ai-fix ──
// Auto-applies AI fixes to specific ATS issues in the editor
router.post("/ai-fix", async (req: AuthRequest, res: Response) => {
    try {
        const { currentText, fixType, issueDescription, editorMode } = req.body;

        if (!currentText || !fixType) {
            res.status(400).json({ error: "Missing required fields for AI fix" });
            return;
        }

        // Apply the fix via AI
        const { applyResumeFix } = await import("../services/chatService.js");
        const { fixedText, fixDescription } = await applyResumeFix(
            currentText,
            fixType,
            issueDescription,
            editorMode || "text"
        );

        res.json({ fixedText, fixDescription });
    } catch (err: any) {
        console.error("AI Fix Error:", err);
        res.status(500).json({ error: err.message || "Failed to apply AI fix" });
    }
});

// ── POST /api/resume/compile-latex ──
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

router.post("/compile-latex", (req: any, res: any) => {
    const { latexContent } = req.body;
    if (!latexContent) return res.status(400).json({ error: "latexContent is required" });

    const workDir = join(tmpdir(), `latex-compile-${randomUUID()}`);
    mkdirSync(workDir, { recursive: true });
    const texPath = join(workDir, "resume.tex");
    const pdfPath = join(workDir, "resume.pdf");

    writeFileSync(texPath, latexContent, "utf-8");

    try {
        const pdflatexCmd = `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${workDir}" "${texPath}"`;
        execSync(pdflatexCmd, { timeout: 30000, stdio: "ignore" });
        execSync(pdflatexCmd, { timeout: 30000, stdio: "ignore" }); // second pass
        
        if (!existsSync(pdfPath)) {
            return res.status(500).json({ error: "PDF was not generated." });
        }
        
        const pdfBuffer = readFileSync(pdfPath);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="Resume.pdf"`);
        return res.send(pdfBuffer);
    } catch (err: any) {
        console.error("pdflatex compile error:", err.message);
        return res.status(500).json({ error: "LaTeX compilation failed. " + err.message });
    }
});

export default router;
