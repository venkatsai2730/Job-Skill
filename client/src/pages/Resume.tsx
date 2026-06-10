import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileText, GraduationCap, Code2,
  FolderOpen, Trash2, Loader2, Eye, Edit3, Check,
  AlertTriangle, BookOpen, Palette, Sparkles,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

import { useResumeStore } from "@/features/resume/store/resumeStore";
import { useAIEdit } from "@/features/resume/hooks/useAIEdit";
import { usePDFExport } from "@/features/resume/hooks/usePDFExport";
import { ResumePreview } from "@/features/resume/components/ResumePreview";
import { AIPromptBar } from "@/features/resume/components/AIPromptBar";
import { VersionHistory } from "@/features/resume/components/VersionHistory";
import { JobDescriptionPanel } from "@/features/resume/components/JobDescriptionPanel";
import { SummaryEditor } from "@/features/resume/components/SectionEditors/SummaryEditor";
import { ExperienceEditor } from "@/features/resume/components/SectionEditors/ExperienceEditor";
import { EducationEditor } from "@/features/resume/components/SectionEditors/EducationEditor";
import { SkillsEditor } from "@/features/resume/components/SectionEditors/SkillsEditor";
import { ProjectsEditor } from "@/features/resume/components/SectionEditors/ProjectsEditor";
import type { ParsedData, ResumeTemplate } from "@/features/resume/types/resume.types";
import type { ResumeAction } from "@/features/resume/types/patch.types";

const PDF_PREVIEW_ID = "resume-pdf-capture";

const TEMPLATES: { id: ResumeTemplate; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "minimal", label: "Minimal" },
];

// ── Keyboard shortcut: Ctrl+Z / Ctrl+Y ───────────────────────────
function useEditorShortcuts(undo: () => void, redo: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [undo, redo]);
}

// ── Component ─────────────────────────────────────────────────────
const Resume = () => {
  const { token } = useAuth();
  const store = useResumeStore();
  const { submit: submitAIEditRaw } = useAIEdit();
  const { exportPDF, exporting } = usePDFExport();

  const canUndo = store.past.length > 0;
  const canRedo = store.future.length > 0;
  useEditorShortcuts(store.undo, store.redo);

  // Adapter so section editors (which expect Dispatch<ResumeAction>) can talk to the store
  const dispatch = useCallback((action: ResumeAction) => {
    if (action.type === "PATCH") store.patch(action.patches);
  }, [store]);

  // ── File state ───────────────────────────────────────────
  const [resumeFile, setResumeFile] = useState<{ file_name: string; storage_path: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingParsed, setLoadingParsed] = useState(false);
  const [downloading, setDownloading] = useState<"docx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Original PDF blob URL (shown before any AI edits) ────
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  // True once the user has applied at least one AI edit — switches view to React preview
  const [hasAIEdits, setHasAIEdits] = useState(false);

  // ── UI state ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"editor" | "preview">("preview");
  const [activeSection, setActiveSection] = useState("Summary");
  const [showVersions, setShowVersions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const hasParsed =
    store.sections.summary !== "" ||
    store.sections.experience.length > 0 ||
    store.sections.skills.length > 0;

  // ── Load original PDF as blob URL (for iframe display) ──
  const loadPdfBlob = useCallback(async () => {
    setLoadingPdf(true);
    try {
      const authToken = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/resume/download/pdf`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      // silently fail — will fall back to React preview
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  // Revoke blob URL on unmount to free memory
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  // ── Load resume on mount ─────────────────────────────────
  useEffect(() => {
    if (!token) return;
    api.get<{ resume: { file_name: string; storage_path: string } | null }>("/api/resume")
      .then((d) => { if (d.resume) setResumeFile(d.resume); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !resumeFile) return;
    setLoadingParsed(true);
    api.get<{ parsed: ParsedData | null }>("/api/resume/parsed")
      .then((d) => {
        if (d.parsed) store.setSections(d.parsed.sections, d.parsed.ats, d.parsed.versions);
      })
      .catch(() => {})
      .finally(() => setLoadingParsed(false));
  }, [token, resumeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load PDF blob whenever we have a resume file (on mount and after upload)
  useEffect(() => {
    if (!token || !resumeFile) return;
    loadPdfBlob();
  }, [token, resumeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save dirty sections ─────────────────────────────
  useEffect(() => {
    if (!store.isDirty || !resumeFile) return;
    const timer = setTimeout(() => {
      api.put("/api/resume/sections", { sections: store.sections })
        .then(() => store.markClean())
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [store.isDirty, store.sections, resumeFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ───────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) { toast.error("Only PDF files are allowed."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File exceeds 10MB limit."); return; }
    setUploading(true);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const meta = await api.post<{
        resume: { file_name: string; storage_path: string };
        parsed: ParsedData | null;
      }>("/api/resume/upload", { fileName: file.name, fileData: base64 });

      setResumeFile(meta.resume);
      if (meta.parsed) store.setSections(meta.parsed.sections, meta.parsed.ats);
      setHasAIEdits(false);
      setViewMode("preview");
      // loadPdfBlob runs automatically via the resumeFile effect above
      toast.success(`"${file.name}" uploaded ✦`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { uploadFile(f); }
    e.target.value = "";
  };

  // ── Delete ───────────────────────────────────────────────
  const handleDelete = async () => {
    if (!globalThis.confirm("Delete your resume? This cannot be undone.")) return;
    try {
      await api.delete("/api/resume");
      setResumeFile(null);
      if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
      setHasAIEdits(false);
      store.reset();
      toast.success("Resume deleted.");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Delete failed."); }
  };

  // ── Downloads ────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    try {
      const name = (resumeFile?.file_name || "resume").replace(/\.pdf$/i, "") + ".pdf";
      if (!hasAIEdits) {
        // No AI edits yet — download the original uploaded PDF
        await api.downloadBlob("/api/resume/download/pdf", name);
      } else {
        // AI has edited the resume — export the live React preview
        await exportPDF(PDF_PREVIEW_ID, name);
      }
      toast.success("PDF downloaded ✦");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "PDF export failed."); }
  };

  const handleDownloadDOCX = async () => {
    setDownloading("docx");
    try {
      const name = (resumeFile?.file_name || "resume").replace(/\.pdf$/i, "") + ".docx";
      await api.downloadBlob("/api/resume/download/docx", name);
      toast.success("DOCX downloaded ✦");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "DOCX download failed."); }
    finally { setDownloading(null); }
  };

  // ── Version actions ──────────────────────────────────────
  const handleSaveVersion = async (label?: string) => {
    const version = store.saveVersion(label);
    try {
      await api.post("/api/resume/versions", { label: version.label, sections: store.sections });
      toast.success("Version saved ✦");
    } catch { toast.error("Failed to save version."); }
  };

  const handleDeleteVersion = async (id: string) => {
    store.deleteVersion(id);
    try { await api.delete(`/api/resume/versions/${id}`); }
    catch { toast.error("Failed to delete version."); }
  };

  // ── Section nav ──────────────────────────────────────────
  const scrollToSection = (section: string) => {
    setActiveSection(section);
    document.getElementById(`section-${section.toLowerCase()}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── AI edit — switch to preview, then mark AI edits done so we show React preview ──
  const submitAIEdit = useCallback(async (prompt: string) => {
    setViewMode("preview");
    await submitAIEditRaw(prompt);
    setHasAIEdits(true); // switch from original PDF iframe to live React preview
  }, [submitAIEditRaw]);

  // ── Derived ATS values ───────────────────────────────────
  const ats = store.ats;
  const atsScore = ats?.score ?? 0;
  const r = 40;
  const SECTIONS = ["Summary", "Experience", "Education", "Skills", "Projects"] as const;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left panel ─────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-border/60 bg-surface-1 p-4 overflow-y-auto">
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" aria-label="Upload resume PDF" onChange={handleFileChange} />

        {/* Upload zone */}
        {resumeFile ? (
          <div className="border-2 border-dashed border-green-500/40 rounded-2xl p-4 bg-surface-2 text-center mb-4">
            <FileText className="w-8 h-8 text-green-500 mx-auto mb-1" />
            <p className="text-foreground text-xs font-medium truncate mb-2 px-1" title={resumeFile.file_name}>{resumeFile.file_name}</p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs text-blue-electric hover:underline">Replace</button>
              <span className="text-white-30 text-xs">|</span>
              <button type="button" onClick={handleDelete} className="text-xs text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={() => setIsDragging(false)}
            className={`w-full border-2 border-dashed rounded-2xl p-6 bg-surface-2 text-center mb-4 cursor-pointer transition-colors ${isDragging ? "border-blue-electric bg-blue-electric/5" : "border-blue-electric/30 hover:border-blue-electric"} ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <><div className="w-6 h-6 border-2 border-blue-electric border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-white-60 text-xs">Uploading…</p></>
            ) : (
              <><Upload className="w-8 h-8 text-blue-electric mx-auto mb-2" /><p className="text-white-60 text-sm">Drop resume PDF</p><p className="text-white-30 text-xs mt-1">or click to browse</p></>
            )}
          </button>
        )}

        {/* Dirty indicator */}
        {store.isDirty && (
          <p className="text-xs text-amber-400 text-center mb-3 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Saving…
          </p>
        )}

        {/* Section nav — only useful when showing the AI-edited React preview or editor */}
        {hasAIEdits && (
          <nav className="space-y-1 flex-1">
            {SECTIONS.map((s) => (
              <button type="button" key={s} onClick={() => scrollToSection(s)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === s ? "bg-blue-electric/10 text-blue-electric border-l-[3px] border-blue-electric" : "text-white-60 hover:bg-surface-2"}`}
              >{s}</button>
            ))}
          </nav>
        )}

        {/* When showing original PDF: hint to use the AI bar */}
        {!hasAIEdits && resumeFile && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-2 py-4 text-center">
            <Sparkles className="w-7 h-7 text-blue-electric opacity-70" />
            <p className="text-white-60 text-xs leading-relaxed">
              Type a prompt below to let Gemini AI update your resume
            </p>
          </div>
        )}

        {/* Template picker — only after AI edits */}
        {hasAIEdits && (
          <div className="mt-4">
            <button type="button" onClick={() => setShowTemplates((p) => !p)}
              className="w-full flex items-center gap-2 text-xs text-white-60 hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors">
              <Palette className="w-3.5 h-3.5" />
              <span>Template: <span className="text-blue-electric capitalize">{store.template}</span></span>
            </button>
            {showTemplates && (
              <div className="mt-1.5 space-y-1">
                {TEMPLATES.map((t) => (
                  <button type="button" key={t.id}
                    onClick={() => { store.setTemplate(t.id); setShowTemplates(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${store.template === t.id ? "bg-blue-electric/10 text-blue-electric" : "text-white-60 hover:bg-surface-2"}`}>
                    {t.id === store.template && <Check className="w-3 h-3 inline mr-1.5" />}{t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Downloads */}
        <div className="space-y-2 mt-4">
          <button type="button" onClick={handleDownloadPDF}
            disabled={!resumeFile || exporting}
            className="w-full bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export PDF
          </button>
          <button type="button" onClick={handleDownloadDOCX} disabled={!hasParsed || downloading === "docx"}
            className="w-full border border-blue-border text-white-60 hover:text-foreground text-sm py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
            {downloading === "docx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} DOCX
          </button>
        </div>
      </div>

      {/* ── Center panel ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-surface-1 shrink-0">
          <h2 className="font-display font-bold text-lg text-foreground">Resume Editor</h2>
          <div className="flex items-center gap-3">
            {/* Status badges */}
            {!hasAIEdits && resumeFile && (
              <span className="text-xs text-blue-electric/80 bg-blue-electric/10 px-2.5 py-1 rounded-full">Original PDF</span>
            )}
            {hasAIEdits && store.isDirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            {hasAIEdits && !store.isDirty && (
              <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
            )}
            {/* View toggle — Edit only available after AI edits */}
            {hasAIEdits && (
              <div className="flex bg-surface-2 rounded-lg p-0.5 border border-border/60">
                <button type="button" onClick={() => setViewMode("editor")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "editor" ? "bg-blue-electric text-white shadow-sm" : "text-white-60 hover:text-foreground"}`}>
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "preview" ? "bg-blue-electric text-white shadow-sm" : "text-white-60 hover:text-foreground"}`}>
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
            )}
            {hasAIEdits && (
              <button type="button" onClick={() => setShowVersions((p) => !p)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${showVersions ? "bg-blue-electric/10 text-blue-electric border-blue-electric/30" : "text-white-60 hover:text-foreground border-border/60"}`}>
                <BookOpen className="w-3.5 h-3.5" /> Versions
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Loading state */}
          {(loadingParsed || (resumeFile && loadingPdf && !pdfBlobUrl)) && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 text-blue-electric animate-spin" />
              <p className="text-white-60 text-sm">Loading your resume…</p>
            </div>
          )}

          {/* Empty state */}
          {!resumeFile && !loadingParsed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <FileText className="w-16 h-16 text-white-30" />
              <div>
                <p className="text-foreground font-semibold text-lg">No resume uploaded</p>
                <p className="text-white-60 text-sm mt-1">Upload a PDF to start editing with AI</p>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* EDITOR MODE — only after AI edits (sections are reliable) */}
            {resumeFile && hasParsed && viewMode === "editor" && (
              <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full overflow-y-auto">
                <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-8">
                  <div id="section-summary">
                    <SectionHeader icon={<FileText className="w-5 h-5 text-blue-electric" />} title="Summary" />
                    <SummaryEditor summary={store.sections.summary} dispatch={dispatch} />
                  </div>
                  <div id="section-experience">
                    <SectionHeader icon={<FileText className="w-5 h-5 text-blue-electric" />} title="Experience" />
                    <ExperienceEditor experience={store.sections.experience} dispatch={dispatch} />
                  </div>
                  <div id="section-education">
                    <SectionHeader icon={<GraduationCap className="w-5 h-5 text-blue-electric" />} title="Education" />
                    <EducationEditor education={store.sections.education} dispatch={dispatch} />
                  </div>
                  <div id="section-skills">
                    <SectionHeader icon={<Code2 className="w-5 h-5 text-blue-electric" />} title="Skills" />
                    <SkillsEditor skills={store.sections.skills} dispatch={dispatch} />
                  </div>
                  <div id="section-projects">
                    <SectionHeader icon={<FolderOpen className="w-5 h-5 text-blue-electric" />} title="Projects" />
                    <ProjectsEditor projects={store.sections.projects} dispatch={dispatch} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* PREVIEW MODE */}
            {resumeFile && viewMode === "preview" && !loadingPdf && (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full">
                {!hasAIEdits && pdfBlobUrl ? (
                  // ── Original PDF: show exact uploaded file in iframe ──
                  <iframe
                    src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title="Your Resume"
                    className="w-full h-full border-0 bg-white"
                    style={{ display: "block" }}
                  />
                ) : hasParsed ? (
                  // ── AI-edited: show React-rendered preview ──
                  <div className="h-full overflow-y-auto flex justify-center p-6 bg-gray-200">
                    <div className="shadow-2xl">
                      <ResumePreview sections={store.sections} template={store.template} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-blue-electric animate-spin" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Prompt bar — visible whenever a resume is loaded */}
        {resumeFile && (
          <AIPromptBar
            onSubmit={submitAIEdit}
            onUndo={store.undo}
            onRedo={store.redo}
            canUndo={canUndo}
            canRedo={canRedo}
            isEditing={store.isAIEditing}
            streamText={store.aiStreamText}
            aiHistory={store.aiHistory}
          />
        )}
      </div>

      {/* ── Right panel ─────────────────────────────────── */}
      <div className="w-80 shrink-0 border-l border-border/60 bg-surface-1 overflow-y-auto p-5 space-y-6">

        {/* ATS Score */}
        <div className="text-center">
          <h3 className="font-display font-semibold text-foreground text-base mb-3">✦ ATS Score</h3>
          {hasParsed && ats ? (
            <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
              <circle cx="60" cy="60" r={r + 8} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="7" />
              <motion.circle cx="60" cy="60" r={r + 8} fill="none" stroke="url(#ats-grad)" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={2 * Math.PI * (r + 8)}
                initial={{ strokeDashoffset: 2 * Math.PI * (r + 8) }}
                animate={{ strokeDashoffset: 2 * Math.PI * (r + 8) - (atsScore / 100) * 2 * Math.PI * (r + 8) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
              <defs><linearGradient id="ats-grad"><stop offset="0%" stopColor="hsl(var(--blue-electric))" /><stop offset="100%" stopColor="hsl(var(--cyan-spark))" /></linearGradient></defs>
              <text x="60" y="56" textAnchor="middle" className="fill-foreground font-mono font-bold text-3xl">{atsScore}</text>
              <text x="60" y="72" textAnchor="middle" className="fill-white-60 text-sm">{ats.label}</text>
            </svg>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="w-16 h-16 rounded-full border-4 border-surface-3 flex items-center justify-center"><span className="text-white-30 font-mono font-bold text-xl">—</span></div>
              <p className="text-white-30 text-sm">Upload a resume to see score</p>
            </div>
          )}
        </div>

        {/* Issues */}
        {ats?.issues && ats.issues.length > 0 && (
          <div>
            <h4 className="font-display font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Top Issues</h4>
            <div className="space-y-2.5">
              {ats.issues.map((issue) => (
                <div key={issue.text} className="flex items-center gap-2.5 text-sm">
                  {issue.type === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> : <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <span className="text-foreground text-xs">{issue.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        {ats && (
          <div>
            <h4 className="font-display font-semibold text-foreground text-sm mb-2 uppercase tracking-wider">Keywords Found</h4>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ats.keywords.found.map((kw) => (
                <span key={kw} className="bg-emerald-500/10 text-emerald-500 text-xs px-2.5 py-1 rounded-full font-medium">{kw}</span>
              ))}
            </div>
            {ats.keywords.missing.length > 0 && (
              <>
                <h4 className="font-display font-semibold text-foreground text-sm mb-2 uppercase tracking-wider mt-3">Missing</h4>
                <div className="flex flex-wrap gap-1.5">
                  {ats.keywords.missing.map((kw) => (
                    <span key={kw} className="bg-amber-500/10 text-amber-500 text-xs px-2.5 py-1 rounded-full font-medium">{kw}</span>
                  ))}
                </div>
              </>
            )}
            <KeywordProgress matched={ats.keywords.matched} total={ats.keywords.total} />
          </div>
        )}

        {/* Job Description Matching */}
        {hasParsed && (
          <div className="border-t border-border/40 pt-4">
            <JobDescriptionPanel />
          </div>
        )}

        {/* Version history */}
        {showVersions && (
          <div className="border-t border-border/40 pt-4">
            <VersionHistory
              versions={store.versions}
              current={store.sections}
              onRestore={(v) => { store.restoreVersion(v.sections); toast.success(`Restored "${v.label}"`); }}
              onDelete={handleDeleteVersion}
              onSave={handleSaveVersion}
            />
          </div>
        )}
      </div>

      {/* ── Hidden A4 preview for PDF export (always in DOM) ── */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 w-[794px] pointer-events-none">
        <ResumePreview sections={store.sections} template={store.template} id={PDF_PREVIEW_ID} />
      </div>
    </div>
  );
};

/** Sets the CSS variable imperatively via DOM API — avoids any JSX style prop. */
function KeywordProgress({ matched, total }: Readonly<{ matched: number; total: number }>) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackRef.current?.style.setProperty("--kw-pct", `${pct}%`);
  }, [pct]);

  return (
    <div className="flex items-center gap-2.5 text-xs mt-3">
      <span className="text-white-60">Matched: {matched}/{total}</span>
      <div ref={trackRef} className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div className="h-full bg-blue-electric rounded-full transition-all w-[var(--kw-pct)]" />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title }: Readonly<{ icon: React.ReactNode; title: string }>) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-1 h-6 bg-blue-electric rounded-full" />
      {icon}
      <h3 className="font-display font-semibold text-foreground text-lg">{title}</h3>
    </div>
  );
}

export default Resume;
