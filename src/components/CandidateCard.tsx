import React from 'react';
import { Badge } from './ui/Badge';
import { Plus, Check, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { TemporalBadge } from './TemporalBadge';

interface CandidateCardProps {
  candidate: {
    page_id: number;
    title: string;
    score: number;
    matched_tags: string[];
    origin_bonus?: number;      // فیلد جدید بونوس مبدا
    destination_bonus?: number; // فیلد جدید بونوس مقصد
    rank?: number;
    scoreDetails?: {
      tagScore: number;
      jaccardScore: number;
      titleScore: number;
    };
    boostedScore?: number;
    temporalMultiplier?: number;
    temporalLabel?: 'pre' | 'current' | 'neutral' | 'out-of-season';
    temporalReason?: string;
    matchedEventName?: string | null;
  };
  isSelected: boolean;
  onToggle: () => void;
  index?: number; // اضافه شدن ایندکس ردیف برای اولویت‌بندی ترتیبی مطمئن
}

export const CandidateCard: React.FC<CandidateCardProps> = React.memo(({ candidate, isSelected, onToggle, index }) => {
  // استفاده از امتیاز افزایش‌یافته (boostedScore) در صورت فعال بودن هوشمندسازی فصلی
  const activeScore = candidate.boostedScore !== undefined ? candidate.boostedScore : candidate.score;
  const similarityPercent = Math.min(Math.round(activeScore * 10), 100);
  
  // اولویت‌بندی عددی، اگر از قبل رتبه ذخیره نشده باشد، از ایندکس ردیف استفاده می‌شود
  const displayRank = candidate.rank ?? (index !== undefined ? index + 1 : undefined);

  const hasTemporalBoost = candidate.temporalMultiplier !== undefined && candidate.temporalMultiplier !== 1;

  return (
    <motion.div 
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${
        isSelected 
          ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-500/20' 
          : 'bg-white border-gray-100 hover:border-gray-250 hover:shadow-md'
      } ${hasTemporalBoost ? 'pb-10' : ''}`} // اضافه کردن فضای عمودی در انتهای کارت برای جلوگیری از تداخل با نشانگر بی‌آزار ترجیحی
      onClick={onToggle}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Target size={12} className={isSelected ? 'text-blue-600' : 'text-gray-300'} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Similarity {similarityPercent}%</span>
            
            {/* نمایش رتبه و اولویت عددی (1, 2, 3...) با فونت انگلیسی */}
            {displayRank !== undefined && (
              <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                رتبه {displayRank}
              </span>
            )}
            
            {/* نمایش امتیاز ۱ تا ۱۰ با اعداد انگلیسی تایید شده */}
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50/70 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <span>امتیاز:</span>
              <span className="font-extrabold">{activeScore.toFixed(1)}</span>
              <span>/ 10</span>
              {hasTemporalBoost && (
                <span className="text-[8px] text-gray-400 font-semibold">(خام: {candidate.score.toFixed(1)})</span>
              )}
            </span>
          </div>
          <h4 className="font-bold text-[13px] text-gray-900 leading-tight mb-2 truncate group-hover:text-blue-600 transition-colors">
            {candidate.title}
          </h4>
          
          {/* نوار تشابه هماهنگ با رنگ برند اصلی */}
          <div className="w-full h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${similarityPercent}%` }}
              className={`h-full rounded-full ${isSelected ? 'bg-blue-600' : 'bg-blue-500 opacity-60'}`}
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {candidate.matched_tags.slice(0, 2).map((tag, idx) => (
              <Badge key={idx} variant="blue" className="text-[9px] py-0 px-1.5 opacity-85">{tag.replace(/_/g, ' ')}</Badge>
            ))}
            {candidate.matched_tags.length > 2 && (
              <span className="text-[9px] text-gray-400 font-medium pt-0.5">+{candidate.matched_tags.length - 2} تگ مشترک</span>
            )}
          </div>

          {/* نمایش اطلاعات بونوس مبدا یا مقصد در صورتی که تطابق وجود داشته باشد */}
          {((candidate.origin_bonus && candidate.origin_bonus > 0) || (candidate.destination_bonus && candidate.destination_bonus > 0)) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {candidate.origin_bonus && candidate.origin_bonus > 0 && (
                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] rounded-lg font-bold border border-green-100 flex items-center gap-1">
                  <span>🏠</span>
                  <span>مبدا یکسان (+{candidate.origin_bonus})</span>
                </span>
              )}
              {candidate.destination_bonus && candidate.destination_bonus > 0 && (
                <span className="px-2 py-0.5 bg-blue-50/70 text-blue-750 text-[10px] rounded-lg font-bold border border-blue-100/50 flex items-center gap-1">
                  <span>🎯</span>
                  <span>مقصد یکسان (+{candidate.destination_bonus})</span>
                </span>
              )}
            </div>
          )}

          {candidate.scoreDetails && (
            <div className="text-[9px] text-gray-400 bg-gray-50/50 p-1.5 rounded-lg border border-gray-100/55 mt-2 flex items-center justify-between font-mono">
              <span className="font-sans">تگ: <strong className="text-blue-600 font-mono">{candidate.scoreDetails.tagScore?.toFixed(1)}</strong></span>
              <span className="font-sans">جکارد: <strong className="text-blue-600 font-mono">{candidate.scoreDetails.jaccardScore?.toFixed(1)}</strong></span>
              <span className="font-sans">عنوان: <strong className="text-blue-600 font-mono">{candidate.scoreDetails.titleScore?.toFixed(1)}</strong></span>
            </div>
          )}
        </div>
        
        {/* حباب وضعیت انتخاب هماهنگ با رنگ برند اصلی */}
        <div 
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
            isSelected 
              ? 'bg-blue-600 border-blue-600 text-white rotate-0' 
              : 'border-gray-200 text-transparent group-hover:border-blue-300 group-hover:text-blue-300 -rotate-90'
          }`}
        >
          {isSelected ? <Check size={14} /> : <Plus size={14} />}
        </div>
      </div>
      {/* نشانگر هوشمند زمانی فصلی */}
      {hasTemporalBoost && candidate.temporalLabel && candidate.temporalMultiplier && (
        <TemporalBadge 
          label={candidate.temporalLabel} 
          multiplier={candidate.temporalMultiplier} 
          reason={candidate.temporalReason} 
        />
      )}
    </motion.div>
  );
});

CandidateCard.displayName = 'CandidateCard';
