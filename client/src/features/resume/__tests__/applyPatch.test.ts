import { describe, it, expect } from "vitest";
import { applyPatches } from "../utils/applyPatch";

const base = {
  sections: {
    summary: "Old summary",
    experience: [
      { id: "e1", title: "Dev", company: "Corp", dates: "2022-2024", bullets: ["Built A", "Improved B"] },
    ],
    skills: [
      { id: "s1", category: "Frontend", items: ["React", "TypeScript"] },
    ],
    projects: [],
    education: [],
    name: "", email: "", phone: "", location: "",
  },
};

describe("applyPatches", () => {
  it("replaces a top-level string field", () => {
    const result = applyPatches(base, [{ op: "replace", path: "sections.summary", value: "New summary" }]);
    expect(result.sections.summary).toBe("New summary");
    expect(base.sections.summary).toBe("Old summary"); // original unchanged
  });

  it("replaces a nested array item string", () => {
    const result = applyPatches(base, [
      { op: "replace", path: "sections.experience[0].title", value: "Senior Dev" },
    ]);
    expect(result.sections.experience[0].title).toBe("Senior Dev");
    expect(base.sections.experience[0].title).toBe("Dev");
  });

  it("replaces a bullet at a specific index", () => {
    const result = applyPatches(base, [
      { op: "replace", path: "sections.experience[0].bullets[1]", value: "Reduced latency by 40%" },
    ]);
    expect(result.sections.experience[0].bullets[1]).toBe("Reduced latency by 40%");
    expect(result.sections.experience[0].bullets[0]).toBe("Built A");
  });

  it("removes an array item by index", () => {
    const result = applyPatches(base, [
      { op: "remove", path: "sections.experience[0].bullets[0]" },
    ]);
    expect(result.sections.experience[0].bullets).toHaveLength(1);
    expect(result.sections.experience[0].bullets[0]).toBe("Improved B");
  });

  it("adds a new skill item to an existing group", () => {
    const result = applyPatches(base, [
      { op: "replace", path: "sections.skills[0].items", value: ["React", "TypeScript", "Tailwind"] },
    ]);
    expect(result.sections.skills[0].items).toContain("Tailwind");
    expect(result.sections.skills[0].items).toHaveLength(3);
  });

  it("applies multiple patches in sequence", () => {
    const result = applyPatches(base, [
      { op: "replace", path: "sections.summary", value: "Updated" },
      { op: "replace", path: "sections.experience[0].company", value: "NewCorp" },
    ]);
    expect(result.sections.summary).toBe("Updated");
    expect(result.sections.experience[0].company).toBe("NewCorp");
  });

  it("ignores a patch with an invalid path gracefully", () => {
    expect(() =>
      applyPatches(base, [{ op: "replace", path: "sections.nonexistent[0].field", value: "x" }])
    ).not.toThrow();
  });

  it("does not mutate the original object", () => {
    const original = structuredClone(base);
    applyPatches(base, [{ op: "replace", path: "sections.summary", value: "Changed" }]);
    expect(base.sections.summary).toBe(original.sections.summary);
  });
});
