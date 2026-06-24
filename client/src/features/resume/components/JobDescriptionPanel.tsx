import { useState } from "react";
import { Briefcase, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { useResumeStore } from "../store/resumeStore";
import type { JDMatchResult } from "../schemas/resume.schema";

export function JobDescriptionPanel() {
  const { sections, setJDResult, jdResult, setJobDescription } = useResumeStore();
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleAnalyze = async () => {
    if (!jd.trim()) { setError("Paste a job description first."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await api.post<JDMatchResult>("/api/resume/jd-match", {
        jobDescription: jd.trim(),
        sections,
      });
      setJDResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-blue-electric" />
          <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider">
            JD Match
          </h4>
          {jdResult && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${jdResult.score >= 70 ? "bg-emerald-500/15 text-emerald-400" : jdResult.score >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
              {jdResult.score}%
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white-30" /> : <ChevronDown className="w-3.5 h-3.5 text-white-30" />}
      </button>

      {expanded && (
        <div className="space-y-3">
          <textarea
            value={jd}
            onChange={(e) => { setJd(e.target.value); setError(""); setJobDescription(e.target.value); }}
            placeholder="Paste job description here…"
            className="w-full h-28 text-xs bg-surface-2 border border-border/60 rounded-xl p-3 text-foreground placeholder:text-white-30 resize-none focus:outline-none focus:border-blue-electric transition-colors"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading || !jd.trim()}
            className="w-full bg-blue-electric hover:bg-blue-bright disabled:opacity-40 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
            {loading ? "Analysing…" : "Analyse Match"}
          </button>

          {jdResult && (
            <div className="space-y-3">
              {/* Score ring */}
              <div className="flex items-center gap-3 bg-surface-2 rounded-xl p-3">
                <div className="relative w-12 h-12 shrink-0">
                  <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--surface-3))" strokeWidth="4" />
                    <circle
                      cx="22" cy="22" r="18" fill="none"
                      stroke={jdResult.score >= 70 ? "#10b981" : jdResult.score >= 50 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="4"
                      strokeDasharray={`${(jdResult.score / 100) * 113} 113`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                    {jdResult.score}
                  </span>
                </div>
                <div>
                  <p className="text-foreground text-xs font-semibold">JD Match Score</p>
                  <p className="text-white-30 text-xs">
                    {jdResult.score >= 70 ? "Strong match" : jdResult.score >= 50 ? "Moderate match" : "Needs improvement"}
                  </p>
                </div>
              </div>

              {/* Matched keywords */}
              {jdResult.matchedKeywords.length > 0 && (
                <div>
                  <p className="text-xs text-white-60 mb-1.5 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" /> Matched keywords
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {jdResult.matchedKeywords.slice(0, 12).map((kw) => (
                      <span key={kw} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing keywords */}
              {jdResult.missingKeywords.length > 0 && (
                <div>
                  <p className="text-xs text-white-60 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500" /> Missing keywords
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {jdResult.missingKeywords.slice(0, 12).map((kw) => (
                      <span key={kw} className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {jdResult.suggestions.length > 0 && (
                <div>
                  <p className="text-xs text-white-60 mb-1.5 font-medium">Suggestions</p>
                  <div className="space-y-1">
                    {jdResult.suggestions.slice(0, 4).map((s, i) => (
                      <div key={i} className="text-xs text-foreground bg-surface-2 rounded-lg px-2 py-1.5 border-l-2 border-blue-electric/40">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
