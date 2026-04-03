import React from 'react';
import { Check } from 'lucide-react';

export interface CompletedCategoryProps {
  category: string;
  pointsSaved: number;
}

export const CompletedCategory: React.FC<CompletedCategoryProps> = ({ category, pointsSaved }) => {
  return (
    <div className="mb-2 rounded-lg border border-white/[0.06] overflow-hidden bg-surface-2">
      <div className="flex items-center justify-between px-3 h-[40px]">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-green-500" strokeWidth={3} />
          <span className="text-[13px] font-semibold text-green-500">
            {category}
          </span>
        </div>
        
        <div className="min-w-[22px] px-1.5 h-[18px] bg-green-600 rounded-[9px] flex items-center justify-center">
          <span className="text-[11px] font-bold text-white leading-none">
            {pointsSaved}
          </span>
        </div>
      </div>
    </div>
  );
};
