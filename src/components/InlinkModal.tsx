/**
 * @file InlinkModal.tsx
 * @description مودال تخصصی نمایش لیست صفحات ارجاع‌دهنده ورودی (Inlink Analytics).
 * این کامپوننت صفحات مبدأ، نوع ارجاع (کاندید یا تایید شده)، رتبه ارجاع و تگ‌های تطبیق داده شده را نمایش می‌دهد.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { InlinkSourceEntry } from '../services/analysis/inlinkGraphService';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import { Spinner } from './ui/Spinner';
import { Badge } from './ui/Badge';
import { Link2, Sparkles, Target, Tag } from 'lucide-react';

interface InlinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTitle: string;
  sources: InlinkSourceEntry[];
  loading: boolean;
  projectId: number;
}

export default function InlinkModal({
  isOpen,
  onClose,
  targetTitle,
  sources,
  loading,
  projectId
}: InlinkModalProps) {
  // بهینه‌سازی پرفورمنس: حد اکثر ۱۰۰ المان اول رندر شوند
  const maxEntries = 100;
  const showLimitMessage = sources.length > maxEntries;
  const displayedSources = sources.slice(0, maxEntries);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`لینک‌های ورودی به: ${targetTitle}`}
      size="xl"
    >
      <div className="space-y-4" dir="rtl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size="lg" color="text-blue-600" />
            <p className="text-sm font-semibold text-gray-500">در حال محاسبه گراف معکوس...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="py-6">
            <EmptyState
              icon={<Link2 size={36} className="text-gray-300" />}
              title="بدون لینک ورودی"
              description="هیچ صفحه‌ای به این صفحه لینک نداده است."
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-gray-400 font-bold px-1">
              <span>لیست مراجع معکوس ({sources.length} ارجاع)</span>
              <span>تنظیم اولویت: هوش مصنوعی و امتیاز کاندیدا</span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl bg-white shadow-xs">
              {displayedSources.map((entry, idx) => {
                const isAI = entry.origin === 'result';
                const hasScore = entry.score !== undefined;
                const matchedTags = entry.matchedTags || [];
                const maxTagsToShow = 5;
                const showMoreTagsCount = matchedTags.length - maxTagsToShow;

                return (
                  <div
                    key={`${entry.sourcePageId}-${idx}`}
                    className="p-4 hover:bg-gray-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* اطلاعات صفحه مبدا */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <Link
                          to={`/project/${projectId}/page/${entry.sourcePageId}`}
                          onClick={onClose}
                          className="hover:text-blue-600 font-bold text-gray-900 text-sm transition-colors text-right line-clamp-1 block"
                        >
                          {entry.sourceTitle}
                        </Link>
                      </div>

                      {/* اطلاعات متادیتای هر ردیف ارجاع */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-semibold">
                          رتبه {entry.rank} در مبدأ
                        </span>

                        {hasScore && (
                          <span className="bg-blue-50/60 text-blue-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            امتیاز: {entry.score!.toFixed(2)}
                          </span>
                        )}

                        <span className="text-[10px] text-gray-400 font-bold">
                          ID: #{entry.sourcePageId}
                        </span>
                      </div>

                      {/* تگ‌های تطابق */}
                      {matchedTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <Tag size={10} className="text-gray-400" />
                          {matchedTags.slice(0, maxTagsToShow).map((tag, tIdx) => (
                            <Badge
                              key={tIdx}
                              variant="blue"
                              className="text-[9px] py-0 px-1.5 opacity-85"
                            >
                              {tag.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {showMoreTagsCount > 0 && (
                            <span className="text-[9px] text-gray-400 font-semibold">
                              +{showMoreTagsCount} تگ دیگر
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* وضعیت تایید / خاستگاه ارجاع */}
                    <div className="flex items-center gap-2 shrink-0 md:self-center">
                      {isAI ? (
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 text-[11px] rounded-lg font-bold flex items-center gap-1">
                          <Sparkles size={11} className="text-green-600" />
                          <span>تایید AI</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-100 text-[11px] rounded-lg font-bold flex items-center gap-1">
                          <Target size={11} className="text-gray-400" />
                          <span>پیشنهاد الگوریتم</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* پیام محدودیت پرفورمنس مرورگر (Virtualization ساده) */}
            {showLimitMessage && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800 text-xs font-semibold leading-relaxed text-center">
                به منظور حفظ کیفیت عملکرد رابط کاربری، تنها ۱۰۰ لینک برتر بازنمایی شده‌اند.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
