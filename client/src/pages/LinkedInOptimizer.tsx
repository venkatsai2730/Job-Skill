import { motion, AnimatePresence } from "framer-motion";
import { Link2, Copy, Check, ArrowRight, Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../lib/api";

interface Section {
  name: string;
  score: number;
  current: string;
  optimized: string;
}

interface MessageTemplate {
  title: string;
  text: string;
}

interface OptimizeResponse {
  sections: Section[];
  messageTemplates: MessageTemplate[];
  provider?: string;
  model?: string;
  raw?: string;
  error?: string;
}

interface LinkedInATS {
  score: number;
  label: string;
  issues: { type: "warning" | "success"; text: string }[];
  keywords: { found: string[]; missing: string[]; total: number; matched: number };
  inferredSkills: string[];
}

interface ScoreResponse {
  linkedinAts: LinkedInATS;
  syncTips: string[];
}

interface ResumeATSData {
  score: number;
  label: string;
  keywords: { found: string[]; missing: string[] };
}

const defaultSections: Section[] = [
  { name: "Headline", score: 65, current: "Software Engineer at TechCorp", optimized: "Senior Software Engineer | Building Scalable Systems for 2M+ Users | React, Node.js, AWS" },
  { name: "About", score: 45, current: "I'm a software engineer with experience in web development.", optimized: "I architect high-performance distributed systems that serve millions of users daily. With 6+ years leading cross-functional teams at top tech companies, I combine deep technical expertise in React, Node.js, and cloud infrastructure with a passion for mentoring and building products that matter." },
  { name: "Experience", score: 72, current: "Worked on various projects and teams to deliver software solutions.", optimized: "Spearheaded the development of 12 microservices handling 2M daily requests, reducing system latency by 40% and saving $200K annually in infrastructure costs." },
  { name: "Skills", score: 88, current: "JavaScript, React, Node.js", optimized: "TypeScript • React • Node.js • AWS (EC2, Lambda, S3) • Docker • Kubernetes • PostgreSQL • Redis • GraphQL • CI/CD • Terraform" },
];

const defaultMessageTemplates: MessageTemplate[] = [
  { title: "Connection Request", text: "Hi [Name], I noticed we share a passion for [field]. I'd love to connect and learn from your experience at [Company]. Looking forward to exchanging ideas!" },
  { title: "Recruiter Follow-up", text: "Hi [Name], thank you for reaching out about the [Role] position. I'm very interested and would love to learn more about the team and the challenges you're solving. When would be a good time to chat?" },
  { title: "Informational Interview", text: "Hi [Name], I've been following [Company]'s work in [area] and I'm impressed by [specific achievement]. Would you be open to a brief 15-minute chat about your experience there?" },
];

const LinkedInOptimizer = () => {
  const { token } = useAuth();
  const [profileText, setProfileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(defaultMessageTemplates);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // LinkedIn ATS score state
  const [linkedinScore, setLinkedinScore] = useState<LinkedInATS | null>(null);
  const [syncTips, setSyncTips] = useState<string[]>([]);
  const [scoringLinkedin, setScoringLinkedin] = useState(false);

  // Resume ATS score state (fetched for comparison)
  const [resumeAts, setResumeAts] = useState<ResumeATSData | null>(null);

  // Fetch resume ATS data on mount for comparison
  useEffect(() => {
    if (!token) return;
    api.get<{ parsed: { ats: ResumeATSData } | null }>("/api/resume/parsed")
      .then(data => {
        if (data.parsed?.ats) setResumeAts(data.parsed.ats);
      })
      .catch(() => {});
  }, [token]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Score LinkedIn text via ATS
  const scoreLinkedIn = async (text: string) => {
    if (text.trim().length < 20) return;
    setScoringLinkedin(true);
    try {
      const data = await api.post<ScoreResponse>("/api/linkedin/score", {
        profileText: text.trim(),
        resumeKeywords: resumeAts?.keywords?.found || [],
        resumeScore: resumeAts?.score || 0,
      });
      setLinkedinScore(data.linkedinAts);
      setSyncTips(data.syncTips);
    } catch {
      /* silent — scoring is optional bonus */
    } finally {
      setScoringLinkedin(false);
    }
  };

  const handleAnalyze = async () => {
    if (!profileText.trim() || profileText.trim().length < 10) {
      setError("Please paste your LinkedIn profile details (at least 10 characters).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.post<OptimizeResponse>("/api/linkedin/optimize", {
        profileText: profileText.trim(),
      });

      if (data.error) {
        setError(data.error);
        return;
      }

      const extractText = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) {
          return val.map(v => {
            if (typeof v === 'string') return `• ${v}`;
            if (typeof v === 'object' && v !== null) return Object.values(v).filter(Boolean).map(String).join(' — ');
            return String(v);
          }).join('\n');
        }
        if (typeof val === 'object') {
          return Object.entries(val).map(([k, v]) => `${k}: ${String(v)}`).join(' | ');
        }
        return String(val);
      };

      if (data.raw && (!data.sections || data.sections.length === 0)) {
        setError("AI returned unstructured text. Please try again — the AI sometimes needs a second attempt to format correctly.");
        return;
      }

      if (data.sections && Array.isArray(data.sections)) {
        const safeSections = data.sections.map(s => ({
          name: typeof s.name === 'string' ? s.name : String(s.name || 'Unknown'),
          score: typeof s.score === 'number' ? s.score : parseInt(String(s.score || '0'), 10) || 0,
          current: extractText(s.current),
          optimized: extractText(s.optimized)
        }));
        setSections(safeSections);
      }

      if (data.messageTemplates && Array.isArray(data.messageTemplates)) {
        const safeTemplates = data.messageTemplates.map(t => ({
          title: typeof t.title === 'string' ? t.title : String(t.title || 'Template'),
          text: typeof t.text === 'string' ? t.text : extractText(t.text)
        }));
        setMessageTemplates(safeTemplates);
      }
      setAnalyzed(true);

      // Also run ATS scoring on LinkedIn in parallel
      scoreLinkedIn(profileText);
    } catch (err: any) {
      setError(err.message || "Failed to analyze. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const r = 36; // Score ring radius

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">LinkedIn Optimizer</h1>
        <p className="text-gray-600 text-base">AI-powered improvements for your LinkedIn profile with ATS scoring.</p>
      </motion.div>

      {/* URL / Text input */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-blue-muted/50 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors">
          <Link2 className="w-4 h-4 text-gray-400" />
          <input
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Paste your LinkedIn profile URL or profile details..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-primary-foreground px-6 rounded-xl font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
          ) : (
            <>Analyze <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DUAL SCORE COMPARISON — Resume vs LinkedIn             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {(linkedinScore || resumeAts) && analyzed && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h3 className="font-display font-semibold text-foreground text-lg">Score Comparison</h3>
              {scoringLinkedin && <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Resume score ring */}
              <div className="text-center">
                <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-3">Resume Score</p>
                <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto">
                  <circle cx="50" cy="50" r={r + 6} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <motion.circle cx="50" cy="50" r={r + 6} fill="none" stroke="url(#resume-grad)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * (r + 6)}
                    initial={{ strokeDashoffset: 2 * Math.PI * (r + 6) }}
                    animate={{ strokeDashoffset: 2 * Math.PI * (r + 6) - ((resumeAts?.score ?? 0) / 100) * 2 * Math.PI * (r + 6) }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                  />
                  <defs>
                    <linearGradient id="resume-grad">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <text x="50" y="47" textAnchor="middle" className="fill-foreground font-mono font-bold text-2xl">{resumeAts?.score ?? "—"}</text>
                  <text x="50" y="62" textAnchor="middle" className="fill-slate-500 font-body text-[10px]">{resumeAts?.label ?? "N/A"}</text>
                </svg>
              </div>

              {/* LinkedIn score ring */}
              <div className="text-center">
                <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-3">LinkedIn Score</p>
                <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto">
                  <circle cx="50" cy="50" r={r + 6} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                  <motion.circle cx="50" cy="50" r={r + 6} fill="none" stroke="url(#linkedin-grad)" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * (r + 6)}
                    initial={{ strokeDashoffset: 2 * Math.PI * (r + 6) }}
                    animate={{ strokeDashoffset: 2 * Math.PI * (r + 6) - ((linkedinScore?.score ?? 0) / 100) * 2 * Math.PI * (r + 6) }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                  />
                  <defs>
                    <linearGradient id="linkedin-grad">
                      <stop offset="0%" stopColor="#0077B5" />
                      <stop offset="100%" stopColor="#00A0DC" />
                    </linearGradient>
                  </defs>
                  <text x="50" y="47" textAnchor="middle" className="fill-foreground font-mono font-bold text-2xl">{linkedinScore?.score ?? "—"}</text>
                  <text x="50" y="62" textAnchor="middle" className="fill-slate-500 font-body text-[10px]">{linkedinScore?.label ?? "N/A"}</text>
                </svg>
              </div>
            </div>

            {/* Score delta badge */}
            {resumeAts && linkedinScore && (
              <div className="text-center mb-4">
                <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold border ${
                  linkedinScore.score >= (resumeAts.score ?? 0)
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }`}>
                  {linkedinScore.score >= (resumeAts.score ?? 0)
                    ? <TrendingUp className="w-4 h-4" />
                    : <TrendingDown className="w-4 h-4" />}
                  {Math.abs(linkedinScore.score - (resumeAts.score ?? 0))} pts {linkedinScore.score >= (resumeAts.score ?? 0) ? "ahead" : "behind"} resume
                </span>
              </div>
            )}

            {/* Sync Tips */}
            {syncTips.length > 0 && (
              <div className="space-y-2.5 mt-4">
                <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" /> Sync Recommendations
                </h4>
                {syncTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    {tip.includes("✓") || tip.includes("aligned")
                      ? <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                    <span className="text-foreground">{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Score bars */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="font-display font-semibold text-foreground mb-4">
          Section Scores
          {analyzed && <span className="ml-2 text-xs text-blue-500 font-normal">(AI-analyzed)</span>}
        </h3>
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-900">{s.name}</span>
                <span className="text-foreground font-mono font-semibold">{s.score}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${s.score}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Side by side optimizations */}
      <div className="space-y-4">
        <h3 className="font-display font-semibold text-foreground">AI-Optimized Sections</h3>
        {sections.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="glass-card p-5">
              <h4 className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-2">Current — {s.name}</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{s.current}</p>
            </div>
            <div className="glass-card p-5 border-l-4 border-l-blue-500 shadow-[0_4px_20px_rgba(59,91,255,0.1)]">
              <h4 className="text-blue-500 text-xs uppercase tracking-wider font-semibold mb-2">✦ AI Optimized — {s.name}</h4>
              <p className="text-gray-900 text-sm leading-relaxed">{s.optimized}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* LinkedIn Keywords */}
      {linkedinScore && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">LinkedIn Keywords</h3>
          {linkedinScore.keywords.found.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-2">Found on LinkedIn</p>
              <div className="flex flex-wrap gap-2">
                {linkedinScore.keywords.found.slice(0, 15).map(kw => (
                  <span key={kw} className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {linkedinScore.keywords.missing.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-2">Missing from LinkedIn</p>
              <div className="flex flex-wrap gap-2">
                {linkedinScore.keywords.missing.slice(0, 10).map(kw => (
                  <span key={kw} className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium border border-amber-500/20">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {linkedinScore.inferredSkills && linkedinScore.inferredSkills.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-purple-400 text-xs uppercase tracking-wider font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Hidden Skills Detected
              </p>
              <p className="text-gray-600 text-xs mb-3">AI inferred these undocumented skills from your experience context.</p>
              <div className="flex flex-wrap gap-2">
                {linkedinScore.inferredSkills.map(kw => (
                  <span key={kw} className="bg-purple-500/10 text-purple-400 text-xs px-2.5 py-1 rounded-full font-medium border border-purple-500/20">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Message templates */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-4">Message Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {messageTemplates.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass-card p-5"
            >
              <h4 className="text-foreground font-medium text-sm mb-2">{t.title}</h4>
              <p className="text-gray-600 text-xs leading-relaxed mb-3">{t.text}</p>
              <button
                onClick={() => handleCopy(t.text, i)}
                className="text-blue-500 text-xs font-medium hover:underline flex items-center gap-1"
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
    </div>
  );
};

export default LinkedInOptimizer;
