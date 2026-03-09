import { motion } from "framer-motion";
import { Upload, Download, Check, AlertTriangle, FileText, GraduationCap, Code2, FolderOpen, Trash2, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────
interface ExperienceEntry {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}
interface EducationEntry {
  degree: string;
  school: string;
  dates: string;
  gpa: string;
  courses: string[];
}
interface SkillGroup {
  category: string;
  items: string[];
}
interface ProjectEntry {
  name: string;
  description: string;
  tech: string[];
}
interface ParsedSections {
  summary: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  projects: ProjectEntry[];
}
interface ATSResult {
  score: number;
  label: string;
  issues: { type: "warning" | "success"; text: string }[];
  keywords: { found: string[]; missing: string[]; total: number; matched: number };
}
interface ParsedData {
  sections: ParsedSections;
  ats: ATSResult;
}

const allSections = ["Summary", "Experience", "Education", "Skills", "Projects"];
const sectionRefs: Record<string, string> = {
  Summary: "section-summary",
  Experience: "section-experience",
  Education: "section-education",
  Skills: "section-skills",
  Projects: "section-projects",
};

// ── Component ──────────────────────────────────────────────────
const Resume = () => {
  const { token } = useAuth();
  const r = 40;

  const [activeSection, setActiveSection] = useState("Summary");
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resumeFile, setResumeFile] = useState<{ file_name: string; storage_path: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [loadingParsed, setLoadingParsed] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch existing resume on mount ──────────────────────
  useEffect(() => {
    if (!token) return;
    api.get<{ resume: { file_name: string; storage_path: string } | null }>("/api/resume")
      .then(data => { if (data.resume) setResumeFile(data.resume); })
      .catch(() => { });
  }, [token]);

  // ── Fetch parsed data when resume exists ────────────────
  useEffect(() => {
    if (!token || !resumeFile) {
      setParsed(null);
      return;
    }
    setLoadingParsed(true);
    api.get<{ parsed: ParsedData | null }>("/api/resume/parsed")
      .then(data => { if (data.parsed) setParsed(data.parsed); })
      .catch(() => { })
      .finally(() => setLoadingParsed(false));
  }, [token, resumeFile]);

  // ── Tab switching + scroll to section ───────────────────
  const handleTabClick = (section: string) => {
    setActiveSection(section);
    const el = document.getElementById(sectionRefs[section]);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Upload logic ─────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      return;
    }

    setUploading(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const meta = await api.post<{ resume: { file_name: string; storage_path: string }; parsed: ParsedData | null }>(
        "/api/resume/upload",
        { fileName: file.name, fileData }
      );

      setResumeFile(meta.resume);
      if (meta.parsed) setParsed(meta.parsed);
      toast.success(`"${file.name}" uploaded successfully ✦`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }, []);

  // ── Drag & drop handlers ─────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  // ── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm("Delete your uploaded resume? This cannot be undone.")) return;
    try {
      await api.delete("/api/resume");
      setResumeFile(null);
      setParsed(null);
      toast.success("Resume deleted.");
    } catch (err: any) {
      toast.error(err.message || "Delete failed.");
    }
  };

  // ── Downloads ─────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setDownloading("pdf");
    try {
      await api.downloadBlob("/api/resume/download/pdf", resumeFile?.file_name || "resume.pdf");
      toast.success("PDF downloaded ✦");
    } catch (err: any) {
      toast.error(err.message || "PDF download failed.");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDOCX = async () => {
    setDownloading("docx");
    try {
      const docxName = (resumeFile?.file_name || "resume").replace(/\.pdf$/i, "") + ".docx";
      await api.downloadBlob("/api/resume/download/docx", docxName);
      toast.success("DOCX downloaded ✦");
    } catch (err: any) {
      toast.error(err.message || "DOCX download failed.");
    } finally {
      setDownloading(null);
    }
  };

  // ── Computed values from parsed data ──────────────────────
  const sections = parsed?.sections;
  const ats = parsed?.ats;
  const atsScore = ats?.score ?? 0;
  const atsLabel = ats?.label ?? "—";
  const issues = ats?.issues ?? [];
  const keywordsFound = ats?.keywords?.found ?? [];
  const keywordsMissing = ats?.keywords?.missing ?? [];
  const keywordsTotal = ats?.keywords?.total ?? 0;
  const keywordsMatched = ats?.keywords?.matched ?? 0;
  const hasParsed = !!parsed && !!sections;

  // ── Bullet strength helper ────────────────────────────────
  const bulletStrength = (text: string): "good" | "medium" => {
    return /\d/.test(text) ? "good" : "medium";
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel */}
      <div className="lg:w-56 p-4 border-b lg:border-b-0 lg:border-r border-border/60 bg-surface-1 shrink-0 flex flex-col">

        {/* Upload zone */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {resumeFile ? (
          // Uploaded state
          <div className="border-2 border-dashed border-green-500/40 rounded-2xl p-4 bg-surface-2 text-center mb-4">
            <FileText className="w-8 h-8 text-green-500 mx-auto mb-1" />
            <p className="text-foreground text-xs font-medium truncate mb-2 px-1" title={resumeFile.file_name}>
              {resumeFile.file_name}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-blue-electric hover:underline"
              >
                Replace
              </button>
              <span className="text-white-30 text-xs">|</span>
              <button
                onClick={handleDelete}
                className="text-xs text-red-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        ) : (
          // Drop zone
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 bg-surface-2 text-center mb-4 cursor-pointer transition-colors ${isDragging
              ? "border-blue-electric bg-blue-electric/5"
              : "border-blue-electric/30 hover:border-blue-electric"
              } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-electric border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-white-60 text-xs">Uploading…</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-blue-electric mx-auto mb-2" />
                <p className="text-white-60 text-sm">Drop resume PDF</p>
                <p className="text-white-30 text-xs mt-1">or click to browse</p>
              </>
            )}
          </div>
        )}

        {/* Section tabs */}
        <nav className="space-y-1 hidden lg:block flex-1">
          {allSections.map((s) => (
            <button
              key={s}
              onClick={() => handleTabClick(s)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === s
                ? "bg-blue-electric/10 text-blue-electric border-l-[3px] border-blue-electric"
                : "text-white-60 hover:bg-surface-2"
                }`}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex gap-2 mt-6">
          <button
            onClick={handleDownloadPDF}
            disabled={!resumeFile || downloading === "pdf"}
            className="flex-1 bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </button>
          <button
            onClick={handleDownloadDOCX}
            disabled={!hasParsed || downloading === "docx"}
            className="flex-1 border border-blue-border text-white-60 hover:text-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading === "docx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} DOCX
          </button>
        </div>
      </div>

      {/* Center - editor */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-surface-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-foreground">Resume Editor</h2>
            {hasParsed && (
              <span className="flex items-center gap-1.5 text-success text-sm">
                <div className="w-2 h-2 rounded-full bg-success" /> Parsed
              </span>
            )}
          </div>

          {/* Loading state */}
          {loadingParsed && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-blue-electric animate-spin" />
              <p className="text-white-60">Parsing your resume…</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingParsed && !hasParsed && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <FileText className="w-16 h-16 text-white-30" />
              <div>
                <p className="text-foreground font-semibold text-lg">No resume uploaded</p>
                <p className="text-white-60 text-sm mt-1">Upload a PDF resume to see your parsed sections, ATS score, and analysis</p>
              </div>
            </div>
          )}

          {/* Dynamic resume sections */}
          {hasParsed && sections && (
            <>
              {/* ── Summary ── */}
              <div id="section-summary">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-6 bg-blue-electric rounded-full" />
                  <h3 className="font-display font-semibold text-foreground text-lg">Summary</h3>
                </div>
                <div className="bg-white border border-gray-200/60 rounded-xl p-5 text-foreground text-base leading-relaxed shadow-sm">
                  {sections.summary || <span className="text-white-30 italic">No summary section detected in your resume</span>}
                </div>
              </div>

              {/* ── Experience ── */}
              <div id="section-experience">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-6 bg-blue-electric rounded-full" />
                  <h3 className="font-display font-semibold text-foreground text-lg">Experience</h3>
                </div>
                {sections.experience.length > 0 ? (
                  <div className="space-y-4">
                    {sections.experience.map((exp, idx) => (
                      <div key={idx} className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-foreground font-semibold text-base">{exp.title}</p>
                            <p className="text-white-60 text-sm">
                              {exp.company}{exp.company && exp.dates ? " · " : ""}{exp.dates}
                            </p>
                          </div>
                          {exp.dates && exp.dates.toLowerCase().includes("present") && (
                            <span className="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-medium">Current</span>
                          )}
                        </div>
                        {exp.bullets.length > 0 && (
                          <ul className="space-y-2.5">
                            {exp.bullets.map((bullet, i) => (
                              <li key={i} className="flex gap-2.5 text-base text-foreground">
                                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${bulletStrength(bullet) === "good" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm text-white-30 italic">
                    No experience section detected in your resume
                  </div>
                )}
              </div>

              {/* ── Education ── */}
              <div id="section-education">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-6 bg-blue-electric rounded-full" />
                  <GraduationCap className="w-5 h-5 text-blue-electric" />
                  <h3 className="font-display font-semibold text-foreground text-lg">Education</h3>
                </div>
                {sections.education.length > 0 ? (
                  <div className="space-y-4">
                    {sections.education.map((edu, idx) => (
                      <div key={idx} className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-foreground font-semibold text-base">{edu.degree}</p>
                            <p className="text-white-60 text-sm">
                              {edu.school}{edu.school && edu.dates ? " · " : ""}{edu.dates}
                            </p>
                          </div>
                          {edu.gpa && (
                            <span className="bg-blue-50 text-blue-electric text-xs px-2.5 py-1 rounded-full font-medium">GPA: {edu.gpa}</span>
                          )}
                        </div>
                        {edu.courses.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-white-60 text-sm">Relevant coursework:</span>
                            {edu.courses.map((course) => (
                              <span key={course} className="bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">{course}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm text-white-30 italic">
                    No education section detected in your resume
                  </div>
                )}
              </div>

              {/* ── Skills ── */}
              <div id="section-skills">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-6 bg-blue-electric rounded-full" />
                  <Code2 className="w-5 h-5 text-blue-electric" />
                  <h3 className="font-display font-semibold text-foreground text-lg">Skills</h3>
                </div>
                {sections.skills.length > 0 ? (
                  <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                    <div className="space-y-4">
                      {sections.skills.map((group) => (
                        <div key={group.category}>
                          <p className="text-white-60 text-sm font-medium mb-2">{group.category}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.items.map((skill) => (
                              <span key={skill} className="bg-blue-electric/8 text-blue-electric text-sm px-3 py-1.5 rounded-lg font-medium">{skill}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm text-white-30 italic">
                    No skills section detected in your resume
                  </div>
                )}
              </div>

              {/* ── Projects ── */}
              <div id="section-projects">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1 h-6 bg-blue-electric rounded-full" />
                  <FolderOpen className="w-5 h-5 text-blue-electric" />
                  <h3 className="font-display font-semibold text-foreground text-lg">Projects</h3>
                </div>
                {sections.projects.length > 0 ? (
                  <div className="space-y-4">
                    {sections.projects.map((proj, idx) => (
                      <div key={idx} className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                        <p className="text-foreground font-semibold text-base mb-2">{proj.name}</p>
                        {proj.description && (
                          <p className="text-white-60 text-sm mb-3">{proj.description}</p>
                        )}
                        {proj.tech.length > 0 && (
                          <div className="flex gap-2">
                            {proj.tech.map((t) => (
                              <span key={t} className="bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm text-white-30 italic">
                    No projects section detected in your resume
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Right panel - AI analysis */}
      <div className="lg:w-80 p-5 border-t lg:border-t-0 lg:border-l border-border/60 bg-surface-1 shrink-0 overflow-y-auto">
        {/* ATS Score */}
        <div className="text-center mb-6">
          <h3 className="font-display font-semibold text-foreground text-base mb-3">✦ ATS Score</h3>
          {hasParsed ? (
            <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto">
              <circle cx="60" cy="60" r={r + 8} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="7" />
              <motion.circle
                cx="60" cy="60" r={r + 8}
                fill="none"
                stroke="url(#ats-gradient)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * (r + 8)}
                initial={{ strokeDashoffset: 2 * Math.PI * (r + 8) }}
                animate={{ strokeDashoffset: 2 * Math.PI * (r + 8) - (atsScore / 100) * 2 * Math.PI * (r + 8) }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
              <defs>
                <linearGradient id="ats-gradient">
                  <stop offset="0%" stopColor="hsl(var(--blue-electric))" />
                  <stop offset="100%" stopColor="hsl(var(--cyan-spark))" />
                </linearGradient>
              </defs>
              <text x="60" y="56" textAnchor="middle" className="fill-foreground font-mono font-bold text-3xl">{atsScore}</text>
              <text x="60" y="72" textAnchor="middle" className="fill-white-60 font-body text-sm">{atsLabel}</text>
            </svg>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="w-16 h-16 rounded-full border-4 border-surface-3 flex items-center justify-center">
                <span className="text-white-30 font-mono font-bold text-xl">—</span>
              </div>
              <p className="text-white-30 text-sm">Upload a resume to see your score</p>
            </div>
          )}
        </div>

        {/* Issues */}
        <div className="mb-6">
          <h4 className="font-display font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Top Issues</h4>
          {issues.length > 0 ? (
            <div className="space-y-2.5">
              {issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  {issue.type === "warning"
                    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    : <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  <span className="text-foreground">{issue.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white-30 text-sm">No analysis yet</p>
          )}
        </div>

        {/* Keywords */}
        <div className="mb-6">
          <h4 className="font-display font-semibold text-foreground text-sm mb-2 uppercase tracking-wider">Keywords Found</h4>
          {hasParsed ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {keywordsFound.map((kw) => (
                  <span key={kw} className="bg-emerald-500/10 text-emerald-500 text-sm px-3 py-1 rounded-full font-medium">{kw}</span>
                ))}
              </div>
              {keywordsMissing.length > 0 && (
                <>
                  <h4 className="font-display font-semibold text-foreground text-sm mb-2 uppercase tracking-wider mt-4">Missing Keywords</h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {keywordsMissing.map((kw) => (
                      <span key={kw} className="bg-amber-500/10 text-amber-500 text-sm px-3 py-1 rounded-full font-medium">{kw}</span>
                    ))}
                  </div>
                </>
              )}
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-white-60">Matched: {keywordsMatched}/{keywordsTotal}</span>
                <div className="flex-1 h-2 bg-surface-3 rounded-full">
                  <div className="h-full bg-blue-electric rounded-full" style={{ width: `${keywordsTotal > 0 ? Math.round((keywordsMatched / keywordsTotal) * 100) : 0}%` }} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-white-30 text-sm">Upload a resume to see keyword analysis</p>
          )}
        </div>

        {/* AI Rewrite tip */}
        {hasParsed && (
          <div className="glass-card p-5 rounded-xl">
            <h4 className="font-display font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">💡 Tips</h4>
            <div className="space-y-2 text-sm">
              {atsScore < 60 && (
                <p className="text-white-60">• Add more quantified achievements (numbers, percentages, metrics) to your bullet points</p>
              )}
              {keywordsMissing.length > 3 && (
                <p className="text-white-60">• Consider adding these missing keywords: {keywordsMissing.slice(0, 3).join(", ")}</p>
              )}
              {sections && sections.summary.length < 50 && (
                <p className="text-white-60">• Add a strong professional summary at the top of your resume</p>
              )}
              {atsScore >= 80 && (
                <p className="text-emerald-500 font-medium">✦ Your resume looks great! Keep it updated with your latest achievements.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resume;
