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
      template: "classic",
      jdResult: null,

      // ── Actions ─────────────────────────────────────────
      setSections: (sections, ats, versions) =>
        set({
          sections: seedIds(sections),
          ...(ats !== undefined ? { ats } : {}),
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
          ats: ats !== undefined ? ats : currentAts,
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
