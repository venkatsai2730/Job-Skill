import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// We need to essentially copy parseSections and computeAdvancedATS
// Actually, since we're inside the server directory, we can try to import them, but running it via tsx might have issues with `.js` extensions in imports if it's a TS project.
// Let's just import the functions from src/routes/resume.ts? No, it's not exported.
// I will import from src/lib/advanced-scorer.ts
import { computeAdvancedATS } from "./src/lib/advanced-scorer.js";
import fs from "fs";

// Simple re-implementation of parseSections so we don't have to export it
const SECTION_PATTERNS: Record<string, RegExp> = {
    summary: /^(summary|professional\s+summary|profile|objective|about\s*me|career\s+summary)/i,
    experience: /^(experience|work\s+experience|professional\s+experience|employment|work\s+history)/i,
    education: /^(education|academic|academics|qualifications)/i,
    skills: /^(skills|technical\s+skills|core\s+competencies|competencies|technologies|tech\s+stack)/i,
    projects: /^(projects|personal\s+projects|key\s+projects|notable\s+projects|academic\s+projects)/i,
};
const DATE_RE = /(\d{4}\s*[-–—]\s*(present|\d{4})|(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[-–—]\s*(?:present|\w+\s+\d{4})))/i;

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

function parseExperience(textLines: string[]): any[] {
    const entries: any[] = [];
    let current: any = null;

    for (const line of textLines) {
        const dateMatch = line.match(DATE_RE);
        const isBullet = /^[•\-–*▪◦◆➤❖►]/.test(line) || /^\d+[.)]\s/.test(line);

        if (dateMatch && !isBullet) {
            if (current) entries.push(current);
            const datePart = dateMatch[0].trim();
            const rest = line.replace(datePart, "").replace(/[|·•,]/g, " ").trim();
            const parts = rest.split(/\s+(?:at|@|[-–—|,])\s+/i).map((s) => s.trim()).filter(Boolean);
            current = { title: parts[0] || rest || "Role", company: parts[1] || "", dates: datePart, bullets: [] };
        } else if (current && (isBullet || (line.length > 20 && !dateMatch))) {
            const clean = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
            if (clean) current.bullets.push(clean);
        } else if (!current && line.length > 5 && !dateMatch) {
            current = { title: line.trim(), company: "", dates: "", bullets: [] };
        }
    }
    if (current) entries.push(current);
    if (entries.length === 0 && textLines.length > 0) {
        entries.push({ title: "Professional Experience", company: "", dates: "", bullets: textLines.filter((l) => l.length > 10) });
    }
    return entries;
}

function parseEducation(textLines: string[]): any[] {
    const entries: any[] = [];
    const fullText = textLines.join(" ");
    const degreeRe = /\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor|master|associate|diploma|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?)\b/gi;
    const gpaRe = /\b(?:gpa|cgpa|grade)[:\s]*(\d+\.?\d*)\b/i;
    const courseRe = /\b(?:courses?|coursework|relevant\s+courses?)[:\s]*(.*)/i;

    const gpaMatch = fullText.match(gpaRe);
    const courseMatch = fullText.match(courseRe);

    let degree = "";
    const degreeMatch = fullText.match(degreeRe);
    if (degreeMatch) {
        const degreeLine = textLines.find((l) => degreeRe.test(l)) || textLines[0] || "";
        degree = degreeLine.replace(DATE_RE, "").trim();
    }

    const dateMatch = fullText.match(DATE_RE);
    const school = textLines.find((l) => !degreeRe.test(l) && !gpaRe.test(l) && !courseRe.test(l) && l.length > 3 && !DATE_RE.test(l)) || "";

    entries.push({
        degree: degree || textLines[0] || "Degree",
        school: school || "",
        dates: dateMatch ? dateMatch[0] : "",
        gpa: gpaMatch ? gpaMatch[1] : "",
        courses: courseMatch ? courseMatch[1].split(/[,;|•]/).map((c) => c.trim()).filter(Boolean) : [],
    });
    return entries;
}

function parseSkills(textLines: string[]): any[] {
    const groups: any[] = [];
    let currentCategory = "General";
    let currentItems: string[] = [];

    for (const line of textLines) {
        const catMatch = line.match(/^([A-Za-z\s&/]+)[:\-–—]\s*(.*)/);
        if (catMatch && catMatch[1].trim().length < 30) {
            if (currentItems.length > 0) groups.push({ category: currentCategory, items: currentItems });
            currentCategory = catMatch[1].trim();
            currentItems = catMatch[2].split(/[,;|•·]/).map((s) => s.trim()).filter(Boolean);
        } else {
            const items = line.split(/[,;|•·]/).map((s) => s.replace(/^[•\-–*▪◦◆]+\s*/, "").trim()).filter((s) => s.length > 0 && s.length < 40);
            currentItems.push(...items);
        }
    }
    if (currentItems.length > 0) groups.push({ category: currentCategory, items: currentItems });
    if (groups.length === 0 && textLines.length > 0) {
        groups.push({ category: "Skills", items: textLines.flatMap((l) => l.split(/[,;|•·]/).map((s) => s.trim()).filter(Boolean)) });
    }
    return groups;
}

function parseProjects(textLines: string[]): any[] {
    const entries: any[] = [];
    let current: any = null;

    for (const line of textLines) {
        const isBullet = /^[•\-–*▪◦◆➤❖►]/.test(line) || /^\d+[.)]\s/.test(line);
        if (!isBullet && line.length < 60 && line.length > 2) {
            if (current) entries.push(current);
            current = { name: line.trim(), description: "", tech: [] };
        } else if (current) {
            const clean = line.replace(/^[•\-–*▪◦◆➤❖►\d.)]+\s*/, "").trim();
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
        entries.push({ name: "Project", description: textLines.join(" "), tech: [] });
    }
    return entries;
}

function parseSections(rawText: string): any {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim());
    const boundaries = detectSectionBoundaries(lines);

    const result: any = { summary: "", experience: [], education: [], skills: [], projects: [] };

    for (let i = 0; i < boundaries.length; i++) {
        const b = boundaries[i];
        const nextStart = i + 1 < boundaries.length ? boundaries[i + 1].startIdx : lines.length;
        const sectionLines = extractTextBetween(lines, b.startIdx, nextStart);

        switch (b.section) {
            case "summary": result.summary = sectionLines.join(" "); break;
            case "experience": result.experience = parseExperience(sectionLines); break;
            case "education": result.education = parseEducation(sectionLines); break;
            case "skills": result.skills = parseSkills(sectionLines); break;
            case "projects": result.projects = parseProjects(sectionLines); break;
        }
    }

    if (!result.summary && boundaries.length > 0) {
        const beforeFirst = lines.slice(0, boundaries[0].startIdx).filter(Boolean);
        const textLines = beforeFirst.filter((l) => l.length > 30);
        if (textLines.length > 0) result.summary = textLines.join(" ");
    }
    return result;
}

async function main() {
    console.log("Fetching resumes...");
    const { data: resumes, error } = await supabaseAdmin.from("resumes").select("id, user_id, storage_path, file_name");
    if (error) { console.error("Error fetching", error); return; }

    for (const resume of resumes) {
        console.log(`Processing ${resume.file_name} (ID: ${resume.id})...`);
        const { data: fileData, error: dlError } = await supabaseAdmin.storage.from("resumes").download(resume.storage_path);
        if (dlError || !fileData) {
            console.error(`Download failed for ${resume.storage_path}`, dlError);
            continue;
        }
        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        
        let parsedData: any = null;
        try {
            const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
            const textResult = await parser.getText();
            const rawText = textResult.text || "";
            const sections = parseSections(rawText);
            const ats = computeAdvancedATS(sections, rawText, resume.user_id);
            parsedData = { sections, ats, rawText: rawText.substring(0, 5000) };
            
            console.log(`New Score for ${resume.file_name}:`, ats.score);
            
            const { error: dbError } = await supabaseAdmin
                .from("resumes")
                .update({ parsed_data: parsedData })
                .eq("id", resume.id);
                
            if (dbError) console.error("Error updating", dbError);
            else console.log("Updated successfully!");
            
        } catch (e) {
            console.error("Parse failed for", resume.file_name, e);
        }
    }
    console.log("Done");
}

main().catch(console.error);
