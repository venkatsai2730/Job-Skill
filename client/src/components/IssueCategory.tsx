import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Lock } from 'lucide-react';

export interface IssueCategoryProps {
  category: string;
  count: number;
  isLocked: boolean;
  pointGain?: number;
  subIssues: { text: string; gain: number }[];
}

export const IssueCategory: React.FC<IssueCategoryProps> = ({ 
  category, count, isLocked, subIssues = [] 
}) => {
  const [expanded, setExpanded] = useState(false);

  // Compute total gain
  const totalGain = (subIssues || []).reduce((sum, issue) => sum + (issue?.gain || 0), 0);

  const toggleExpand = () => {
    if (!isLocked) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className={`mb-2 rounded-lg border border-white/[0.06] overflow-hidden transition-colors ${
      isLocked 
        ? "opacity-50 cursor-not-allowed bg-surface-1" 
        : "bg-surface-2 hover:bg-white/[0.05] cursor-pointer"
    }`}>
      
      {/* Main Row */}
      <div 
        className="flex items-center justify-between px-3 h-[40px]"
        onClick={toggleExpand}
        title={isLocked ? "Upgrade to see details" : ""}
      >
        <div className="flex items-center gap-2">
          {isLocked ? (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className={`text-[13px] font-semibold ${isLocked ? 'text-slate-400' : 'text-white'}`}>
            {category}
          </span>
        </div>
        
        {isLocked ? (
          <div className="w-[22px] h-[18px] bg-white/[0.1] rounded-[9px] flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
          </div>
        ) : (
          <div className="min-w-[22px] px-1.5 h-[18px] bg-red-500 rounded-[9px] flex items-center justify-center">
            <span className="text-[11px] font-bold text-white leading-none">
              {count}
            </span>
          </div>
        )}
      </div>

      {/* Expanded Sub-Issues */}
      <AnimatePresence>
        {!isLocked && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-3 pt-1 border-t border-white/[0.04] bg-surface-1/50"
          >
            <ul className="space-y-2 mt-1">
              {subIssues.map((issue, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="shrink-0 mt-1">•</span>
                  <span>
                    {issue.text}{" "}
                    <span className="text-green-500 italic whitespace-nowrap">
                      (+{issue.gain} pts if fixed)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {totalGain > 0 && subIssues.length > 1 && (
              <p className="text-xs text-green-500 italic mt-3 text-right">
                (+{Number(totalGain.toFixed(1))} pts if all fixed)
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
