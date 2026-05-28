import { db, type Page } from '../db';
import * as idfRepository from '../repositories/idfRepository';
import * as candidateRepository from '../repositories/candidateRepository';
import { computeAllInWorker } from '../services/scoring/scoringService';
import { type IDFMap, computeIDFMap } from '../core/scoring/idfCalculator';
import { computeAllCandidates, type CandidateWithTags } from '../core/scoring/scorer';

// آستانه انتخاب موتور پردازش: زیر این مقدار، اجرای مستقیم روی Main Thread (Fast-Track)
const SCORING_WORKER_THRESHOLD = 1000;

// محاسبه و ذخیره کاندیداهای برتر برای تمام صفحات یک پروژه با استفاده از وب‌ورکر یا اجرای مستقیم روی Main Thread بر اساس آستانه تعداد صفحات
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
    categories: p.categories // 👈 حذف JSON.parse تا scorer خودش کارش رو بکنه
  }));
  
  // ۲. انتخاب مسیر پردازش مبتنی بر اندازه پروژه
  let idfMap: IDFMap;
  let candidatesMap: Map<number, CandidateWithTags[]>;

  if (pagesWithId.length <= SCORING_WORKER_THRESHOLD) {
    // ── Fast-Track: اجرای مستقیم روی Main Thread، بدون Worker ──
    idfMap = computeIDFMap(pagesWithId);
    const rawCandidatesMap = computeAllCandidates(pagesWithId as any);
    // برای تطابق دقیق بایت‌به‌بایت با خروجی وب‌ورکر (مسیر Heavy)، نتایج را به ۵۰ کاندیدای برتر محدود می‌کنیم

    candidatesMap = new Map<number, CandidateWithTags[]>(
      Array.from(rawCandidatesMap.entries()).map(([pageId, list]) => [
        pageId,
        list.slice(0, 50)
      ])
    );
  } else {
    // ── Heavy-Track: ارسال به Web Worker (همان مسیر R12) ──
    const result = await computeAllInWorker(pagesWithId);
    idfMap = result.idfMap;
    candidatesMap = result.candidatesMap;
  }

  // ثبت لاگ عیب‌یابی در کنسول
  console.log('[v0] scoring path', pagesWithId.length, pagesWithId.length <= SCORING_WORKER_THRESHOLD ? 'fast' : 'heavy');
  
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

