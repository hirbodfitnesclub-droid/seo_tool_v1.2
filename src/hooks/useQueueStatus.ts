/**
 * @file useQueueStatus.ts
 * @description هوک اختصاصی سلکتوری جهت بازگرداندن بهینه فقط فیلد وضعیت (status) به منظور کنترل دقیق و کاهش رندر افزوده کامپوننت‌های رادیکال
 */

import { useLiveQuery } from 'dexie-react-hooks';
import * as queueRepository from '../repositories/queueRepository';

/**
 * دریافت پویای وضعیت صف بدون رندر شدن مجدد بر اثر تغییر پیشرفت عددی صفحات (Index)
 * @param projectId شناسه عددی پروژه
 * @returns وضعیت فعلی صف یا undefined
 */
export function useQueueStatus(projectId: number): string | undefined {
  const status = useLiveQuery(async () => {
    const queue = await queueRepository.getByProject(projectId);
    return queue?.status;
  }, [projectId]);

  return status;
}
