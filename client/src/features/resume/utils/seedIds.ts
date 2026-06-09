import type { ParsedSections } from "../types/resume.types";

/** Attach stable IDs to all array entries that are missing them.
 *  Called once when parsed data is loaded from the server. */
export function seedIds(sections: ParsedSections): ParsedSections {
  return {
    ...sections,
    name: sections.name ?? "",
    email: sections.email ?? "",
    phone: sections.phone ?? "",
    location: sections.location ?? "",
    experience: sections.experience.map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
    })),
    education: sections.education.map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
    })),
    skills: sections.skills.map((s) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
    })),
    projects: sections.projects.map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
    })),
  };
}

/** Sanitise a user-supplied AI prompt: strip control characters, cap length. */
export function sanitisePrompt(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .trim()
    .slice(0, 500);
}
