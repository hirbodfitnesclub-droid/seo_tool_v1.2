/**
 * @file InlinkBadge.tsx
 * @description کامپوننت دکمه/نشانگر نمایش تعداد لینک‌های ورودی به صفحه (Inlink Badge).
 * در صورت فاقد لینک بودن به شکل غیرفعال خاکستری و در صورت وجود لینک کلیک‌پذیر خواهد بود.
 */

import React from 'react';
import { Link2 } from 'lucide-react';
import { Spinner } from './ui/Spinner';

interface InlinkBadgeProps {
  count: number;
  loading: boolean;
  onClick: () => void;
}

export default function InlinkBadge({ count, loading, onClick }: InlinkBadgeProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-gray-400 text-xs">
        <Spinner size="sm" color="text-gray-400" />
        <span>در حال محاسبه...</span>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-gray-400 text-xs font-semibold cursor-default">
        <Link2 size={13} className="text-gray-300" />
        <span>بدون لینک ورودی</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
    >
      <Link2 size={13} className="text-blue-500 animate-pulse" />
      <span>{count} لینک ورودی</span>
    </button>
  );
}
