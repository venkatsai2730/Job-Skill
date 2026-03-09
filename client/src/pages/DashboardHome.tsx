import { motion } from "framer-motion";
import { Gift, TrendingUp, FileText, Briefcase, Target, Trophy, Flame, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const MetricRing = ({ score, label, color = "blue" }: { score: number; label: string; color?: string }) => {
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="7" />
        <motion.circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={color === "cyan" ? "hsl(var(--cyan-spark))" : "hsl(var(--blue-electric))"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          filter="url(#glow)"
        />
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text x="55" y="52" textAnchor="middle" className="fill-foreground font-mono font-bold text-2xl">
          {score}
        </text>
        <text x="55" y="68" textAnchor="middle" className="fill-white-60 font-body text-xs">
          {label}
        </text>
      </svg>
    </div>
  );
};

const quickActions = [
  { icon: FileText, label: "Fix Resume", desc: "AI-powered resume optimization", path: "/dashboard/resume" },
  { icon: Target, label: "Find Jobs", desc: "Match with top opportunities", path: "/dashboard/jobs" },
  { icon: TrendingUp, label: "Skill Gap", desc: "Identify & close skill gaps", path: "/dashboard/chat" },
];

const achievements = [
  { icon: Trophy, label: "First Resume", unlocked: true },
  { icon: Flame, label: "7-Day Streak", unlocked: true },
  { icon: Zap, label: "ATS 90+", unlocked: false },
];

const DashboardHome = () => {
  return (
    <div className="p-6 lg:p-10 space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-1">
          Welcome back, Alex
        </h1>
        <p className="text-white-60 text-base lg:text-lg">Here are your latest career insights.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left: main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {quickActions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={action.path}
                  className="glass-card-hover p-6 flex flex-col items-center gap-3 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-blue-electric/10 flex items-center justify-center">
                    <action.icon className="w-7 h-7 text-blue-electric" />
                  </div>
                  <span className="text-foreground text-base font-semibold">{action.label}</span>
                  <span className="text-white-60 text-sm">{action.desc}</span>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Daily credits */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-7"
          >
            <div className="flex items-center gap-2.5 mb-4">
              <Gift className="w-6 h-6 text-blue-electric" />
              <h3 className="font-display font-semibold text-foreground text-lg">Daily Free Allowance</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "AI Chats", used: 3, total: 5 },
                { label: "ATS Scans", used: 0, total: 1 },
                { label: "Job Matches", used: 1, total: 2 },
                { label: "LinkedIn", used: 0, total: 1 },
              ].map((credit) => (
                <div key={credit.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white-60">{credit.label}</span>
                    <span className="text-foreground font-mono font-semibold">{credit.used}/{credit.total}</span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-electric rounded-full transition-all"
                      style={{ width: `${(credit.used / credit.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white-30 text-sm mt-4">✦ Resets in 4h 23m · Always free, every day</p>
          </motion.div>

          {/* This week */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground text-lg mb-5">This Week</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "Chats", value: "12" },
                { label: "Resumes", value: "3" },
                { label: "Jobs Applied", value: "8" },
                { label: "Interviews", value: "1 🎉" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-mono font-bold text-3xl text-blue-electric">{stat.value}</p>
                  <p className="text-white-60 text-sm mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground text-lg mb-5">Recent Activity</h3>
            <div className="space-y-4">
              {[
                { action: "Applied to Senior Engineer at Stripe", time: "2h ago", type: "job", icon: "💼" },
                { action: "AI Resume scan completed — ATS score: 87%", time: "3h ago", type: "resume", icon: "📄" },
                { action: "Completed mock interview for System Design", time: "5h ago", type: "chat", icon: "🎯" },
                { action: "LinkedIn headline optimized — 3x more views", time: "1d ago", type: "linkedin", icon: "🔗" },
                { action: "Saved Full Stack Developer role at Notion", time: "1d ago", type: "job", icon: "💼" },
                { action: "Skills gap analysis: React advanced +12%", time: "2d ago", type: "skill", icon: "📈" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-base truncate">{item.action}</p>
                  </div>
                  <span className="text-white-60 text-sm shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Scores */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground mb-5 text-base">Your Profile</h3>
            <div className="flex justify-around">
              <MetricRing score={87} label="ATS Score" />
              <MetricRing score={92} label="Job Match" color="cyan" />
            </div>
            <p className="text-center text-white-60 text-sm mt-4">
              Grade: <span className="font-mono font-bold text-blue-electric text-lg">A-</span>
            </p>
          </motion.div>

          {/* Skills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground mb-5 text-base">Top Skills</h3>
            <div className="space-y-4">
              {[
                { name: "React", pct: 85 },
                { name: "Node.js", pct: 70 },
                { name: "AWS", pct: 55 },
                { name: "Docker", pct: 40 },
              ].map((skill) => (
                <div key={skill.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-foreground font-medium">{skill.name}</span>
                    <span className="text-white-60 font-mono">{skill.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-electric rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${skill.pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Achievements */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground mb-5 text-base">Achievements</h3>
            <div className="space-y-4">
              {achievements.map((ach) => (
                <div
                  key={ach.label}
                  className={`flex items-center gap-3 text-base ${ach.unlocked ? "text-foreground" : "text-white-30"}`}
                >
                  <ach.icon className={`w-5 h-5 ${ach.unlocked ? "text-blue-electric" : ""}`} />
                  <span>{ach.label}</span>
                  {!ach.unlocked && (
                    <span className="text-xs ml-auto bg-surface-3 px-2.5 py-1 rounded-full">Locked</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Upgrade CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-2xl p-6 bg-gradient-to-br from-blue-electric to-indigo-soft text-white"
          >
            <h3 className="font-display font-bold text-lg mb-2">Go Pro ✦</h3>
            <p className="text-white/80 text-sm mb-4 leading-relaxed">
              Unlimited AI chats, ATS scans, job matches, and priority support.
            </p>
            <Link
              to="/pricing"
              className="block text-center bg-white text-blue-electric font-semibold text-sm py-2.5 rounded-lg hover:bg-white/90 transition-colors"
            >
              Upgrade Now — $19/mo
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
