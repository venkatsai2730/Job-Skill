import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import FeaturesSection from "../components/FeaturesSection";
import HowItWorks from "../components/HowItWorks";
import PricingSection from "../components/PricingSection";
import FAQSection from "../components/FAQSection";
import Footer from "../components/Footer";
import PageTransition from "../components/PageTransition";

const Index = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-page">
        <Navbar />
        <HeroSection />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <FAQSection />
        <Footer />
      </div>
    </PageTransition>
  );
};

export default Index;
