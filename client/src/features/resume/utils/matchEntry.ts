// ═══════════════════════════════════════════════════════════════
// matchEntry — Resolve which resume entry an AriaEdit change targets.
//
// Replaces the old `findIndex(includes) ?? 0` logic that silently
// patched the FIRST entry whenever a name didn't match. Matching
// priority: exact → startsWith (either direction) → includes (either
// direction) → valid in-range entry_index → (only if the section has a
// single entry) index 0. Otherwise the change is reported as UNMATCHED
// so the caller can skip it and warn the user instead of corrupting the
// wrong entry.
// ═══════════════════════════════════════════════════════════════

export interface EntryMatch {
  index: number;
  matched: boolean;
}

/** Outcome of applying an AriaEdit to the resume sections. */
export interface AriaEditResult {
  /** Number of changes that were actually applied. */
  applied: number;
  /** Human-readable labels of changes that could not be matched to an entry. */
  unmatched: string[];
}

const norm = (s: string | undefined): string => (s || "").toLowerCase().trim();

/**
 * @param candidatesPerEntry For each entry, the strings a name may match
 *   against (e.g. [company, title] for experience, [name] for projects).
 * @param entryName  The AI-provided entry name (company/project), if any.
 * @param entryIndex The AI-provided 0-based fallback index, if any.
 */
export function resolveEntryIndex(
  candidatesPerEntry: string[][],
  entryName: string | undefined,
  entryIndex: number | undefined
): EntryMatch {
  const needle = norm(entryName);

  if (needle) {
    // 1. Exact (case-insensitive) match on any candidate
    let idx = candidatesPerEntry.findIndex(cands =>
      cands.some(c => norm(c) === needle)
    );
    // 2. Prefix match in either direction
    if (idx === -1) {
      idx = candidatesPerEntry.findIndex(cands =>
        cands.some(c => {
          const n = norm(c);
          return n !== "" && (n.startsWith(needle) || needle.startsWith(n));
        })
      );
    }
    // 3. Substring match in either direction
    if (idx === -1) {
      idx = candidatesPerEntry.findIndex(cands =>
        cands.some(c => {
          const n = norm(c);
          return n !== "" && (n.includes(needle) || needle.includes(n));
        })
      );
    }
    if (idx !== -1) return { index: idx, matched: true };
  }

  // 4. Explicit index — only when present and in range
  if (
    typeof entryIndex === "number" &&
    Number.isInteger(entryIndex) &&
    entryIndex >= 0 &&
    entryIndex < candidatesPerEntry.length
  ) {
    return { index: entryIndex, matched: true };
  }

  // 5. Unambiguous single-entry section — safe to apply to the only entry
  if (candidatesPerEntry.length === 1) {
    return { index: 0, matched: true };
  }

  // Nothing confident — caller should skip and warn
  return { index: -1, matched: false };
}
