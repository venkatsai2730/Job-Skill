import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";

const trustedLogos = ["Google", "Amazon", "Meta", "Stripe", "Figma", "Netflix"];

const stats = [
  { value: "12,847", label: "Resumes Optimized" },
  { value: "94%", label: "Interview Rate" },
  { value: "4.9★", label: "User Rating" },
  { value: "3x", label: "Faster Hiring" },
];

const HeroSection = () => {
  return (
    <section className="relative min-h-screen pt-28 pb-20 px-4 overflow-hidden">
      {/* Background effects */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />
      <div className="absolute inset-0 particle-grid opacity-30 pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full px-5 py-2 border border-white/[0.08] bg-white/[0.03]">
            <div className="flex -space-x-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 border-2 border-background flex items-center justify-center text-[8px] text-white font-bold">
                  {["S", "M", "P", "D"][i - 1]}
                </div>
              ))}
            </div>
            <span className="text-white-60 text-sm">Trusted by <span className="text-foreground font-medium">100,000+</span> professionals</span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="text-center max-w-4xl mx-auto mb-8"
        >
          <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.5rem] leading-[1.08] tracking-[-0.03em] font-bold">
            <span className="text-gradient-hero">Land Your Dream Job</span>
            <br />
            <span className="text-gradient-blue">Smarter & Faster</span>
          </h1>
        </motion.div>

        {/* Subtext */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="text-white-60 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed text-center"
        >
          Delegate your job search to AI. Get ATS-optimized resumes, smart job matching, and interview prep — all in minutes.
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to="/auth"
              className="group bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white font-semibold text-base px-8 py-4 rounded-full transition-all hover:shadow-[0_0_50px_rgba(124,58,237,0.4)] flex items-center gap-2">
              Try for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <a href="/#how-it-works"
              className="flex items-center gap-2 border border-white/[0.12] text-white-60 hover:text-foreground hover:border-white/[0.2] font-medium text-base px-8 py-4 rounded-full transition-all hover:bg-white/[0.03]">
              <Play className="w-4 h-4" /> How it works
            </a>
          </motion.div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="text-center text-white-40 text-sm mb-16"
        >
          5 free AI chats daily — no credit card needed
        </motion.p>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.1 }}
                className="text-center p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] bento-glow"
              >
                <p className="font-display font-bold text-2xl sm:text-3xl text-foreground">{stat.value}</p>
                <p className="text-white-40 text-xs sm:text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Trust logos */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="text-center"
        >
          <p className="text-white-30 text-xs uppercase tracking-widest mb-5">Professionals who landed roles at</p>
          <div className="flex items-center justify-center flex-wrap gap-8 sm:gap-12">
            {trustedLogos.map((logo) => (
              <span key={logo} className="text-white-30 font-display font-bold text-sm sm:text-base opacity-40 hover:opacity-80 transition-opacity duration-300">
                {logo}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
