import { motion } from "framer-motion";

const FloatingChip = ({
  text,
  className,
  bobClass,
  delay = 0,
}: {
  text: string;
  className?: string;
  bobClass: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className={`absolute glass rounded-full px-4 py-2 text-xs sm:text-sm text-white-90 font-body ${bobClass} ${className}`}
  >
    <span className="text-blue-electric mr-1.5">✦</span>
    {text}
  </motion.div>
);

const HeroCard3D = () => {
  return (
    <div className="relative mt-16 mb-8 flex justify-center">
      {/* Floating chips */}
      <FloatingChip
        text='Try: "Improved UI, increasing conversion by 24%"'
        className="hidden sm:block -top-4 -right-4 lg:right-8 max-w-[320px]"
        bobClass="chip-bob-1"
        delay={0.6}
      />
      <FloatingChip
        text='Use: "Managed projects..." for stronger tone'
        className="hidden sm:block top-1/3 -left-4 lg:-left-8 max-w-[300px]"
        bobClass="chip-bob-2"
        delay={0.8}
      />
      <FloatingChip
        text='Spelling: "Received"'
        className="hidden lg:block -top-8 left-8 max-w-[200px]"
        bobClass="chip-bob-3"
        delay={1.0}
      />
      <FloatingChip
        text="67% match → AI suggests 3 fixes to hit 90%+"
        className="hidden sm:block -bottom-4 left-1/2 -translate-x-1/2 max-w-[340px]"
        bobClass="chip-bob-4"
        delay={1.2}
      />

      {/* 3D Card */}
      <div className="hero-float" style={{ perspective: "1200px" }}>
        <div
          className="w-[340px] sm:w-[480px] lg:w-[560px] bg-white rounded-2xl p-6 sm:p-8 shadow-[0_40px_120px_rgba(99,91,255,0.25),0_8px_30px_rgba(0,0,0,0.08)] border border-gray-100"
          style={{
            transform: "rotateX(18deg) rotateY(-6deg)",
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-electric/20 flex items-center justify-center text-blue-600 font-display font-bold text-lg">
                AC
              </div>
              <div>
                <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">Alex Chen</h3>
                <p className="text-gray-500 text-xs sm:text-sm">Senior Software Engineer</p>
              </div>
              <div className="ml-auto px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                ATS: 87%
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Experience</h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm">Designed 12 REST APIs serving 2M requests/day, reducing latency by 40%</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm">Led migration to microservices architecture, improving deployment frequency 3x</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <p className="text-gray-700 text-xs sm:text-sm">Managed cross-functional team of 8 engineers across 3 time zones</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {["React", "TypeScript", "Node.js", "AWS", "Docker", "PostgreSQL"].map((skill) => (
                    <span key={skill} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroCard3D;
