import { motion } from "framer-motion";
import { Upload, Brain, Rocket } from "lucide-react";

const steps = [
  { icon: Upload, num: "01", title: "Upload your resume", desc: "Drop your resume PDF and let AI do the heavy lifting." },
  { icon: Brain, num: "02", title: "AI analyzes & scores", desc: "Get ATS score, keyword gaps, tone analysis, and rewrite suggestions instantly." },
  { icon: Rocket, num: "03", title: "Apply with confidence", desc: "Submit polished, ATS-optimized resumes and land more interviews." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-4 starfield">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight mb-4">
            <span className="text-foreground font-bold">How it works</span>
          </h2>
          <p className="text-white-60 text-lg">Three simple steps to your dream job.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px border-t-2 border-dashed border-blue-electric/30" />

          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className="glass-card p-8 text-center relative"
            >
              <motion.div
                whileHover={{ scale: 1.15 }}
                className="w-10 h-10 rounded-full bg-blue-electric text-primary-foreground font-mono font-semibold text-sm flex items-center justify-center mx-auto mb-6"
              >
                {step.num}
              </motion.div>
              <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-blue-electric" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{step.title}</h3>
              <p className="text-white-60 text-sm">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
