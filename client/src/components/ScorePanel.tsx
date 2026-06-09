import React, { useState } from 'react';
import { ScoreGauge } from './ScoreGauge';
import { BenchmarkBar } from './BenchmarkBar';
import { IssueCategory, IssueCategoryProps } from './IssueCategory';
import { CompletedCategory, CompletedCategoryProps } from './CompletedCategory';
import { Share2, Download, AlertTriangle } from 'lucide-react';

// Assuming ATSResult is passed down or imported
export interface ATSResult {
  overall_score: number;
  grade: string;
  atsRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  top_issues: {
    category: string;
    penalty_key: string;
    count: number;
    point_gain: number;
    is_locked: boolean;
    sub_issues: { text: string; gain: number }[];
  }[];
  completed_checks: {
    category: string;
    points_saved: number;
  }[];
}

interface ScorePanelProps {
  hasParsed?: boolean;
  atsResult?: ATSResult | null;
  onShare?: () => void;
  onExport?: () => void;
}

export const ScorePanel: React.FC<ScorePanelProps> = ({ 
  hasParsed = true, 
  atsResult, 
  onShare, 
  onExport 
}) => {
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  if (!hasParsed || !atsResult) {
    return (
      <div className="lg:w-80 p-5 border-t lg:border-t-0 lg:border-l border-border bg-white shrink-0 overflow-y-auto">
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 flex items-center justify-center">
            <span className="text-gray-400 font-mono font-bold text-xl">—</span>
          </div>
          <p className="text-gray-400 text-sm">Upload a resume to see your score</p>
        </div>
      </div>
    );
  }

  const { overall_score = 0, grade = '', atsRisk, top_issues = [], completed_checks = [] } = atsResult;

  // Split free and locked
  const freeIssues = top_issues.filter(i => !i.is_locked);
  const lockedIssues = top_issues.filter(i => i.is_locked);

  const visibleCompleted = showAllCompleted ? completed_checks : completed_checks.slice(0, 4);

  return (
    <div className="w-full">
      {/* Zone A: Action Buttons */}
      <div className="flex gap-2 mb-6 print:hidden">
        <button
          onClick={onShare}
          className="flex-[2] bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5"
        >
          <Share2 className="w-4 h-4" /> Share Score
        </button>
        <button
          onClick={onExport}
          className="flex-1 bg-gray-50 hover:bg-gray-100 border border-border text-foreground text-sm py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Zone B: Score Card */}
      <div className="text-center mb-6 border border-border bg-white/50 rounded-xl p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] text-slate-400">
            Benchmarked against real resumes · 20+ ATS checks
          </p>
        </div>
        
        <ScoreGauge score={overall_score} />
        
        <div className="mt-4">
          <BenchmarkBar score={overall_score} />
        </div>

        {atsRisk && (
          <div className="mt-5 flex justify-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
              atsRisk === "LOW" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
              atsRisk === "MEDIUM" ? "bg-amber-50 text-amber-600 border-amber-200" :
              "bg-rose-50 text-rose-600 border-rose-200"
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
              ATS Risk: {atsRisk}
            </span>
          </div>
        )}
      </div>

      {/* Zone C: Top Fixes */}
      <div className="mb-6">
        <div className="mb-4">
          <h4 className="font-display font-semibold text-slate-800 text-[14px]">TOP FIXES</h4>
          <p className="text-[11px] text-slate-400">Fix these to boost your score</p>
        </div>
        
        <div className="space-y-1">
          {freeIssues.map((issue: any, i) => (
            <IssueCategory 
              key={`free-${i}`}
              category={issue.category || issue.id || 'Issue'}
              count={issue.count || 1}
              isLocked={false}
              subIssues={issue.sub_issues || (issue.fix ? [{ text: issue.fix, gain: issue.deduction || 0 }] : [])}
            />
          ))}
          
          {lockedIssues.map((issue: any, i) => (
            <IssueCategory 
              key={`locked-${i}`}
              category={issue.category || issue.id || 'Locked Issue'}
              count={issue.count || 1}
              isLocked={true}
              subIssues={issue.sub_issues || []}
            />
          ))}
        </div>

        {lockedIssues.length > 0 && (
          <button className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-slate-500 text-xs font-semibold hover:text-slate-700">
            + {lockedIssues.length} MORE ISSUES <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded ml-1 text-slate-400">🔒 Upgrade</span>
          </button>
        )}
      </div>

      {/* Zone D: Completed */}
      {completed_checks && completed_checks.length > 0 && (
        <div className="mb-6">
          <div className="mb-4">
            <h4 className="font-display font-semibold text-green-500 text-[14px]">COMPLETED ✓</h4>
          </div>

          <div className="space-y-1">
            {visibleCompleted.map((check, i) => (
              <CompletedCategory 
                key={i}
                category={check.category}
                pointsSaved={check.points_saved}
              />
            ))}
          </div>

          {completed_checks.length > 4 && (
            <div className="mt-3 text-center">
              <button 
                onClick={() => setShowAllCompleted(!showAllCompleted)}
                className="text-xs text-slate-500 hover:text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors"
              >
                {showAllCompleted ? "Show fewer completed" : `Show all ${completed_checks.length} completed`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
