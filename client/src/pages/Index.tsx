import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
  <section className="py-24 px-4 relative overflow-hidden">
    <div className="absolute inset-0 starfield" />
    <div className="hero-orb hero-orb-1" style={{ opacity: 0.2 }} />
    <div className="hero-orb hero-orb-2" style={{ opacity: 0.15 }} />
    <div className="max-w-3xl mx-auto text-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
          Ready to land your dream job?
        </h2>
        <p className="text-white-60 text-lg mb-8">
          Join 12,000+ professionals who accelerated their career with AI.
        </p>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-blue-electric hover:bg-blue-bright text-primary-foreground font-semibold text-base px-8 py-4 rounded-full transition-all hover:shadow-[0_0_50px_rgba(124,101,255,0.5)]"
          >
            <span className="text-cyan-spark">✦</span> Get Started Free →
          </Link>
        </motion.div>
        <p className="text-white-30 text-sm mt-4">No credit card required</p>
      </motion.div>
    </div>
  </section>
);

const Index = () => {
  return (
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
};

export default Index;
