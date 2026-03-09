import { motion } from "framer-motion";
import { Briefcase, MapPin, DollarSign, Clock, Star, Bot, ExternalLink } from "lucide-react";

const columns = [
  {
    name: "Saved",
    color: "white-60",
    jobs: [
      { company: "Notion", role: "Senior Frontend Engineer", location: "SF / Remote", salary: "$180-220k", match: 89, days: 2, starred: true },
      { company: "Linear", role: "Full Stack Developer", location: "Remote", salary: "$160-200k", match: 79, days: 5, starred: false },
    ],
  },
  {
    name: "Applied",
    color: "blue-electric",
    jobs: [
      { company: "Stripe", role: "Software Engineer, Payments", location: "SF", salary: "$190-240k", match: 87, days: 3, starred: true },
      { company: "Vercel", role: "Senior Engineer, Edge", location: "Remote", salary: "$175-210k", match: 82, days: 7, starred: false },
    ],
  },
  {
    name: "Interview",
    color: "cyan-spark",
    jobs: [
      { company: "Figma", role: "Staff Engineer", location: "SF / NY", salary: "$200-260k", match: 91, days: 10, starred: true },
    ],
  },
  {
    name: "Offer",
    color: "success",
    jobs: [
      { company: "Datadog", role: "Senior SRE", location: "NY", salary: "$195-230k", match: 85, days: 14, starred: false },
    ],
  },
];

const stats = [
  { icon: "📋", label: "Total", value: "24" },
  { icon: "✅", label: "Active", value: "18" },
  { icon: "🎯", label: "Interviews", value: "4" },
  { icon: "🏆", label: "Offers", value: "1" },
  { icon: "📈", label: "Response Rate", value: "23%" },
];

const Jobs = () => {
  return (
    <div className="p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Job Applications</h1>
        <p className="text-white-60 text-base mb-6">Track and manage your job search pipeline.</p>
      </motion.div>

      {/* Stats */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-full px-5 py-2.5 flex items-center gap-2.5 shrink-0">
            <span className="text-lg">{stat.icon}</span>
            <span className="text-white-60 text-sm">{stat.label}:</span>
            <span className="text-blue-electric font-mono font-semibold text-base">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col, ci) => (
          <motion.div
            key={col.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.1 }}
            className="min-w-[300px] flex-1"
          >
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className={`font-display font-semibold text-base text-${col.color}`}>{col.name}</h3>
              <span className="bg-surface-2 text-white-60 text-xs px-2 py-0.5 rounded-full font-mono">
                {col.jobs.length}
              </span>
            </div>

            <div className="space-y-3">
              {col.jobs.map((job, ji) => (
                <motion.div
                  key={job.company + job.role}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: ci * 0.1 + ji * 0.05 }}
                  className="glass-card-hover p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-electric/20 to-cyan-spark/10 flex items-center justify-center text-blue-electric font-display font-bold text-xs">
                        {job.company.charAt(0)}
                      </div>
                      <div>
                        <p className="text-foreground font-semibold text-base">{job.role}</p>
                        <p className="text-white-60 text-sm">{job.company}</p>
                      </div>
                    </div>
                    <Star className={`w-4 h-4 ${job.starred ? "text-blue-electric fill-blue-electric" : "text-white-30"}`} />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="flex items-center gap-1.5 text-white-60 text-sm">
                      <MapPin className="w-4 h-4" /> {job.location}
                    </span>
                    <span className="flex items-center gap-1.5 text-white-60 text-sm">
                      <DollarSign className="w-4 h-4" /> {job.salary}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="bg-cyan-spark/10 text-cyan-spark text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                      {job.match}% match
                    </span>
                    <span className="flex items-center gap-1 text-white-30 text-xs font-mono">
                      <Clock className="w-3 h-3" /> {job.days}d ago
                    </span>
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-blue-muted/20">
                    <button className="text-blue-electric text-xs hover:underline flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Coach
                    </button>
                    <button className="text-white-60 text-xs hover:text-foreground flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> View JD
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Jobs;
