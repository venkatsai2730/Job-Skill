import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useState } from "react";

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
    <span className="text-cyan-spark mr-1.5">✦</span>
    {text}
  </motion.div>
);

const HeroCard3D = () => {
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-150, 150], [15, -15]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-200, 200], [-15, 15]), { stiffness: 150, damping: 20 });
  const glareX = useTransform(mouseX, [-200, 200], [0, 100]);
  const glareY = useTransform(mouseY, [-150, 150], [0, 100]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

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

      {/* 3D Interactive Card */}
      <div
        className="relative"
        style={{ perspective: "1200px" }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
      >
        {/* Glow behind card */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{ opacity: isHovered ? 0.6 : 0.3 }}
          style={{
            background: "radial-gradient(circle, hsl(250 89% 67% / 0.4), transparent 70%)",
            filter: "blur(40px)",
            transform: "scale(1.2)",
          }}
        />

        <motion.div
          className="w-[340px] sm:w-[480px] lg:w-[560px] rounded-2xl p-6 sm:p-8 relative overflow-hidden"
          style={{
            rotateX: isHovered ? rotateX : 12,
            rotateY: isHovered ? rotateY : -6,
            background: "linear-gradient(135deg, hsl(228 22% 12%), hsl(228 22% 8%))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 40px 120px rgba(124, 101, 255, 0.25), 0 8px 30px rgba(0, 0, 0, 0.4)",
          }}
          animate={!isHovered ? { y: [0, -10, 0] } : {}}
          transition={!isHovered ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          {/* Holographic glare overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: useTransform(
                [glareX, glareY],
                ([x, y]) =>
                  `radial-gradient(circle at ${x}% ${y}%, rgba(124, 101, 255, 0.15), transparent 60%)`
              ),
            }}
          />

          {/* Animated border shimmer */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div
              className="absolute inset-[-2px] rounded-2xl animate-spin-slow"
              style={{
                background: "conic-gradient(from 0deg, transparent, hsl(250 89% 67% / 0.3), hsl(180 85% 60% / 0.2), transparent, hsl(280 75% 68% / 0.3), transparent)",
              }}
            />
            <div
              className="absolute inset-[1px] rounded-2xl"
              style={{ background: "linear-gradient(135deg, hsl(228 22% 12%), hsl(228 22% 8%))" }}
            />
          </div>

          {/* Card content */}
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-electric to-violet-pulse flex items-center justify-center text-white font-display font-bold text-lg">
                AC
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground text-sm sm:text-base">Alex Chen</h3>
                <p className="text-white-60 text-xs sm:text-sm">Senior Software Engineer</p>
              </div>
              <div className="ml-auto px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                ATS: 87%
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-white-40 uppercase tracking-wider mb-1">Experience</h4>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <p className="text-white-60 text-xs sm:text-sm">Designed 12 REST APIs serving 2M requests/day, reducing latency by 40%</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <p className="text-white-60 text-xs sm:text-sm">Led migration to microservices architecture, improving deployment frequency 3x</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <p className="text-white-60 text-xs sm:text-sm">Managed cross-functional team of 8 engineers across 3 time zones</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white-40 uppercase tracking-wider mb-1">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {["React", "TypeScript", "Node.js", "AWS", "Docker", "PostgreSQL"].map((skill) => (
                    <span key={skill} className="px-2 py-0.5 bg-blue-electric/15 text-blue-bright rounded text-xs font-medium border border-blue-electric/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroCard3D;
