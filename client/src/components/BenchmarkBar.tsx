import React from 'react';
import { motion } from 'framer-motion';

interface BenchmarkBarProps {
  score: number;
}

export const BenchmarkBar: React.FC<BenchmarkBarProps> = ({ score }) => {
  return (
    <div className="w-full my-6">
      <p className="text-xs text-slate-400 mb-2 text-center">
        Your score is benchmarked against resumes at your experience level
      </p>
      
      <div className="relative w-full h-3 rounded-full bg-surface-3 overflow-visible pointer-events-none mt-4">
        {/* The Bar */}
        <div 
          className="absolute inset-0 rounded-full" 
          style={{ 
            background: 'linear-gradient(to right, #ef4444 0%, #f97316 35%, #f59e0b 65%, #22c55e 100%)' 
          }} 
        />
        
        {/* Animated Slide Marker */}
        <motion.div 
          className="absolute top-[-8px] ml-[-4px]"
          initial={{ left: 0 }}
          animate={{ left: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          {/* Downward pointing triangle marker */}
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white relative drop-shadow-md">
            {/* inner triangle matching the background or white */}
          </div>
        </motion.div>
      </div>
      
      <div className="flex justify-between mt-2 px-1">
        <span className="text-[11px] text-slate-400 font-medium">0</span>
        <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">TOP RESUMES</span>
      </div>
    </div>
  );
};
