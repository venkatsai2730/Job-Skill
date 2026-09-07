import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ParsedSections,
  ATSResult,
  ResumeVersion,
  AIHistoryEntry,
  ResumeTemplate,
} from "../types/resume.types";
import type { JDMatchResult } from "../schemas/resume.schema";
import { applyPatches } from "../utils/applyPatch";
import { seedIds } from "../utils/seedIds";
import type { PatchOperation } from "../types/patch.types";

const MAX_HISTORY = 30;

/** Guarantee a persisted/AI-produced ATS object has its nested `keywords` and
 *  `issues` shapes. Older records and AI-edit responses can store an `ats` with
 *  a missing `keywords` object; the ATS panel reads `ats.keywords.found` etc.
 *  unguarded, so a malformed `ats` throws and unmounts the page. Preserves any
 *  extra fields (e.g. `atsRisk`) via spread. */
function normalizeAts<T>(ats: T | null | undefined): T | null {
  if (ats == null) return null;
  const a = ats as Record<string, unknown>;
  const kw = (a.keywords ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const arr = <U,>(v: unknown): U[] => (Array.isArray(v) ? (v as U[]) : []);
  return {
    ...a,
    score: num(a.score),
    label: typeof a.label === "string" ? a.label : "",
    issues: arr(a.issues),
    keywords: {
      found: arr<string>(kw.found),
      missing: arr<string>(kw.missing),
      total: num(kw.total),
      matched: num(kw.matched),
    },
  } as T;
}

export const EMPTY_SECTIONS: ParsedSections = {
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
  links: undefined,
};

// ── State shape ────────────────────────────────────────────────────
interface ResumeState {
  sections: ParsedSections;
  ats: ATSResult | null;
  past: ParsedSections[];
  future: ParsedSections[];
  versions: ResumeVersion[];
  isDirty: boolean;
  isAIEditing: boolean;
  aiStreamText: string;
  aiHistory: AIHistoryEntry[];
  template: ResumeTemplate;
  jdResult: JDMatchResult | null;
  jobDescription: string;
}

// ── Actions ────────────────────────────────────────────────────────
interface ResumeActions {
  setSections: (sections: ParsedSections, ats?: ATSResult | null, versions?: ResumeVersion[]) => void;
  patch: (patches: PatchOperation[]) => void;
  undo: () => void;
  redo: () => void;
  saveVersion: (label?: string) => ResumeVersion;
  restoreVersion: (sections: ParsedSections) => void;
  deleteVersion: (id: string) => void;
  syncVersions: (versions: ResumeVersion[]) => void;
  markClean: () => void;
  setTemplate: (template: ResumeTemplate) => void;
  startAIEdit: () => void;
  appendStream: (text: string) => void;
  completeAIEdit: (
    sections: ParsedSections,
    ats?: ATSResult,
    summary?: string,
    prompt?: string
  ) => void;
  failAIEdit: () => void;
  setJDResult: (result: JDMatchResult | null) => void;
  setJobDescription: (jd: string) => void;
  reset: () => void;
}

export type ResumeStore = ResumeState & ResumeActions;

// ── Store ──────────────────────────────────────────────────────────
export const useResumeStore = create<ResumeStore>()(
  devtools(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────
      sections: EMPTY_SECTIONS,
      ats: null,
      past: [],
      future: [],
      versions: [],
      isDirty: false,
      isAIEditing: false,
      aiStreamText: "",
      aiHistory: [],
      template: "professional",
      jdResult: null,
      jobDescription: "",

      // ── Actions ─────────────────────────────────────────
      setSections: (sections, ats, versions) =>
        set({
          sections: seedIds(sections),
          ...(ats !== undefined ? { ats: normalizeAts(ats) } : {}),
          ...(versions !== undefined ? { versions } : {}),
          past: [],
          future: [],
          isDirty: false,
        }),

      patch: (patches) => {
        const { sections, past } = get();
        const patched = applyPatches({ sections }, patches);
        set({
          sections: patched.sections,
          past: [...past, sections].slice(-MAX_HISTORY),
          future: [],
          isDirty: true,
        });
      },

      undo: () => {
        const { past, sections, future } = get();
        if (past.length === 0) return;
        const previous = past[past.length - 1];
        set({
          sections: previous,
          past: past.slice(0, -1),
          future: [sections, ...future].slice(0, MAX_HISTORY),
          isDirty: true,
        });
      },

      redo: () => {
        const { future, sections, past } = get();
        if (future.length === 0) return;
        set({
          sections: future[0],
          past: [...past, sections].slice(-MAX_HISTORY),
          future: future.slice(1),
          isDirty: true,
        });
      },

      saveVersion: (label) => {
        const version: ResumeVersion = {
          id: crypto.randomUUID(),
          label: label || new Date().toLocaleString(),
          sections: structuredClone(get().sections),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ versions: [...s.versions, version].slice(-10) }));
        return version;
      },

      restoreVersion: (sections) => {
        const { past, sections: current } = get();
        set({
          sections: seedIds(sections),
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          isDirty: true,
        });
      },

      deleteVersion: (id) =>
        set((s) => ({ versions: s.versions.filter((v) => v.id !== id) })),

      syncVersions: (versions) => set({ versions }),

      markClean: () => set({ isDirty: false }),

      setTemplate: (template) => set({ template }),

      startAIEdit: () => set({ isAIEditing: true, aiStreamText: "" }),

      appendStream: (text) =>
        set((s) => ({ aiStreamText: s.aiStreamText + text })),

      completeAIEdit: (sections, ats, summary = "", prompt = "") => {
        const { past, sections: current, aiHistory, ats: currentAts } = get();
        set({
          sections: seedIds(sections),
          ats: ats !== undefined ? normalizeAts(ats) : currentAts,
          past: [...past, current].slice(-MAX_HISTORY),
          future: [],
          isDirty: true,
          isAIEditing: false,
          aiStreamText: "",
          aiHistory: [
            ...aiHistory,
            { prompt, summary, timestamp: Date.now() },
          ].slice(-20),
        });
      },

      failAIEdit: () => set({ isAIEditing: false, aiStreamText: "" }),

      setJDResult: (result) => set({ jdResult: result }),

      setJobDescription: (jd) => set({ jobDescription: jd }),

      reset: () =>
        set({
          sections: EMPTY_SECTIONS,
          ats: null,
          past: [],
          future: [],
          isDirty: false,
          isAIEditing: false,
          aiStreamText: "",
          aiHistory: [],
          jdResult: null,
        }),
    }),
    { name: "resume-store" }
  )
);
