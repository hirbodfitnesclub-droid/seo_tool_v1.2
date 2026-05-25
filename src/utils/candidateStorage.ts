import { db, type Page } from '../db';
import * as idfRepository from '../repositories/idfRepository';
import * as candidateRepository from '../repositories/candidateRepository';
import { computeAllInWorker } from '../services/scoring/scoringService';
import { type IDFMap } from '../core/scoring/idfCalculator';

// محاسبه و ذخیره کاندیداهای برتر برای تمام صفحات یک پروژه با استفاده از وب‌ورکر و لایه‌های مخزن
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  _weights: Record<string, number>,
  _mode: 'linear' | 'weighted'
): Promise<void> {
  
  // ۱. تبدیل pages به فرمت مورد نیاز scorer
  const pagesWithId = pages.map(p => ({
    id: p.id!,
    title: p.title,
    categories: typeof p.categories === 'string' ? JSON.parse(p.categories) : p.categories
  }));
  
  // ۲. محاسبه IDF و مقادیر کاندیداها به صورت همزمان با یک پیام به وب‌ورکر بهینه شده
  const { idfMap, candidatesMap } = await computeAllInWorker(pagesWithId);
  
  // ۳. آماده‌سازی رکوردهای نهایی کاندیداها برای ذخیره گروهی
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));
  
  // ۴. ذخیره همگی در قالب یک تراکنش واحد برای جلوگیری از re-render های مکرر UI
  await db.transaction('rw', [db.idfCache, db.candidates], async () => {
    // ذخیره IDF در کش با استفاده از نسخه مخصوص دورن تراکنش
    await idfRepository.upsertInTx(projectId, JSON.stringify(idfMap));
    
    // حذف کاندیداهای قبلی پروژه
    await candidateRepository.clearByProject(projectId);
    
    // ذخیره گروهی جدید
    await candidateRepository.bulkAdd(records);
  });
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

