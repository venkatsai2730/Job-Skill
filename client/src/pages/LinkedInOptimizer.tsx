import { motion } from "framer-motion";
import { Link2, Copy, Check, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
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
  const [profileText, setProfileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>(defaultMessageTemplates);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
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

      // Helper: safely flatten any value to a plain string
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

      // Handle raw text response (JSON parse failed on backend)
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
    } catch (err: any) {
      setError(err.message || "Failed to analyze. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">LinkedIn Optimizer</h1>
        <p className="text-white-60 text-base">AI-powered improvements for your LinkedIn profile.</p>
      </motion.div>

      {/* URL input */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 bg-surface-2 border border-blue-muted/50 rounded-xl px-4 py-3 focus-within:border-blue-electric transition-colors">
          <Link2 className="w-4 h-4 text-white-30" />
          <input
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder="Paste your LinkedIn profile URL or profile details..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30"
          />
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-blue-electric hover:bg-blue-bright text-primary-foreground px-6 rounded-xl font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              Analyze <ArrowRight className="w-4 h-4" />
            </>
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

      {/* Score bars */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="font-display font-semibold text-foreground mb-4">
          Section Scores
          {analyzed && <span className="ml-2 text-xs text-blue-electric font-normal">(AI-analyzed)</span>}
        </h3>
        <div className="space-y-4">
          {sections.map((s) => (
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

      {/* Side by side */}
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
              <h4 className="text-white-60 text-xs uppercase tracking-wider font-semibold mb-2">Current — {s.name}</h4>
              <p className="text-white-60 text-sm leading-relaxed">{s.current}</p>
            </div>
            <div className="glass-card p-5 border-l-4 border-l-blue-electric shadow-[0_4px_20px_rgba(59,91,255,0.1)]">
              <h4 className="text-blue-electric text-xs uppercase tracking-wider font-semibold mb-2">✦ AI Optimized — {s.name}</h4>
              <p className="text-white-90 text-sm leading-relaxed">{s.optimized}</p>
            </div>
          </motion.div>
        ))}
      </div>

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
    </div>
  );
};

export default LinkedInOptimizer;
