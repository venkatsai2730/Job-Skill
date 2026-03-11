import { Star, MapPin, DollarSign, Clock, Bot, ExternalLink, Filter, ChevronDown } from "lucide-react";

const STATS = [
  { icon: "📋", label: "Total", value: "24" },
  { icon: "✅", label: "Active", value: "18" },
  { icon: "🎯", label: "Interviews", value: "4" },
  { icon: "🏆", label: "Offers", value: "1" },
  { icon: "📈", label: "Response Rate", value: "23%" },
];

const JOBS = [
  { id: 1, status: "Saved", role: "Senior Frontend Engineer", company: "Notion", location: "SF / Remote", salary: "$180-220k", match: "89% MATCH", time: "2d ago", starred: true },
  { id: 2, status: "Saved", role: "Full Stack Developer", company: "Linear", location: "Remote", salary: "$160-200k", match: "79% MATCH", time: "5d ago", starred: false },
  { id: 3, status: "Applied", role: "Software Engineer, Payments", company: "Stripe", location: "SF", salary: "$190-240k", match: "87% MATCH", time: "3d ago", starred: true },
  { id: 4, status: "Applied", role: "Senior Engineer, Edge", company: "Vercel", location: "Remote", salary: "$175-210k", match: "82% MATCH", time: "7d ago", starred: false },
  { id: 5, status: "Interview", role: "Staff Engineer", company: "Figma", location: "SF / NY", salary: "$200-260k", match: "91% MATCH", time: "18d ago", starred: true },
  { id: 6, status: "Offer", role: "Senior SRE", company: "Datadog", location: "NY", salary: "$195-230k", match: "85% MATCH", time: "14d ago", starred: false },
];

const COLUMNS = [
  { name: "Saved", status: "Saved", color: "text-white-60", count: 2 },
  { name: "Applied", status: "Applied", color: "text-blue-electric", count: 2 },
  { name: "Interview", status: "Interview", color: "text-cyan-spark", count: 1 },
  { name: "Offer", status: "Offer", color: "text-emerald-400", count: 1 },
];

const Jobs = () => {
  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-bold text-foreground mb-1.5 tracking-tight">Job Applications</h1>
        <p className="text-white-60 text-[15px] font-medium">Track and manage your job search pipeline.</p>
      </div>

      {/* Stats & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10 w-full">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide py-1">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/[0.06] shadow-sm bg-surface-1 shrink-0">
              <span className="text-[1.1rem]">{stat.icon}</span>
              <span className="text-white-60 font-medium text-[13px]">{stat.label}:</span>
              <span className="text-blue-electric font-bold text-[15px]">{stat.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 items-center shrink-0">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-surface-1 border border-white/[0.06] rounded-full text-white-60 font-medium text-[13px] hover:bg-surface-2 transition-all shadow-sm">
            Status: All <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-50" />
          </button>
          <button className="flex items-center gap-1.5 px-5 py-2 bg-blue-electric border border-transparent rounded-full text-primary-foreground font-medium text-[13px] shadow-md shadow-blue-electric/20 hover:bg-blue-bright transition-all">
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {COLUMNS.map((col) => {
          const colJobs = JOBS.filter(j => j.status === col.status);
          return (
            <div key={col.name} className="flex-1 min-w-[300px] w-full">
              <div className="flex items-center gap-2.5 mb-5 px-1">
                <h3 className={`font-display font-bold text-lg ${col.color}`}>{col.name}</h3>
                <span className="bg-surface-3 text-white-40 text-xs font-bold px-2 py-0.5 rounded-md">{col.count}</span>
              </div>
              <div className="space-y-4">
                {colJobs.map((job) => (
                  <div key={job.id} className="glass-card-hover p-5 cursor-pointer group relative">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-electric/15 flex items-center justify-center text-blue-electric font-display font-bold text-base uppercase shrink-0">
                          {job.company.charAt(0)}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h4 className="text-foreground font-semibold text-[15px] leading-snug group-hover:text-blue-electric transition-colors">{job.role}</h4>
                          <p className="text-white-40 font-medium text-[13px] tracking-wide">{job.company}</p>
                        </div>
                      </div>
                      <Star className={`w-5 h-5 shrink-0 transition-all ${job.starred ? "text-blue-electric fill-blue-electric" : "text-white-30 group-hover:text-white-40"}`} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-5">
                      <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                        <MapPin className="w-3.5 h-3.5 text-white-30" /> {job.location}
                      </div>
                      <div className="flex items-center gap-1.5 text-white-40 text-[12px] font-medium">
                        <DollarSign className="w-3.5 h-3.5 text-white-30" /> {job.salary}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {job.match}
                      </div>
                      <div className="flex items-center gap-1.5 text-white-30 text-[11px] font-medium">
                        <Clock className="w-3 h-3" /> {job.time}
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/[0.06] pt-4 mt-1">
                      <button className="flex items-center gap-1.5 text-blue-electric font-semibold text-[13px] hover:underline outline-none">
                        <Bot className="w-4 h-4" /> AI Coach
                      </button>
                      <button className="flex items-center gap-1.5 text-white-40 font-medium text-[13px] hover:text-white-60 group/jd outline-none transition-colors">
                        <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover/jd:-translate-y-0.5 group-hover/jd:translate-x-0.5" /> View JD
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Jobs;
