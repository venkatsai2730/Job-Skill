import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: { monthly: 0, annual: 0 },
    desc: "5 free AI chats daily — forever",
    features: [
      { text: "5 AI chats/day (daily reset)", included: true },
      { text: "1 ATS scan/day", included: true },
      { text: "2 job matches/day", included: true },
      { text: "Basic resume tips", included: true },
      { text: "LinkedIn optimizer", included: false },
      { text: "Unlimited scans", included: false },
    ],
    cta: "Start Free →",
    popular: false,
    variant: "ghost" as const,
  },
  {
    name: "Basic",
    price: { monthly: 9, annual: 7 },
    desc: "For active job seekers",
    features: [
      { text: "50 chats/month + daily free", included: true },
      { text: "5 ATS scans/month", included: true },
      { text: "Job tracker", included: true },
      { text: "Email support", included: true },
      { text: "LinkedIn optimizer", included: false },
      { text: "API access", included: false },
    ],
    cta: "Get Basic →",
    popular: false,
    variant: "filled" as const,
  },
  {
    name: "Pro",
    price: { monthly: 29, annual: 23 },
    desc: "Unlimited AI power",
    features: [
      { text: "Unlimited AI chats", included: true },
      { text: "Unlimited ATS scans", included: true },
      { text: "LinkedIn optimizer", included: true },
      { text: "Resume builder + export", included: true },
      { text: "Priority support + API", included: true },
      { text: "Streak gamification", included: true },
    ],
    cta: "Go Pro →",
    popular: true,
    variant: "primary" as const,
  },
];

const PricingSection = ({ fullPage = false }: { fullPage?: boolean }) => {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className={`py-24 px-4 ${fullPage ? "starfield min-h-screen pt-32" : "bg-page"}`}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-white-60 text-lg mb-8">Start free. Upgrade when you're ready.</p>

          <div className="inline-flex items-center gap-3 glass rounded-full px-2 py-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!annual ? "bg-blue-electric text-primary-foreground" : "text-white-60 hover:text-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-blue-electric text-primary-foreground" : "text-white-60 hover:text-foreground"}`}
            >
              Annual
              <span className="text-xs bg-cyan-spark/20 text-cyan-spark px-2 py-0.5 rounded-full">Save 20%</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              className={`rounded-2xl p-8 relative ${
                plan.popular
                  ? "bg-surface-2 border-2 border-blue-electric shadow-[0_8px_40px_rgba(124,101,255,0.3)]"
                  : "glass-card"
              }`}
            >
              {plan.popular && (
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-electric to-violet-pulse text-primary-foreground text-xs font-display font-semibold px-4 py-1 rounded-full"
                >
                  Most Popular
                </motion.div>
              )}

              <h3 className="font-display font-bold text-xl text-foreground mb-1">{plan.name}</h3>
              <p className="text-white-60 text-sm mb-6">{plan.desc}</p>

              <div className="mb-6">
                <span className="font-display font-extrabold text-4xl text-foreground">
                  ${annual ? plan.price.annual : plan.price.monthly}
                </span>
                <span className="text-white-60 text-sm">/mo</span>
              </div>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/auth"
                  className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${
                    plan.variant === "primary"
                      ? "bg-blue-electric hover:bg-blue-bright text-primary-foreground hover:shadow-[0_0_30px_rgba(124,101,255,0.4)]"
                      : plan.variant === "filled"
                      ? "bg-blue-electric/80 hover:bg-blue-electric text-primary-foreground"
                      : "border border-blue-border text-white-60 hover:text-foreground hover:border-foreground"
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>

              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5 text-sm">
                    {f.included ? (
                      <Check className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-white-30 shrink-0" />
                    )}
                    <span className={f.included ? "text-white-90" : "text-white-30"}>{f.text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
