import { type Page } from '../db';
import * as idfRepository from '../repositories/idfRepository';
import * as candidateRepository from '../repositories/candidateRepository';
import { computeCandidatesInWorker, computeIDFInWorker } from '../services/scoring/scoringService';
import { type IDFMap } from '../core/scoring/idfCalculator';

// محاسبه و ذخیره کاندیداهای برتر برای تمام صفحات یک پروژه با استفاده از وب‌ورکر و لایه‌های مخزن
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  _weights: Record<string, number>,
  _mode: 'linear' | 'weighted'
): Promise<void> {
  
  // ۱. محاسبه IDF در وب‌ورکر پس‌زمینه
  const idfMap = await computeIDFInWorker(pages);
  
  // ۲. ذخیره IDF در کش با استفاده از مخزن داده
  await idfRepository.upsert(projectId, JSON.stringify(idfMap));
  
  // ۳. حذف کاندیداهای قبلی پروژه با استفاده از مخزن داده
  await candidateRepository.clearByProject(projectId);
  
  // ۴. تبدیل pages به فرمت مورد نیاز scorer
  const pagesWithId = pages.map(p => ({
    id: p.id!,
    title: p.title,
    categories: typeof p.categories === 'string' ? JSON.parse(p.categories) : p.categories
  }));
  
  // ۵. محاسبه مقادیر کاندیداها با استفاده از وب‌ورکر ناهمگام (بدون مسدودسازی رشته اصلی)
  const candidatesMap = await computeCandidatesInWorker(pagesWithId);
  
  // ۶. آماده‌سازی رکوردهای نهایی کاندیداها
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));
  
  // ۷. ذخیره گروهی امن در دیتابیس با استفاده از مخزن داده
  await candidateRepository.bulkAdd(records);
}

// خواندن IDF کش‌شده برای یک پروژه
export async function getCachedIDF(projectId: number): Promise<IDFMap | null> {
  const record = await idfRepository.getByProject(projectId);
  if (!record) return null;
  try {
    return JSON.parse(record.idf_map) as IDFMap;
  } catch {
    return null;
  }
}

