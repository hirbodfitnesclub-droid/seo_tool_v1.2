/**
 * @file quotaAllocationService.ts
 * @description سرویس تخصیص سراسری سهمیه برای هر صفحه مقصد به صفحات مبدأ.
 * دارای سیستم کش هوشمند در حافظه (In-Memory) با امضای پروژه برای بازسازی خودکار در زمان تغییر داده‌های پایه.
 */

import * as pageRepository from '../../repositories/pageRepository';
import * as candidateRepository from '../../repositories/candidateRepository';
import { safeJsonParse } from '../../utils/safeJson';
import {
  type QuotaRow,
  type QuotaTargetInfo,
  type QuotaAllocation,
  normalizeTitle,
  normalizeUrl,
  computeImpressionWeights
} from './quotaService';

export interface QuotaSettings {
  totalInternalLinks: number;
  rows: QuotaRow[];
}

interface CacheEntry {
  allocation: QuotaAllocation;
  signature: string;
  builtAt: number;
  buildPromise?: Promise<QuotaAllocation>;
}

const cache = new Map<number, CacheEntry>();

/**
 * تولید هش ساده و تکرارپذیر جهت یکپارچه‌سازی متغیرهای تنظیمات سهمیه
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // تبدیل به عدد ۳۲ بیتی
  }
  return hash.toString();
}

/**
 * دریافت آخرین زمان محاسبات کاندیداها از دیتابیس برای اعتبارسنجی امضای حافظه کش
 */
async function getLatestCandidatesComputedAt(projectId: number): Promise<string> {
  const candidates = await candidateRepository.listByProject(projectId);
  let latest = '';
  for (const cand of candidates) {
    if (cand.computed_at > latest) {
      latest = cand.computed_at;
    }
  }
  return latest;
}

/**
 * محاسبه امضای اعتبارسنجی (Signature) برای کش‌کردن تخصیص‌های سراسری یک پروژه
 */
async function computeSignature(projectId: number, settings: QuotaSettings): Promise<string> {
  const candidatesCount = await candidateRepository.countByProject(projectId);
  const latestComputedAt = await getLatestCandidatesComputedAt(projectId);
  const settingsHash = hashString(JSON.stringify(settings));
  
  return `${candidatesCount}:${latestComputedAt}:${settingsHash}`;
}

/**
 * دریافت یا ساخت تخصیص سراسری سهمیه‌بندی به همراه لود Lazy و Chunked کاندیداها
 */
export async function getOrBuildAllocation(
  projectId: number,
  settings: QuotaSettings
): Promise<QuotaAllocation> {
  const signature = await computeSignature(projectId, settings);
  const existing = cache.get(projectId);
  
  // بازگرداندن جواب در صورت معتبر بودن کلید کش قبلی
  if (existing && existing.signature === signature) {
    if (existing.buildPromise) {
      return existing.buildPromise;
    }
    return existing.allocation;
  }
  
  // ممانعت از اجرای همزمان دو عملیات ساخت کش در مرورگر
  if (existing && existing.buildPromise) {
    return existing.buildPromise;
  }
  
  const buildPromise = buildAllocation(projectId, settings);
  
  cache.set(projectId, {
    allocation: { byTarget: new Map(), unmatchedTitles: [] },
    signature,
    builtAt: Date.now(),
    buildPromise
  });
  
  try {
    const allocation = await buildPromise;
    cache.set(projectId, {
      allocation,
      signature,
      builtAt: Date.now()
    });
    return allocation;
  } catch (error) {
    cache.delete(projectId);
    throw error;
  }
}

/**
 * اجرای الگوریتم پیش‌محاسبه ۵ مرحله‌ای تخصیص سراسری سهمیه
 */
async function buildAllocation(projectId: number, settings: QuotaSettings): Promise<QuotaAllocation> {
  // ۱. واکشی اطلاعات تمامی صفحات پروژه و به دست آوردن مپ عنوان نرمال‌شده و مپ آدرس نرمال‌شده به شناسه صفحه
  const pages = await pageRepository.listByProject(projectId);
  const normalizedTitleToPageId = new Map<string, number>();
  const normalizedUrlToPageId = new Map<string, number>();
  
  for (const pg of pages) {
    if (pg.id !== undefined) {
      normalizedTitleToPageId.set(normalizeTitle(pg.title), pg.id);
      
      // بررسی فیلدهای مربوط به آدرس صفحه جهت تطبیق عالی بر اساس URL
      const pgAny = pg as any;
      const pgUrl = pgAny.url || pgAny.link || pgAny.path || pgAny.address;
      if (pgUrl) {
        normalizedUrlToPageId.set(normalizeUrl(pgUrl), pg.id);
      } else if (pg.title && (pg.title.includes('/') || pg.title.includes('.') || pg.title.toLowerCase().startsWith('http'))) {
        normalizedUrlToPageId.set(normalizeUrl(pg.title), pg.id);
      }
    }
  }

  // ۲. مطابقت دادن ردیف‌های فایل CSV با صفحات دیتابیس (دو مرحله‌ای: URL و سپس عنوان)
  const targetQuotasMap = new Map<number, { quota: number; impressions: number; percentage: number; rawTitle: string }>();
  const unmatchedTitles: string[] = [];

  for (const row of settings.rows) {
    let targetPageId: number | undefined = undefined;

    // گام اول: اولویت قطعی جهت تطبیق بر اساس URL
    if (row.url) {
      const normUrl = normalizeUrl(row.url);
      if (normalizedUrlToPageId.has(normUrl)) {
        targetPageId = normalizedUrlToPageId.get(normUrl);
      }
    }

    // گام دوم (Fallback): تطبیق بر اساس عنوان هم‌تراز شده
    if (targetPageId === undefined) {
      const normTitle = normalizeTitle(row.title);
      if (normalizedTitleToPageId.has(normTitle)) {
        targetPageId = normalizedTitleToPageId.get(normTitle)!;
      }
    }

    if (targetPageId !== undefined) {
      // محاسبه سهمیه کل برای این صفحه: سهمیه = round(percentage / 100 * totalInternalLinks)
      const quota = Math.max(0, Math.round((row.percentage / 100) * settings.totalInternalLinks));
      targetQuotasMap.set(targetPageId, {
        quota,
        impressions: row.impressions,
        percentage: row.percentage,
        rawTitle: row.title
      });
    } else {
      unmatchedTitles.push(row.title);
    }
  }

  // ۳. پیمایش کاندیداهای کل پروژه به صورت Chunkهای ۱۰۰تایی برای ممانعت از قفل‌شدگی UI
  const edgesMap = new Map<number, { sourcePageId: number; edgeScore: number }[]>();
  const candidates = await candidateRepository.listByProject(projectId);

  const CHUNK_SIZE = 100;
  for (let i = 0; i < candidates.length; i++) {
    const candRec = candidates[i];
    const sourcePageId = candRec.source_page_id;
    const candidateList = safeJsonParse<any[]>(candRec.candidate_list, []);

    for (const item of candidateList) {
      const targetId = typeof item.page_id === 'number' ? item.page_id : Number(item.page_id);
      if (isNaN(targetId) || targetId === sourcePageId) continue;

      // ثبت و جمع‌آوری امتیازها صرفاً برای صفحاتی که در چرخه‌ی سهمیه‌بندی (Managed) قرار دارند
      if (targetQuotasMap.has(targetId)) {
        if (!edgesMap.has(targetId)) {
          edgesMap.set(targetId, []);
        }
        edgesMap.get(targetId)!.push({
          sourcePageId,
          edgeScore: typeof item.score === 'number' ? item.score : 0
        });
      }
    }

    // استراحت کوتاه در حلقه Event Loop
    if (i % CHUNK_SIZE === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // ۴. محاسبه ضریب وزنی ایمپرشن هر صفحه مقصد از طریق هسته Pure با در نظر گرفتن مپ URLها
  const impressionWeights = computeImpressionWeights(settings.rows, normalizedTitleToPageId, normalizedUrlToPageId);

  // ۵. ایجاد allowedSources بر اساس اولویت امتیاز یال‌ها و ساخت QuotaTargetInfo نهایی
  const byTarget = new Map<number, QuotaTargetInfo>();

  for (const [targetPageId, quotaProps] of targetQuotasMap.entries()) {
    const edges = edgesMap.get(targetPageId) || [];
    
    // سورت کاندیداهای فرستنده بر اساس بیشترین امتیاز لبه
    const sortedEdges = [...edges].sort((a, b) => {
      if (b.edgeScore !== a.edgeScore) {
        return b.edgeScore - a.edgeScore;
      }
      return a.sourcePageId - b.sourcePageId;
    });

    const allowedSources = new Set<number>();
    const quota = quotaProps.quota;
    const assigned = Math.min(quota, sortedEdges.length);

    for (let idx = 0; idx < assigned; idx++) {
      allowedSources.add(sortedEdges[idx].sourcePageId);
    }

    const impressionWeight = impressionWeights.get(targetPageId) ?? 1;

    byTarget.set(targetPageId, {
      allowedSources,
      impressionWeight,
      quota,
      assigned,
      impressions: quotaProps.impressions,
      percentage: quotaProps.percentage
    });
  }

  return {
    byTarget,
    unmatchedTitles
  };
}

/**
 * باطل‌سازی دستی کش مربوط به پروژه (به عنوان مثال بعد از حذف پروژه یا تحلیل مجدد تمام کاندیداها)
 */
export function invalidateProject(projectId: number): void {
  cache.delete(projectId);
}
