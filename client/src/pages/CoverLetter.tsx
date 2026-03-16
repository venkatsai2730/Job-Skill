import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sparkles, ArrowRight, Loader2, Copy, Check, AlertTriangle, Wand2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ScoreBreakdown {
  tone: { score: number; max: 25 };
  keywords: { score: number; max: 25 };
  length: { score: number; max: 25 };
  personalization: { score: number; max: 25 };
}

interface CoverLetterScore {
  overall: number;
  label: string;
  breakdown: ScoreBreakdown;
  issues: { type: "warning" | "success"; text: string }[];
  keywordsFound: string[];
  keywordsMissing: string[];
}

interface GenerateResponse {
  coverLetter: string;
  keyMatches: string[];
  tone: string;
  wordCount: number;
  score: CoverLetterScore;
  provider?: string;
  model?: string;
  error?: string;
}

const CoverLetter = () => {
  const { token } = useAuth();

  // Inputs
  const [coverLetterText, setCoverLetterText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tone, setTone] = useState("professional");

  // Resume text (auto-fetched for generation)
  const [resumeText, setResumeText] = useState("");

  // Results
  const [score, setScore] = useState<CoverLetterScore | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState("");
  const [keyMatches, setKeyMatches] = useState<string[]>([]);

  // Loading states
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const r = 40;

  // Fetch resume text on mount
  useEffect(() => {
    if (!token) return;
    api.get<{ parsed: { sections: any } | null }>("/api/resume/parsed")
      .then(data => {
        if (!data.parsed?.sections) return;
        const s = data.parsed.sections;
        const parts: string[] = [];
        if (s.summary) parts.push(s.summary);
        if (s.experience?.length) s.experience.forEach((e: any) => { parts.push(`${e.title} at ${e.company}`); e.bullets?.forEach((b: string) => parts.push(b)); });
        if (s.skills?.length) s.skills.forEach((g: any) => parts.push(g.items?.join(", ") || ""));
        if (s.education?.length) s.education.forEach((e: any) => parts.push(`${e.degree} ${e.school}`));
        setResumeText(parts.join("\n"));
      })
      .catch(() => {});
  }, [token]);

  // Score a cover letter
  const handleScore = async () => {
    if (coverLetterText.trim().length < 30) {
      toast.error("Cover letter text needs to be at least 30 characters.");
      return;
    }
    setScoring(true);
    try {
      const result = await api.post<CoverLetterScore>("/api/cover-letter/score", {
        coverLetterText: coverLetterText.trim(),
        jobDescription: jobDescription.trim() || undefined,
      });
      setScore(result);
    } catch (err: any) {
      toast.error(err.message || "Scoring failed.");
    } finally {
      setScoring(false);
    }
  };

  // Generate a cover letter from resume + JD
  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      toast.error("Paste a job description to generate a cover letter.");
      return;
    }
    if (!resumeText) {
      toast.error("Upload a resume first — we need it to tailor the cover letter.");
      return;
    }
    setGenerating(true);
    try {
      const result = await api.post<GenerateResponse>("/api/cover-letter/generate", {
        resumeText,
        jobDescription: jobDescription.trim(),
        companyName: companyName.trim() || undefined,
        tone,
      });
      if (result.error) { toast.error(result.error); return; }
      setGeneratedLetter(result.coverLetter || "");
      setCoverLetterText(result.coverLetter || "");
      setKeyMatches(result.keyMatches || []);
      setScore(result.score);
      toast.success("Cover letter generated ✦");
    } catch (err: any) {
      toast.error(err.message || "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLetter || coverLetterText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const breakdownItems: { key: keyof ScoreBreakdown; label: string; color: string }[] = [
    { key: "tone", label: "Tone", color: "from-violet-500 to-purple-500" },
    { key: "keywords", label: "Keywords", color: "from-blue-500 to-cyan-500" },
    { key: "length", label: "Length", color: "from-emerald-500 to-green-500" },
    { key: "personalization", label: "Personalization", color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Cover Letter</h1>
        <p className="text-white-60 text-base">Score existing cover letters or generate AI-tailored ones from your resume.</p>
      </motion.div>

      {/* ═══ INPUT AREA ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Cover letter text */}
        <div className="space-y-3">
          <label className="text-white-60 text-xs uppercase tracking-wider font-semibold">Cover Letter Text</label>
          <textarea
            value={coverLetterText}
            onChange={(e) => setCoverLetterText(e.target.value)}
            placeholder="Paste your cover letter here to score it, or use the Generate button below..."
            className="w-full min-h-[280px] bg-surface-1 border border-white/[0.1] rounded-xl p-5 text-foreground text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-20"
          />
          <div className="flex gap-3">
            <button
              onClick={handleScore}
              disabled={scoring || coverLetterText.trim().length < 30}
              className="flex-1 bg-blue-electric hover:bg-blue-bright text-primary-foreground py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scoring ? <><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</> : <><Sparkles className="w-4 h-4" /> Score Cover Letter</>}
            </button>
            {(generatedLetter || coverLetterText) && (
              <button onClick={handleCopy} className="px-4 py-2.5 rounded-xl border border-white/[0.1] bg-surface-2 text-foreground text-sm font-medium hover:bg-surface-3 transition-all flex items-center gap-2">
                {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
            )}
          </div>
        </div>

        {/* Right — Job Description + Generate */}
        <div className="space-y-3">
          <label className="text-white-60 text-xs uppercase tracking-wider font-semibold">Job Description</label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description for better keyword matching and AI generation..."
            className="w-full min-h-[180px] bg-surface-1 border border-white/[0.1] rounded-xl p-5 text-foreground text-sm leading-relaxed resize-y focus:outline-none focus:border-blue-electric focus:ring-2 focus:ring-blue-electric/10 transition-all placeholder:text-white-20"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name (optional)"
              className="bg-surface-1 border border-white/[0.1] rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-electric transition-all placeholder:text-white-20"
            />
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="bg-surface-1 border border-white/[0.1] rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-electric transition-all"
            >
              <option value="professional">Professional</option>
              <option value="enthusiastic">Enthusiastic</option>
              <option value="conversational">Conversational</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !jobDescription.trim()}
            className="w-full bg-gradient-to-r from-violet-600 to-blue-electric hover:from-violet-500 hover:to-blue-bright text-primary-foreground py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4" /> AI Generate Cover Letter</>}
          </button>
          {!resumeText && (
            <p className="text-amber-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Upload a resume first for tailored generation</p>
          )}
        </div>
      </div>

      {/* ═══ SCORING RESULTS ═══ */}
      <AnimatePresence>
        {score && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* Score ring + breakdown */}
            <div className="glass-card p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Score ring */}
                <div className="text-center shrink-0">
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r={r + 10} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="7" />
                    <motion.circle cx="65" cy="65" r={r + 10} fill="none" stroke="url(#cl-gradient)" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * (r + 10)}
                      initial={{ strokeDashoffset: 2 * Math.PI * (r + 10) }}
                      animate={{ strokeDashoffset: 2 * Math.PI * (r + 10) - (score.overall / 100) * 2 * Math.PI * (r + 10) }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                    />
                    <defs>
                      <linearGradient id="cl-gradient">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="hsl(var(--blue-electric))" />
                      </linearGradient>
                    </defs>
                    <text x="65" y="60" textAnchor="middle" className="fill-foreground font-mono font-bold text-3xl">{score.overall}</text>
                    <text x="65" y="78" textAnchor="middle" className="fill-white-60 font-body text-sm">{score.label}</text>
                  </svg>
                </div>

                {/* Breakdown bars */}
                <div className="flex-1 space-y-3 w-full">
                  {breakdownItems.map(({ key, label, color }) => (
                    <div key={key}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white-90 font-medium">{label}</span>
                        <span className="text-foreground font-mono font-semibold">{score.breakdown[key].score}/{score.breakdown[key].max}</span>
                      </div>
                      <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full bg-gradient-to-r ${color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(score.breakdown[key].score / score.breakdown[key].max) * 100}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Issues */}
            <div className="glass-card p-6">
              <h3 className="font-display font-semibold text-foreground mb-4">Analysis</h3>
              <div className="space-y-2.5">
                {score.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    {issue.type === "success"
                      ? <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    <span className={issue.type === "success" ? "text-foreground" : "text-amber-300"}>{issue.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keywords */}
            {(score.keywordsFound.length > 0 || score.keywordsMissing.length > 0) && (
              <div className="glass-card p-6">
                <h3 className="font-display font-semibold text-foreground mb-4">Keywords</h3>
                {score.keywordsFound.length > 0 && (
                  <div className="mb-4">
                    <p className="text-white-60 text-xs uppercase tracking-wider font-semibold mb-2">Matched</p>
                    <div className="flex flex-wrap gap-2">
                      {score.keywordsFound.map(kw => (
                        <span key={kw} className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {score.keywordsMissing.length > 0 && (
                  <div>
                    <p className="text-white-60 text-xs uppercase tracking-wider font-semibold mb-2">Missing</p>
                    <div className="flex flex-wrap gap-2">
                      {score.keywordsMissing.map(kw => (
                        <span key={kw} className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium border border-amber-500/20">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Matches from generation */}
            {keyMatches.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-electric" /> Resume → Job Matches
                </h3>
                <div className="space-y-2">
                  {keyMatches.map((match, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-electric shrink-0 mt-0.5" />
                      <span className="text-foreground">{match}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CoverLetter;
