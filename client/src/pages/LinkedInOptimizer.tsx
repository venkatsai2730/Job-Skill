import { motion, AnimatePresence } from "framer-motion";
import { Link2, Copy, Check, ArrowRight, ChevronDown, ChevronUp, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";

interface LinkedInSection {
  name: string;
  score: number;
  current: string;
  optimized: string;
  feedback: string;
}

interface MessageTemplate {
  title: string;
  text: string;
}

interface AnalysisResult {
  sections: LinkedInSection[];
  messageTemplates: MessageTemplate[];
  overallScore: number;
}

type PageState = "idle" | "loading" | "results" | "error";

const LINKEDIN_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%.]+\/?(\?.*)?$/;

const LinkedInOptimizer = () => {
  const [url, setUrl] = useState("");
  const [showProfileInputs, setShowProfileInputs] = useState(false);
  const [profileFields, setProfileFields] = useState({
    headline: "",
    about: "",
    experience: "",
    skills: "",
  });
  const [pageState, setPageState] = useState<PageState>("idle");
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const isValidUrl = LINKEDIN_RE.test(url.trim());

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setErrorMsg("Please enter your LinkedIn profile URL.");
      setPageState("error");
      return;
    }
    if (!isValidUrl) {
      setErrorMsg("Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/your-name).");
      setPageState("error");
      return;
    }

    setPageState("loading");
    setErrorMsg("");

    try {
      const data = await api.post<AnalysisResult>("/api/linkedin/analyze", {
        url: url.trim(),
        ...(profileFields.headline && { headline: profileFields.headline }),
        ...(profileFields.about && { about: profileFields.about }),
        ...(profileFields.experience && { experience: profileFields.experience }),
        ...(profileFields.skills && { skills: profileFields.skills }),
      });
      setResults(data);
      setPageState("results");
    } catch (err: any) {
      setErrorMsg(err.message || "Analysis failed. Please try again.");
      setPageState("error");
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleReset = () => {
    setPageState("idle");
    setResults(null);
    setErrorMsg("");
  };

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">LinkedIn Optimizer</h1>
        <p className="text-white-60 text-base">AI-powered improvements for your LinkedIn profile.</p>
      </motion.div>

      {/* Input area */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div
            className={`flex-1 flex items-center gap-2 bg-surface-2 border rounded-xl px-4 py-3 focus-within:border-blue-electric transition-colors ${
              pageState === "error" && !isValidUrl && url
                ? "border-red-500/70"
                : "border-blue-muted/50"
            }`}
          >
            <Link2 className="w-4 h-4 text-white-30 shrink-0" />
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (pageState === "error") setPageState("idle");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Paste your LinkedIn profile URL..."
              className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30"
              disabled={pageState === "loading"}
            />
          </div>
          <button
            onClick={pageState === "results" ? handleReset : handleAnalyze}
            disabled={pageState === "loading"}
            className="bg-blue-electric hover:bg-blue-bright disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground px-6 rounded-xl font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {pageState === "loading" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
            ) : pageState === "results" ? (
              <><RotateCcw className="w-4 h-4" /> Re-analyze</>
            ) : (
              <>Analyze <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </div>

        {/* Optional profile content toggle */}
        {pageState !== "results" && (
          <button
            onClick={() => setShowProfileInputs((p) => !p)}
            className="flex items-center gap-1.5 text-xs text-white-60 hover:text-white-90 transition-colors"
          >
            {showProfileInputs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showProfileInputs ? "Hide" : "Add your current profile content"} (optional — for personalised results)
          </button>
        )}

        <AnimatePresence>
          {showProfileInputs && pageState !== "results" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {(["headline", "about", "experience", "skills"] as const).map((field) => (
                  <div key={field} className="glass-card p-4">
                    <label className="text-white-60 text-xs uppercase tracking-wider font-semibold mb-2 block capitalize">
                      {field}
                    </label>
                    <textarea
                      rows={field === "about" || field === "experience" ? 4 : 2}
                      value={profileFields[field]}
                      onChange={(e) => setProfileFields((p) => ({ ...p, [field]: e.target.value }))}
                      placeholder={
                        field === "headline"
                          ? "e.g. Software Engineer at TechCorp"
                          : field === "about"
                          ? "Paste your About section…"
                          : field === "experience"
                          ? "Paste your latest experience bullets…"
                          : "e.g. JavaScript, React, Node.js"
                      }
                      className="w-full bg-transparent text-foreground text-sm outline-none placeholder:text-white-30 resize-none leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {pageState === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loading skeleton */}
      <AnimatePresence>
        {pageState === "loading" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="glass-card p-6 space-y-4">
              <div className="h-4 bg-surface-3 rounded animate-pulse w-32" />
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-surface-3 rounded animate-pulse w-20" />
                    <div className="h-3 bg-surface-3 rounded animate-pulse w-10" />
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full animate-pulse" />
                </div>
              ))}
            </div>
            <div className="text-center text-white-60 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Claude is analysing your profile…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle empty state */}
      <AnimatePresence>
        {pageState === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-10 text-center space-y-3"
          >
            <div className="text-4xl">🔍</div>
            <p className="text-foreground font-medium">Paste your LinkedIn URL above and click Analyze</p>
            <p className="text-white-60 text-sm max-w-sm mx-auto">
              AI will score your Headline, About, Experience, and Skills sections then generate optimised rewrites.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {pageState === "results" && results && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Overall score */}
            <div className="glass-card p-5 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold font-mono shrink-0"
                style={{
                  background: `conic-gradient(rgb(59 91 255) ${results.overallScore * 3.6}deg, rgb(30 30 50) 0deg)`,
                }}
              >
                <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-sm font-bold text-foreground">
                  {results.overallScore}
                </div>
              </div>
              <div>
                <p className="text-foreground font-semibold">Overall Profile Score</p>
                <p className="text-white-60 text-sm">
                  {results.overallScore >= 80
                    ? "Strong profile — a few tweaks will make it exceptional."
                    : results.overallScore >= 60
                    ? "Good foundation. Apply the suggestions below to stand out."
                    : "Significant room to improve. Use the optimised sections below."}
                </p>
              </div>
            </div>

            {/* Score bars */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6"
            >
              <h3 className="font-display font-semibold text-foreground mb-4">Section Scores</h3>
              <div className="space-y-4">
                {results.sections.map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white-90">{s.name}</span>
                      <span className="text-foreground font-mono font-semibold">{s.score}%</span>
                    </div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-electric to-cyan-spark"
                        initial={{ width: 0 }}
                        animate={{ width: `${s.score}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Side-by-side sections */}
            <div className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">AI-Optimized Sections</h3>
              {results.sections.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="space-y-2"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-card p-5">
                      <h4 className="text-white-60 text-xs uppercase tracking-wider font-semibold mb-2">
                        Current — {s.name}
                      </h4>
                      <p className="text-white-60 text-sm leading-relaxed">{s.current}</p>
                    </div>
                    <div className="glass-card p-5 border-l-4 border-l-blue-electric shadow-[0_4px_20px_rgba(59,91,255,0.1)]">
                      <h4 className="text-blue-electric text-xs uppercase tracking-wider font-semibold mb-2">
                        ✦ AI Optimized — {s.name}
                      </h4>
                      <p className="text-white-90 text-sm leading-relaxed">{s.optimized}</p>
                    </div>
                  </div>
                  <p className="text-white-60 text-xs px-1">
                    <span className="text-blue-electric font-medium">Why: </span>
                    {s.feedback}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Message templates */}
            <div>
              <h3 className="font-display font-semibold text-foreground mb-4">Message Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {results.messageTemplates.map((t, i) => (
                  <motion.div
                    key={t.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="glass-card p-5"
                  >
                    <h4 className="text-foreground font-medium text-sm mb-2">{t.title}</h4>
                    <p className="text-white-60 text-xs leading-relaxed mb-3">{t.text}</p>
                    <button
                      onClick={() => handleCopy(t.text, i)}
                      className="text-blue-electric text-xs font-medium hover:underline flex items-center gap-1"
                    >
                      {copiedIdx === i ? (
                        <><Check className="w-3 h-3" /> Copied!</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy</>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LinkedInOptimizer;
