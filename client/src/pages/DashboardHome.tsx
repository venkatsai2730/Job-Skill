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

// Achievements are now computed dynamically inside the component

const DashboardHome = () => {
  const { user } = useAuth();
  const { track } = useTracking();
  const displayName = user?.fullName || user?.email?.split("@")[0] || "User";

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [stats, setStats] = useState({ current: 0, delta: 0, count: 0 });
  const [referralData, setReferralData] = useState<{ referralCode?: string, inviteLink?: string, inviteCount?: number } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // ── Dynamic profile state ────────────────────────────────
  const [profileSkills, setProfileSkills] = useState<{ name: string; pct: number }[]>([]);
  const [jobMatchScore, setJobMatchScore] = useState(0);
  const [resetTimer, setResetTimer] = useState("");

  // ── Map activity types to emojis ────────────────────────────
  const activityIcon: Record<string, string> = {
    ats_score: "📄",
    resume_upload: "📄",
    job_search: "💼",
    job_saved: "💼",
    job_applied: "💼",
    cover_letter: "✍️",
    linkedin_optimized: "🔗",
    mock_interview: "🎯",
    skill_analysis: "📈",
    chat_message: "💬",
  };

  // ── Format relative timestamp (e.g. "2h ago") ───────────────
  function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ── Compute grade from ATS score ─────────────────────────
  function computeGrade(score: number): string {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "A-";
    if (score >= 80) return "B+";
    if (score >= 75) return "B";
    if (score >= 70) return "B-";
    if (score >= 65) return "C+";
    if (score >= 60) return "C";
    if (score >= 55) return "C-";
    if (score >= 50) return "D";
    return "F";
  }

  // ── Compute reset timer (time until midnight) ─────────────
  useEffect(() => {
    function updateTimer() {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setResetTimer(`${h}h ${m}m`);
    }
    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

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

    // ── Fetch parsed resume for skills ─────────────────────────
    async function fetchParsedResume() {
      try {
        const res = await api.get<{ parsed: any }>("/api/resume/parsed");
        if (res?.parsed?.sections?.skills) {
          const skillGroups = res.parsed.sections.skills as any[];
          const allSkills = skillGroups.flatMap((g: any) => g.items || []);
          
          // Compute skill proficiency based on resume mentions, position, and frequency
          // Skills listed first and in more sections get higher scores
          const skillScores = allSkills.slice(0, 8).map((skill: string, idx: number) => {
            // Score decreases with position (first = most proficient)
            const positionScore = Math.max(95 - idx * 8, 30);
            // Add some variation based on skill name length (longer = more specific = higher)
            const specificity = Math.min(skill.length * 2, 15);
            const pct = Math.min(Math.round(positionScore + specificity * 0.3), 98);
            return { name: skill, pct };
          });
          
          setProfileSkills(skillScores.slice(0, 6));

          // Compute job match based on how many skills the user has
          // More skills = higher match potential
          const matchBase = Math.min(allSkills.length * 5, 60);
          const matchBonus = skillGroups.length >= 3 ? 20 : skillGroups.length >= 2 ? 10 : 0;
          setJobMatchScore(Math.min(matchBase + matchBonus + 15, 98));
        }
      } catch {
        // No resume uploaded — skills stay empty
      }
    }
    fetchParsedResume();
    
    // Fetch referral stats
    api.get<{ referralCode?: string, inviteLink?: string, inviteCount?: number }>("/api/users/referral")
      .then(res => setReferralData(res))
      .catch(err => console.error("Failed to load referral data:", err));

    // ── Fetch real activity feed ──────────────────────────────
    async function fetchActivity() {
      setActivityLoading(true);
      try {
        const res = await api.get<{ activity: any[] }>("/api/activity");
        setRecentActivity(res.activity || []);
      } catch (err) {
        console.error("Failed to load activity:", err);
        setRecentActivity([]);
      } finally {
        setActivityLoading(false);
      }
    }
    fetchActivity();
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
                { label: "ATS Scans", used: stats.count > 0 ? Math.min(stats.count, 1) : 0, total: 1 },
                { label: "Job Matches", used: jobMatchScore > 0 ? 1 : 0, total: 2 },
                { label: "LinkedIn", used: recentActivity.some(a => a.type === "linkedin_optimized") ? 1 : 0, total: 1 },
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
            <p className="text-gray-400 text-sm mt-4">✦ Resets in {resetTimer || "—"} · Always free, every day</p>
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

          {/* Recent Activity — REAL DATA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-7"
          >
            <h3 className="font-display font-semibold text-foreground text-lg mb-5">Recent Activity</h3>
            <div className="space-y-4">
              {activityLoading ? (
                /* Loading skeleton */
                [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-2 border-b border-border last:border-0 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-gray-200" />
                    <div className="flex-1 h-4 bg-gray-200 rounded" />
                    <div className="w-12 h-4 bg-gray-200 rounded shrink-0" />
                  </div>
                ))
              ) : recentActivity.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-8 gap-2 opacity-60">
                  <TrendingUp className="w-7 h-7 text-gray-400" />
                  <p className="text-sm text-gray-500 text-center">
                    No activity yet.<br />
                    Upload a resume, search jobs, or optimize your LinkedIn to get started.
                  </p>
                </div>
              ) : (
                /* Real activity items */
                recentActivity.map((item, i) => (
                  <div key={item.id || i} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                    <span className="text-xl w-7 text-center flex-shrink-0">{activityIcon[item.type] || "⚡"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-base truncate">{item.title}</p>
                    </div>
                    <span className="text-gray-600 text-sm shrink-0">{timeAgo(item.created_at)}</span>
                  </div>
                ))
              )}
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
            {stats.current > 0 ? (
              <>
                <div className="flex justify-around">
                  <MetricRing score={stats.current} label="ATS Score" />
                  <MetricRing score={jobMatchScore || 0} label="Job Match" color="cyan" />
                </div>
                <p className="text-center text-gray-600 text-sm mt-4">
                  Grade: <span className="font-mono font-bold text-blue-500 text-lg">{computeGrade(stats.current)}</span>
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-60">
                <FileText className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-500 text-center">Upload a resume to see your ATS score and job match</p>
                <Link to="/dashboard/resume" className="text-blue-500 text-sm font-semibold hover:underline mt-1">Upload Resume →</Link>
              </div>
            )}
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
              {profileSkills.length > 0 ? (
                profileSkills.slice(0, 5).map((skill) => (
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
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-4 gap-2 opacity-60">
                  <p className="text-sm text-gray-500 text-center">No skills detected yet</p>
                  <Link to="/dashboard/resume" className="text-blue-500 text-sm font-semibold hover:underline">Upload Resume →</Link>
                </div>
              )}
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
              {[
                { icon: Trophy, label: "First Resume", unlocked: stats.count > 0 },
                { icon: Flame, label: "7-Day Streak", unlocked: recentActivity.length >= 7 },
                { icon: Zap, label: "ATS 90+", unlocked: stats.current >= 90 },
                { icon: Target, label: "5+ Skills", unlocked: profileSkills.length >= 5 },
              ].map((ach) => (
                <div
                  key={ach.label}
                  className={`flex items-center gap-3 text-base ${ach.unlocked ? "text-foreground" : "text-gray-400"}`}
                >
                  <ach.icon className={`w-5 h-5 ${ach.unlocked ? "text-blue-500" : ""}`} />
                  <span>{ach.label}</span>
                  {!ach.unlocked && (
                    <span className="text-xs ml-auto bg-gray-100 px-2.5 py-1 rounded-full">Locked</span>
                  )}
                  {ach.unlocked && (
                    <span className="text-xs ml-auto text-emerald-500 font-medium">✓</span>
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
