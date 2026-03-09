import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "Is JobSkill AI really free?", a: "Yes! Every user gets 5 free AI chats daily, 1 ATS scan, and 2 job matches — no credit card required. Credits reset every day at midnight UTC." },
  { q: "How does the ATS scanner work?", a: "Our AI analyzes your resume against ATS algorithms used by top companies. It checks formatting, keywords, structure, and content quality to give you an actionable score with specific improvement suggestions." },
  { q: "What AI model do you use?", a: "We use state-of-the-art language models for analysis and recommendations, optimized specifically for career coaching and resume optimization." },
  { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no hidden fees. Cancel your subscription at any time from your settings page. Your free daily credits will continue working." },
  { q: "Is my data secure?", a: "Yes. All data is encrypted at rest and in transit. We use SOC2-ready infrastructure and never share your personal information with third parties." },
  { q: "What file formats do you support?", a: "We support PDF resume uploads (up to 10MB). Our AI can parse complex formatting including multi-column layouts, tables, and graphics." },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-4 starfield">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-white-60 text-lg">Everything you need to know about JobSkill AI.</p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="font-medium text-foreground text-sm sm:text-base">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-blue-electric transition-transform shrink-0 ml-4 ${openIndex === i ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-white-60 text-sm leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
