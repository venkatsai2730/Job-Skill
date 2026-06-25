import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResumeEditor } from "../hooks/useResumeEditor";
import type { ParsedSections } from "../types/resume.types";

const makeSections = (summary = "Initial"): ParsedSections => ({
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555-0100",
  location: "Remote",
  summary,
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
});

describe("useResumeEditor", () => {
  it("initialises with empty sections", () => {
    const { result } = renderHook(() => useResumeEditor());
    expect(result.current.state.sections.summary).toBe("");
    expect(result.current.state.past).toHaveLength(0);
  });

  it("SET_SECTIONS loads data and resets history", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("Hello")); });
    expect(result.current.state.sections.summary).toBe("Hello");
    expect(result.current.state.past).toHaveLength(0);
    expect(result.current.state.isDirty).toBe(false);
  });

  it("PATCH updates sections and pushes to past stack", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("Before")); });
    act(() => {
      result.current.dispatch({ type: "PATCH", patches: [{ op: "replace", path: "sections.summary", value: "After" }] });
    });
    expect(result.current.state.sections.summary).toBe("After");
    expect(result.current.state.past).toHaveLength(1);
    expect(result.current.state.past[0].summary).toBe("Before");
    expect(result.current.state.isDirty).toBe(true);
  });

  it("UNDO reverts to previous state and pushes to future", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("v1")); });
    act(() => { result.current.patchField("sections.summary", "v2"); });
    act(() => { result.current.undo(); });
    expect(result.current.state.sections.summary).toBe("v1");
    expect(result.current.state.past).toHaveLength(0);
    expect(result.current.state.future).toHaveLength(1);
    expect(result.current.state.future[0].summary).toBe("v2");
  });

  it("REDO re-applies the undone change", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("v1")); });
    act(() => { result.current.patchField("sections.summary", "v2"); });
    act(() => { result.current.undo(); });
    act(() => { result.current.redo(); });
    expect(result.current.state.sections.summary).toBe("v2");
    expect(result.current.state.future).toHaveLength(0);
  });

  it("PATCH clears the redo stack", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("v1")); });
    act(() => { result.current.patchField("sections.summary", "v2"); });
    act(() => { result.current.undo(); });
    // Now there's a future; a new patch should clear it
    act(() => { result.current.patchField("sections.summary", "v3"); });
    expect(result.current.state.future).toHaveLength(0);
    expect(result.current.state.sections.summary).toBe("v3");
  });

  it("UNDO is a no-op when past is empty", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("only")); });
    act(() => { result.current.undo(); });
    expect(result.current.state.sections.summary).toBe("only");
  });

  it("canUndo and canRedo reflect stack sizes", () => {
    const { result } = renderHook(() => useResumeEditor());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    act(() => { result.current.loadParsedData(makeSections()); });
    act(() => { result.current.patchField("sections.summary", "x"); });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    act(() => { result.current.undo(); });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("AI_EDIT_COMPLETE updates sections and appends to aiHistory", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections("original")); });
    act(() => {
      result.current.dispatch({
        type: "AI_EDIT_COMPLETE",
        sections: makeSections("ai-improved"),
        summary: "Improved summary",
        prompt: "Make it better",
      });
    });
    expect(result.current.state.sections.summary).toBe("ai-improved");
    expect(result.current.state.aiHistory).toHaveLength(1);
    expect(result.current.state.aiHistory[0].prompt).toBe("Make it better");
    expect(result.current.state.isAIEditing).toBe(false);
  });

  it("SAVE_VERSION stores a snapshot and caps at 10", () => {
    const { result } = renderHook(() => useResumeEditor());
    act(() => { result.current.loadParsedData(makeSections()); });
    for (let i = 0; i < 12; i++) {
      act(() => { result.current.saveVersion(`v${i}`); });
    }
    expect(result.current.state.versions.length).toBeLessThanOrEqual(10);
  });
});
