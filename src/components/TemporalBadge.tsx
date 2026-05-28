import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

/**
 * مسئولیت: نمایش نشانگر زمانی بونوس فصلی یا جریمه زمانی (Temporal Badge) روی کاندیداها.
 * طراحی بسیار جذاب، چشم‌نواز و متناسب با برند لایت هوشمند.
 */

interface TemporalBadgeProps {
  label: 'pre' | 'current' | 'neutral' | 'out-of-season';
  multiplier: number;
  reason?: string;
  className?: string;
}

export const TemporalBadge: React.FC<TemporalBadgeProps> = ({
  label,
  multiplier,
  reason,
  className = '',
}) => {
  if (label === 'neutral' || multiplier === 1) return null;

  // تنظیم رنگ و متن برچسب بر اساس نوع کلاس زمانی شمسی
  let badgeStyles = '';
  let multiplierText = '';
  let labelText = '';
  let Icon = Calendar;

  switch (label) {
    case 'pre':
      badgeStyles = 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50';
      multiplierText = `+${multiplier}x`;
      labelText = 'پیش‌واز';
      break;
    case 'current':
      badgeStyles = 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/50';
      multiplierText = `+${multiplier}x`;
      labelText = 'جاری';
      break;
    case 'out-of-season':
      badgeStyles = 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/50';
      multiplierText = `${multiplier}x`;
      labelText = 'خارج از فصل';
      Icon = AlertCircle;
      break;
    default:
      return null;
  }

  return (
    <div
      className={`absolute left-3 bottom-3 flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-bold transition-all shadow-2xs group-hover:scale-105 duration-250 ${badgeStyles} ${className}`}
      title={reason || labelText}
    >
      <Icon size={10} className="shrink-0" />
      <span>{labelText}</span>
      <span className="font-extrabold font-mono text-[10px]">{multiplierText}</span>
    </div>
  );
};

export default TemporalBadge;
