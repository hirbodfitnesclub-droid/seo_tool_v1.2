import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON } from '../constants/categories';

// ══════════════════════════════════════════════════════════════════════════════
// تایپ‌های اصلی
// ══════════════════════════════════════════════════════════════════════════════

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
  matchedTags: string[];
  origin_bonus: number;
  destination_bonus: number;
  categories?: Record<string, unknown>;
}

interface ScoreResult {
  score: number;
  matchedTags: string[];
  originBonus: number;
  destinationBonus: number;
  isFiltered: boolean;
  isCityMother: boolean;    // صفحه مادر شهر (رتبه ۱)
  isCountryMother: boolean; // صفحه مادر کشور (رتبه ۲)
}

interface PageInfo {
  id?: number;
  title: string;
  categories: Record<string, unknown>;
}

interface ParsedPage {
  title: string;
  city: string | null;
  country: string | null;
  origin: string | null;
  month: string | null;
  monthIdx: number;
  season: string | null;
  seasonIdx: number;
  transport: string | null;
  hotelStar: number | null;
  tourType: string | null;
  travelType: string | null;
  tourClass: string | null;
  regionDirection: string | null;
  hasOrigin: boolean;
  hasMonth: boolean;
  hasSeason: boolean;
  hasHotel: boolean;
  generalKeywords: string[];
  isGeneral: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// ثوابت
// ══════════════════════════════════════════════════════════════════════════════

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
const GENERAL_KEYWORDS = ['ارزان', 'لوکس', 'قطار', 'اتوبوس', 'هوایی', 'زمینی', 'لحظه آخری'];
const TRANSPORT_KEYWORDS = ['هوایی', 'قطار', 'اتوبوس', 'کشتی', 'زمینی'];

/**
 * محاسبه ماه شمسی فعلی بر اساس تاریخ میلادی
 * این تابع تقریبی است و برای اکثر موارد کافی است
 */
function getCurrentPersianMonthIndex(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  // تبدیل تقریبی میلادی به شمسی
  // فروردین: ~21 مارس تا ~20 آوریل
  // اردیبهشت: ~21 آوریل تا ~21 می
  // ...
  const persianMonthMap: Array<{ start: [number, number]; monthIdx: number }> = [
    { start: [2, 21], monthIdx: 0 },   // فروردین از 21 مارس
    { start: [3, 21], monthIdx: 1 },   // اردیبهشت از 21 آوریل
    { start: [4, 22], monthIdx: 2 },   // خرداد از 22 می
    { start: [5, 22], monthIdx: 3 },   // تیر از 22 ژوئن
    { start: [6, 23], monthIdx: 4 },   // مرداد از 23 جولای
    { start: [7, 23], monthIdx: 5 },   // شهریور از 23 آگوست
    { start: [8, 23], monthIdx: 6 },   // مهر از 23 سپتامبر
    { start: [9, 23], monthIdx: 7 },   // آبان از 23 اکتبر
    { start: [10, 22], monthIdx: 8 },  // آذر از 22 نوامبر
    { start: [11, 22], monthIdx: 9 },  // دی از 22 دسامبر
    { start: [0, 21], monthIdx: 10 },  // بهمن از 21 ژانویه
    { start: [1, 20], monthIdx: 11 },  // اسفند از 20 فوریه
  ];

  // پیدا کردن ماه شمسی فعلی
  for (let i = persianMonthMap.length - 1; i >= 0; i--) {
    const { start, monthIdx } = persianMonthMap[i];
    if (month > start[0] || (month === start[0] && day >= start[1])) {
      return monthIdx;
    }
  }

  // اگر قبل از 21 مارس بودیم، اسفند است
  return 11;
}

// ماه فعلی (محاسبه شده از سیستم)
const CURRENT_MONTH_INDEX = getCurrentPersianMonthIndex();

// ══════════════════════════════════════════════════════════════════════════════
// ضرایب امتیازدهی (مطابق با درخواست کاربر)
// ══════════════════════════════════════════════════════════════════════════════

const COEFFICIENTS = {
  // جهت منطقه
  REGION_MATCH: 1.5,
  REGION_MISMATCH: 0.8,

  // دسته‌های کلی (تطابق کلمات: ارزان، لوکس، قطار، اتوبوس، هوایی، لحظه آخری)
  GENERAL_MATCH: 1.5,

  // مقصد (شهر یا کشور)
  DESTINATION_MATCH: 2.0,      // شهر یا کشور یکسان
  DESTINATION_MISMATCH: 0.7,   // مقصد متفاوت

  // حمل‌ونقل
  TRANSPORT_MATCH: 2.0,
  TRANSPORT_MISMATCH: 0.75,
  TRANSPORT_NONE: 1.0,         // نداشت

  // ماه (وقتی source ماه دارد)
  MONTH_SAME: 3.0,
  MONTH_SAME_SEASON: 2.0,
  MONTH_NEXT_SEASON_LAST_MONTH: 1.8,  // فقط اگر آخرین ماه فصل بود
  MONTH_NEXT_SEASON_NOT_LAST: 0.8,    // اگر آخرین ماه فصل نبود
  MONTH_NONE: 0.2,                     // نداشت

  // فصل (وقتی source فصل دارد، نه ماه)
  SEASON_SAME: 3.0,
  SEASON_MONTHS_IN_SEASON: 2.5,       // ماه‌های همان فصل
  SEASON_NEXT: 2.0,                   // فصل بعد
  SEASON_NONE: 0.2,                   // نداشت

  // نوع سفر
  TRAVEL_TYPE_MATCH: 1.5,
  TRAVEL_TYPE_MISMATCH: 0.8,

  // برچسب کلاس تور
  TOUR_CLASS_MATCH: 2.0,
  TOUR_CLASS_MISMATCH: 0.75,
  TOUR_CLASS_NONE: 1.0,        // نداشت

  // ستاره هتل
  HOTEL_STAR_SAME: 1.8,        // هم‌رده
  HOTEL_STAR_DIFF_1: 1.1,      // یک رده بالا/پایین
  HOTEL_STAR_DIFF_2: 0.75,     // ۲ رده بالا/پایین
  HOTEL_STAR_NONE: 1.0,        // نداشت

  // مبدا
  ORIGIN_MATCH: 3.0,
  ORIGIN_MISMATCH: 0.5,
  ORIGIN_NONE: 1.0,            // نداشت

  // جریمه متقاطع (Cross-Penalty)
  // صفحه مبدادار → تارگت زمان‌دار یا هتل‌دار
  CROSS_PENALTY_ORIGIN_TO_TIME: 0.4,
  CROSS_PENALTY_ORIGIN_TO_HOTEL: 0.4,
  // صفحه زمان‌دار → تارگت مبدادار یا هتل‌دار
  CROSS_PENALTY_TIME_TO_ORIGIN: 0.7,
  CROSS_PENALTY_TIME_TO_HOTEL: 0.4,
  // صفحه هتل‌دار → تارگت زمان‌دار یا مبدادار
  CROSS_PENALTY_HOTEL_TO_TIME: 0.4,
  CROSS_PENALTY_HOTEL_TO_ORIGIN: 0.4,

  // بونوس‌ها (برای UI - جدا از امتیاز اصلی)
  ORIGIN_BONUS: 10,
  DESTINATION_BONUS: 5,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// توابع کمکی استخراج اطلاعات
// ══════════════════════════════════════════════════════════════════════════════

function normalizeMonth(month: string): string {
  if (!month) return month;
  if (month === 'نوروز' || month === 'نوروزی') return 'فروردین';
  return month;
}

function extractMonth(title: string): string | null {
  if (!title) return null;
  if (title.includes('نوروز') || title.includes('نوروزی')) return 'فروردین';
  for (const m of PERSIAN_MONTHS_ORDER) {
    if (title.includes(m)) return m;
  }
  return null;
}

function extractSeason(title: string): string | null {
  if (!title) return null;
  for (const s of SEASONS_ORDER) {
    if (title.includes(s)) return s;
  }
  return null;
}

function extractTransport(title: string): string | null {
  if (!title) return null;
  for (const t of TRANSPORT_KEYWORDS) {
    if (title.includes(t)) return t;
  }
  return null;
}

function extractGeneralKeywords(title: string): string[] {
  if (!title) return [];
  return GENERAL_KEYWORDS.filter(k => title.includes(k));
}

function extractHotelStar(title: string, catStar?: unknown): number | null {
  // اول از عنوان
  if (title) {
    const match = title.match(/(\d+)\s*ستاره/);
    if (match) return parseInt(match[1]);
  }
  // بعد از دسته‌بندی
  if (catStar) {
    const numMatch = String(catStar).match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1]);
  }
  return null;
}

function hasOriginInTitle(title: string): boolean {
  if (!title) return false;
  return title.includes(' از ');
}

function hasHotelInTitle(title: string, catHotel?: unknown): boolean {
  if (!title) return false;
  // بررسی ستاره در عنوان
  if (/\d+\s*ستاره/.test(title)) return true;
  // بررسی نام هتل در دسته‌بندی
  if (catHotel && String(catHotel).trim()) return true;
  return false;
}

function getMonthSeasonIdx(monthIdx: number): number {
  return Math.floor(monthIdx / 3);
}

function isLastMonthOfSeason(monthIdx: number): boolean {
  return monthIdx % 3 === 2;
}

function getSeasonMonths(seasonIdx: number): number[] {
  const start = seasonIdx * 3;
  return [start, start + 1, start + 2];
}

// ══════════════════════════════════════════════════════════════════════════════
// پارس کردن صفحه
// ══════════════════════════════════════════════════════════════════════════════

function parsePage(page: PageInfo, cat: Record<string, unknown>): ParsedPage {
  const title = page.title || '';
  const month = extractMonth(title);
  const monthIdx = month ? PERSIAN_MONTHS_ORDER.indexOf(month) : -1;
  const season = extractSeason(title);
  const seasonIdx = season ? SEASONS_ORDER.indexOf(season) : -1;
  const generalKeywords = extractGeneralKeywords(title);

  return {
    title,
    city: (cat['شهر_یا_جزیره_مقصد'] as string)?.trim() || null,
    country: (cat['کشور_مقصد'] as string)?.trim() || null,
    origin: (cat['شهر_یا_استان_مبدا'] as string)?.trim() || null,
    month,
    monthIdx,
    season,
    seasonIdx,
    transport: extractTransport(title),
    hotelStar: extractHotelStar(title, cat['تعداد_ستاره_هتل']),
    tourType: (cat['نوع_تور'] as string) || null,
    travelType: (cat['نوع_سفر'] as string) || null,
    tourClass: (cat['برچسب_کلاسی_تور'] as string) || null,
    regionDirection: (cat['جهت_در_منطقه'] as string) || null,
    hasOrigin: hasOriginInTitle(title),
    hasMonth: monthIdx !== -1,
    hasSeason: seasonIdx !== -1 && monthIdx === -1, // فقط اگر ماه نداشت
    hasHotel: hasHotelInTitle(title, cat['نام_دقیق_هتل']),
    generalKeywords,
    isGeneral: generalKeywords.length > 0,
  };
}

function parseCategories(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════════
// توابع محاسبه ضرایب جداگانه
// ══════════════════════════════════════════════════════════════════════════════

/** جهت منطقه - مشابه: 1.5 | غیرمشابه: 0.8 */
function calcRegionScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  // اگر source یا target جهت منطقه ندارد، ضریب خنثی
  if (!src.regionDirection || !tgt.regionDirection) {
    return { coef: 1.0, tag: null };
  }
  if (src.regionDirection === tgt.regionDirection) {
    return { coef: COEFFICIENTS.REGION_MATCH, tag: 'جهت_در_منطقه' };
  }
  return { coef: COEFFICIENTS.REGION_MISMATCH, tag: null };
}

/** دسته‌های کلی - تطابق کلمات: 1.5 */
function calcGeneralScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  // فقط وقتی تطابق کلمات کلی بین source و target باشد
  if (src.generalKeywords.length === 0) {
    return { coef: 1.0, tag: null };
  }
  // بررسی تطابق کلمات کلی
  const hasMatch = src.generalKeywords.some(k => tgt.generalKeywords.includes(k));
  if (hasMatch) {
    return { coef: COEFFICIENTS.GENERAL_MATCH, tag: 'دسته_های_کلی' };
  }
  return { coef: 1.0, tag: null };
}

/** مقصد - مشابه: 2 | غیرمشابه: 0.7 */
function calcDestinationScore(
  src: ParsedPage,
  tgt: ParsedPage
): { coef: number; tag: string | null; bonus: number } {
  const srcHasDest = !!(src.city || src.country);
  const tgtHasDest = !!(tgt.city || tgt.country);

  // اگر source یا target مقصد ندارد، ضریب خنثی
  if (!srcHasDest || !tgtHasDest) {
    return { coef: 1.0, tag: null, bonus: 0 };
  }

  // مقصد مشابه = شهر یکسان یا کشور یکسان
  if (src.city && tgt.city && src.city === tgt.city) {
    return {
      coef: COEFFICIENTS.DESTINATION_MATCH,
      tag: 'شهر_یا_جزیره_مقصد',
      bonus: COEFFICIENTS.DESTINATION_BONUS,
    };
  }

  if (src.country && tgt.country && src.country === tgt.country) {
    return {
      coef: COEFFICIENTS.DESTINATION_MATCH,
      tag: 'کشور_مقصد',
      bonus: COEFFICIENTS.DESTINATION_BONUS,
    };
  }

  // غیرمشابه
  return { coef: COEFFICIENTS.DESTINATION_MISMATCH, tag: null, bonus: 0 };
}

/** حمل‌ونقل */
function calcTransportScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_NONE, tag: null };
  }
  if (!tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_NONE, tag: null }; // نداشت = خنثی
  }
  if (src.transport === tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_MATCH, tag: 'نوع_وسیله_نقلیه' };
  }
  return { coef: COEFFICIENTS.TRANSPORT_MISMATCH, tag: null };
}

/**
 * زمان (ماه/فصل)
 * این تابع پیچیده‌ترین بخش الگوریتم است.
 */
function calcTimeScore(
  src: ParsedPage,
  tgt: ParsedPage,
  currentMonthIdx: number
): { coef: number; tag: string | null; shouldFilter: boolean } {
  // ─────────────────────────────────────────────────────────────
  // حالت ۱: سورس ماه دارد
  // ─────────────────────────────────────────────────────────────
  if (src.hasMonth) {
    const srcMonthIdx = src.monthIdx;
    const srcSeasonIdx = getMonthSeasonIdx(srcMonthIdx);

    // اگر تارگت ماه دارد
    if (tgt.hasMonth) {
      const tgtMonthIdx = tgt.monthIdx;
      const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);

      // فیلتر: ماه‌های گذشته نباید بیایند
      if (tgtMonthIdx < currentMonthIdx) {
        return { coef: 0, tag: null, shouldFilter: true };
      }

      // همان ماه
      if (srcMonthIdx === tgtMonthIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME, tag: 'ماه_تقویمی_برگزاری', shouldFilter: false };
      }

      // همان فصل (فقط ماه‌های باقیمانده فصل)
      if (srcSeasonIdx === tgtSeasonIdx && tgtMonthIdx > srcMonthIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'فصل_برگزاری', shouldFilter: false };
      }

      // فصل بعدی (فقط اگر آخرین ماه فصل بود)
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        if (isLastMonthOfSeason(srcMonthIdx)) {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null, shouldFilter: false };
        } else {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_NOT_LAST, tag: null, shouldFilter: false };
        }
      }

      // سایر ماه‌ها باید فیلتر شوند
      return { coef: 0, tag: null, shouldFilter: true };
    }

    // اگر تارگت فصل دارد (نه ماه)
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      // همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'فصل_برگزاری', shouldFilter: false };
      }

      // فصل بعدی (فقط اگر آخرین ماه فصل بود)
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        if (isLastMonthOfSeason(srcMonthIdx)) {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null, shouldFilter: false };
        } else {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_NOT_LAST, tag: null, shouldFilter: false };
        }
      }

      // فصل‌های دیگر باید فیلتر شوند
      return { coef: 0, tag: null, shouldFilter: true };
    }

    // تارگت زمان ندارد
    return { coef: COEFFICIENTS.MONTH_NONE, tag: null, shouldFilter: false };
  }

  // ─────────────────────────────────────────────────────────────
  // حالت ۲: سورس فصل دارد (نه ماه)
  // ─────────────────────────────────────────────────────────────
  if (src.hasSeason) {
    const srcSeasonIdx = src.seasonIdx;

    // اگر تارگت ماه دارد
    if (tgt.hasMonth) {
      const tgtMonthIdx = tgt.monthIdx;
      const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);

      // فیلتر: ماه‌های گذشته نباید بیایند
      if (tgtMonthIdx < currentMonthIdx) {
        return { coef: 0, tag: null, shouldFilter: true };
      }

      // ماه‌های همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_MONTHS_IN_SEASON, tag: 'فصل_برگزاری', shouldFilter: false };
      }

      // فصل بعدی
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_NEXT, tag: null, shouldFilter: false };
      }

      // سایر ماه‌ها فیلتر
      return { coef: 0, tag: null, shouldFilter: true };
    }

    // اگر تارگت فصل دارد
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      // همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_SAME, tag: 'فصل_برگزاری', shouldFilter: false };
      }

      // فصل بعدی
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_NEXT, tag: null, shouldFilter: false };
      }

      // فصل‌های دیگر فیلتر
      return { coef: 0, tag: null, shouldFilter: true };
    }

    // تارگت زمان ندارد
    return { coef: COEFFICIENTS.SEASON_NONE, tag: null, shouldFilter: false };
  }

  // ─────────────────────────────────────────────────────────────
  // حالت ۳: سورس زمان ندارد
  // ─────────────────────────────────────────────────────────────
  // اگر تارگت زمان دارد، ضریب 0.8 (نه فیلتر)
  if (tgt.hasMonth || tgt.hasSeason) {
    return { coef: 0.8, tag: null, shouldFilter: false };
  }

  return { coef: 1.0, tag: null, shouldFilter: false };
}

/** نوع سفر - مشابه: 1.5 | غیرمشابه: 0.8 */
function calcTravelTypeScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  const srcType = src.travelType || src.tourType;
  const tgtType = tgt.travelType || tgt.tourType;

  // اگر source یا target نوع سفر ندارد، ضریب خنثی
  if (!srcType || !tgtType) {
    return { coef: 1.0, tag: null };
  }
  if (srcType === tgtType) {
    return { coef: COEFFICIENTS.TRAVEL_TYPE_MATCH, tag: src.travelType ? 'نوع_سفر' : 'نوع_تور' };
  }
  return { coef: COEFFICIENTS.TRAVEL_TYPE_MISMATCH, tag: null };
}

/** برچسب کلاس تور */
function calcTourClassScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.tourClass) {
    return { coef: COEFFICIENTS.TOUR_CLASS_NONE, tag: null };
  }
  if (!tgt.tourClass) {
    return { coef: COEFFICIENTS.TOUR_CLASS_NONE, tag: null }; // نداشت = خنثی
  }
  if (src.tourClass === tgt.tourClass) {
    return { coef: COEFFICIENTS.TOUR_CLASS_MATCH, tag: 'برچسب_کلاسی_تور' };
  }
  return { coef: COEFFICIENTS.TOUR_CLASS_MISMATCH, tag: null };
}

/** ستاره هتل */
function calcHotelStarScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.hotelStar) {
    return { coef: COEFFICIENTS.HOTEL_STAR_NONE, tag: null };
  }
  if (!tgt.hotelStar) {
    return { coef: COEFFICIENTS.HOTEL_STAR_NONE, tag: null }; // نداشت = خنثی
  }

  const diff = Math.abs(src.hotelStar - tgt.hotelStar);
  if (diff === 0) {
    return { coef: COEFFICIENTS.HOTEL_STAR_SAME, tag: 'تعداد_ستاره_هتل' };
  }
  if (diff === 1) {
    return { coef: COEFFICIENTS.HOTEL_STAR_DIFF_1, tag: null };
  }
  return { coef: COEFFICIENTS.HOTEL_STAR_DIFF_2, tag: null };
}

/** مبدا */
function calcOriginScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null; bonus: number } {
  if (!src.hasOrigin) {
    return { coef: COEFFICIENTS.ORIGIN_NONE, tag: null, bonus: 0 };
  }
  if (!tgt.hasOrigin) {
    return { coef: COEFFICIENTS.ORIGIN_NONE, tag: null, bonus: 0 }; // نداشت = خنثی
  }
  if (src.origin && tgt.origin && src.origin === tgt.origin) {
    return { coef: COEFFICIENTS.ORIGIN_MATCH, tag: 'شهر_یا_استان_مبدا', bonus: COEFFICIENTS.ORIGIN_BONUS };
  }
  return { coef: COEFFICIENTS.ORIGIN_MISMATCH, tag: null, bonus: 0 };
}

/**
 * جریمه متقاطع (Cross-Penalty)
 * صفحات مبدادار/زمان‌دار/هتل‌دار نباید لینک‌های نامرتبط داشته باشند
 */
function calcCrossPenalty(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  let penalty = 1.0;

  // صفحه مبدادار
  if (src.hasOrigin) {
    if (tgt.hasMonth || tgt.hasSeason) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_ORIGIN_TO_TIME;
    }
    if (tgt.hasHotel) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_ORIGIN_TO_HOTEL;
    }
  }

  // صفحه زمان‌دار
  if (src.hasMonth || src.hasSeason) {
    if (tgt.hasOrigin) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_TIME_TO_ORIGIN;
    }
    if (tgt.hasHotel) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_TIME_TO_HOTEL;
    }
  }

  // صفحه هتل‌دار
  if (src.hasHotel) {
    if (tgt.hasMonth || tgt.hasSeason) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_HOTEL_TO_TIME;
    }
    if (tgt.hasOrigin) {
      penalty *= COEFFICIENTS.CROSS_PENALTY_HOTEL_TO_ORIGIN;
    }
  }

  if (penalty < 1.0) {
    return { coef: penalty, tag: null };
  }
  return { coef: 1.0, tag: null };
}

/**
 * صفحات مادر (Mother Page)
 * صفحه اصلی شهر و کشور باید همیشه رتبه ۱ و ۲ باشند
 * به جای ضریب بالا، یک پرچم برمی‌گردانیم که در مرتب‌سازی استفاده شود
 */
function checkMotherPage(src: ParsedPage, tgt: ParsedPage): { isCityMother: boolean; isCountryMother: boolean } {
  const tgtTitleClean = tgt.title.trim();

  // صفحه مادر شهر: "تور استانبول" برای source با شهر استانبول
  const isCityMother = !!(src.city && tgtTitleClean === `تور ${src.city}`);
  
  // صفحه مادر کشور: "تور ترکیه" برای source با کشور ترکیه
  const isCountryMother = !!(src.country && tgtTitleClean === `تور ${src.country}`);

  return { isCityMother, isCountryMother };
}

// ══════════════════════════════════════════════════════════════════════════════
// الگوریتم امتیازدهی اصلی
// ═════════════════════════════════════════════════���════════════════════════════

function calculateScore(
  sourcePage: PageInfo,
  sourceCat: Record<string, unknown>,
  targetPage: PageInfo,
  targetCat: Record<string, unknown>,
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): ScoreResult {
  // پارس کردن صفحات
  const src = parsePage(sourcePage, sourceCat);
  const tgt = parsePage(targetPage, targetCat);

  // جمع‌آوری تگ‌ها و محاسبه امتیاز
  let score = 1.0;
  const matchedTags: string[] = [];
  let originBonus = 0;
  let destinationBonus = 0;
  let shouldFilter = false;

  // ۱. جهت منطقه
  const region = calcRegionScore(src, tgt);
  score *= region.coef;
  if (region.tag) matchedTags.push(region.tag);

  // ۲. دسته‌های کلی (تطابق کلمات کلی بین source و target)
  const general = calcGeneralScore(src, tgt);
  score *= general.coef;
  if (general.tag) matchedTags.push(general.tag);

  // ۳. مقصد
  const dest = calcDestinationScore(src, tgt);
  score *= dest.coef;
  if (dest.tag) matchedTags.push(dest.tag);
  destinationBonus = dest.bonus;

  // ۴. حمل‌ونقل
  const transport = calcTransportScore(src, tgt);
  score *= transport.coef;
  if (transport.tag) matchedTags.push(transport.tag);

  // ۵. زمان (ماه/فصل)
  const time = calcTimeScore(src, tgt, currentMonthIdx);
  score *= time.coef;
  if (time.tag) matchedTags.push(time.tag);
  if (time.shouldFilter) shouldFilter = true;

  // ۶. نوع سفر
  const travelType = calcTravelTypeScore(src, tgt);
  score *= travelType.coef;
  if (travelType.tag) matchedTags.push(travelType.tag);

  // ۷. برچسب کلاس تور
  const tourClass = calcTourClassScore(src, tgt);
  score *= tourClass.coef;
  if (tourClass.tag) matchedTags.push(tourClass.tag);

  // ۸. ستاره هتل
  const hotelStar = calcHotelStarScore(src, tgt);
  score *= hotelStar.coef;
  if (hotelStar.tag) matchedTags.push(hotelStar.tag);

  // ۹. مبدا
  const origin = calcOriginScore(src, tgt);
  score *= origin.coef;
  if (origin.tag) matchedTags.push(origin.tag);
  originBonus = origin.bonus;

  // ۱۰. جریمه متقاطع (Cross-Penalty)
  const crossPenalty = calcCrossPenalty(src, tgt);
  score *= crossPenalty.coef;

  // ۱۱. بررسی صفحات مادر (برای مرتب‌سازی ویژه)
  const motherPage = checkMotherPage(src, tgt);

  return {
    score,
    matchedTags,
    originBonus,
    destinationBonus,
    isFiltered: shouldFilter,
    isCityMother: motherPage.isCityMother,
    isCountryMother: motherPage.isCountryMother,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// نرمال‌سازی امتیاز
// ══════════════════════════════════════════════════════════════════════════════

/**
 * نرمال‌سازی خطی به جای لگاریتمی
 * این روش تفاوت‌ها را حفظ می‌کند
 */
function normalizeScore(raw: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  // نرمال‌سازی به بازه ۰-۱۰
  const normalized = (raw / maxScore) * 10;
  return parseFloat(Math.min(10, normalized).toFixed(2));
}

// ══════════════════════════════════════════════════════════════════════════════
// توابع عمومی صادر شده
// ══════════════════════════════════════════════════════════════════════════════

export { normalizeMonth };

export function findTopCandidates(
  sourcePage: PageInfo,
  allPages: PageInfo[],
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): CandidateWithTags[] {
  const sourceCat = parseCategories(sourcePage.categories);

  const rawCandidates: Array<{
    page: PageInfo;
    result: ScoreResult;
  }> = [];

  // محاسبه امتیاز برای همه صفحات
  for (const page of allPages) {
    if ((page as any).id === (sourcePage as any).id) continue;

    const pageCat = parseCategories(page.categories);
    const result = calculateScore(sourcePage, sourceCat, page, pageCat, currentMonthIdx);

    // فیلتر کردن صفحات نامعتبر
    if (result.isFiltered) continue;
    if (result.score <= 0) continue;

    rawCandidates.push({ page, result });
  }

  // جدا کردن صفحات مادر از بقیه
  const cityMother: typeof rawCandidates = [];
  const countryMother: typeof rawCandidates = [];
  const regularCandidates: typeof rawCandidates = [];

  for (const candidate of rawCandidates) {
    if (candidate.result.isCityMother) {
      cityMother.push(candidate);
    } else if (candidate.result.isCountryMother) {
      countryMother.push(candidate);
    } else {
      regularCandidates.push(candidate);
    }
  }

  // پیدا کردن حداکثر امتیاز از صفحات معمولی (بدون صفحات مادر)
  const maxScore = regularCandidates.reduce((max, c) => Math.max(max, c.result.score), 1);

  // تابع تبدیل به CandidateWithTags
  const toCandidate = ({ page, result }: typeof rawCandidates[0], normalizedScore: number): CandidateWithTags => ({
    page_id: (page as any).id!,
    title: page.title,
    score: normalizedScore,
    matched_tags: result.matchedTags,
    matchedTags: result.matchedTags,
    origin_bonus: result.originBonus,
    destination_bonus: result.destinationBonus,
    categories: parseCategories(page.categories),
  });

  // ساخت لیست نهایی
  const candidates: CandidateWithTags[] = [];

  // ۱. صفحه مادر شهر - رتبه ۱ (امتیاز ۱۰)
  for (const c of cityMother) {
    candidates.push(toCandidate(c, 10));
  }

  // ۲. صفحه مادر کشور - رتبه ۲ (امتیاز ۹.۹)
  for (const c of countryMother) {
    candidates.push(toCandidate(c, 9.9));
  }

  // ۳. بقیه صفحات با نرمال‌سازی (حداکثر ۹.۸)
  for (const c of regularCandidates) {
    const normalized = (c.result.score / maxScore) * 9.8;
    candidates.push(toCandidate(c, parseFloat(normalized.toFixed(2))));
  }

  // مرتب‌سازی نزولی
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

export function computeAllCandidates(
  pages: PageInfo[],
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();

  for (const page of pages) {
    const candidates = findTopCandidates(page, pages, currentMonthIdx);
    map.set((page as any).id!, candidates);
  }

  return map;
}
