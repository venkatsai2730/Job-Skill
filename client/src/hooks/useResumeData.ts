// ═══════════════════════════════════════════════════════════════
// useResumeData — React hook for live resume editing
// Manages resume state, undo stack, patch application, and
// debounced server persistence.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
    ResumeData,
    ResumeExperience,
    ResumeEducation,
    ResumeProject,
    ResumePatch,
} from "@/lib/resumeTypes";
import { applyResumePatch } from "@/lib/resumeTypes";

// ── Legacy ParsedSections shape (matches Resume.tsx interfaces) ──
interface LegacyExperience { title: string; company: string; dates: string; bullets: string[]; }
interface LegacyEducation { degree: string; school: string; dates: string; gpa: string; courses: string[]; }
interface LegacySkillGroup { category: string; items: string[]; }
interface LegacyProject { name: string; description: string; tech: string[]; }
interface LegacyParsedSections {
    summary: string;
    experience: LegacyExperience[];
    education: LegacyEducation[];
    skills: LegacySkillGroup[];
    projects: LegacyProject[];
}

// ── Generate UUID (browser-safe) ──────────────────────────────
function uuid(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// ── Convert legacy ParsedSections → structured ResumeData ─────
export function initFromParsedSections(sections: LegacyParsedSections): ResumeData {
    const experience: ResumeExperience[] = (sections.experience || []).map(exp => {
        const dateStr = exp.dates || "";
        const parts = dateStr.split(/\s*[-–—]\s*/);
        return {
            id: uuid(),
            title: exp.title || "",
            company: exp.company || "",
            start_date: parts[0]?.trim() || "",
            end_date: parts[1]?.trim() || "Present",
            bullets: exp.bullets || [],
        };
    });

    const education: ResumeEducation[] = (sections.education || []).map(edu => ({
        id: uuid(),
        degree: edu.degree || "",
        institution: edu.school || "",
        year: edu.dates || "",
        grade: edu.gpa || undefined,
    }));

    const skills: string[] = (sections.skills || []).flatMap(
        (group: LegacySkillGroup) => group.items || []
    );

    const projects: ResumeProject[] = (sections.projects || []).map(proj => ({
        id: uuid(),
        name: proj.name || "",
        description: proj.description || "",
        tech_stack: proj.tech || [],
        bullets: [],
    }));

    return { summary: sections.summary || "", experience, education, skills, projects };
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════
const MAX_HISTORY = 10;

export function useResumeData() {
    const [resumeData, setResumeData] = useState<ResumeData | null>(null);
    const [resumeHistory, setResumeHistory] = useState<ResumeData[]>([]);
    const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
    const [pendingPatch, setPendingPatch] = useState<ResumePatch | null>(null);
    const [isLiveEditMode, setIsLiveEditMode] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Initialize from parsed sections ───────────────────────
    const initFromSections = useCallback((sections: LegacyParsedSections) => {
        const data = initFromParsedSections(sections);
        setResumeData(data);
        setResumeHistory([]);
    }, []);

    // ── Debounced save to server ──────────────────────────────
    const saveToServer = useCallback((data: ResumeData, immediate = false) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        
        const saveFn = async () => {
            try {
                await api.patch("/api/resume/data", { resume_data: data });
                toast.success("Resume saved", { duration: 2000 });
            } catch (err: any) {
                console.error("[useResumeData] Save failed:", err);
                toast.error("Failed to save resume changes");
            }
        };

        if (immediate) {
            saveFn();
        } else {
            saveTimerRef.current = setTimeout(saveFn, 2000);
        }
    }, []);

    // ── Accept a pending patch (user clicked "Accept") ────────
    const acceptPatch = useCallback((patch?: ResumePatch) => {
        const patchToApply = patch || pendingPatch;
        if (!patchToApply || !resumeData) return null;

        // Push current state to history for undo
        setResumeHistory(prev => {
            const next = [...prev, resumeData];
            if (next.length > MAX_HISTORY) next.shift();
            return next;
        });

        // Apply the patch
        const newData = applyResumePatch(resumeData, patchToApply);
        setResumeData(newData);
        setIsLiveEditMode(true);
        setPendingPatch(null);

        // Highlight the first changed section
        if (patchToApply.patches.length > 0) {
            const firstSection = patchToApply.patches[0].section;
            setHighlightedSection(firstSection);
            setTimeout(() => setHighlightedSection(null), 2500);
        }

        // Auto-save
        saveToServer(newData);
        return newData;
    }, [pendingPatch, resumeData, saveToServer]);

    // ── Undo last patch ───────────────────────────────────────
    const undoLastPatch = useCallback(() => {
        if (resumeHistory.length === 0 || !resumeData) {
            toast.info("Nothing to undo");
            return null;
        }

        const previousState = resumeHistory[resumeHistory.length - 1];
        setResumeHistory(prev => prev.slice(0, -1));
        setResumeData(previousState);

        // Save the reverted state
        saveToServer(previousState);
        toast.success("Changes undone");
        return previousState;
    }, [resumeHistory, resumeData, saveToServer]);

    // ── Set a pending patch (don't apply yet — show diff) ─────
    const setPatch = useCallback((patch: ResumePatch) => {
        setPendingPatch(patch);
    }, []);

    // ── Reject pending patch ──────────────────────────────────
    const rejectPatch = useCallback(() => {
        setPendingPatch(null);
    }, []);

    return {
        resumeData,
        setResumeData,
        resumeHistory,
        highlightedSection,
        pendingPatch,
        isLiveEditMode,
        setIsLiveEditMode,
        initFromSections,
        acceptPatch,
        undoLastPatch,
        setPatch,
        rejectPatch,
        saveToServer,
    };
}
