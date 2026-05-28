/**
 * @file useInlinkAnalytics.ts
 * @description هوک اختصاصی ری‌اکت جهت بارگذاری تنبل (Lazy) و غیرمسدودکننده گراف معکوس صفحات (Inlink Analytics).
 * این هوک لیستی از آدرس‌های مبدأ که به صفحه هدف ارجاع داده‌اند را استخراج می‌کند.
 */

import { useState, useEffect } from 'react';
import * as inlinkGraphService from '../services/analysis/inlinkGraphService';
import { type InlinkSourceEntry } from '../services/analysis/inlinkGraphService';

/**
 * هوک محاسبه و استخراج لینک‌های ورودی به یک صفحه هدف مشخص
 * @param projectId شناسه عددی پروژه سئو
 * @param targetPageId شناسه عددی صفحه مقصد مورد بررسی
 */
export function useInlinkAnalytics(
  projectId: number,
  targetPageId: number
): {
  count: number;
  sources: InlinkSourceEntry[];
  loading: boolean;
} {
  const [sources, setSources] = useState<InlinkSourceEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // واکشی داده‌های گراف معکوس از ساختار کش‌شده سرویس
    inlinkGraphService.getInlinksFor(projectId, targetPageId)
      .then((result) => {
        if (!cancelled) {
          setSources(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error in useInlinkAnalytics:', err);
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, targetPageId]);

  return {
    count: sources.length,
    sources,
    loading
  };
}
