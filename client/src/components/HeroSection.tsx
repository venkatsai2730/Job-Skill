import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import HeroCard3D from "./HeroCard3D";

const trustedLogos = ["Google", "Amazon", "Meta", "Stripe", "Figma", "Netflix"];

const stats = [
  { value: "12,847", label: "resumes optimized" },
  { value: "94%", label: "interview rate" },
  { value: "4.9★", label: "rating" },
  { value: "3x", label: "faster hiring" },
];

const HeroSection = () => {
  return (
    <section className="starfield min-h-screen pt-24 pb-16 px-4 overflow-hidden relative">
      {/* Animated gradient orbs */}
      <div className="hero-orb hero-orb-1" />
      <div className="hero-orb hero-orb-2" />
      <div className="hero-orb hero-orb-3" />

      {/* Particle grid overlay */}
      <div className="absolute inset-0 particle-grid opacity-40 pointer-events-none" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Trust badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-8"
        >
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full bg-blue-electric/30 border-2 border-surface-1 flex items-center justify-center text-[8px] text-foreground font-bold"
              >
                👤
              </div>
            ))}
          </div>
          <span className="text-white-60 text-sm">Trusted by 100,000+ professionals worldwide</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-[-0.04em] mb-6"
        >
          <span className="font-extrabold text-foreground">Land your dream job</span>
          <br />
          <span className="font-normal text-gradient-blue">smarter, faster, better.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-white-60 text-lg sm:text-xl max-w-xl mx-auto mb-8 leading-relaxed"
        >
          AI-powered career coaching tailored to your dream role.
          <br className="hidden sm:block" />
          Get ATS-optimized, job-matched, and interview-ready — in minutes.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3"
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/auth"
              className="bg-blue-electric hover:bg-blue-bright text-primary-foreground font-semibold text-base px-8 py-3.5 rounded-full transition-all hover:shadow-[0_0_40px_rgba(124,101,255,0.5)] flex items-center gap-2"
            >
              <span className="text-cyan-spark">✦</span> Build my Resume →
            </Link>
          </motion.div>
          <motion.button
            whileHover={{ scale: 1.04, borderColor: "hsl(210, 40%, 96%)" }}
            whileTap={{ scale: 0.97 }}
            className="border border-white-30 text-white-60 hover:text-foreground font-medium text-base px-8 py-3.5 rounded-full transition-all"
          >
            Request demo
          </motion.button>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-white-60 text-sm"
        >
          🎁 5 free AI chats daily — no credit card needed
        </motion.p>

        {/* 3D Hero Card */}
        <HeroCard3D />

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="glass rounded-2xl p-4 sm:p-6 max-w-3xl mx-auto mb-12"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-mono font-semibold text-xl sm:text-2xl text-foreground">{stat.value}</p>
                <p className="text-white-60 text-xs sm:text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trust logos */}
        <div className="text-center">
          <p className="text-white-30 text-sm mb-4">Works with job seekers who landed roles at</p>
          <div className="flex items-center justify-center flex-wrap gap-6 sm:gap-10">
            {trustedLogos.map((logo) => (
              <span key={logo} className="text-white-30 font-display font-bold text-sm sm:text-base opacity-40 hover:opacity-70 transition-opacity">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
