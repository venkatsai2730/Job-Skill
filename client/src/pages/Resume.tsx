import { motion } from "framer-motion";
import { Upload, Download, Check, AlertTriangle, FileText, GraduationCap, Code2, FolderOpen } from "lucide-react";

const sections = ["Summary", "Experience", "Education", "Skills", "Projects"];

const issues = [
  { type: "warning", text: 'Missing keyword: "CI/CD"' },
  { type: "warning", text: "Weak bullet: Job 2, #3" },
  { type: "success", text: "Strong summary section" },
  { type: "success", text: "Good quantification in Job 1" },
];

const keywords = ["Terraform", "K8s", "Helm", "CI/CD", "Monitoring"];

const Resume = () => {
  const atsScore = 87;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (atsScore / 100) * c;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
      {/* Left panel */}
      <div className="lg:w-56 p-4 border-b lg:border-b-0 lg:border-r border-border/60 bg-surface-1 shrink-0 flex flex-col">
        <div className="border-2 border-dashed border-blue-electric/30 rounded-2xl p-6 bg-surface-2 text-center mb-4 cursor-pointer hover:border-blue-electric transition-colors">
          <Upload className="w-8 h-8 text-blue-electric mx-auto mb-2" />
          <p className="text-white-60 text-sm">Drop resume PDF</p>
        </div>

        <nav className="space-y-1 hidden lg:block flex-1">
          {sections.map((s, i) => (
            <button
              key={s}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${i === 0 ? "bg-blue-electric/10 text-blue-electric border-l-[3px] border-blue-electric" : "text-white-60 hover:bg-surface-2"
                }`}
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex gap-2 mt-6">
          <button className="flex-1 bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button className="flex-1 border border-blue-border text-white-60 hover:text-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> DOCX
          </button>
        </div>
      </div>

      {/* Center - editor */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-surface-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-foreground">Resume Editor</h2>
            <span className="flex items-center gap-1.5 text-success text-sm">
              <div className="w-2 h-2 rounded-full bg-success" /> Saved
            </span>
          </div>

          {/* ── Summary ── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1 h-6 bg-blue-electric rounded-full" />
              <h3 className="font-display font-semibold text-foreground text-lg">Summary</h3>
            </div>
            <div className="bg-white border border-gray-200/60 rounded-xl p-5 text-foreground text-base leading-relaxed shadow-sm">
              Senior Software Engineer with 6+ years of experience building scalable distributed systems. Expert in React, Node.js, and cloud infrastructure with a proven track record of leading cross-functional teams and delivering high-impact products.
            </div>
          </div>

          {/* ── Experience ── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1 h-6 bg-blue-electric rounded-full" />
              <h3 className="font-display font-semibold text-foreground text-lg">Experience</h3>
            </div>

            <div className="space-y-4">
              {/* Job 1 */}
              <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-foreground font-semibold text-base">Senior Software Engineer</p>
                    <p className="text-white-60 text-sm">TechCorp · 2021 – Present</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-medium">Current</span>
                </div>
                <ul className="space-y-2.5">
                  {[
                    { text: "Designed 12 REST APIs serving 2M requests/day, reducing latency by 40%", strength: "good" },
                    { text: "Led migration to microservices architecture, improving deployment frequency 3x", strength: "good" },
                    { text: "Managed cross-functional team of 8 engineers across 3 time zones", strength: "medium" },
                  ].map((bullet, i) => (
                    <li key={i} className="flex gap-2.5 text-base text-foreground">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${bullet.strength === "good" ? "bg-emerald-500" : "bg-amber-500"
                        }`} />
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Job 2 */}
              <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-foreground font-semibold text-base">Software Engineer</p>
                    <p className="text-white-60 text-sm">StartupXYZ · 2018 – 2021</p>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {[
                    { text: "Built real-time analytics dashboard processing 500K events/hour with React and D3.js", strength: "good" },
                    { text: "Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes", strength: "good" },
                    { text: "Worked on various backend services and improved test coverage", strength: "medium" },
                  ].map((bullet, i) => (
                    <li key={i} className="flex gap-2.5 text-base text-foreground">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${bullet.strength === "good" ? "bg-emerald-500" : "bg-amber-500"
                        }`} />
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Education ── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1 h-6 bg-blue-electric rounded-full" />
              <GraduationCap className="w-5 h-5 text-blue-electric" />
              <h3 className="font-display font-semibold text-foreground text-lg">Education</h3>
            </div>

            <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-foreground font-semibold text-base">B.S. in Computer Science</p>
                  <p className="text-white-60 text-sm">University of California, Berkeley · 2014 – 2018</p>
                </div>
                <span className="bg-blue-50 text-blue-electric text-xs px-2.5 py-1 rounded-full font-medium">GPA: 3.8</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-white-60 text-sm">Relevant coursework:</span>
                {["Data Structures", "Algorithms", "Distributed Systems", "Machine Learning"].map((c) => (
                  <span key={c} className="bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Skills ── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1 h-6 bg-blue-electric rounded-full" />
              <Code2 className="w-5 h-5 text-blue-electric" />
              <h3 className="font-display font-semibold text-foreground text-lg">Skills</h3>
            </div>

            <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
              <div className="space-y-4">
                {[
                  { category: "Languages", skills: ["TypeScript", "JavaScript", "Python", "Go", "SQL"] },
                  { category: "Frontend", skills: ["React", "Next.js", "Tailwind CSS", "GraphQL", "Redux"] },
                  { category: "Backend & Cloud", skills: ["Node.js", "Express", "AWS", "Docker", "Kubernetes", "PostgreSQL", "Redis"] },
                  { category: "Tools", skills: ["Git", "CI/CD", "Terraform", "Datadog", "Figma"] },
                ].map((group) => (
                  <div key={group.category}>
                    <p className="text-white-60 text-sm font-medium mb-2">{group.category}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.skills.map((skill) => (
                        <span key={skill} className="bg-blue-electric/8 text-blue-electric text-sm px-3 py-1.5 rounded-lg font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Projects ── */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-1 h-6 bg-blue-electric rounded-full" />
              <FolderOpen className="w-5 h-5 text-blue-electric" />
              <h3 className="font-display font-semibold text-foreground text-lg">Projects</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-foreground font-semibold text-base">Open-Source API Gateway</p>
                  <span className="bg-amber-50 text-amber-600 text-xs px-2.5 py-1 rounded-full font-medium">⭐ 1.2k stars</span>
                </div>
                <p className="text-white-60 text-sm mb-3">
                  High-performance API gateway built with Go, supporting rate limiting, caching, and load balancing. Used in production by 50+ companies.
                </p>
                <div className="flex gap-2">
                  {["Go", "Redis", "Docker"].map((t) => (
                    <span key={t} className="bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200/60 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-foreground font-semibold text-base">Real-Time Collaboration Engine</p>
                  <span className="bg-blue-50 text-blue-electric text-xs px-2.5 py-1 rounded-full font-medium">Featured</span>
                </div>
                <p className="text-white-60 text-sm mb-3">
                  WebSocket-based real-time document collaboration engine with OT conflict resolution, supporting 10K concurrent users.
                </p>
                <div className="flex gap-2">
                  {["TypeScript", "WebSocket", "PostgreSQL"].map((t) => (
                    <span key={t} className="bg-surface-2 text-foreground text-xs px-2.5 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right panel - AI analysis */}
      <div className="lg:w-80 p-5 border-t lg:border-t-0 lg:border-l border-border/60 bg-surface-1 shrink-0 overflow-y-auto">
        {/* ATS Score */}
        <div className="text-center mb-6">
          <h3 className="font-display font-semibold text-foreground text-base mb-3">✦ ATS Score</h3>
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
            <text x="60" y="56" textAnchor="middle" className="fill-foreground font-mono font-bold text-3xl">
              {atsScore}
            </text>
            <text x="60" y="72" textAnchor="middle" className="fill-white-60 font-body text-sm">
              Great!
            </text>
          </svg>
        </div>

        {/* Issues */}
        <div className="mb-6">
          <h4 className="font-display font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">Top Issues</h4>
          <div className="space-y-2.5">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                {issue.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                <span className="text-foreground">{issue.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div className="mb-6">
          <h4 className="font-display font-semibold text-foreground text-sm mb-2 uppercase tracking-wider">Keyword Gaps</h4>
          <p className="text-white-60 text-sm mb-3">Job: Senior DevOps @ AWS</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {keywords.map((kw) => (
              <span key={kw} className="bg-blue-electric/10 text-blue-electric text-sm px-3 py-1 rounded-full font-medium">{kw}</span>
            ))}
          </div>
          <div className="flex items-center gap-2.5 text-sm">
            <span className="text-white-60">Matched: 23/31</span>
            <div className="flex-1 h-2 bg-surface-3 rounded-full">
              <div className="h-full bg-blue-electric rounded-full" style={{ width: "74%" }} />
            </div>
          </div>
        </div>

        {/* Bullet rewrite */}
        <div className="glass-card p-5 rounded-xl">
          <h4 className="font-display font-semibold text-foreground text-sm mb-3 uppercase tracking-wider">AI Rewrite</h4>
          <p className="text-white-60 text-sm mb-1">Before:</p>
          <p className="text-white-30 text-sm line-through mb-3">"Worked on APIs"</p>
          <p className="text-white-60 text-sm mb-1">AI suggestion:</p>
          <p className="text-foreground text-sm mb-4 leading-relaxed">"Designed 12 REST APIs serving 2M req/day, cut latency by 40%"</p>
          <button className="w-full bg-blue-electric hover:bg-blue-bright text-primary-foreground text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Apply Fix
          </button>
        </div>
      </div>
    </div>
  );
};

export default Resume;
