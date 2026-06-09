import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free", price: { monthly: 0, annual: 0 }, desc: "5 free AI chats daily — forever",
    features: [
      { text: "5 AI chats/day (daily reset)", included: true },
      { text: "1 ATS scan/day", included: true },
      { text: "2 job matches/day", included: true },
      { text: "Basic resume tips", included: true },
      { text: "LinkedIn optimizer", included: false },
      { text: "Unlimited scans", included: false },
    ],
    cta: "Start Free", popular: false, variant: "ghost" as const,
  },
  {
    name: "Basic", price: { monthly: 9, annual: 7 }, desc: "For active job seekers",
    features: [
      { text: "50 chats/month + daily free", included: true },
      { text: "5 ATS scans/month", included: true },
      { text: "Job tracker", included: true },
      { text: "Email support", included: true },
      { text: "LinkedIn optimizer", included: false },
      { text: "API access", included: false },
    ],
    cta: "Get Basic", popular: false, variant: "filled" as const,
  },
  {
    name: "Pro", price: { monthly: 29, annual: 23 }, desc: "Unlimited AI power",
    features: [
      { text: "Unlimited AI chats", included: true },
      { text: "Unlimited ATS scans", included: true },
      { text: "LinkedIn optimizer", included: true },
      { text: "Resume builder + export", included: true },
      { text: "Priority support + API", included: true },
      { text: "Streak gamification", included: true },
    ],
    cta: "Go Pro", popular: true, variant: "primary" as const,
  },
];

const PricingSection = ({ fullPage = false }: { fullPage?: boolean }) => {
  const [annual, setAnnual] = useState(false);
  return (
    <section id="pricing" className={`py-28 px-4 relative ${fullPage ? "min-h-screen pt-32" : ""}`}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Pricing
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-gradient-hero mb-4">Simple, Transparent Pricing</h2>
          <p className="text-gray-600 text-lg mb-8">Start free. Upgrade when you're ready.</p>
          <div className="inline-flex items-center gap-1 rounded-full p-1 border border-border bg-white/70">
            <button onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!annual ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-600/20" : "text-gray-600 hover:text-foreground"}`}>
              Monthly
            </button>
            <button onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-lg shadow-purple-600/20" : "text-gray-600 hover:text-foreground"}`}>
              Annual <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">-20%</span>
            </button>
          </div>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              className={`relative rounded-2xl p-8 border transition-all duration-500 hover:border-purple-500/20 bento-glow ${
                plan.popular ? "border-purple-500/30 bg-purple-500/[0.04] shadow-[0_8px_40px_rgba(124,58,237,0.15)]" : "border-border bg-white/70"}`}>
              {plan.popular && (
                <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-violet-500 text-white text-xs font-display font-semibold px-4 py-1 rounded-full shadow-lg shadow-purple-600/20">
                  Most Popular
                </motion.div>
              )}
              <h3 className="font-display font-bold text-xl text-foreground mb-1">{plan.name}</h3>
              <p className="text-gray-500 text-sm mb-6">{plan.desc}</p>
              <div className="mb-6">
                <span className="font-display font-extrabold text-4xl text-foreground">${annual ? plan.price.annual : plan.price.monthly}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link to="/auth" className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${
                  plan.variant === "primary" ? "bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white hover:shadow-[0_0_30px_rgba(124,58,237,0.3)]"
                  : plan.variant === "filled" ? "bg-purple-600/80 hover:bg-purple-600 text-white"
                  : "border border-border text-gray-600 hover:text-foreground hover:border-border hover:bg-white/70"}`}>
                  {plan.cta}
                </Link>
              </motion.div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5 text-sm">
                    {f.included
                      ? <div className="w-4 h-4 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0"><Check className="w-2.5 h-2.5 text-emerald-400" /></div>
                      : <div className="w-4 h-4 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0"><X className="w-2.5 h-2.5 text-gray-400" /></div>}
                    <span className={f.included ? "text-gray-600" : "text-gray-400"}>{f.text}</span>
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
