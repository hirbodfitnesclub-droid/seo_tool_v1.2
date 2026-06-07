import React from 'react';
import { BarChart3, Star } from 'lucide-react';

interface QuotaBadgeProps {
  quotaLabel: 'within-quota' | 'unmanaged';
  quotaInfo?: {
    quota: number;
    assigned: number;
    impressions: number;
    percentage: number;
  };
  impressionWeight?: number;
}

export default function QuotaBadge({ quotaLabel, quotaInfo, impressionWeight }: QuotaBadgeProps) {
  if (quotaLabel !== 'within-quota' || !quotaInfo) {
    return null;
  }

  // نمایش سهمیه به سبک شیک با رنگ آبی/برند لینک‌مش
  const displayQuota = `${quotaInfo.assigned}/${quotaInfo.quota}`;
  const weightPercent = impressionWeight ? `+${Math.round((impressionWeight - 1) * 100)}٪ وزن` : '';

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 shadow-xs transition-colors duration-200 cursor-help"
      title={`سهمیه: ${quotaInfo.quota} | ایمپرشن: ${quotaInfo.impressions} | درصد سهمیه: ${quotaInfo.percentage}٪ ${weightPercent ? `| ${weightPercent}` : ''}`}
    >
      <BarChart3 size={12} className="shrink-0 text-blue-500" />
      <span className="leading-none shrink-0 text-[10px]">سهمیه {displayQuota}</span>
      {impressionWeight && impressionWeight > 1 && (
        <span className="leading-none shrink-0 text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono">
          x{impressionWeight.toFixed(2)}
        </span>
      )}
    </div>
  );
}
