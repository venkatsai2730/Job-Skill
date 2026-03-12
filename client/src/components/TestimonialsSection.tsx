import { motion } from "framer-motion";

const testimonials = [
  { name: "Sarah K.", role: "Product Manager @ Google", quote: "JobSkill AI helped me tailor my resume perfectly. Got 3 interviews in one week!", rating: 5 },
  { name: "Marcus J.", role: "Software Engineer @ Meta", quote: "The ATS scanner caught issues I never would have found. Went from 45% to 92% score.", rating: 5 },
  { name: "Priya S.", role: "Data Scientist @ Amazon", quote: "The AI assistant gave me better advice than any human recruiter I've talked to.", rating: 5 },
  { name: "David L.", role: "DevOps @ Stripe", quote: "LinkedIn optimizer completely transformed my profile. Started getting recruiter messages daily.", rating: 5 },
  { name: "Emily R.", role: "UX Designer @ Figma", quote: "Best career tool I've ever used. The job matching is incredibly accurate.", rating: 5 },
  { name: "Tom W.", role: "Backend Dev @ Netflix", quote: "Went from ghosted to 4 offers in 3 weeks. The resume suggestions were game-changing.", rating: 5 },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <motion.div
    whileHover={{ y: -4, transition: { duration: 0.25 } }}
    className="min-w-[320px] max-w-[360px] flex-shrink-0 mx-3 p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-purple-500/15 transition-all duration-400 bento-glow"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center text-white font-display font-bold text-sm shadow-lg shadow-purple-600/15">
        {t.name.charAt(0)}
      </div>
      <div>
        <p className="text-foreground font-medium text-sm">{t.name}</p>
        <p className="text-white-40 text-xs">{t.role}</p>
      </div>
    </div>
    <div className="flex gap-0.5 mb-3">
      {Array.from({ length: t.rating }).map((_, i) => (
        <span key={i} className="text-amber-400 text-sm">★</span>
      ))}
    </div>
    <p className="text-white-60 text-sm leading-relaxed">"{t.quote}"</p>
  </motion.div>
);

const TestimonialsSection = () => {
  const row1 = testimonials.slice(0, 3);
  const row2 = testimonials.slice(3);

  return (
    <section className="py-28 overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center mb-14"
      >
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-amber-400 border border-amber-500/20 bg-amber-500/5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Wall of Love
        </span>
        <h2 className="font-display text-4xl sm:text-5xl font-bold text-gradient-hero mb-3">
          Loved by Professionals
        </h2>
        <p className="text-white-60 text-lg">Join thousands who landed their dream roles.</p>
      </motion.div>

      <div className="relative mb-6">
        <div className="flex animate-marquee-left" style={{ width: "max-content" }}>
          {[...row1, ...row1, ...row1, ...row1].map((t, i) => <TestimonialCard key={i} t={t} />)}
        </div>
      </div>
      <div className="relative">
        <div className="flex animate-marquee-right" style={{ width: "max-content" }}>
          {[...row2, ...row2, ...row2, ...row2].map((t, i) => <TestimonialCard key={i} t={t} />)}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
