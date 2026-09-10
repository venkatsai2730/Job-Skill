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

/** Visual fingerprint of the original PDF, mined at upload on the server
 *  (see server/src/lib/resumeStyleProfile.ts). Drives the "faithful" re-render
 *  so AI-edited resumes still look like the user's uploaded document. */
export interface StyleProfile {
  version: 2;
  page: { width: number; height: number; marginLeft: number; marginRight: number; marginTop: number };
  columns: 1 | 2;
  sidebar: { side: "left" | "right"; widthPct: number } | null;
  fonts: { bodyFamily: string; headingFamily: string };
  sizes: { name: number; sectionHeading: number; body: number };
  colors: { name: string; sectionHeading: string; body: string };
  weights: { nameBold: boolean; headingBold: boolean };
  lineHeight: number;
  sectionHeadingStyle: { uppercase: boolean; smallCaps: boolean };
  bulletGlyph: string;
  header: { align: "left" | "center" };
}

export interface ParsedData {
  sections: ParsedSections;
  ats: ATSResult;
  rawText?: string;
  versions?: ResumeVersion[];
  styleProfile?: StyleProfile;
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

export type ResumeTemplate = "classic" | "modern" | "minimal" | "professional" | "faithful";
