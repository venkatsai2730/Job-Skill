import { motion } from "framer-motion";

const testimonials = [
  { name: "Sarah K.", role: "Product Manager @ Google", quote: "JobSkill AI helped me tailor my resume perfectly. Got 3 interviews in one week!", rating: 5 },
  { name: "Marcus J.", role: "Software Engineer @ Meta", quote: "The ATS scanner caught issues I never would have found. Went from 45% to 92% score.", rating: 5 },
  { name: "Priya S.", role: "Data Scientist @ Amazon", quote: "The AI career coach gave me better advice than any human recruiter I've talked to.", rating: 5 },
  { name: "David L.", role: "DevOps @ Stripe", quote: "LinkedIn optimizer completely transformed my profile. Started getting recruiter messages daily.", rating: 5 },
  { name: "Emily R.", role: "UX Designer @ Figma", quote: "Best career tool I've ever used. The job matching is incredibly accurate.", rating: 5 },
  { name: "Tom W.", role: "Backend Dev @ Netflix", quote: "Went from ghosted to 4 offers in 3 weeks. The resume suggestions were game-changing.", rating: 5 },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
    className="glass-card p-6 min-w-[300px] max-w-[340px] flex-shrink-0 mx-3 cursor-default"
  >
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-electric to-cyan-spark flex items-center justify-center text-primary-foreground font-display font-bold text-sm">
        {t.name.charAt(0)}
      </div>
      <div>
        <p className="text-foreground font-medium text-sm">{t.name}</p>
        <p className="text-white-60 text-xs">{t.role}</p>
      </div>
    </div>
    <div className="flex gap-0.5 mb-2">
      {Array.from({ length: t.rating }).map((_, i) => (
        <span key={i} className="text-warning text-sm">★</span>
      ))}
    </div>
    <p className="text-white-90 text-sm leading-relaxed">"{t.quote}"</p>
  </motion.div>
);

const TestimonialsSection = () => {
  const row1 = testimonials.slice(0, 3);
  const row2 = testimonials.slice(3);

  return (
    <section className="py-24 bg-page overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="font-display text-4xl font-bold text-foreground mb-3">
          Loved by professionals
        </h2>
        <p className="text-white-60 text-lg">Join thousands who landed their dream roles.</p>
      </motion.div>

      {/* Row 1 - scrolls left */}
      <div className="relative mb-6">
        <div className="flex animate-marquee-left" style={{ width: "max-content" }}>
          {[...row1, ...row1, ...row1, ...row1].map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>

      {/* Row 2 - scrolls right */}
      <div className="relative">
        <div className="flex animate-marquee-right" style={{ width: "max-content" }}>
          {[...row2, ...row2, ...row2, ...row2].map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
