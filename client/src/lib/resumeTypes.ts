// ═══════════════════════════════════════════════════════════════
// Resume Live-Edit Types — Shared between frontend components
// ═══════════════════════════════════════════════════════════════

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

// ── Resume Patch Protocol ─────────────────────────────────────
export type PatchSection = "summary" | "experience" | "education" | "skills" | "projects";
export type PatchOperation = "update" | "append" | "replace_bullet" | "add_bullet" | "delete_bullet";

export interface ResumePatchItem {
  section: PatchSection;
  operation: PatchOperation;
  target_id?: string;       // UUID of the experience/project/education entry
  bullet_index?: number;    // Index for bullet-level operations
  before: string | string[];
  after: string | string[];
}

export interface ResumePatch {
  action: "PATCH_RESUME";
  patches: ResumePatchItem[];
  explanation: string;
}

// ── Helper: Apply a single patch item to ResumeData ───────────
export function applySinglePatch(data: ResumeData, item: ResumePatchItem): ResumeData {
  const next = structuredClone(data);

  switch (item.section) {
    case "summary": {
      if (item.operation === "update") {
        next.summary = typeof item.after === "string" ? item.after : item.after[0] || "";
      }
      break;
    }

    case "experience": {
      if (item.operation === "update" && item.target_id) {
        const entry = next.experience.find(e => e.id === item.target_id);
        if (entry && Array.isArray(item.after)) {
          entry.bullets = item.after;
        }
      } else if (item.operation === "replace_bullet" && item.target_id && item.bullet_index !== undefined) {
        const entry = next.experience.find(e => e.id === item.target_id);
        if (entry && entry.bullets[item.bullet_index] !== undefined) {
          entry.bullets[item.bullet_index] = typeof item.after === "string" ? item.after : item.after[0] || "";
        }
      } else if (item.operation === "add_bullet" && item.target_id) {
        const entry = next.experience.find(e => e.id === item.target_id);
        if (entry) {
          const newBullets = Array.isArray(item.after) ? item.after : [item.after];
          entry.bullets.push(...newBullets);
        }
      } else if (item.operation === "delete_bullet" && item.target_id && item.bullet_index !== undefined) {
        const entry = next.experience.find(e => e.id === item.target_id);
        if (entry && entry.bullets[item.bullet_index] !== undefined) {
          entry.bullets.splice(item.bullet_index, 1);
        }
      } else if (item.operation === "append") {
        // Append a whole new experience entry
        const afterData = Array.isArray(item.after) ? item.after : [item.after];
        // afterData should contain JSON strings of experience entries, but handle gracefully
        for (const raw of afterData) {
          try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            next.experience.push({
              id: parsed.id || crypto.randomUUID(),
              title: parsed.title || "",
              company: parsed.company || "",
              start_date: parsed.start_date || "",
              end_date: parsed.end_date || "Present",
              bullets: parsed.bullets || [],
            });
          } catch {
            // Skip unparseable entries
          }
        }
      }
      break;
    }

    case "education": {
      if (item.operation === "update" && item.target_id) {
        const entry = next.education.find(e => e.id === item.target_id);
        if (entry && typeof item.after === "string") {
          entry.degree = item.after;
        }
      } else if (item.operation === "append") {
        const afterData = Array.isArray(item.after) ? item.after : [item.after];
        for (const raw of afterData) {
          try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            next.education.push({
              id: parsed.id || crypto.randomUUID(),
              degree: parsed.degree || "",
              institution: parsed.institution || "",
              year: parsed.year || "",
              grade: parsed.grade,
            });
          } catch {
            // Skip
          }
        }
      }
      break;
    }

    case "skills": {
      if (item.operation === "update") {
        next.skills = Array.isArray(item.after) ? item.after : [item.after];
      } else if (item.operation === "append") {
        const newSkills = Array.isArray(item.after) ? item.after : [item.after];
        next.skills = [...new Set([...next.skills, ...newSkills])];
      }
      break;
    }

    case "projects": {
      if (item.operation === "update" && item.target_id) {
        const entry = next.projects.find(p => p.id === item.target_id);
        if (entry && Array.isArray(item.after)) {
          entry.bullets = item.after;
        }
      } else if (item.operation === "replace_bullet" && item.target_id && item.bullet_index !== undefined) {
        const entry = next.projects.find(p => p.id === item.target_id);
        if (entry && entry.bullets[item.bullet_index] !== undefined) {
          entry.bullets[item.bullet_index] = typeof item.after === "string" ? item.after : item.after[0] || "";
        }
      } else if (item.operation === "add_bullet" && item.target_id) {
        const entry = next.projects.find(p => p.id === item.target_id);
        if (entry) {
          const newBullets = Array.isArray(item.after) ? item.after : [item.after];
          entry.bullets.push(...newBullets);
        }
      } else if (item.operation === "delete_bullet" && item.target_id && item.bullet_index !== undefined) {
        const entry = next.projects.find(p => p.id === item.target_id);
        if (entry && entry.bullets[item.bullet_index] !== undefined) {
          entry.bullets.splice(item.bullet_index, 1);
        }
      } else if (item.operation === "append") {
        const afterData = Array.isArray(item.after) ? item.after : [item.after];
        for (const raw of afterData) {
          try {
            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            next.projects.push({
              id: parsed.id || crypto.randomUUID(),
              name: parsed.name || "",
              description: parsed.description || "",
              tech_stack: parsed.tech_stack || [],
              bullets: parsed.bullets || [],
            });
          } catch {
            // Skip
          }
        }
      }
      break;
    }
  }

  return next;
}

// ── Apply a full ResumePatch (all items) ──────────────────────
export function applyResumePatch(data: ResumeData, patch: ResumePatch): ResumeData {
  let current = data;
  for (const item of patch.patches) {
    current = applySinglePatch(current, item);
  }
  return current;
}

// ── Legacy ParsedSections shape (matches Resume.tsx interfaces) ──
interface LegacyExperience { title: string; company: string; dates: string; bullets: string[]; }
interface LegacyEducation { degree: string; school: string; dates: string; gpa: string; courses: string[]; }
interface LegacySkillGroup { category: string; items: string[]; }
interface LegacyProject { name: string; description: string; tech: string[]; }
interface LegacyParsedSections {
  summary: string;
  experience: LegacyExperience[];
  education: LegacyEducation[];
  skills: LegacySkillGroup[];
  projects: LegacyProject[];
}

// ── Convert ResumeData back to legacy ParsedSections ───────────
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

// ═══════════════════════════════════════════════════════════════
// AriaEdit — Simple section-rewrite format (auto-applied, no UUID needed)
// ═══════════════════════════════════════════════════════════════

export interface AriaEditChange {
  section: "summary" | "skills" | "experience" | "projects";
  new_summary?: string;
  new_skills?: string[];
  entry_name?: string;    // company or project name — matched case-insensitively
  entry_index?: number;   // fallback when no name match
  new_bullets?: string[];
  new_description?: string;
}

export interface AriaEdit {
  action: "ARIA_EDIT";
  changes: AriaEditChange[];
  description: string;
}

export function applyAriaEdit(data: ResumeData, edit: AriaEdit): ResumeData {
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
        let idx = -1;
        if (change.entry_name) {
          idx = next.experience.findIndex(e =>
            e.company.toLowerCase().includes(change.entry_name!.toLowerCase()) ||
            e.title.toLowerCase().includes(change.entry_name!.toLowerCase())
          );
        }
        if (idx === -1) idx = change.entry_index ?? 0;
        if (idx >= 0 && idx < next.experience.length) {
          if (change.new_bullets) next.experience[idx].bullets = change.new_bullets;
        }
        break;
      }

      case "projects": {
        let idx = -1;
        if (change.entry_name) {
          idx = next.projects.findIndex(p =>
            p.name.toLowerCase().includes(change.entry_name!.toLowerCase())
          );
        }
        if (idx === -1) idx = change.entry_index ?? 0;
        if (idx === -1 && next.projects.length > 0) idx = 0;
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
