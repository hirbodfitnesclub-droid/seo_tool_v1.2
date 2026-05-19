import { db, type Page } from '../db';
import { computeAllCandidates } from './scorer';

/**
 * محاسبه و ذخیره ۲۰ کاندیدای برتر برای تمام صفحات یک پروژه
 */
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): Promise<void> {
  // ۱. حذف کاندیداهای قبلی پروژه
  await db.candidates.where('project_id').equals(projectId).delete();
  
  // ۲. محاسبه کاندیداها (الگوریتمی)
  const candidatesMap = computeAllCandidates(pages, weights, mode);
  
  // ۳. آماده‌سازی رکوردها
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));
  
  // ۴. ذخیره یکجا در دیتابیس
  await db.candidates.bulkAdd(records);
}
