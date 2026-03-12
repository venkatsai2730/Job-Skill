import { motion } from "framer-motion";
import { Upload, Brain, Rocket } from "lucide-react";

const steps = [
  {
    icon: Upload, num: "1",
    title: "Upload Your Resume",
    desc: "Drop your resume PDF and let AI do the heavy lifting. Works with any format.",
  },
  {
    icon: Brain, num: "2",
    title: "AI Analyzes & Scores",
    desc: "Get ATS score, keyword gaps, tone analysis, and rewrite suggestions instantly.",
  },
  {
    icon: Rocket, num: "3",
    title: "Apply With Confidence",
    desc: "Submit polished, ATS-optimized resumes and land more interviews.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-28 px-4 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-cyan-spark border border-cyan-spark/20 bg-cyan-spark/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-spark animate-pulse" />
            Deploy in 2 Minutes
          </span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight font-bold text-gradient-hero">
            AI That Actually Works
          </h2>
          <p className="text-white-60 text-lg mt-4 max-w-xl mx-auto">Three simple steps to your dream job.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-20 left-[20%] right-[20%] h-px border-t border-dashed border-purple-500/20" />

          {steps.map((step, i) => (
            <motion.div key={step.num}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="group relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-center hover:bg-white/[0.04] hover:border-purple-500/20 transition-all duration-500 bento-glow"
            >
              {/* Step number */}
              <div className="relative mx-auto mb-6 w-14 h-14">
                <div className="absolute inset-0 rounded-full bg-purple-600/20 animate-pulse-ring" />
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center text-white font-display font-bold text-lg shadow-lg shadow-purple-600/20">
                  {step.num}
                </div>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5 group-hover:border-purple-500/20 transition-colors">
                <step.icon className="w-7 h-7 text-purple-400 group-hover:text-purple-300 transition-colors" />
              </div>

              <h3 className="font-display font-bold text-lg text-foreground mb-2">{step.title}</h3>
              <p className="text-white-60 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
