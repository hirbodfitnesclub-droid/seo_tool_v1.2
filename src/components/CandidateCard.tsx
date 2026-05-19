import React from 'react';
import { Badge } from './ui/Badge';
import { Plus, Check, Target } from 'lucide-react';
import { motion } from 'motion/react';

interface CandidateCardProps {
  candidate: {
    page_id: number;
    title: string;
    score: number;
    matched_tags: string[];
  };
  isSelected: boolean;
  onToggle: () => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ candidate, isSelected, onToggle }) => {
  // فرض می‌کنیم ماکزیمم امتیاز حول و حوش ۱۵ باشه برای نمایش درصدی نمایشی
  const similarityPercent = Math.min(Math.round((candidate.score / 15) * 100), 100);

  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
        isSelected 
          ? 'bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/20' 
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
      onClick={onToggle}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Target size={12} className={isSelected ? 'text-emerald-500' : 'text-gray-300'} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Similarity {similarityPercent}%</span>
          </div>
          <h4 className="font-bold text-[13px] text-gray-900 leading-tight mb-2 truncate group-hover:text-emerald-600 transition-colors">
            {candidate.title}
          </h4>
          
          {/* Similarity Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${similarityPercent}%` }}
              className={`h-full rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-gray-400 opacity-30'}`}
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {candidate.matched_tags.slice(0, 2).map((tag, idx) => (
              <Badge key={idx} variant="blue" className="text-[9px] py-0 px-1.5 opacity-80">{tag.replace(/_/g, ' ')}</Badge>
            ))}
            {candidate.matched_tags.length > 2 && (
              <span className="text-[9px] text-gray-400 font-medium pt-0.5">+{candidate.matched_tags.length - 2} تگ مشترک</span>
            )}
          </div>
        </div>
        
        <div 
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
            isSelected 
              ? 'bg-emerald-600 border-emerald-600 text-white rotate-0' 
              : 'border-gray-200 text-transparent group-hover:border-emerald-300 group-hover:text-emerald-300 -rotate-90'
          }`}
        >
          {isSelected ? <Check size={14} /> : <Plus size={14} />}
        </div>
      </div>
    </motion.div>
  );
};
