import type { ParsedSections } from "./resume.types";

// RFC 6902-inspired subset. Path uses dot-notation + bracket indices.
// Examples:
//   "sections.summary"
//   "sections.experience[0].bullets[1]"
//   "sections.skills[0].items"

export type PatchOperation =
  | { op: "replace"; path: string; value: unknown }
  | { op: "add"; path: string; value: unknown }      // appends to array when path ends with "[-]"
  | { op: "remove"; path: string };

export interface ResumePatch {
  patches: PatchOperation[];
  /** Human-readable description of what changed (shown in AI history) */
  summary: string;
}

// ── Actions dispatched to useResumeEditor ────────────────────────
export type ResumeAction =
  | { type: "SET_SECTIONS"; sections: ParsedSections; ats?: import("./resume.types").ATSResult }
  | { type: "PATCH"; patches: PatchOperation[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SAVE_VERSION"; label?: string }
  | { type: "RESTORE_VERSION"; sections: ParsedSections }
  | { type: "DELETE_VERSION"; id: string }
  | { type: "SYNC_VERSIONS"; versions: import("./resume.types").ResumeVersion[] }
  | { type: "MARK_CLEAN" }
  | { type: "AI_EDIT_START" }
  | { type: "AI_STREAM"; text: string }
  | { type: "AI_EDIT_COMPLETE"; sections: ParsedSections; ats?: import("./resume.types").ATSResult; summary: string; prompt: string }
  | { type: "AI_EDIT_ERROR" };
