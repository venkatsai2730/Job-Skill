export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  school: string;
  dates: string;
  gpa: string;
  courses: string[];
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  tech: string[];
  url?: string;
}

export interface CertificationEntry {
  id: string;
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
  links?: {
    linkedin?: string;
    github?: string;
    portfolio?: string;
    medium?: string;
  };
}

export interface ATSResult {
  score: number;
  label: string;
  issues: { type: "warning" | "success"; text: string }[];
  keywords: {
    found: string[];
    missing: string[];
    total: number;
    matched: number;
  };
}

export interface ResumeVersion {
  id: string;
  label: string;
  sections: ParsedSections;
  createdAt: string;
}

export interface ParsedData {
  sections: ParsedSections;
  ats: ATSResult;
  rawText?: string;
  versions?: ResumeVersion[];
}

// ── Editor state ──────────────────────────────────────────────────
export interface ResumeEditorState {
  sections: ParsedSections;
  ats: ATSResult | null;
  /** Undo stack: previous snapshots, oldest first */
  past: ParsedSections[];
  /** Redo stack: future snapshots, most-recent first */
  future: ParsedSections[];
  versions: ResumeVersion[];
  isDirty: boolean;
  isAIEditing: boolean;
  aiStreamText: string;
  aiHistory: AIHistoryEntry[];
}

export interface AIHistoryEntry {
  prompt: string;
  summary: string;
  timestamp: number;
}

export const MAX_HISTORY = 30;

export type ResumeTemplate = "classic" | "modern" | "minimal" | "professional";
