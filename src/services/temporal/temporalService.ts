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
  temporalMultiplier: 4 | 3 | 1 | 0.15 | 0.001; // مقدار ضریب اعمال شده (۴، ۳، ۱، ۰.۱۵ یا ۰.۰۰۱)
  temporalLabel: TemporalLabel;         // برچسب دسته‌بندی زمانی
  temporalReason: string;               // توضیح فارسی دلیل اعمال ضریب (مثال: «پیش‌واز یلدا — ۴۵ روز مانده»)
  matchedEventName: string | null;      // نام مناسبتی که تطابق پیدا کرده است
  temporalTargetMonth?: number;         // ماه هدف مناسبت برای فیلترینگ پساپردازش
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
 * بررسی می‌کند که آیا یک عبارت (کلمه یا ترکیب کلمات) به صورت کامل و با رعایت مرز کلمه‌ها 
 * در یک متن وجود دارد یا خیر.
 */
export function matchWithBoundary(text: string, phrase: string): boolean {
  const idxs: number[] = [];
  let pos = text.indexOf(phrase);
  while (pos !== -1) {
    idxs.push(pos);
    pos = text.indexOf(phrase, pos + 1);
  }

  if (idxs.length === 0) return false;

  const isWordChar = (char: string): boolean => {
    if (!char) return false;
    // حروف الفبای فارسی/عربی، حروف انگلیسی و اعداد
    return /[a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);
  };

  return idxs.some((idx) => {
    const startBoundary = idx === 0 || !isWordChar(text[idx - 1]);
    const endBoundary = (idx + phrase.length) === text.length || !isWordChar(text[idx + phrase.length]);
    return startBoundary && endBoundary;
  });
}

/**
 * بررسی انطباق کلمات کلیدی مناسبت با کلمات کلیدی کاندیدا
 */
function matchEventToKeywords(event: TemporalEvent, keywords: string[]): boolean {
  const validKeywords = (keywords || []).filter(Boolean);
  const validEventKeywords = (event.keywords || []).filter(Boolean);

  return validEventKeywords.some((kw) => {
    const normalizedKw = normalizeString(kw);
    if (!normalizedKw) return false;
    return validKeywords.some((k) => {
      const normalizedK = normalizeString(k);
      if (!normalizedK) return false;
      return matchWithBoundary(normalizedK, normalizedKw);
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
): { label: TemporalLabel; multiplier: 4 | 3 | 1 | 0.15 | 0.001; reason: string } | null {
  if (isJalaliInRange(today, event.startDate, event.endDate)) {
    return {
      label: 'current',
      multiplier: 3,
      reason: `در حال برگزاری: ${event.name}`,
    };
  }

  const daysToStart = jalaliDaysBetween(today, event.startDate);
  if (daysToStart > 0 && daysToStart <= 60) {
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
    { name: 'بهار', start: { year: today.year, month: 1, day: 1 }, end: { year: today.year, month: 3, day: 31 } },
    { name: 'تابستان', start: { year: today.year, month: 4, day: 1 }, end: { year: today.year, month: 6, day: 31 } },
    { name: 'پاییز', start: { year: today.year, month: 7, day: 1 }, end: { year: today.year, month: 9, day: 30 } },
    { name: 'زمستان', start: { year: today.year, month: 10, day: 1 }, end: { year: today.year, month: 12, day: 29 } },
  ];

  for (const season of seasons) {
    const isCurrent = isJalaliInRange(today, season.start, season.end);
    if (!isCurrent) {
      const hasKeyword = keywords.some((k) => {
        const normalizedK = normalizeString(k);
        const normalizedSeasonName = normalizeString(season.name);
        return matchWithBoundary(normalizedK, normalizedSeasonName);
      });
      if (hasKeyword) {
        return season.name;
      }
    }
  }

  return null;
}

/**
 * بررسی دوره‌ای و فصلی بودن کاندیدا بر اساس رویدادهای تعریف شده
 */
export function isCandidateSeasonal(
  keywords: string[],
  events: TemporalEvent[],
  today: JalaliDate
): {
  hasActiveOrUpcoming: boolean;
  hasExpiredOrFar: boolean;
  bestMatch: {
    label: TemporalLabel;
    multiplier: 4 | 3 | 1 | 0.15 | 0.001;
    reason: string;
    eventName: string;
    startMonth?: number;
  } | null;
  expiredEventNames: string[];
} {
  let bestMatch: {
    label: TemporalLabel;
    multiplier: 4 | 3 | 1 | 0.15 | 0.001;
    reason: string;
    eventName: string;
    startMonth?: number;
  } | null = null;
  let hasActiveOrUpcoming = false;
  let hasExpiredOrFar = false;
  const expiredEventNames: string[] = [];

  for (const event of events) {
    if (!matchEventToKeywords(event, keywords)) continue;
    const projected = projectEventToCurrentYear(event, today);
    const classification = classifyEventTiming(projected, today);

    if (classification) {
      hasActiveOrUpcoming = true;
      if (!bestMatch || classification.multiplier > bestMatch.multiplier) {
        bestMatch = {
          ...classification,
          eventName: event.name,
          startMonth: projected.startDate.month,
        };
      }
    } else {
      hasExpiredOrFar = true;
      if (!expiredEventNames.includes(event.name)) {
        expiredEventNames.push(event.name);
      }
    }
  }

  return {
    hasActiveOrUpcoming,
    hasExpiredOrFar,
    bestMatch,
    expiredEventNames,
  };
}

/**
 * تابع اصلی افزایش رتبه‌ی زمانی (Temporal Boost Middleware)
 */
export function applyTemporalBoost(
  candidates: any[],
  options: {
    events: TemporalEvent[];
    today?: JalaliDate;
    targetMetadata?: Map<number, { title: string; categoryValues: string[] }>;
  }
): BoostedCandidate[] {
  const today = options.today ?? getCurrentJalaliDate();
  const events = options.events || [];
  const targetMetadata = options.targetMetadata;

  const boostedCandidates = candidates.map((c) => {
    const keywords = extractKeywordsFromCandidate(c, targetMetadata);
    const score = typeof c.score === 'number' ? c.score : 0;
    const matchedTagsArray = c.matched_tags || c.matchedTags || [];

    const result = isCandidateSeasonal(keywords, events, today);

    if (result.hasActiveOrUpcoming && result.bestMatch) {
      return {
        ...c,
        page_id: c.page_id,
        title: c.title,
        score: score,
        matched_tags: matchedTagsArray,
        boostedScore: score * result.bestMatch.multiplier,
        temporalMultiplier: result.bestMatch.multiplier as any,
        temporalLabel: result.bestMatch.label,
        temporalReason: result.bestMatch.reason,
        matchedEventName: result.bestMatch.eventName,
        temporalTargetMonth: result.bestMatch.startMonth,
      };
    }

    if (!result.hasActiveOrUpcoming && result.hasExpiredOrFar) {
      return {
        ...c,
        page_id: c.page_id,
        title: c.title,
        score: score,
        matched_tags: matchedTagsArray,
        boostedScore: score * 0.001,
        temporalMultiplier: 0.001,
        temporalLabel: 'out-of-season',
        temporalReason: `منقضی‌شده/خیلی دور: ${result.expiredEventNames.join('، ')}`,
        matchedEventName: null,
      };
    }

    const outOfSeasonReason = detectOutOfSeason(keywords, today);
    if (outOfSeasonReason) {
      return {
        ...c,
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
      ...c,
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

  return applyDynamicAllowedWindow(boostedCandidates, today);
}

/**
 * اعمال پنجره زمانی مجاز و پویا بر اساس ماه جاری تقویم شمسی
 */
export function applyDynamicAllowedWindow(
  candidates: BoostedCandidate[],
  today: JalaliDate
): BoostedCandidate[] {
  const currentMonth = today.month;
  const nextMonth = (currentMonth % 12) + 1;

  // محاسبه ماه‌های فصل جاری
  let seasonMonths: number[] = [];
  if (currentMonth >= 1 && currentMonth <= 3) {
    seasonMonths = [1, 2, 3];
  } else if (currentMonth >= 4 && currentMonth <= 6) {
    seasonMonths = [4, 5, 6];
  } else if (currentMonth >= 7 && currentMonth <= 9) {
    seasonMonths = [7, 8, 9];
  } else {
    seasonMonths = [10, 11, 12];
  }

  // ماه‌های مجاز شامل ماه جاری، ماه بعدی و فصل جاری
  const allowedSet = new Set<number>([currentMonth, nextMonth, ...seasonMonths]);
  const allowedMonths = Array.from(allowedSet);

  // تشخیص فصل بعد ژنریک اگر ماه جاری آخرین ماه فصل باشد
  let nextSeasonName = '';
  if (currentMonth === 3) {
    nextSeasonName = 'تابستان';
  } else if (currentMonth === 6) {
    nextSeasonName = 'پاییز';
  } else if (currentMonth === 9) {
    nextSeasonName = 'زمستان';
  } else if (currentMonth === 12) {
    nextSeasonName = 'بهار';
  }

  return candidates.map((c) => {
    // استثنای حق‌تقدم: رویداد با وضعیت current هرگز تحت تاثیر پنجره خنثی نمی‌شود
    if (c.temporalLabel === 'current') {
      return c;
    }

    // اگر کاندیدا برانگیخته (بوست) شده ولی متعلق به ماه غیرمجاز است، امتیاز آن خنثی می‌شود
    if (
      c.temporalMultiplier > 1 &&
      c.temporalTargetMonth !== undefined &&
      !allowedMonths.includes(c.temporalTargetMonth)
    ) {
      // بررسی استثنای فصل بعد ژنریک
      if (nextSeasonName) {
        const candidateKeywords = extractKeywordsFromCandidate(c);
        const matchesNextSeasonGeneric = candidateKeywords.some((kw) => {
          const normalizedKw = normalizeString(kw);
          const normalizedNextSeasonName = normalizeString(nextSeasonName);
          return matchWithBoundary(normalizedKw, normalizedNextSeasonName);
        });
        if (matchesNextSeasonGeneric) {
          return c; // معاف از خنثی‌سازی
        }
      }

      return {
        ...c,
        boostedScore: c.score,
        temporalMultiplier: 1,
        temporalLabel: 'neutral',
        temporalReason: `خنثی‌شده (خارج از پنجره زمانی مجاز - ماه هدف: ${c.temporalTargetMonth})`,
      };
    }
    return c;
  });
}

/**
 * مرتب‌سازی کاندیداها بر اساس ضریب زمانی نزولی و سپس امتیاز بوست‌شده به‌صورت نزولی (اکید و قطعی - قانون ۵)
 */
export function sortByBoostedScore(boosted: BoostedCandidate[]): BoostedCandidate[] {
  return [...boosted].sort((a, b) => {
    const multA = a.temporalMultiplier ?? 1;
    const multB = b.temporalMultiplier ?? 1;
    if (multB !== multA) {
      return multB - multA;
    }
    return b.boostedScore - a.boostedScore;
  });
}

export const PIN_QUOTA = 4;

/**
 * ارکستراتور تک‌مرجع (قانون ۱ و ۵) جهت تطابق ۱۰۰٪ ترتیب در UI و AI
 */
export function buildLiveOrderedList(
  candidates: any[],
  options: {
    events: TemporalEvent[];
    today?: JalaliDate;
    targetMetadata?: Map<number, { title: string; categoryValues: string[] }>;
  }
): BoostedCandidate[] {
  const boosted = applyTemporalBoost(candidates, options);
  return sortByBoostedScore(boosted);
}

