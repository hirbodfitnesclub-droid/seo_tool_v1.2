/**
 * @file quotaService.ts
 * @description هسته محاسباتی Pure برای عینک سهمیه سراسری و اولویت‌دهی ایمپرشن (فیچر F3).
 * این ماژول هیچ وابستگی به لایه نمایش (React) یا پایگاه‌داده (Dexie) ندارد و کاملاً مستقل است.
 */

export interface QuotaRow {
  title: string;          // عنوان خام (H1) در فایل CSV
  url?: string;           // آدرس صفحه مقصد (اختیاری)
  impressions: number;    // میزان ایمپرشن ثبت شده برای مقصد
  percentage: number;     // درصد سهمیه اختصاص یافته به مقصد
}

export interface QuotaTargetInfo {
  allowedSources: Set<number>; // مجموعه شناسه‌های صفحات مبدأ که تخصیص به آنها مجاز است
  impressionWeight: number;    // ضریب وزنی حاصل از پیش‌محاسبه ایمپرشن مقصد
  quota: number;               // کل تعداد مجاز لینک ورودی به این مقصد (سهمیه نهایی)
  assigned: number;            // تعداد رکوردهای تخصیص داده شده واقعی
  impressions: number;         // مقدار عددی ایمپرشن
  percentage: number;         // درصد سهمیه
}

export interface QuotaAllocation {
  byTarget: Map<number, QuotaTargetInfo>; // نقشه‌برداری شناسه صفحه مقصد به اطلاعات سهمیه آن
  unmatchedTitles: string[];              // لیست عناوینی در CSV که با هیچ صفحه‌ای در دیتابیس مطابقت نداشتند
}

export interface FinalCandidate {
  page_id: number;
  title: string;
  score: number;                         // امتیاز خام اولیه
  matched_tags: string[];

  // فیلدهای لایو زمانی (F2 - اختیاری)
  boostedScore?: number;
  temporalMultiplier?: number;
  temporalLabel?: string;
  temporalReason?: string;
  matchedEventName?: string | null;

  // فیلدهای سهمیه (F3)
  impressionWeight?: number;             // ضریب برانگیختگی ایمپرشن
  quotaLabel: 'within-quota' | 'unmanaged';
  quotaInfo?: {
    quota: number;
    assigned: number;
    impressions: number;
    percentage: number;
  };
  finalScore?: number;                   // امتیاز نهایی ترکیب شده
}

/**
 * ثابت تعیین قدرت ضریب ایمپرشن (IMPRESSION_BOOST_STRENGTH)
 * مقدار ۱ موجب می‌شود ضریب وزنی نهایی ایمپرشن در بازه [۱، ۲] قرار گیرد.
 */
export const IMPRESSION_BOOST_STRENGTH = 1;

/**
 * نرمال‌سازی کردن رشته برای مطابقت هوشمند دقیق بین عنوان H1 در فایل CSV و عنوان صفحات در دیتابیس.
 * این تابع دقیقاً هم‌رفتار با normalizeString در temporalService است.
 */
export function normalizeTitle(s: string): string {
  if (!s) return '';
  return s
    .replace(/[\u064a\u0649]/g, '\u06cc') // ي or ى to ی
    .replace(/\u0643/g, '\u06a9')        // ك to ک
    .replace(/\u200c/g, ' ')             // تبدیل نیم‌فاصله به فاصله معمولی
    .replace(/\s+/g, ' ')                // فشرده‌سازی فاصله‌های خالی تکراری
    .trim()
    .toLowerCase();
}

/**
 * نرمال‌سازی آدرس‌های وب جهت یکپارچه‌سازی و مقایسه در تخصیص سهمیه‌بندی.
 * اسلش‌های آخر، پروتکل http/https، مقدار www و پارامترها یا هشت‌ها را فاقد تاثیر می‌کند.
 */
export function normalizeUrl(urlStr: string | undefined): string {
  if (!urlStr) return '';
  let url = urlStr.trim().toLowerCase();
  
  // حذف پارامترهای کوئری و هشت لنگرها
  url = url.split('?')[0].split('#')[0];
  
  // حذف پروتکل و دابلیودابلیودابلیو
  url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  
  // در صورتی که آدرس دامنه وجود دارد، بخش مسیر (Path) را استخراج می‌کنیم
  if (!url.startsWith('/')) {
    const slashIdx = url.indexOf('/');
    if (slashIdx !== -1) {
      url = url.slice(slashIdx);
    } else if (url.includes('.')) {
      // فقط یک دامنه خالی است
      url = '/';
    }
  }
  
  // اطمینان از وجود اسلش در ابتدا و حذف اسلش اضافه در انتها
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  while (url.endsWith('/') && url.length > 1) {
    url = url.slice(0, -1);
  }
  
  if (url === '') {
    url = '/';
  }
  
  return url;
}

/**
 * محاسبه ضریب‌های وزنی ایمپرشن با استفاده از تابع log-normalized.
 * @param rows لیست ردیف‌های سهمیه وارد شده توسط کاربر
 * @param matchedTitleToPageId نقشه‌برداری عنوان نرمال شده به شناسه عددی صفحه
 * @param matchedUrlToPageId نقشه‌برداری آدرس نرمال شده به شناسه عددی صفحه (اختیاری)
 * @returns نقشه‌برداری شناسه صفحه مقصد به ضریب وزنی ایمپرشن آن
 */
export function computeImpressionWeights(
  rows: QuotaRow[],
  matchedTitleToPageId: Map<string, number>,
  matchedUrlToPageId?: Map<string, number>
): Map<number, number> {
  const matchedPageImpressions = new Map<number, number>();

  // تجمیع ایمپرشن‌ها برای هر مقصدِ مطابقت یافته با اولویت دو مرحله‌ای (URL و سپس عنوان)
  for (const row of rows) {
    let pageId: number | undefined = undefined;

    // گام اول: تطبیق بر اساس آدرس
    if (row.url && matchedUrlToPageId) {
      const normUrl = normalizeUrl(row.url);
      if (matchedUrlToPageId.has(normUrl)) {
        pageId = matchedUrlToPageId.get(normUrl);
      }
    }

    // گام دوم (Fallback): تطبیق بر اساس عنوان
    if (pageId === undefined) {
      const normTitle = normalizeTitle(row.title);
      if (matchedTitleToPageId.has(normTitle)) {
        pageId = matchedTitleToPageId.get(normTitle)!;
      }
    }

    if (pageId !== undefined) {
      const currentImpr = matchedPageImpressions.get(pageId) || 0;
      matchedPageImpressions.set(pageId, currentImpr + row.impressions);
    }
  }

  const weights = new Map<number, number>();
  if (matchedPageImpressions.size === 0) {
    return weights;
  }

  // محاسبه log(impressions + 1) و دریافت مقادیر حداقل و حداکثر
  let minLog = Infinity;
  let maxLog = -Infinity;
  const pageLogs = new Map<number, number>();

  for (const [pageId, impressions] of matchedPageImpressions.entries()) {
    const logImpr = Math.log(impressions + 1);
    pageLogs.set(pageId, logImpr);
    if (logImpr < minLog) minLog = logImpr;
    if (logImpr > maxLog) maxLog = logImpr;
  }

  // محاسبه ضریب نهایی برای هر مقصد
  for (const [pageId, logImpr] of pageLogs.entries()) {
    let norm = 0;
    if (maxLog !== minLog && maxLog !== -Infinity && minLog !== Infinity) {
      norm = (logImpr - minLog) / (maxLog - minLog);
    }
    const weight = 1 + IMPRESSION_BOOST_STRENGTH * norm;
    weights.set(pageId, weight);
  }

  return weights;
}

/**
 * اعمال لنز فیلترینگ و ضریب‌دهی سهمیه‌بندی روی نامزدهای یک صفحه مبدأ خاص.
 * @param candidates لیست کاندیداهای ورودی صفحه مبدأ
 * @param sourcePageId شناسه صفحه مبدأ فعلی
 * @param allocation پیش‌محاسبه تخصیص سراسری سهمیه
 * @returns لیست جدید کاندیداها به همراه برچسب‌های سهمیه و فیلتر شده‌های خارج از سهمیه
 */
export function applyQuotaLens(
  candidates: any[],
  sourcePageId: number,
  allocation: QuotaAllocation
): FinalCandidate[] {
  const finalCandidates: FinalCandidate[] = [];

  for (const c of candidates) {
    const pageId = c.page_id;

    // کاندیداهایی که در سهمیه مدیریت نشده‌اند به عنوان unmanaged عبور می‌کنند
    if (!allocation.byTarget.has(pageId)) {
      finalCandidates.push({
        ...c,
        quotaLabel: 'unmanaged'
      });
      continue;
    }

    const targetInfo = allocation.byTarget.get(pageId)!;

    // اگر کاندیدا مدیریت شده بود و این صفحه مبدأ جزو تخصیص‌های مجاز او بود، نگه داشته می‌شود
    if (targetInfo.allowedSources.has(sourcePageId)) {
      finalCandidates.push({
        ...c,
        impressionWeight: targetInfo.impressionWeight,
        quotaLabel: 'within-quota',
        quotaInfo: {
          quota: targetInfo.quota,
          assigned: targetInfo.assigned,
          impressions: targetInfo.impressions,
          percentage: targetInfo.percentage
        }
      });
    }
    // نامزد مدیریت شده‌ای که جزو مبدأهای اولویت‌دار نبود فیلتر شده و حذف می‌گردد
  }

  return finalCandidates;
}

/**
 * مرتب‌سازی اکید و قطعی کاندیداها بر اساس امتیاز نهایی به صورت نزولی.
 * در صورت تساوی با شناسه صفحه به صورت صعودی (tie-break).
 */
export function sortByFinalScore(list: FinalCandidate[]): FinalCandidate[] {
  return [...list].sort((a, b) => {
    const scoreA = a.finalScore ?? a.boostedScore ?? a.score ?? 0;
    const scoreB = b.finalScore ?? b.boostedScore ?? b.score ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.page_id - b.page_id;
  });
}
