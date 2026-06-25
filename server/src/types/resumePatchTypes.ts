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

  // Normalize any value to string | string[] so the frontend never receives bare objects
  function normalizeValue(val: any): string | string[] {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) {
      return val.map((v) => (typeof v === "string" ? v : JSON.stringify(v)));
    }
    if (val == null) return "";
    return JSON.stringify(val);
  }

  const validPatches: ResumePatchItem[] = [];
  for (const p of raw.patches) {
    if (!p || typeof p !== "object") continue;
    if (!validSections.includes(p.section)) continue;
    if (!validOps.includes(p.operation)) continue;
    if (p.before === undefined || p.after === undefined) continue;

    validPatches.push({
      section: p.section,
      operation: p.operation,
      target_id: typeof p.target_id === "string" ? p.target_id : undefined,
      bullet_index: p.bullet_index !== undefined ? Number(p.bullet_index) : undefined,
      before: normalizeValue(p.before),
      after: normalizeValue(p.after),
    });
  }

  if (validPatches.length === 0) return null;

  return {
    action: "PATCH_RESUME",
    patches: validPatches,
    explanation: raw.explanation || "Resume changes generated by Aria.",
  };
}

// ═══════════════════════════════════════════════════════════════
// AriaEdit — Simple section-rewrite format (no UUIDs needed)
// LLM identifies entries by company/project name, not UUID.
// Much more reliable than ResumePatch for AI generation.
// ═══════════════════════════════════════════════════════════════

export interface AriaEditChange {
  section: "summary" | "skills" | "experience" | "projects";
  // summary
  new_summary?: string;
  // skills (full replacement list)
  new_skills?: string[];
  // experience / projects — identify by name or fallback index
  entry_name?: string;   // company name or project name (case-insensitive match)
  entry_index?: number;  // 0-based fallback when no name match
  new_bullets?: string[];
  new_description?: string;
}

export interface AriaEdit {
  action: "ARIA_EDIT";
  changes: AriaEditChange[];
  description: string;
}

export function validateAriaEdit(raw: any): AriaEdit | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.action !== "ARIA_EDIT") return null;
  if (!Array.isArray(raw.changes) || raw.changes.length === 0) return null;

  const valid = ["summary", "skills", "experience", "projects"];
  const changes: AriaEditChange[] = raw.changes
    .filter((c: any) => c && typeof c === "object" && valid.includes(c.section))
    .map((c: any) => ({
      section: c.section,
      new_summary: typeof c.new_summary === "string" ? c.new_summary : undefined,
      new_skills: Array.isArray(c.new_skills) ? c.new_skills.map(String) : undefined,
      entry_name: typeof c.entry_name === "string" ? c.entry_name : undefined,
      entry_index: typeof c.entry_index === "number" ? c.entry_index : undefined,
      new_bullets: Array.isArray(c.new_bullets) ? c.new_bullets.map(String) : undefined,
      new_description: typeof c.new_description === "string" ? c.new_description : undefined,
    }));

  if (changes.length === 0) return null;
  return { action: "ARIA_EDIT", changes, description: raw.description || "Resume updated." };
}

// Resolve which entry a change targets without silently defaulting to index 0.
// Priority: exact → prefix → substring (either direction) → valid in-range
// index → single-entry section. Returns -1 when nothing confident matches.
function resolveEntryIndexServer(
  candidatesPerEntry: string[][],
  entryName?: string,
  entryIndex?: number
): number {
  const needle = (entryName || "").toLowerCase().trim();
  const norm = (s: string) => (s || "").toLowerCase().trim();

  if (needle) {
    let idx = candidatesPerEntry.findIndex(cs => cs.some(c => norm(c) === needle));
    if (idx === -1) idx = candidatesPerEntry.findIndex(cs => cs.some(c => {
      const n = norm(c); return n !== "" && (n.startsWith(needle) || needle.startsWith(n));
    }));
    if (idx === -1) idx = candidatesPerEntry.findIndex(cs => cs.some(c => {
      const n = norm(c); return n !== "" && (n.includes(needle) || needle.includes(n));
    }));
    if (idx !== -1) return idx;
  }

  if (
    typeof entryIndex === "number" && Number.isInteger(entryIndex) &&
    entryIndex >= 0 && entryIndex < candidatesPerEntry.length
  ) {
    return entryIndex;
  }

  if (candidatesPerEntry.length === 1) return 0;
  return -1;
}

export function applyAriaEditServer(data: ResumeData, edit: AriaEdit): ResumeData {
  const next: ResumeData = JSON.parse(JSON.stringify(data));

  for (const change of edit.changes) {
    switch (change.section) {
      case "summary":
        if (change.new_summary) next.summary = change.new_summary;
        break;

      case "skills":
        if (change.new_skills) next.skills = change.new_skills;
        break;

      case "experience": {
        if (!change.new_bullets) break;
        const idx = resolveEntryIndexServer(
          next.experience.map(e => [e.company, e.title]),
          change.entry_name,
          change.entry_index
        );
        if (idx >= 0 && idx < next.experience.length) {
          next.experience[idx].bullets = change.new_bullets;
        }
        break;
      }

      case "projects": {
        if (!change.new_bullets && !change.new_description) break;
        const idx = resolveEntryIndexServer(
          next.projects.map(p => [p.name]),
          change.entry_name,
          change.entry_index
        );
        if (idx >= 0 && idx < next.projects.length) {
          if (change.new_bullets) next.projects[idx].bullets = change.new_bullets;
          if (change.new_description) next.projects[idx].description = change.new_description;
        }
        break;
      }
    }
  }
  return next;
}
