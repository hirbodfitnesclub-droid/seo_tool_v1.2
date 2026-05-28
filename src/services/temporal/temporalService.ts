import { JalaliDate, getCurrentJalaliDate, jalaliDaysBetween, isJalaliInRange } from './jalaliCalendar';

/**
 * مسئولیت: تعریف تایپ‌های لایه افزایش امتیاز زمانی (Temporal Boost) و پیاده‌سازی منطق محاسباتی pure.
 */

export type TemporalLabel = 'pre' | 'current' | 'neutral' | 'out-of-season';

export interface TemporalEvent {
  id: string;               // شناسه منحصربه‌فرد مناسبت
  name: string;             // نام مناسبت یا رویداد
  startDate: JalaliDate;    // تاریخ شروع مناسبت در تقویم شمسی
  endDate: JalaliDate;      // تاریخ پایان مناسبت در تقویم شمسی
  keywords: string[];       // کلمات کلیدی مرتب‌شده به‌صورت حروف کوچک و بدون فضای اضافی
  source: 'csv' | 'builtin'; // منبع تعریف رویداد
}

export interface BoostedCandidate {
  page_id: number;
  title: string;
  score: number;            // امتیاز محاسباتی خام (دست‌نخورده)
  matched_tags: string[];
  
  // فیلدهای بونوس فاز ۲:
  boostedScore: number;                 // امتیاز نهایی پس از اعمال ضریب زمانی (score * multiplier)
  temporalMultiplier: 4 | 3 | 1 | 0.15; // مقدار ضریب اعمال شده (۴، ۳، ۱ یا ۰.۱۵)
  temporalLabel: TemporalLabel;         // برچسب دسته‌بندی زمانی
  temporalReason: string;               // توضیح فارسی دلیل اعمال ضریب (مثال: «پیش‌واز یلدا — ۴۵ روز مانده»)
  matchedEventName: string | null;      // نام مناسبتی که تطابق پیدا کرده است
}

/**
 * نرمال‌سازی کردن رشته برای همسان‌سازی مقایسه عبارات (رفع نیم‌فاصله و فاصله‌های مکرر)
 */
function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\u200c/g, ' ') // تبدیل نیم‌فاصله به فاصله معمولی
    .replace(/\s+/g, ' ')   // فشرده‌سازی فاصله‌های مکرر به یک فاصله
    .trim()
    .toLowerCase();
}

/**
 * استخراج و یکپارچه‌سازی تمام کلمات کلیدی متناظر با یک کاندیدا
 */
function extractKeywordsFromCandidate(
  candidate: any,
  targetMetadata?: Map<number, { title: string; categoryValues: string[] }>
): string[] {
  const keywordsSet = new Set<string>();

  if (candidate.title) {
    keywordsSet.add(candidate.title.toLowerCase().trim());
  }

  const tags = candidate.matched_tags || candidate.matchedTags || [];
  if (Array.isArray(tags)) {
    tags.forEach((tag: any) => {
      if (typeof tag === 'string') {
        keywordsSet.add(tag.toLowerCase().trim());
      }
    });
  }

  if (targetMetadata && targetMetadata.has(candidate.page_id)) {
    const meta = targetMetadata.get(candidate.page_id);
    if (meta && Array.isArray(meta.categoryValues)) {
      meta.categoryValues.forEach((val: any) => {
        if (typeof val === 'string') {
          keywordsSet.add(val.toLowerCase().trim());
        }
      });
    }
  }

  return Array.from(keywordsSet);
}

/**
 * بررسی انطباق کلمات کلیدی مناسبت با کلمات کلیدی کاندیدا
 */
function matchEventToKeywords(event: TemporalEvent, keywords: string[]): boolean {
  return event.keywords.some((kw) => {
    const normalizedKw = normalizeString(kw);
    if (!normalizedKw) return false;
    return keywords.some((k) => {
      const normalizedK = normalizeString(k);
      return normalizedK.includes(normalizedKw) || normalizedKw.includes(normalizedK);
    });
  });
}

/**
 * انتقال تاریخ رویدادهای سالانه به سال جاری یا سال آینده (در صورتی که تاریخ امسال گذشته باشد)
 */
function projectEventToCurrentYear(event: TemporalEvent, today: JalaliDate): TemporalEvent {
  if (event.startDate.year > today.year) {
    return event;
  }

  let startYear = today.year;
  let endYear = today.year;

  // اگر انتهای رویداد بر اساس ماه کوچکتر از شروع باشد، یعنی از مرز تبریک سال عبور می‌کند (مثل نوروز)
  if (event.endDate.month < event.startDate.month) {
    endYear = startYear + 1;
  }

  let projectedStart: JalaliDate = {
    year: startYear,
    month: event.startDate.month,
    day: event.startDate.day,
  };

  let projectedEnd: JalaliDate = {
    year: endYear,
    month: event.endDate.month,
    day: event.endDate.day,
  };

  // بررسی عبور کامل تاریخ امسال رویداد
  if (jalaliDaysBetween(today, projectedEnd) < 0) {
    const nextStartYear = today.year + 1;
    let nextEndYear = nextStartYear;
    if (event.endDate.month < event.startDate.month) {
      nextEndYear = nextStartYear + 1;
    }

    projectedStart = {
      year: nextStartYear,
      month: event.startDate.month,
      day: event.startDate.day,
    };
    projectedEnd = {
      year: nextEndYear,
      month: event.endDate.month,
      day: event.endDate.day,
    };
  }

  return {
    ...event,
    startDate: projectedStart,
    endDate: projectedEnd,
  };
}

/**
 * ارزیابی وضعیت زمانی رویداد نسبت به تاریخ جاری (جاری یا پیش‌واز یا بی‌اثر)
 */
function classifyEventTiming(
  event: TemporalEvent,
  today: JalaliDate
): { label: TemporalLabel; multiplier: 4 | 3 | 1 | 0.15; reason: string } | null {
  if (isJalaliInRange(today, event.startDate, event.endDate)) {
    return {
      label: 'current',
      multiplier: 3,
      reason: `در حال برگزاری: ${event.name}`,
    };
  }

  const daysToStart = jalaliDaysBetween(today, event.startDate);
  if (daysToStart >= 30 && daysToStart <= 60) {
    return {
      label: 'pre',
      multiplier: 4,
      reason: `پیش‌واز ${event.name} — ${daysToStart} روز مانده`,
    };
  }

  return null;
}

/**
 * شناساگر کاندیداهای خارج از فصل جاری برای جریمه زمانی
 */
function detectOutOfSeason(keywords: string[], today: JalaliDate): string | null {
  const seasons = [
    { name: 'بهار', start: { year: 1400, month: 1, day: 1 }, end: { year: 1400, month: 3, day: 31 } },
    { name: 'تابستان', start: { year: 1400, month: 4, day: 1 }, end: { year: 1400, month: 6, day: 31 } },
    { name: 'پاییز', start: { year: 1400, month: 7, day: 1 }, end: { year: 1400, month: 9, day: 30 } },
    { name: 'زمستان', start: { year: 1400, month: 10, day: 1 }, end: { year: 1400, month: 12, day: 29 } },
  ];

  for (const season of seasons) {
    const isCurrent = isJalaliInRange(today, season.start, season.end);
    if (!isCurrent) {
      const hasKeyword = keywords.some((k) => k.includes(season.name));
      if (hasKeyword) {
        return season.name;
      }
    }
  }

  return null;
}

/**
 * تابع اصلی افزایش رتبه‌ی زمانی (Temporal Boost Middleware) به همراه سهمیه‌بندی هوشمند رویدادها
 */
export function applyTemporalBoost(
  candidates: any[],
  options: {
    events: TemporalEvent[];
    today?: JalaliDate;
    targetMetadata?: Map<number, { title: string; categoryValues: string[] }>;
    sourcePageTitle?: string;
  }
): BoostedCandidate[] {
  const today = options.today ?? getCurrentJalaliDate();
  const events = options.events || [];
  const targetMetadata = options.targetMetadata;
  const sourceTitle = options.sourcePageTitle || '';

  // تشخیص زماندار بودن صفحه مبدأ بر اساس کلمات کلیدی تمام رویدادها
  let isSeasonal = false;
  if (sourceTitle) {
    const normalizedSourceTitle = normalizeString(sourceTitle);
    isSeasonal = events.some((event) => {
      return event.keywords.some((kw) => {
        const normalizedKw = normalizeString(kw);
        if (!normalizedKw) return false;
        return normalizedSourceTitle.includes(normalizedKw) || normalizedKw.includes(normalizedSourceTitle);
      });
    });
  }

  // سهمیه‌بندی: ۵ لینک اگر صفحه مبدأ خود زمان‌دار باشد، در غیر این‌صورت ۳ لینک
  const quota = isSeasonal ? 5 : 3;

  const allProcessed = candidates.map((c): BoostedCandidate => {
    const keywords = extractKeywordsFromCandidate(c, targetMetadata);

    let bestMatch: {
      label: TemporalLabel;
      multiplier: 4 | 3 | 1 | 0.15;
      reason: string;
      eventName: string;
    } | null = null;

    for (const event of events) {
      if (!matchEventToKeywords(event, keywords)) continue;
      const projected = projectEventToCurrentYear(event, today);
      const classification = classifyEventTiming(projected, today);
      if (!classification) continue;

      // اولویت بالا به ضریب بزرگتر (پیش‌واز ۴ بر جاری ۳ ارجح است)
      if (!bestMatch || classification.multiplier > bestMatch.multiplier) {
        bestMatch = {
          ...classification,
          eventName: event.name,
        };
      }
    }

    const score = typeof c.score === 'number' ? c.score : 0;
    const matchedTagsArray = c.matched_tags || c.matchedTags || [];

    if (bestMatch) {
      return {
        page_id: c.page_id,
        title: c.title,
        score: score,
        matched_tags: matchedTagsArray,
        boostedScore: score * bestMatch.multiplier,
        temporalMultiplier: bestMatch.multiplier,
        temporalLabel: bestMatch.label,
        temporalReason: bestMatch.reason,
        matchedEventName: bestMatch.eventName,
      };
    }

    const outOfSeasonReason = detectOutOfSeason(keywords, today);
    if (outOfSeasonReason) {
      return {
        page_id: c.page_id,
        title: c.title,
        score: score,
        matched_tags: matchedTagsArray,
        boostedScore: score * 0.15,
        temporalMultiplier: 0.15,
        temporalLabel: 'out-of-season',
        temporalReason: `خارج از فصل: ${outOfSeasonReason}`,
        matchedEventName: null,
      };
    }

    return {
      page_id: c.page_id,
      title: c.title,
      score: score,
      matched_tags: matchedTagsArray,
      boostedScore: score,
      temporalMultiplier: 1,
      temporalLabel: 'neutral',
      temporalReason: '',
      matchedEventName: null,
    };
  });

  // تفکیک کاندیداهای دارای ضریب افزایشی (بونوس مثبت) جهت سهمیه‌بندی
  const positiveBoosted = allProcessed.filter(item => item.temporalMultiplier !== undefined && item.temporalMultiplier > 1);
  const others = allProcessed.filter(item => !(item.temporalMultiplier !== undefined && item.temporalMultiplier > 1));

  // مرتب‌سازی کاندیداهای بوست‌شده بر اساس امتیاز جدید نزولی
  positiveBoosted.sort((a, b) => b.boostedScore - a.boostedScore);

  // نگه داشتن ردیف‌های برتر تا سقف سهمیه و خنثی کردن اضافه بار فصلی
  const topPositiveBoosted = positiveBoosted.slice(0, quota);
  const restPositiveBoosted = positiveBoosted.slice(quota).map(item => ({
    ...item,
    boostedScore: item.score,
    temporalMultiplier: 1 as const,
    temporalLabel: 'neutral' as TemporalLabel,
    temporalReason: '',
    matchedEventName: null
  }));

  const combined = [...topPositiveBoosted, ...restPositiveBoosted, ...others];

  // مرتب‌سازی نهایی و خروجی یکپارچه دست‌نخورده
  return sortByBoostedScore(combined);
}

/**
 * مرتب‌سازی کاندیداها بر اساس امتیاز بوست‌شده به‌صورت نزولی (به‌صورت immutable)
 */
export function sortByBoostedScore(boosted: BoostedCandidate[]): BoostedCandidate[] {
  return [...boosted].sort((a, b) => b.boostedScore - a.boostedScore);
}

