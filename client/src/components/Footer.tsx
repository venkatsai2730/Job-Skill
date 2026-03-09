import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";

const Footer = () => (
  <footer className="bg-surface-1 border-t border-blue-muted/30 py-16 px-4">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <ScrollReveal direction="up" className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-electric flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">JobSkill AI</span>
          </div>
          <p className="text-white-60 text-sm leading-relaxed">
            AI-powered career acceleration. Land your dream job faster.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.1}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Product</h4>
          <ul className="space-y-2">
            {["AI Coach", "ATS Scanner", "Job Tracker", "Resume Builder", "LinkedIn Optimizer"].map((item) => (
              <li key={item}>
                <Link to="/auth" className="text-white-60 hover:text-foreground text-sm transition-colors hover:translate-x-1 inline-block">
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.2}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Resources</h4>
          <ul className="space-y-2">
            {["Blog", "Documentation", "Career Tips", "API"].map((item) => (
              <li key={item}>
                <span className="text-white-60 text-sm cursor-pointer hover:text-foreground transition-colors">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.3}>
          <h4 className="font-display font-semibold text-foreground text-sm mb-4">Legal</h4>
          <ul className="space-y-2">
            {["Privacy Policy", "Terms of Service", "Security", "Contact"].map((item) => (
              <li key={item}>
                <span className="text-white-60 text-sm cursor-pointer hover:text-foreground transition-colors">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className="border-t border-blue-muted/30 pt-6 text-center"
      >
        <p className="text-white-30 text-xs">
          © 2025 JobSkill AI · 256-bit Encrypted · SOC2 Ready
        </p>
      </motion.div>
    </div>
  </footer>
);

export default Footer;
