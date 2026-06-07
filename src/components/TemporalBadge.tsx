import React from 'react';
import { TrendingUp, Calendar, TrendingDown } from 'lucide-react';

interface TemporalBadgeProps {
  multiplier: number;
  label: 'pre' | 'current' | 'neutral' | 'out-of-season';
  reason: string;
}

export default function TemporalBadge({ multiplier, label, reason }: TemporalBadgeProps) {
  if (label === 'neutral') {
    return null;
  }

  // کلاس‌های استایل دهی بر اساس نوع وضعیت زمانی
  let badgeClasses = '';
  let Icon: React.ComponentType<{ size?: number; className?: string }> | null = null;
  let text = '';

  switch (label) {
    case 'pre':
      badgeClasses = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      Icon = TrendingUp;
      text = `x${multiplier}`;
      break;
    case 'current':
      badgeClasses = 'bg-blue-50 text-blue-700 border border-blue-200';
      Icon = Calendar;
      text = `x${multiplier}`;
      break;
    case 'out-of-season':
      badgeClasses = 'bg-rose-50 text-rose-700 border border-rose-100';
      Icon = TrendingDown;
      text = `x${multiplier}`;
      break;
    default:
      return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md shadow-xs transition-colors duration-200 cursor-help ${badgeClasses}`}
      title={reason}
    >
      {Icon && <Icon size={12} className="shrink-0" />}
      <span className="leading-none">{text}</span>
    </div>
  );
}
