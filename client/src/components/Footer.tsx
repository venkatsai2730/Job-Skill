import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";

const Footer = () => (
  <footer className="relative border-t border-white/[0.06] py-16 px-4">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <ScrollReveal direction="up" className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-600/15">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-foreground">JobSkill AI</span>
          </div>
          <p className="text-white-40 text-sm leading-relaxed">
            AI-powered career acceleration. Land your dream job faster.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Product</h4>
          <ul className="space-y-2.5">
            {["AI Assistant", "ATS Scanner", "Job Tracker", "Resume Builder", "LinkedIn Optimizer"].map((item) => (
              <li key={item}>
                <Link to="/auth" className="text-white-40 hover:text-foreground text-sm transition-colors">{item}</Link>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.2}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Resources</h4>
          <ul className="space-y-2.5">
            {["Blog", "Documentation", "Career Tips", "API"].map((item) => (
              <li key={item}><span className="text-white-40 text-sm cursor-pointer hover:text-foreground transition-colors">{item}</span></li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.3}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Legal</h4>
          <ul className="space-y-2.5">
            {["Privacy Policy", "Terms of Service", "Security", "Contact"].map((item) => (
              <li key={item}><span className="text-white-40 text-sm cursor-pointer hover:text-foreground transition-colors">{item}</span></li>
            ))}
          </ul>
        </ScrollReveal>
      </div>

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
        className="border-t border-white/[0.06] pt-6 text-center">
        <p className="text-white-30 text-xs">© 2026 JobSkill AI · 256-bit Encrypted · SOC2 Ready</p>
      </motion.div>
    </div>
  </footer>
);

export default Footer;
