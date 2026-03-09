import { motion } from "framer-motion";
import { Link2, Copy, Check, ArrowRight } from "lucide-react";
import { useState } from "react";

const sections = [
  { name: "Headline", score: 65, current: "Software Engineer at TechCorp", optimized: "Senior Software Engineer | Building Scalable Systems for 2M+ Users | React, Node.js, AWS" },
  { name: "About", score: 45, current: "I'm a software engineer with experience in web development.", optimized: "I architect high-performance distributed systems that serve millions of users daily. With 6+ years leading cross-functional teams at top tech companies, I combine deep technical expertise in React, Node.js, and cloud infrastructure with a passion for mentoring and building products that matter." },
  { name: "Experience", score: 72, current: "Worked on various projects and teams to deliver software solutions.", optimized: "Spearheaded the development of 12 microservices handling 2M daily requests, reducing system latency by 40% and saving $200K annually in infrastructure costs." },
  { name: "Skills", score: 88, current: "JavaScript, React, Node.js", optimized: "TypeScript • React • Node.js • AWS (EC2, Lambda, S3) • Docker • Kubernetes • PostgreSQL • Redis • GraphQL • CI/CD • Terraform" },
];

const messageTemplates = [
  { title: "Connection Request", text: "Hi [Name], I noticed we share a passion for [field]. I'd love to connect and learn from your experience at [Company]. Looking forward to exchanging ideas!" },
  { title: "Recruiter Follow-up", text: "Hi [Name], thank you for reaching out about the [Role] position. I'm very interested and would love to learn more about the team and the challenges you're solving. When would be a good time to chat?" },
  { title: "Informational Interview", text: "Hi [Name], I've been following [Company]'s work in [area] and I'm impressed by [specific achievement]. Would you be open to a brief 15-minute chat about your experience there?" },
];

const LinkedInOptimizer = () => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
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
            placeholder="Paste your LinkedIn profile URL..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-white-30"
          />
        </div>
        <button className="bg-blue-electric hover:bg-blue-bright text-primary-foreground px-6 rounded-xl font-medium text-sm transition-all flex items-center gap-2">
          Analyze <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Score bars */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="font-display font-semibold text-foreground mb-4">Section Scores</h3>
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
