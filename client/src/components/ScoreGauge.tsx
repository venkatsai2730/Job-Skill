import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 120, strokeWidth = 10 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    // Animate score from 0 up to target
    let start = 0;
    const duration = 1200; // ms
    const increment = score / (duration / 16);
    
    const animate = () => {
      start += increment;
      if (start < score) {
        setAnimatedScore(Math.round(start));
        requestAnimationFrame(animate);
      } else {
        setAnimatedScore(score);
      }
    };
    requestAnimationFrame(animate);
  }, [score]);

  // Determine color and label
  const getColor = (s: number) => {
    if (s >= 88) return '#22c55e'; // green
    if (s >= 75) return '#14b8a6'; // teal
    if (s >= 65) return '#f59e0b'; // amber
    if (s >= 50) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getLabel = (s: number) => {
    if (s >= 88) return 'Excellent';
    if (s >= 75) return 'Great';
    if (s >= 65) return 'Good';
    if (s >= 50) return 'Average';
    if (s >= 35) return 'Weak';
    return 'Poor';
  };

  const color = getColor(score);
  const label = getLabel(score);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated Fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      
      {/* Center Text */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white font-mono leading-none">{animatedScore}</span>
        <div className="w-8 h-[1px] bg-white/20 my-1" />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
    </div>
  );
};
