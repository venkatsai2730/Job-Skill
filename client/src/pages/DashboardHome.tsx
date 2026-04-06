import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, TrendingUp, FileText, Briefcase, Target, Trophy, Flame, Zap, ArrowUpRight, ArrowDownRight, Minus, Share2, Users, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTracking } from "@/hooks/useTracking";
import { api } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MetricRing = ({ score, label, color = "blue" }: { score: number; label: string; color?: string }) => {
// ...
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
// ...
  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
        <motion.circle
          cx="55" cy="55" r={r}
          fill="none"
          stroke={color === "cyan" ? "#06b6d4" : "#3b82f6"}
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
        <text x="55" y="68" textAnchor="middle" className="fill-slate-500 font-body text-xs">
          {label}
        </text>
      </svg>
    </div>
  );
};

const quickActions = [
  { icon: FileText, label: "Fix Resume", desc: "AI-powered resume scoring", path: "/dashboard/resume" },
  { icon: Target, label: "Find Jobs", desc: "Real-time from Greenhouse & Lever", path: "/dashboard/jobs" },
  { icon: TrendingUp, label: "AI Coach", desc: "Smart career coaching", path: "/dashboard/chat" },
];

const achievements = [
  { icon: Trophy, label: "First Resume", unlocked: true },
  { icon: Flame, label: "7-Day Streak", unlocked: true },
  { icon: Zap, label: "ATS 90+", unlocked: false },
];

const DashboardHome = () => {
  const { user } = useAuth();
  const { track } = useTracking();
  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [stats, setStats] = useState({ current: 0, delta: 0, count: 0 });
  const [referralData, setReferralData] = useState<{ referralCode?: string, inviteLink?: string, inviteCount?: number } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    track("dashboard_viewed");
    
    async function fetchHistory() {
      try {
        const res = await api.get<{ history: any[] }>("/api/resume/history");
        const list = res.history || [];
        
        // Map to chart format
        const chartData = list.map((item, i) => ({
          name: new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          score: item.atsScore || 0,
          rawDate: item.createdAt,
        }));
        setHistoryData(chartData);

        // Calc delta
        if (list.length > 0) {
          const first = list[0].atsScore || 0;
          const current = list[list.length - 1].atsScore || 0;
          setStats({
            current,
            delta: current - first,
            count: list.length
          });
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    }
    fetchHistory();
    
    // Fetch referral stats
    api.get<{ referralCode?: string, inviteLink?: string, inviteCount?: number }>("/api/users/referral")
      .then(res => setReferralData(res))
      .catch(err => console.error("Failed to load referral data:", err));
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 lg:p-10 space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-1">
          Welcome back, {displayName}
        </h1>
        <p className="text-gray-600 text-base lg:text-lg">Here are your latest career insights.</p>
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
                  <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <action.icon className="w-7 h-7 text-blue-500" />
                  </div>
                  <span className="text-foreground text-base font-semibold">{action.label}</span>
                  <span className="text-gray-600 text-sm">{action.desc}</span>
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
              <Gift className="w-6 h-6 text-blue-500" />
              <h3 className="font-display font-semibold text-foreground text-lg">Daily Free Allowance</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                { label: "AI Chats", used: user?.dailyCreditsUsed || 0, total: user?.dailyCreditsLimit || 5 },
                { label: "ATS Scans", used: 0, total: 1 },
                { label: "Job Matches", used: 1, total: 2 },
                { label: "LinkedIn", used: 0, total: 1 },
              ].map((credit) => (
                <div key={credit.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">{credit.label}</span>
                    <span className="text-foreground font-mono font-semibold">{credit.used}/{credit.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(credit.used / credit.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-gray-400 text-sm mt-4">✦ Resets in 4h 23m · Always free, every day</p>
          </motion.div>

          {/* Phase 7: Score Progress & Improvement */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-7"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-foreground text-lg">Score Progression</h3>
              <div className="flex items-center gap-3">
                 {stats.delta !== 0 && (
                   <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${stats.delta > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"}`}>
                      {stats.delta > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {Math.abs(stats.delta)} pts
                   </div>
                 )}
                 <span className="text-gray-500 text-sm">{stats.count} versions</span>
              </div>
            </div>
            
            {historyData.length > 1 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="name" 
                      stroke="rgba(148, 163, 184, 0.3)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="rgba(148, 163, 184, 0.3)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={['auto', 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                      itemStyle={{ color: '#334155' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="url(#colorScore)" 
                      strokeWidth={3} 
                      dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                    />
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
                <div className="h-48 w-full border border-border border-dashed rounded-xl flex items-center justify-center flex-col gap-2 opacity-60">
                    <TrendingUp className="w-6 h-6 text-gray-500" />
                    <p className="text-sm text-gray-500">Upload multiple versions to see your progression trend</p>
                </div>
            )}
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
                <div key={i} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-base truncate">{item.action}</p>
                  </div>
                  <span className="text-gray-600 text-sm shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Referral Card */}
          {referralData?.inviteLink && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative p-7 rounded-2xl overflow-hidden glass-card bg-gradient-to-r from-white to-blue-50/50"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <h3 className="font-display font-semibold text-foreground text-lg">Invite Friends, Get Pro</h3>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    Share your link. When 3 friends sign up, you unlock a <strong>Free Month of Pro</strong> (Unlimited AI chats & ATS Scans).
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 items-center bg-gray-50 border border-border rounded-lg p-2.5">
                      <span className="text-gray-600 text-sm truncate select-all">{referralData.inviteLink}</span>
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(referralData.inviteLink!);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="md:w-px md:h-24 bg-black/[0.05] hidden md:block" />

                <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-border min-w-[120px]">
                  <span className="text-3xl font-display font-bold text-foreground mb-1">{referralData.inviteCount || 0}</span>
                  <span className="text-gray-600 text-xs uppercase tracking-wider font-medium">Friends Joined</span>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all" 
                      style={{ width: `${Math.min(((referralData.inviteCount || 0) / 3) * 100, 100)}%` }} 
                    />
                  </div>
                  <span className="text-gray-400 text-[10px] mt-1.5">{3 - (referralData.inviteCount || 0)} more to unlock Pro</span>
                </div>
              </div>
            </motion.div>
          )}
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
            <p className="text-center text-gray-600 text-sm mt-4">
              Grade: <span className="font-mono font-bold text-blue-500 text-lg">A-</span>
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
                    <span className="text-gray-600 font-mono">{skill.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
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
                  className={`flex items-center gap-3 text-base ${ach.unlocked ? "text-foreground" : "text-gray-400"}`}
                >
                  <ach.icon className={`w-5 h-5 ${ach.unlocked ? "text-blue-500" : ""}`} />
                  <span>{ach.label}</span>
                  {!ach.unlocked && (
                    <span className="text-xs ml-auto bg-gray-100 px-2.5 py-1 rounded-full">Locked</span>
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
            className="rounded-2xl p-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
          >
            <h3 className="font-display font-bold text-lg mb-2">Go Pro ✦</h3>
            <p className="text-white/80 text-sm mb-4 leading-relaxed">
              Unlimited AI chats, ATS scans, job matches, and priority support.
            </p>
            <Link
              to="/pricing"
              className="block text-center bg-white text-blue-600 font-semibold text-sm py-2.5 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
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
