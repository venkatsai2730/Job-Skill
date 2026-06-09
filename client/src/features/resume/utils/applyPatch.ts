import type { PatchOperation } from "../types/patch.types";

/**
 * Resolve a dot-bracket path string to the parent object + final key.
 * e.g. "sections.experience[0].bullets[1]" on root returns
 *      { parent: bulletsArray, key: "1" }
 */
function resolvePath(
  root: Record<string, unknown>,
  path: string
): { parent: Record<string, unknown> | unknown[]; key: string } | null {
  // Normalise: "sections.experience[0].bullets" → ["sections","experience","0","bullets"]
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  if (parts.length === 0) return null;

  let current: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  if (current === null || typeof current !== "object") return null;
  return {
    parent: current as Record<string, unknown> | unknown[],
    key: parts[parts.length - 1],
  };
}

/**
 * Apply a list of patch operations to a deep clone of `target`.
 * Returns the patched clone; the original is never mutated.
 */
export function applyPatches<T>(target: T, patches: PatchOperation[]): T {
  const clone = structuredClone(target) as Record<string, unknown>;

  for (const patch of patches) {
    if (patch.op === "replace") {
      const resolved = resolvePath(clone, patch.path);
      if (!resolved) continue;
      const { parent, key } = resolved;
      (parent as Record<string, unknown>)[key] = patch.value;
    } else if (patch.op === "add") {
      const resolved = resolvePath(clone, patch.path);
      if (!resolved) continue;
      const { parent, key } = resolved;
      if (Array.isArray(parent)) {
        // Numeric key → insert at index; "[-]" style handled by parent resolution
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) {
          (parent as unknown[]).splice(idx, 0, patch.value);
        } else {
          (parent as unknown[]).push(patch.value);
        }
      } else {
        (parent as Record<string, unknown>)[key] = patch.value;
      }
    } else if (patch.op === "remove") {
      const resolved = resolvePath(clone, patch.path);
      if (!resolved) continue;
      const { parent, key } = resolved;
      if (Array.isArray(parent)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) (parent as unknown[]).splice(idx, 1);
      } else {
        delete (parent as Record<string, unknown>)[key];
      }
    }
  }

  return clone as unknown as T;
}
