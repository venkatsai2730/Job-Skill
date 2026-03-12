import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import FeaturesSection from "../components/FeaturesSection";
import HowItWorks from "../components/HowItWorks";
import TestimonialsSection from "../components/TestimonialsSection";
import PricingSection from "../components/PricingSection";
import FAQSection from "../components/FAQSection";
import Footer from "../components/Footer";
import PageTransition from "../components/PageTransition";

const CTASection = () => (
  <section className="py-28 px-4 relative overflow-hidden">
    <div className="hero-orb hero-orb-1" style={{ opacity: 0.15 }} />
    <div className="hero-orb hero-orb-2" style={{ opacity: 0.1 }} />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

    <div className="max-w-3xl mx-auto text-center relative z-10">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        {/* Decorative ring */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full bg-purple-600/20 animate-pulse-ring" />
          <div className="absolute inset-0 rounded-full bg-purple-600/10 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center shadow-xl shadow-purple-600/25">
            <span className="text-2xl">🚀</span>
          </div>
        </div>

        <h2 className="font-display text-4xl sm:text-5xl font-bold text-gradient-hero mb-4">
          Scale Your Career, Not Your Effort
        </h2>
        <p className="text-white-60 text-lg mb-10 max-w-xl mx-auto">
          Join 12,000+ professionals who accelerated their career with AI. Start for free today.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to="/auth"
              className="group bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white font-semibold text-base px-8 py-4 rounded-full transition-all hover:shadow-[0_0_50px_rgba(124,58,237,0.4)] flex items-center gap-2">
              Try for free <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
          <Link to="/pricing"
            className="text-white-60 hover:text-foreground font-medium text-base px-8 py-4 rounded-full border border-white/[0.12] hover:border-white/[0.2] hover:bg-white/[0.03] transition-all">
            View Pricing
          </Link>
        </div>
        <p className="text-white-30 text-sm mt-5">No credit card required</p>
      </motion.div>
    </div>
  </section>
);

const Index = () => (
  <PageTransition>
    <div className="min-h-screen bg-page">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorks />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  </PageTransition>
);

export default Index;
