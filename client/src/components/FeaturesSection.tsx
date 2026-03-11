import { motion } from "framer-motion";
import { FileSearch, Target, Linkedin, TrendingUp, BarChart3, MessageSquare } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "AI Career Coach",
    desc: "Chat with your personal AI career advisor. Get tailored resume feedback, interview prep, and job search strategies.",
    gradient: "from-blue-electric to-violet-pulse",
  },
  {
    icon: FileSearch,
    title: "ATS Scanner",
    desc: "Instant ATS compatibility scoring. Know exactly where your resume stands before you apply.",
    gradient: "from-cyan-spark to-blue-electric",
  },
  {
    icon: Target,
    title: "Job Matcher",
    desc: "AI matches your skills to open roles and highlights keyword gaps to boost your match score.",
    gradient: "from-violet-pulse to-rose-500",
  },
  {
    icon: BarChart3,
    title: "Skill Gap Analysis",
    desc: "Identify missing skills and get AI-powered recommendations to upskill fast.",
    gradient: "from-emerald-400 to-cyan-spark",
  },
  {
    icon: Linkedin,
    title: "LinkedIn Optimizer",
    desc: "Optimize your headline, about, and experience sections with AI-generated improvements.",
    gradient: "from-blue-electric to-cyan-spark",
  },
  {
    icon: TrendingUp,
    title: "Career Analytics",
    desc: "Track applications, interview rates, and measure your job search progress over time.",
    gradient: "from-amber-400 to-rose-500",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 px-4 bg-page relative">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[1px] bg-gradient-to-r from-transparent via-blue-electric/30 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-1.5 glass rounded-full px-4 py-1.5 text-sm text-cyan-spark mb-4">
            ✦ Benefits
          </span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight">
            <span className="text-white-60">Your smart job search </span>
            <span className="text-foreground font-bold">starts here</span>
          </h2>
          <p className="text-white-60 text-lg mt-4 max-w-xl mx-auto">
            Everything you need to land your dream role, powered by advanced AI.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="glass-card-hover p-8 group"
            >
              <motion.div
                whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.5 } }}
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-5 opacity-80 group-hover:opacity-100 transition-opacity`}
              >
                <feat.icon className="w-6 h-6 text-white" />
              </motion.div>
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
