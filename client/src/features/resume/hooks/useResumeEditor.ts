import { useReducer, useCallback } from "react";
import type { ResumeEditorState, ParsedSections, ATSResult, ResumeVersion } from "../types/resume.types";
import type { ResumeAction, PatchOperation } from "../types/patch.types";
import { applyPatches } from "../utils/applyPatch";
import { seedIds } from "../utils/seedIds";
import { MAX_HISTORY } from "../types/resume.types";

// ── Initial state ─────────────────────────────────────────────────
const EMPTY_SECTIONS: ParsedSections = {
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
};

const INITIAL: ResumeEditorState = {
  sections: EMPTY_SECTIONS,
  ats: null,
  past: [],
  future: [],
  versions: [],
  isDirty: false,
  isAIEditing: false,
  aiStreamText: "",
  aiHistory: [],
};

// ── Reducer ───────────────────────────────────────────────────────
function reducer(state: ResumeEditorState, action: ResumeAction): ResumeEditorState {
  switch (action.type) {
    case "SET_SECTIONS": {
      const seeded = seedIds(action.sections);
      return {
        ...state,
        sections: seeded,
        ats: action.ats ?? state.ats,
        past: [],
        future: [],
        isDirty: false,
      };
    }

    case "PATCH": {
      // Patch paths are relative to { sections: ... } so we wrap, patch, then unwrap.
      const wrapped = { sections: state.sections };
      const patched = applyPatches(wrapped, action.patches);
      return {
        ...state,
        sections: patched.sections,
        past: [...state.past, state.sections].slice(-MAX_HISTORY),
        future: [],
        isDirty: true,
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past.at(-1) ?? state.sections;
      return {
        ...state,
        sections: previous,
        past: state.past.slice(0, -1),
        future: [state.sections, ...state.future].slice(0, MAX_HISTORY),
        isDirty: true,
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        sections: next,
        past: [...state.past, state.sections].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        isDirty: true,
      };
    }

    case "SAVE_VERSION": {
      const version: ResumeVersion = {
        id: crypto.randomUUID(),
        label: action.label || new Date().toLocaleString(),
        sections: structuredClone(state.sections),
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        versions: [...state.versions, version].slice(-10),
      };
    }

    case "RESTORE_VERSION": {
      const seeded = seedIds(action.sections);
      return {
        ...state,
        sections: seeded,
        past: [...state.past, state.sections].slice(-MAX_HISTORY),
        future: [],
        isDirty: true,
      };
    }

    case "DELETE_VERSION":
      return {
        ...state,
        versions: state.versions.filter((v) => v.id !== action.id),
      };

    case "SYNC_VERSIONS":
      return { ...state, versions: action.versions };

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    case "AI_EDIT_START":
      return { ...state, isAIEditing: true, aiStreamText: "" };

    case "AI_STREAM":
      return { ...state, aiStreamText: state.aiStreamText + action.text };

    case "AI_EDIT_COMPLETE": {
      const seeded = seedIds(action.sections);
      return {
        ...state,
        sections: seeded,
        ats: action.ats ?? state.ats,
        past: [...state.past, state.sections].slice(-MAX_HISTORY),
        future: [],
        isDirty: true,
        isAIEditing: false,
        aiStreamText: "",
        aiHistory: [
          ...state.aiHistory,
          { prompt: action.prompt, summary: action.summary, timestamp: Date.now() },
        ].slice(-20),
      };
    }

    case "AI_EDIT_ERROR":
      return { ...state, isAIEditing: false, aiStreamText: "" };

    default:
      return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────
export function useResumeEditor() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const patchField = useCallback(
    (path: string, value: unknown) => {
      dispatch({ type: "PATCH", patches: [{ op: "replace", path, value }] });
    },
    []
  );

  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const loadParsedData = useCallback(
    (sections: ParsedSections, ats?: ATSResult, versions?: ResumeVersion[]) => {
      dispatch({ type: "SET_SECTIONS", sections, ats });
      if (versions) dispatch({ type: "SYNC_VERSIONS", versions });
    },
    []
  );

  const saveVersion = useCallback(
    (label?: string) => dispatch({ type: "SAVE_VERSION", label }),
    []
  );

  const restoreVersion = useCallback(
    (sections: ParsedSections) => dispatch({ type: "RESTORE_VERSION", sections }),
    []
  );

  const deleteVersion = useCallback(
    (id: string) => dispatch({ type: "DELETE_VERSION", id }),
    []
  );

  return {
    state,
    dispatch,
    patchField,
    undo,
    redo,
    loadParsedData,
    saveVersion,
    restoreVersion,
    deleteVersion,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
