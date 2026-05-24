import { db, type Page } from '../db';
import { computeAllCandidates } from './scorer';
import { computeIDFMap, type IDFMap } from './idfCalculator';

// محاسبه و ذخیره کاندیداهای برتر برای تمام صفحات یک پروژه
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  _weights: Record<string, number>,
  _mode: 'linear' | 'weighted'
): Promise<void> {
  
  // ۱. محاسبه IDF برای کل پروژه
  const idfMap = computeIDFMap(pages);
  
  // ۲. ذخیره IDF در کش
  await db.idfCache.where('project_id').equals(projectId).delete();
  await db.idfCache.add({
    project_id: projectId,
    idf_map: JSON.stringify(idfMap),
    computed_at: new Date().toISOString()
  });
  
  // ۳. حذف کاندیداهای قبلی پروژه
  await db.candidates.where('project_id').equals(projectId).delete();
  
  // ۴. تبدیل pages به فرمت مورد نیاز scorer
  const pagesWithId = pages.map(p => ({
    id: p.id!,
    title: p.title,
    categories: p.categories
  }));
  
  // ۵. محاسبه کاندیداها با الگوریتم پیشرفته (بدون نیاز به weights و idfMap)
  const candidatesMap = computeAllCandidates(pagesWithId);
  
  // ۶. آماده‌سازی رکوردها
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));
  
  // ۷. ذخیره یکجا در دیتابیس
  await db.candidates.bulkAdd(records);
}

// خواندن IDF کش‌شده برای یک پروژه
export async function getCachedIDF(projectId: number): Promise<IDFMap | null> {
  const record = await db.idfCache.where('project_id').equals(projectId).first();
  if (!record) return null;
  try {
    return JSON.parse(record.idf_map) as IDFMap;
  } catch {
    return null;
  }
}
