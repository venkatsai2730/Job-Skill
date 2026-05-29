// ═══════════════════════════════════════════════════════════════
// Resume Patch Types — Server-side types + normalizer
// Converts legacy ParsedSections → structured ResumeData with UUIDs
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from "crypto";

// ── Structured Resume Data Model ──────────────────────────────
export interface ResumeData {
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
  projects: ResumeProject[];
  certifications?: ResumeCertification[];
}

export interface ResumeExperience {
  id: string;
  title: string;
  company: string;
  start_date: string;
  end_date: string | "Present";
  bullets: string[];
}

export interface ResumeEducation {
  id: string;
  degree: string;
  institution: string;
  year: string;
  grade?: string;
}

export interface ResumeProject {
  id: string;
  name: string;
  description: string;
  tech_stack: string[];
  bullets: string[];
}

export interface ResumeCertification {
  name: string;
  issuer: string;
  year: string;
}

// ── Patch Protocol ────────────────────────────────────────────
export type PatchSection = "summary" | "experience" | "education" | "skills" | "projects";
export type PatchOperation = "update" | "append" | "replace_bullet" | "add_bullet" | "delete_bullet";

export interface ResumePatchItem {
  section: PatchSection;
  operation: PatchOperation;
  target_id?: string;
  bullet_index?: number;
  before: string | string[];
  after: string | string[];
}

export interface ResumePatch {
  action: "PATCH_RESUME";
  patches: ResumePatchItem[];
  explanation: string;
}

// ── Legacy ParsedSections shape (from resume.ts parser) ───────
interface LegacyExperience {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

interface LegacyEducation {
  degree: string;
  school: string;
  dates: string;
  gpa: string;
  courses: string[];
}

interface LegacySkillGroup {
  category: string;
  items: string[];
}

interface LegacyProject {
  name: string;
  description: string;
  tech: string[];
}

interface LegacyParsedSections {
  summary: string;
  experience: LegacyExperience[];
  education: LegacyEducation[];
  skills: LegacySkillGroup[];
  projects: LegacyProject[];
}

// ═══════════════════════════════════════════════════════════════
// normalizeToResumeData() — Converts existing ParsedSections
// into the structured ResumeData with UUIDs for each entry
// ═══════════════════════════════════════════════════════════════
export function normalizeToResumeData(sections: LegacyParsedSections): ResumeData {
  // Convert experience
  const experience: ResumeExperience[] = (sections.experience || []).map(exp => {
    // Parse dates: try to split "Jan 2023 - Present" → start/end
    const dateStr = exp.dates || "";
    const dateParts = dateStr.split(/\s*[-–—]\s*/);
    const startDate = dateParts[0]?.trim() || "";
    const endDate = dateParts[1]?.trim() || "Present";

    return {
      id: randomUUID(),
      title: exp.title || "",
      company: exp.company || "",
      start_date: startDate,
      end_date: endDate,
      bullets: exp.bullets || [],
    };
  });

  // Convert education
  const education: ResumeEducation[] = (sections.education || []).map(edu => ({
    id: randomUUID(),
    degree: edu.degree || "",
    institution: edu.school || "",
    year: edu.dates || "",
    grade: edu.gpa || undefined,
  }));

  // Flatten skills from groups
  const skills: string[] = (sections.skills || []).flatMap(
    (group: LegacySkillGroup) => group.items || []
  );

  // Convert projects — add empty bullets array since legacy doesn't have bullets
  const projects: ResumeProject[] = (sections.projects || []).map(proj => ({
    id: randomUUID(),
    name: proj.name || "",
    description: proj.description || "",
    tech_stack: proj.tech || [],
    bullets: [], // Legacy projects don't have separate bullets
  }));

  return {
    summary: sections.summary || "",
    experience,
    education,
    skills,
    projects,
  };
}

// ═══════════════════════════════════════════════════════════════
// denormalizeToSections() — Convert ResumeData back to legacy
// ParsedSections for backward compatibility with DOCX/LaTeX
// ═══════════════════════════════════════════════════════════════
export function denormalizeToSections(data: ResumeData): LegacyParsedSections {
  const experience: LegacyExperience[] = data.experience.map(exp => ({
    title: exp.title,
    company: exp.company,
    dates: exp.end_date === "Present"
      ? `${exp.start_date} - Present`
      : `${exp.start_date} - ${exp.end_date}`,
    bullets: exp.bullets,
  }));

  const education: LegacyEducation[] = data.education.map(edu => ({
    degree: edu.degree,
    school: edu.institution,
    dates: edu.year,
    gpa: edu.grade || "",
    courses: [],
  }));

  // Group all skills into one "Skills" group for backward compat
  const skills: LegacySkillGroup[] = data.skills.length > 0
    ? [{ category: "Skills", items: data.skills }]
    : [];

  const projects: LegacyProject[] = data.projects.map(proj => ({
    name: proj.name,
    description: proj.description + (proj.bullets.length > 0 ? "\n" + proj.bullets.join("\n") : ""),
    tech: proj.tech_stack,
  }));

  return {
    summary: data.summary,
    experience,
    education,
    skills,
    projects,
  };
}

// ── Validate a ResumePatch from LLM output ────────────────────
export function validateResumePatch(raw: any): ResumePatch | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.action !== "PATCH_RESUME") return null;
  if (!Array.isArray(raw.patches) || raw.patches.length === 0) return null;

  const validSections = ["summary", "experience", "education", "skills", "projects"];
  const validOps = ["update", "append", "replace_bullet", "add_bullet", "delete_bullet"];

  const validPatches: ResumePatchItem[] = [];
  for (const p of raw.patches) {
    if (!p || typeof p !== "object") continue;
    if (!validSections.includes(p.section)) continue;
    if (!validOps.includes(p.operation)) continue;
    // before/after can be string or string[]
    if (p.before === undefined || p.after === undefined) continue;

    validPatches.push({
      section: p.section,
      operation: p.operation,
      target_id: p.target_id,
      bullet_index: p.bullet_index !== undefined ? Number(p.bullet_index) : undefined,
      before: p.before,
      after: p.after,
    });
  }

  if (validPatches.length === 0) return null;

  return {
    action: "PATCH_RESUME",
    patches: validPatches,
    explanation: raw.explanation || "Resume changes generated by Aria.",
  };
}
