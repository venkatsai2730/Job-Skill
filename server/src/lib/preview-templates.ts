// ── Editor preview-template registry ────────────────────────────
// The Resume editor can only render FOUR on-screen preview layouts
// (ClassicTemplate / ModernTemplate / MinimalTemplate / ProfessionalTemplate).
// The backend, separately, has 20+ LaTeX templates used only for PDF
// compilation. This registry is the single source of truth that bridges the
// two: each preview template maps to a real backend LaTeX template id, so a
// user's on-screen choice actually drives the compiled PDF (previously the
// client sent ids like "professional" that don't exist in ALL_TEMPLATES, so
// generateLatex silently fell back).
import { ALL_TEMPLATES } from "./latex-templates.js";

export type PreviewTemplateId = "classic" | "modern" | "minimal" | "professional";

export interface PreviewTemplate {
    id: PreviewTemplateId;
    name: string;
    description: string;
    /** Backend LaTeX template id used for server-side PDF compilation. */
    latexId: string;
    /** Combined ATS score of the mapped LaTeX template (for UI social proof). */
    atsScore: number;
}

const REGISTRY: Omit<PreviewTemplate, "atsScore">[] = [
    { id: "professional", name: "Professional", description: "Clean single-column layout tuned for corporate ATS parsing.", latexId: "engineering-pro" },
    { id: "modern",       name: "Modern",       description: "Contemporary styling with accent headers for tech roles.",   latexId: "modern-tech" },
    { id: "classic",      name: "Classic",      description: "Traditional academic format, maximum ATS compatibility.",     latexId: "classic-academic" },
    { id: "minimal",      name: "Minimal",      description: "Minimalist, whitespace-forward and distraction-free.",        latexId: "minimalist-clean" },
];

export const PREVIEW_TEMPLATES: PreviewTemplate[] = REGISTRY.map((t) => {
    const latex = ALL_TEMPLATES.find((x) => x.id === t.latexId);
    return { ...t, atsScore: latex?.atsScores?.combined ?? 90 };
});

const PREVIEW_IDS = new Set<string>(PREVIEW_TEMPLATES.map((t) => t.id));

/** True if `id` is one of the four editor preview template ids. */
export function isPreviewTemplate(id: string): id is PreviewTemplateId {
    return PREVIEW_IDS.has(id);
}

/** Map an editor preview template id → the backend LaTeX template id used for
 *  PDF compilation. Ids that are already backend template ids pass through
 *  unchanged, so callers passing a real LaTeX id still work. */
export function resolveLatexTemplateId(templateId: string | undefined): string {
    if (!templateId) return "classic-academic";
    const preview = PREVIEW_TEMPLATES.find((t) => t.id === templateId);
    return preview ? preview.latexId : templateId;
}
