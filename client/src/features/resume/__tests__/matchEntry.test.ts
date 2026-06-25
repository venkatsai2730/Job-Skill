import { describe, it, expect } from "vitest";
import { resolveEntryIndex } from "../utils/matchEntry";

// Two experience-like entries to exercise ambiguity handling.
const two = [
  ["Acme Corp", "Software Engineer"],
  ["Beta Systems", "Software Engineer"],
];

describe("resolveEntryIndex", () => {
  it("matches an exact company name", () => {
    expect(resolveEntryIndex(two, "Beta Systems", undefined)).toEqual({ index: 1, matched: true });
  });

  it("matches a partial company name (resume has the longer form)", () => {
    const entries = [["Google India Pvt Ltd", "SWE"], ["Acme", "Dev"]];
    expect(resolveEntryIndex(entries, "Google", undefined)).toEqual({ index: 0, matched: true });
  });

  it("matches by title when company does not match", () => {
    expect(resolveEntryIndex(two, "Software Engineer", undefined).matched).toBe(true);
  });

  it("does NOT silently default to index 0 when a name matches nothing (multiple entries)", () => {
    expect(resolveEntryIndex(two, "Nonexistent Company", undefined)).toEqual({ index: -1, matched: false });
  });

  it("uses a valid in-range entry_index fallback", () => {
    expect(resolveEntryIndex(two, "Nonexistent", 1)).toEqual({ index: 1, matched: true });
  });

  it("rejects an out-of-range entry_index", () => {
    expect(resolveEntryIndex(two, undefined, 5)).toEqual({ index: -1, matched: false });
  });

  it("applies to the only entry when the section is unambiguous", () => {
    const one = [["Acme", "Dev"]];
    expect(resolveEntryIndex(one, "Totally Different Name", undefined)).toEqual({ index: 0, matched: true });
  });

  it("returns unmatched when no name and no index on a multi-entry section", () => {
    expect(resolveEntryIndex(two, undefined, undefined)).toEqual({ index: -1, matched: false });
  });
});
