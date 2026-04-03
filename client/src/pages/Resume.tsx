import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, ChevronRight, Download, Bot, Sparkles, Code2, AlertTriangle, LayoutTemplate, Briefcase, Minus, Plus, RefreshCw, Loader2, Info, Building2, MapPin, Search, ArrowRight, Eye, Trash2, GraduationCap, FolderOpen, Check, Share2, Pencil, Type, ExternalLink, TrendingUp, BookOpen, ChevronDown, ChevronUp, Target } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ShareScoreModal } from "@/components/ShareScoreModal";
import { ScorePanel } from "@/components/ScorePanel";
import { ResumeChatbot } from "@/components/ResumeChatbot";
import { ResumePDFViewer } from "@/components/ResumePDFViewer";

interface CourseLink { platform: string; title: string; url: string; duration: string; isFree: boolean; }
interface LearningRec { skill: string; courses: CourseLink[]; salaryImpactINR: string; salaryImpactUSD: string; }
interface GapRoadmapItem { skill: string; priority?: string; action: string; timeframe: string; reason?: string; }
interface GapSalary { estimated: string; estimatedINR?: string; marketRate: string; negotiationLeverage: string; }
interface GapAnalysisResult {
  matchScore: number; levelMatch: string; missingKeywords: string[]; foundKeywords: string[];
  analysis: string; salary: GapSalary; roadmap: GapRoadmapItem[];
}

// ── Interview Prep Interfaces ──
interface InterviewQuestion { question: string; skill?: string; suggestedAnswer: string; }
interface InterviewCategory { title: string; questions: InterviewQuestion[]; }

interface ExperienceEntry { title: string; company: string; dates: string; bullets: string[]; }
interface EducationEntry { degree: string; school: string; dates: string; gpa: string; courses: string[]; }
interface SkillGroup { category: string; items: string[]; }
interface ProjectEntry { name: string; description: string; tech: string[]; }
interface ParsedSections { summary: string; experience: ExperienceEntry[]; education: EducationEntry[]; skills: SkillGroup[]; projects: ProjectEntry[]; }
// ── ATS Simulator Interfaces ──
interface ATSParsedField { extracted: string | string[] | null; status: "success" | "warning" | "dropped"; suggestion?: string; }
interface ATSSimulationResult {
  platform: "Greenhouse" | "Lever";
  fields: {
    name: ATSParsedField; email: ATSParsedField; phone: ATSParsedField; location: ATSParsedField; links: ATSParsedField;
    experience: ATSParsedField; education: ATSParsedField; skills: ATSParsedField;
    keywords?: { extracted: string; status: "success" | "warning" | "dropped"; suggestion?: string; matched: string[]; missing: string[] };
  };
  score: { total: number; breakdown: { base: number; penalties: { [key: string]: number } } };
  overallScore?: number; // fallback for linter
}

interface ATSResult {
  score: number;
  label: string;
  atsRisk?: string;
  abVariant?: string;
  issues: any[];
  keywords?: any;
  inferredSkills?: string[];
  indiaAtsScore?: number;
}

interface ParsedData { sections: ParsedSections; ats: ATSResult; rawText?: string; }
interface HistoryItem { id: string; fileName: string; createdAt: string; atsScore: number; parsedData: ParsedData; }

const allSections = ["Summary", "Experience", "Education", "Skills", "Projects"];
const sectionRefs: Record<string, string> = {
  Summary: "section-summary", Experience: "section-experience",
  Education: "section-education", Skills: "section-skills", Projects: "section-projects",
};

const Resume = () => {
  const { token, user } = useAuth();
  const userName = user?.fullName || user?.email?.split("@")[0] || "User";
  const r = 40;
  const [activeSection, setActiveSection] = useState("Summary");
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [resumeFile, setResumeFile] = useState<{ file_name: string; storage_path: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [loadingParsed, setLoadingParsed] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [compareWith, setCompareWith] = useState<HistoryItem | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Gap Analysis State ──
  const [showGapInput, setShowGapInput] = useState(false);
  const [jobDescText, setJobDescText] = useState("");
  const [gapLoading, setGapLoading] = useState(false);
  const [gapResult, setGapResult] = useState<GapAnalysisResult | null>(null);
  const [learningRecs, setLearningRecs] = useState<LearningRec[]>([]);

  // ── PDF Viewer State ──
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);

  // ── Create from Scratch State ──
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createData, setCreateData] = useState({
    Contact: "", Objective: "", Experience: "", Education: "", Skills: "", Projects: ""
  });

  // ── Interview Prep State ──
  const [showInterviewPrep, setShowInterviewPrep] = useState(false);
  const [interviewJobDesc, setInterviewJobDesc] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewResults, setInterviewResults] = useState<InterviewCategory[] | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});

  // ── ATS Simulator State ──
  const [showAtsSimulator, setShowAtsSimulator] = useState(false);
  const [atsSimJobDesc, setAtsSimJobDesc] = useState("");
  const [atsSimLoading, setAtsSimLoading] = useState(false);
  const [atsSimResult, setAtsSimResult] = useState<{ greenhouse: ATSSimulationResult; lever: ATSSimulationResult } | null>(null);

  // ── Analyzing Sequence State ──
  const [showScoringSequence, setShowScoringSequence] = useState(false);
  const [scoringStep, setScoringStep] = useState(0);
  const SCORING_STEPS = [
    "Evaluating resume length...",
    "Identifying bullet points...",
    "Analyzing resume depth...",
    "Evaluating impact...",
    "Calculating ATS compatibility..."
  ];

  const handleAtsSimulation = async () => {
    if (!parsed?.rawText && !resumeFile) {
      toast.error("Please upload and parse a resume first.");
      return;
    }
    setAtsSimLoading(true);
    setAtsSimResult(null); // Reset results before fetching
    try {
      const result = await api.post<{ greenhouse: ATSSimulationResult; lever: ATSSimulationResult }>("/api/resume/simulate-ats", {
        jobDescription: atsSimJobDesc || jobDescText, // Fallback to gap analysis JD
        // Notice we omit resumeText to rely on the backend auto-fetch capability for resilience
      });
      setAtsSimResult(result);
      toast.success("ATS simulation complete!");
    } catch (err: any) {
      toast.error(err.message || "Failed to run ATS simulation");
    } finally {
      setAtsSimLoading(false);
    }
  };

  const toggleAnswer = (catIdx: number, qIdx: number) => {
    setRevealedAnswers(prev => ({ ...prev, [`${catIdx}-${qIdx}`]: !prev[`${catIdx}-${qIdx}`] }));
  };

  const handleGenerateInterview = async () => {
    if (!parsed?.rawText) {
      toast.error("Please upload and parse a resume first.");
      return;
    }
    setInterviewLoading(true);
    setRevealedAnswers({}); // Reset revealed answers
    try {
      const { categories } = await api.post<{ categories: InterviewCategory[] }>("/api/interview/predict-interview-questions", {
        resumeText: parsed.rawText,
        jobDescription: interviewJobDesc || jobDescText // fallback to Gap Analysis JD if available
      });
      setInterviewResults(categories);
      toast.success("Interview questions generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate interview questions");
    } finally {
      setInterviewLoading(false);
    }
  };

  // Cleanup PDF URL on unmount
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  // Fetch PDF blob if we have a saved resume but no local file yet
  useEffect(() => {
    if (resumeFile && token && !pdfUrl) {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
      fetch(`${baseUrl}/api/resume/download/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load PDF blob");
        return res.blob();
      })
      .then(blob => {
        setPdfUrl(URL.createObjectURL(blob));
      })
      .catch(console.error);
    }
  }, [resumeFile, token, pdfUrl]);

  useEffect(() => {
    if (!token) return;
    api.get<{ resume: { file_name: string; storage_path: string } | null }>("/api/resume")
      .then(data => { if (data.resume) setResumeFile(data.resume); }).catch(() => { });

    // Fetch History for Phase 7
    api.get<{ history: HistoryItem[] }>("/api/resume/history")
      .then(data => setHistory(data.history || [])).catch(() => { });
  }, [token]);

  useEffect(() => {
    if (!token || !resumeFile || showScoringSequence) {
      if (!resumeFile) setParsed(null);
      return;
    }
    setLoadingParsed(true);
    api.get<{ parsed: ParsedData | null }>("/api/resume/parsed")
      .then(data => { if (data.parsed) setParsed(data.parsed); }).catch(() => { }).finally(() => setLoadingParsed(false));
  }, [token, resumeFile, showScoringSequence]);

  const handleTabClick = (section: string) => {
    setActiveSection(section);
    document.getElementById("pdf-viewer-container")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) { toast.error("Only PDF files are allowed."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File is too large. Maximum size is 10MB."); return; }
    setUploading(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const base64 = (reader.result as string).split(",")[1]; resolve(base64); };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      // Start fake loading sequence
      setShowScoringSequence(true);
      setScoringStep(0);

      const meta = await api.post<{ resume: { file_name: string; storage_path: string }; parsed: ParsedData | null }>("/api/resume/upload", { fileName: file.name, fileData });
      setResumeFile(meta.resume);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(file));

      // Run sequence steps
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step >= SCORING_STEPS.length) {
          clearInterval(interval);
          setShowScoringSequence(false);
          if (meta.parsed) setParsed(meta.parsed);
          toast.success(`"${file.name}" uploaded successfully ✦`);
          setUploading(false);
        } else {
          setScoringStep(step);
        }
      }, 800);

    } catch (err: any) {
      toast.error(err.message || "Upload failed. Please try again.");
      setUploading(false);
      setShowScoringSequence(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) uploadFile(file); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ""; };

  // ── Gap Analysis Handler ──
  const handleGapAnalysis = async () => {
    if (!jobDescText.trim()) { toast.error("Please paste a job description first."); return; }
    setGapLoading(true);
    try {
      const result = await api.post<{ gapAnalysis: GapAnalysisResult; learningRecommendations: LearningRec[] }>(
        "/api/resume/score-with-job", { jobDescription: jobDescText }
      );
      setGapResult(result.gapAnalysis);
      setLearningRecs(result.learningRecommendations || []);
      toast.success("Gap analysis complete!");
    } catch (err: any) {
      toast.error(err.message || "Gap analysis failed.");
    } finally {
      setGapLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete your uploaded resume? This cannot be undone.")) return;
    try { await api.delete("/api/resume"); setResumeFile(null); setParsed(null); toast.success("Resume deleted."); }
    catch (err: any) { toast.error(err.message || "Delete failed."); }
  };

  const handleDownloadPDF = async () => {
    setDownloading("pdf");
    try {
      if (resumeFile) {
        // Download original
        await api.downloadBlob("/api/resume/download/pdf", resumeFile.file_name || "resume.pdf");
        toast.success("PDF downloaded ✦");
      } else {
        toast.error("Nothing to download.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to download PDF");
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadDOCX = async () => {
    setDownloading("docx");
    try {
      const docxName = (resumeFile?.file_name || "resume").replace(/\.pdf$/i, "") + ".docx";
      await api.downloadBlob("/api/resume/download/docx", docxName); toast.success("DOCX downloaded ✦");
    } catch (err: any) { toast.error(err.message || "DOCX download failed."); }
    finally { setDownloading(null); }
  };

  const sections = parsed?.sections;
  const ats = parsed?.ats;
  const atsScore = ats?.score ?? 0;
  const atsLabel = ats?.label ?? "—";
  const atsRisk = ats?.atsRisk ?? "LOW";
  const abVariant = ats?.abVariant ?? "variant_a";
  const issues = ats?.issues ?? [];
  const keywordsFound = ats?.keywords?.found ?? [];
  const keywordsMissing = ats?.keywords?.missing ?? [];
  const keywordsTotal = ats?.keywords?.total ?? 0;
  const keywordsMatched = ats?.keywords?.matched ?? 0;
  const inferredSkills = ats?.inferredSkills ?? [];
  const indiaAtsScore = ats?.indiaAtsScore ?? 0;
  const hasParsed = !!parsed && !!sections;
  const bulletStrength = (text: string): "good" | "medium" => /\d/.test(text) ? "good" : "medium";

  const handleCreateSubmit = async () => {
    setCreateLoading(true);
    try {
      const result = await api.post<{ sections: ParsedSections, latex: string }>("/api/resume/create-new", {
        userData: createData,
        templateType: "IT"
      });
      setParsed({ sections: result.sections, ats: { score: 75, label: "Good", issues: [], atsRisk: "LOW", abVariant: "variant_a", inferredSkills: [] } });
      // Note: With the PDF viewer update, Latex generation is backend-only. 
      // The user would typically click "Export DOCX" or "PDF" to get the result.
      toast.success("Resume generated successfully!");
      setShowCreateFlow(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate resume.");
    } finally {
      setCreateLoading(false);
    }
  };

  if (showScoringSequence) {
    return (
      <div className="fixed inset-0 z-50 bg-[#1e1e2d] flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6">
          {SCORING_STEPS.map((text, idx) => {
            const isCompleted = scoringStep > idx;
            const isActive = scoringStep === idx;
            const isFuture = scoringStep < idx;

            return (
              <motion.div
                key={text}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: isFuture ? 0 : 1, y: isFuture ? 10 : 0 }}
                className="flex items-center gap-4"
              >
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isCompleted ? 'bg-emerald-500/10' : isActive ? 'bg-blue-electric/10' : 'bg-surface-2'}`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : isActive ? <Loader2 className="w-5 h-5 text-blue-electric animate-spin" /> : <div className="w-3 h-3 rounded-full bg-white-20" />}
                </div>
                <p className={`text-lg transition-colors ${isActive ? 'text-foreground font-medium' : isCompleted ? 'text-white-60' : 'text-white-30'}`}>{text}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel */}
      <div className="lg:w-56 p-4 border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-surface-1 shrink-0 flex flex-col">
        <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
        {resumeFile ? (
          <div className="border-2 border-dashed border-emerald-500/40 rounded-2xl p-4 bg-surface-2 text-center mb-4">
            <FileText className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-foreground text-xs font-medium truncate mb-2 px-1" title={resumeFile.file_name}>{resumeFile.file_name}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs text-blue-electric hover:underline">Replace</button>
              <span className="text-white-30 text-xs">|</span>
              <button onClick={handleDelete} className="text-xs text-red-400 hover:underline flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          </div>
        ) : (
          <div
            role="button" tabIndex={0}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 bg-surface-2 text-center mb-4 cursor-pointer transition-colors ${isDragging ? "border-blue-electric bg-blue-electric/5" : "border-blue-electric/30 hover:border-blue-electric"} ${uploading ? "opacity-50 pointer-events-none" : ""}`}
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
        <nav className="space-y-1 hidden lg:block flex-1">
          {allSections.map((s) => (
            <button key={s} onClick={() => handleTabClick(s)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === s ? "bg-blue-electric/10 text-blue-electric border-l-[3px] border-blue-electric" : "text-white-60 hover:bg-surface-2"}`}
            >{s}</button>
          ))}
        </nav>
        <div className="hidden lg:flex gap-2 mt-6">
          <button onClick={handleDownloadPDF} disabled={!resumeFile || downloading === "pdf"}
            className="flex-1 bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {downloading === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </button>
          <button onClick={handleDownloadDOCX} disabled={!hasParsed || downloading === "docx"}
            className="flex-1 border border-blue-border text-white-60 hover:text-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {downloading === "docx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} DOCX
          </button>
        </div>
      </div>

      {/* Center - editor */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-surface-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between shrink-0 mb-6">
            <h2 className="font-display font-bold text-2xl text-foreground">Resume Editor</h2>
            <div className="flex items-center gap-3">
              {hasParsed && <span className="flex items-center gap-1.5 text-success text-sm"><div className="w-2 h-2 rounded-full bg-success" /> Parsed</span>}
              {hasParsed && pdfUrl && (
                <div className="flex bg-surface-3/50 p-1 rounded-lg border border-white/[0.06] items-center">
                  <button 
                    onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}
                    className="w-7 h-7 flex flex-col items-center justify-center rounded text-white-60 hover:text-white hover:bg-surface-2 transition-colors focus:outline-none"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-white-60 text-xs font-medium w-12 text-center pointer-events-none select-none">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}
                    className="w-7 h-7 flex flex-col items-center justify-center rounded text-white-60 hover:text-white hover:bg-surface-2 transition-colors focus:outline-none"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingParsed && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-blue-electric animate-spin" />
              <p className="text-white-60">Parsing your resume…</p>
            </div>
          )}

          {!loadingParsed && !hasParsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="flex flex-col items-center justify-center p-8 bg-surface-1 border border-white/[0.06] rounded-2xl text-center hover:border-blue-electric/30 transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 rounded-full bg-blue-electric/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-blue-electric" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">Upload Existing Resume</h3>
                <p className="text-white-60 text-sm mt-2">Upload a PDF to get an instant ATS score and AI analysis.</p>
              </div>

              <div className="relative flex flex-col items-center justify-center p-8 bg-surface-1 border border-emerald-500/20 rounded-2xl text-center hover:border-emerald-500/50 transition-colors cursor-pointer group"
                onClick={() => setShowCreateFlow(true)}>
                <div className="absolute top-4 right-4">
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border border-emerald-500/20">
                    New
                  </span>
                </div>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LayoutTemplate className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">Create from Scratch</h3>
                <p className="text-white-60 text-sm mt-2">Use our AI to generate an ATS-optimized LaTeX resume instantly.</p>
              </div>
            </div>
          )}

          {/* ── LIVE PDF VIEWER ── */}
          {hasParsed && pdfUrl && !loadingParsed && (
             <div className="flex-1 w-full bg-surface-1 rounded-xl shadow-xl overflow-hidden border border-white/[0.06] mb-8 min-h-[600px] flex text-foreground">
                <ResumePDFViewer fileUrl={pdfUrl} zoom={zoom} />
             </div>
          )}
        </motion.div>
      </div>

      {/* Right panel - AI analysis */}
      <div className="lg:w-80 p-5 border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-surface-1 shrink-0 overflow-y-auto print:static print:w-full print:border-none">

        {/* Phase 7: History Comparison Dropdown */}
        {hasParsed && history.length > 1 && (
          <div className="mb-6 bg-surface-2 p-3 rounded-xl border border-white/[0.06] print:hidden">
            <label className="text-xs font-medium text-white-60 uppercase tracking-wider mb-2 block">Compare vs History</label>
            <select
              className="w-full bg-surface-1 border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-foreground focus:border-blue-electric outline-none"
              onChange={(e) => {
                const selected = history.find(h => h.id === e.target.value);
                setCompareWith(selected || null);
              }}
            >
              <option value="">Current Version Only</option>
              {history.map(h => (
                <option key={h.id} value={h.id}>
                  {new Date(h.createdAt).toLocaleDateString()} - Score: {h.atsScore} ({h.fileName})
                </option>
              ))}
            </select>
            {compareWith && (
              <div className="mt-3 text-sm flex justify-between items-center bg-surface-3/50 px-3 py-2 rounded-lg">
                <span className="text-white-60">Prev Score: {compareWith.atsScore}</span>
                <span className={`font-semibold ${atsScore > compareWith.atsScore ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {atsScore > compareWith.atsScore ? '+' : ''}{atsScore - compareWith.atsScore} pts
                </span>
              </div>
            )}
          </div>
        )}

        {hasParsed && (
          <ScorePanel 
            hasParsed={hasParsed} 
            atsResult={ats as any} 
            onShare={() => setShowShareModal(true)} 
            onExport={() => window.print()} 
          />
        )}

        {/* ═══════ GAP ANALYSIS PANEL ═══════ */}
        {hasParsed && (
          <div className="mt-6 print:hidden">
            {/* Toggle Button */}
            <button
              onClick={() => setShowGapInput(p => !p)}
              className="w-full flex items-center justify-between gap-2 bg-violet-500/10 hover:bg-violet-500/15 text-violet-400 border border-violet-500/20 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
            >
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4" /> Skill Gap Analysis
              </span>
              {showGapInput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showGapInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={jobDescText}
                      onChange={e => setJobDescText(e.target.value)}
                      placeholder="Paste the job description here to analyze skill gaps..."
                      rows={5}
                      className="w-full bg-surface-2 border border-white/[0.08] rounded-xl p-3 text-sm text-foreground resize-none focus:border-violet-500 outline-none placeholder:text-white-20"
                    />
                    <button
                      onClick={handleGapAnalysis}
                      disabled={gapLoading || !jobDescText.trim()}
                      className="w-full bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {gapLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Target className="w-4 h-4" /> Analyze Gap</>}
                    </button>
                  </div>

                  {/* ── Gap Analysis Results ── */}
                  {gapResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-5">

                      {/* Match Score */}
                      <div className="text-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-lg font-bold border-2 ${gapResult.matchScore >= 75 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            gapResult.matchScore >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                              "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                          <Target className="w-5 h-5" /> {gapResult.matchScore}% Match
                        </div>
                        <p className="text-xs text-white-40 mt-1">{gapResult.levelMatch}</p>
                      </div>

                      {/* AI Analysis */}
                      <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-4">
                        <p className="text-sm text-white-80 leading-relaxed">{gapResult.analysis}</p>
                      </div>

                      {/* Salary Estimate */}
                      {gapResult.salary && (
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4 space-y-1">
                          <h5 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> Salary Estimate
                          </h5>
                          <p className="text-foreground font-semibold">{gapResult.salary.estimated}</p>
                          {gapResult.salary.estimatedINR && <p className="text-white-60 text-sm">{gapResult.salary.estimatedINR}</p>}
                          <p className="text-xs text-white-40">{gapResult.salary.negotiationLeverage}</p>
                        </div>
                      )}

                      {/* Missing Skills */}
                      {gapResult.missingKeywords.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Missing: {gapResult.missingKeywords.length} Skills
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {gapResult.missingKeywords.map(kw => (
                              <span key={kw} className="bg-rose-500/10 text-rose-400 text-xs px-2.5 py-1 rounded-full font-medium border border-rose-500/20">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Found Skills */}
                      {gapResult.foundKeywords.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Matched Skills
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {gapResult.foundKeywords.map(kw => (
                              <span key={kw} className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ═══════ LEARNING ROADMAP CARDS ═══════ */}
                      {learningRecs.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-electric" /> Learning Roadmap
                          </h5>
                          <div className="space-y-3">
                            {learningRecs.map((rec, idx) => {
                              const roadmapItem = gapResult.roadmap?.find(r => r.skill.toLowerCase() === rec.skill.toLowerCase());
                              return (
                                <div key={idx} className="bg-surface-2 border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                                  {/* Skill Header */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-foreground">Learn {rec.skill}</span>
                                      {roadmapItem?.priority && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${roadmapItem.priority === "HIGH" ? "bg-rose-500/15 text-rose-400" :
                                            roadmapItem.priority === "MEDIUM" ? "bg-amber-500/15 text-amber-400" :
                                              "bg-blue-500/15 text-blue-400"
                                          }`}>{roadmapItem.priority}</span>
                                      )}
                                    </div>
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                                      <TrendingUp className="w-2.5 h-2.5" /> {rec.salaryImpactINR}
                                    </span>
                                  </div>

                                  {/* Timeframe & Reason */}
                                  {roadmapItem && (
                                    <div className="text-xs text-white-40">
                                      ⏱ {roadmapItem.timeframe}{roadmapItem.reason && ` — ${roadmapItem.reason}`}
                                    </div>
                                  )}

                                  {/* Course Links */}
                                  <div className="space-y-1.5">
                                    {rec.courses.slice(0, 3).map((course, ci) => (
                                      <a
                                        key={ci}
                                        href={course.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs hover:bg-surface-3 rounded-lg px-2 py-1.5 transition-colors group/link"
                                      >
                                        <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${course.platform === "YouTube" || course.platform === "freeCodeCamp" ? "bg-red-500/15 text-red-400" :
                                            course.platform === "Udemy" ? "bg-violet-500/15 text-violet-400" :
                                              course.platform === "Coursera" ? "bg-blue-500/15 text-blue-400" :
                                                "bg-white/10 text-white-60"
                                          }`}>{course.platform}</span>
                                        <span className="text-white-80 group-hover/link:text-foreground flex-1 truncate">{course.title}</span>
                                        <span className="text-white-30 shrink-0">{course.duration}</span>
                                        {course.isFree && <span className="text-emerald-400 text-[9px] font-bold shrink-0">FREE</span>}
                                        <ExternalLink className="w-3 h-3 text-white-20 group-hover/link:text-blue-electric shrink-0" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══════ INTERVIEW PREP PANEL ═══════ */}
        {hasParsed && (
          <div className="mt-4 print:hidden mb-10">
            {/* Toggle Button */}
            <button
              onClick={() => setShowInterviewPrep(p => !p)}
              className="w-full flex items-center justify-between gap-2 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
            >
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Interview Prep
              </span>
              {showInterviewPrep ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showInterviewPrep && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={interviewJobDesc || jobDescText}
                      onChange={e => setInterviewJobDesc(e.target.value)}
                      placeholder="Paste the job description (or leave blank for general questions based on resume)..."
                      rows={5}
                      className="w-full bg-surface-2 border border-white/[0.08] rounded-xl p-3 text-sm text-foreground resize-none focus:border-indigo-500 outline-none placeholder:text-white-20"
                    />
                    <button
                      onClick={handleGenerateInterview}
                      disabled={interviewLoading}
                      className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {interviewLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Predict Questions</>}
                    </button>
                  </div>

                  {/* ── Interview Prep Results ── */}
                  {interviewResults && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-6">
                      {interviewResults.map((category, catIdx) => (
                        <div key={catIdx}>
                          <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5 pb-2 border-b border-white/[0.06]">
                            <Target className="w-3.5 h-3.5 text-indigo-400" /> {category.title}
                          </h5>

                          <div className="space-y-3">
                            {category.questions.map((q, qIdx) => {
                              const isRevealed = revealedAnswers[`${catIdx}-${qIdx}`];
                              return (
                                <div key={qIdx} className="bg-surface-2 border border-white/[0.06] rounded-xl overflow-hidden">
                                  {/* Question Header */}
                                  <div className="p-4">
                                    <div className="flex justify-between items-start gap-3">
                                      <p className="text-sm text-foreground font-medium leading-relaxed">{q.question}</p>
                                      {q.skill && (
                                        <span className="shrink-0 bg-surface-3 text-white-60 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-white/[0.06]">
                                          {q.skill}
                                        </span>
                                      )}
                                    </div>

                                    {/* Action Toggle */}
                                    <button
                                      onClick={() => toggleAnswer(catIdx, qIdx)}
                                      className="mt-3 text-xs font-semibold text-indigo-400 flex items-center gap-1.5 hover:text-indigo-300 transition-colors"
                                    >
                                      {isRevealed ? <Eye className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                      {isRevealed ? "Hide Strategy" : "Show Answer Strategy"}
                                    </button>
                                  </div>

                                  {/* Hidden Answer Strategy */}
                                  <AnimatePresence>
                                    {isRevealed && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                        className="bg-indigo-500/5 px-4 py-3 border-t border-indigo-500/10"
                                      >
                                        <p className="text-sm text-indigo-200/80 leading-relaxed italic">
                                          "{q.suggestedAnswer}"
                                        </p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══════ ATS SIMULATOR PANEL ═══════ */}
        {hasParsed && (
          <div className="mt-4 print:hidden mb-10">
            <button
              onClick={() => setShowAtsSimulator(p => !p)}
              className="w-full flex items-center justify-between gap-2 bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 border border-rose-500/20 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
            >
              <span className="flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" /> ATS Simulator
              </span>
              {showAtsSimulator ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <AnimatePresence>
              {showAtsSimulator && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={atsSimJobDesc}
                      onChange={e => setAtsSimJobDesc(e.target.value)}
                      placeholder="Paste job description here for keyword matching (Optional)..."
                      rows={4}
                      className="w-full bg-surface-2 border border-white/[0.08] rounded-xl p-3 text-sm text-foreground resize-none focus:border-rose-500 outline-none placeholder:text-white-20"
                    />
                    <button
                      onClick={handleAtsSimulation}
                      disabled={atsSimLoading}
                      className="w-full bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {atsSimLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Simulating ATS Drop...</> : <><Search className="w-4 h-4" /> Run Simulation</>}
                    </button>
                  </div>

                  {/* Results */}
                  {atsSimResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-5">

                      {/* Greenhouse Result Card */}
                      <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
                          <h4 className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5"><Building2 className="w-4 h-4 text-emerald-400" /> Greenhouse ATS</h4>
                          <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-bold">Score: {atsSimResult.greenhouse.overallScore}</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(atsSimResult.greenhouse.fields).filter(([k, v]) => v.status === "warning" || v.status === "dropped").length > 0 ? (
                            Object.entries(atsSimResult.greenhouse.fields).filter(([k, v]) => v.status === "warning" || v.status === "dropped").map(([key, field]) => (
                              <div key={`gh-${key}`} className="flex flex-col gap-1 text-xs mb-2">
                                <div className="flex items-center gap-1.5 opacity-80">
                                  {field.status === "dropped" ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Info className="w-3.5 h-3.5 text-amber-400" />}
                                  <span className="text-white capitalize">{key}</span>
                                </div>
                                <span className="text-white-60 leading-relaxed pl-5">{field.suggestion || "Missing required structure."}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Passed Greenhouse Structural Checks
                            </p>
                          )}

                          {atsSimResult.greenhouse.fields.keywords && atsSimResult.greenhouse.fields.keywords.status !== "success" && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06]">
                              <p className="text-rose-400 text-xs font-medium mb-1.5">Missing Core Keywords:</p>
                              <div className="flex flex-wrap gap-1">
                                {atsSimResult.greenhouse.fields.keywords.missing?.map((kw: string) => (
                                  <span key={`gh-miss-${kw}`} className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px]">{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lever Result Card */}
                      <div className="bg-surface-2 border border-white/[0.06] rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
                          <h4 className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5"><Building2 className="w-4 h-4 text-blue-400" /> Lever ATS</h4>
                          <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full font-bold">Score: {atsSimResult.lever.overallScore}</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(atsSimResult.lever.fields).filter(([k, v]) => v.status === "warning" || v.status === "dropped").length > 0 ? (
                            Object.entries(atsSimResult.lever.fields).filter(([k, v]) => v.status === "warning" || v.status === "dropped").map(([key, field]) => (
                              <div key={`lv-${key}`} className="flex flex-col gap-1 text-xs mb-2">
                                <div className="flex items-center gap-1.5 opacity-80">
                                  {field.status === "dropped" ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <Info className="w-3.5 h-3.5 text-amber-400" />}
                                  <span className="text-white capitalize">{key}</span>
                                </div>
                                <span className="text-white-60 leading-relaxed pl-5">{field.suggestion || "Missing required structure."}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-blue-400 text-xs font-semibold flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" /> Passed Lever Structural Checks
                            </p>
                          )}

                          {atsSimResult.lever.fields.keywords && atsSimResult.lever.fields.keywords.status !== "success" && (
                            <div className="mt-3 pt-3 border-t border-white/[0.06]">
                              <p className="text-amber-400 text-xs font-medium mb-1.5">Missing Keywords Warning:</p>
                              <div className="flex flex-wrap gap-1">
                                {atsSimResult.lever.fields.keywords.missing?.map((kw: string) => (
                                  <span key={`lv-miss-${kw}`} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px]">{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ShareScoreModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        score={atsScore}
        label={atsLabel}
        keywords={keywordsFound}
        userName={userName}
      />

      {showCreateFlow && (
        <div className="fixed inset-0 z-50 bg-[#1e1e2d] flex flex-col items-center justify-center p-4">
          <div className="bg-surface-1 border border-white/[0.06] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-foreground mb-4">Create Resume from Scratch</h2>
            <p className="text-sm text-white-60 mb-6">Provide minimal details, and our AI will generate a fully ATS-optimized LaTeX resume for you.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-white-60 mb-1">Contact <span className="text-rose-400">*</span></label>
                <input value={createData.Contact} onChange={e => setCreateData(p => ({ ...p, Contact: e.target.value }))} placeholder="Phone, City, LinkedIn profile..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none" />
              </div>
              <div>
                <label className="block text-xs uppercase text-white-60 mb-1">Target Role / Objective</label>
                <input value={createData.Objective} onChange={e => setCreateData(p => ({ ...p, Objective: e.target.value }))} placeholder="E.g. Senior Frontend Developer looking for..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none" />
              </div>
              <div>
                <label className="block text-xs uppercase text-white-60 mb-1">Experience</label>
                <textarea rows={3} value={createData.Experience} onChange={e => setCreateData(p => ({ ...p, Experience: e.target.value }))} placeholder="Briefly list your recent jobs, companies, and key achievements..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-white-60 mb-1">Education</label>
                  <textarea rows={2} value={createData.Education} onChange={e => setCreateData(p => ({ ...p, Education: e.target.value }))} placeholder="Degrees, schools, grad years..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs uppercase text-white-60 mb-1">Skills</label>
                  <textarea rows={2} value={createData.Skills} onChange={e => setCreateData(p => ({ ...p, Skills: e.target.value }))} placeholder="Comma separated technical / soft skills..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none resize-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase text-white-60 mb-1">Projects</label>
                <textarea rows={2} value={createData.Projects} onChange={e => setCreateData(p => ({ ...p, Projects: e.target.value }))} placeholder="List key personal/academic projects..." className="w-full bg-surface-2 border border-white/[0.1] rounded-lg p-3 text-sm text-foreground focus:border-blue-electric outline-none resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button disabled={createLoading} onClick={() => setShowCreateFlow(false)} className="px-5 py-2 rounded-lg text-white-60 hover:text-foreground text-sm font-medium transition-colors">Cancel</button>
              <button disabled={createLoading || !createData.Contact} onClick={handleCreateSubmit} className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                Generate AI Resume
              </button>
            </div>
          </div>
        </div>
      )}

      <ResumeChatbot hasParsedResume={hasParsed} jobDescription={jobDescText} />
    </div>
  );
};

export default Resume;
