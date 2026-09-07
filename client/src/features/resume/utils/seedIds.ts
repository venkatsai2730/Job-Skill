import type { ParsedSections } from "../types/resume.types";

/** Attach stable IDs to all array entries and guarantee every nested array/field
 *  exists. Called once when parsed data is loaded from the server (or AI edit).
 *
 *  The server parser, AI-edit endpoints, and older persisted records can emit
 *  entries with a missing `bullets` / `items` / `tech` / `courses` array. The
 *  resume templates and section editors call `.map`/`.join`/`.length` on those
 *  arrays unguarded, so a single missing array throws a TypeError that unmounts
 *  the whole app (blank page). Normalising here — the one place server data
 *  enters the store — keeps all four templates and every editor safe. */
export function seedIds(sections: ParsedSections): ParsedSections {
  const s = (sections ?? {}) as ParsedSections;
  const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);

  return {
    ...s,
    name: s.name ?? "",
    email: s.email ?? "",
    phone: s.phone ?? "",
    location: s.location ?? "",
    summary: s.summary ?? "",
    experience: arr(s.experience).map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      bullets: arr(e.bullets),
    })),
    education: arr(s.education).map((e) => ({
      ...e,
      id: e.id || crypto.randomUUID(),
      courses: arr(e.courses),
    })),
    skills: arr(s.skills).map((sk) => ({
      ...sk,
      id: sk.id || crypto.randomUUID(),
      items: arr(sk.items),
    })),
    projects: arr(s.projects).map((p) => ({
      ...p,
      id: p.id || crypto.randomUUID(),
      tech: arr(p.tech),
    })),
    certifications: arr(s.certifications).map((c) => ({
      ...c,
      id: c.id || crypto.randomUUID(),
      text: c.text ?? "",
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
