import Navbar from "../components/Navbar";
import PricingSection from "../components/PricingSection";
import FAQSection from "../components/FAQSection";
import Footer from "../components/Footer";
import PageTransition from "../components/PageTransition";

const Pricing = () => (
  <PageTransition>
    <div className="min-h-screen bg-page">
      <Navbar />
      <PricingSection fullPage />
      <FAQSection />
      <Footer />
    </div>
  </PageTransition>
);

export default Pricing;
