import { motion } from "framer-motion";
import { FileSearch, Target, Linkedin, TrendingUp, BarChart3, MessageSquare } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "AI Career Assistant",
    desc: "Chat with your personal AI advisor. Get tailored resume feedback, interview prep, and job search strategies.",
    gradient: "from-purple-600 to-violet-500",
    span: "md:col-span-2",
  },
  {
    icon: FileSearch,
    title: "ATS Scanner",
    desc: "Instant ATS compatibility scoring. Know exactly where your resume stands before you apply.",
    gradient: "from-cyan-spark to-teal-400",
    span: "",
  },
  {
    icon: Target,
    title: "Smart Job Matcher",
    desc: "AI matches your skills to open roles and highlights keyword gaps to boost your match score.",
    gradient: "from-violet-500 to-pink-500",
    span: "",
  },
  {
    icon: BarChart3,
    title: "Skill Gap Analysis",
    desc: "Identify missing skills and get AI-powered recommendations to upskill fast for 2026 market demands.",
    gradient: "from-emerald-500 to-cyan-spark",
    span: "",
  },
  {
    icon: Linkedin,
    title: "LinkedIn Optimizer",
    desc: "Optimize your headline, about, and experience sections with AI-generated improvements.",
    gradient: "from-blue-500 to-cyan-400",
    span: "",
  },
  {
    icon: TrendingUp,
    title: "Career Analytics",
    desc: "Track applications, interview rates, and measure your job search progress over time.",
    gradient: "from-amber-500 to-orange-500",
    span: "md:col-span-2",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-28 px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-purple-400 border border-purple-500/20 bg-purple-500/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Everything You Need
          </span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight font-bold">
            <span className="text-gradient-hero">Your Smart Job Search</span>
            <br />
            <span className="text-white-60 font-normal text-3xl sm:text-4xl mt-2 block">Already built. Ready to deploy.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feat, i) => (
            <motion.div key={feat.title}
              initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className={`group relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 hover:border-purple-500/20 bento-glow ${feat.span}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-5 opacity-80 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                <feat.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{feat.title}</h3>
              <p className="text-white-60 text-sm leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
