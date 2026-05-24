import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON } from '../constants/categories';

// ══════════════════════════════════════════════════════════════════════════════
// تایپ‌های اصلی
// ══════════════════════════════════════════════════════════════════════════════

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;           // امتیاز نرمالایز شده برای نمایش UI
  rawScore: number;        // امتیاز خام برای مرتب‌سازی
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
  isCityMother: boolean;
  isCountryMother: boolean;
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
  hasTime: boolean;
  generalKeywords: string[];
  isGeneral: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// ثوابت
// ══════════════════════════════════════════════════════════════════════════════

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
const GENERAL_KEYWORDS = ['ارزان', 'لوکس', 'قطار', 'اتوبوس', 'هوایی', 'زمینی', 'لحظه آخری'];
const TRANSPORT_KEYWORDS = ['هوایی', 'قطار', 'اتوبوس', 'کشتی', 'زمینی'];

// تعداد ماه‌ها در سال شمسی
const MONTHS_IN_YEAR = 12;

// پنجره زمانی معتبر (چند ماه آینده قابل قبول است)
const VALID_FUTURE_WINDOW = 4;

/**
 * محاسبه ماه شمسی فعلی بر اساس تاریخ میلادی
 */
function getCurrentPersianMonthIndex(): number {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  const persianMonthMap: Array<{ start: [number, number]; monthIdx: number }> = [
    { start: [2, 21], monthIdx: 0 },   // فروردین
    { start: [3, 21], monthIdx: 1 },   // اردیبهشت
    { start: [4, 22], monthIdx: 2 },   // خرداد
    { start: [5, 22], monthIdx: 3 },   // تیر
    { start: [6, 23], monthIdx: 4 },   // مرداد
    { start: [7, 23], monthIdx: 5 },   // شهریور
    { start: [8, 23], monthIdx: 6 },   // مهر
    { start: [9, 23], monthIdx: 7 },   // آبان
    { start: [10, 22], monthIdx: 8 },  // آذر
    { start: [11, 22], monthIdx: 9 },  // دی
    { start: [0, 21], monthIdx: 10 },  // بهمن
    { start: [1, 20], monthIdx: 11 },  // اسفند
  ];

  for (let i = persianMonthMap.length - 1; i >= 0; i--) {
    const { start, monthIdx } = persianMonthMap[i];
    if (month > start[0] || (month === start[0] && day >= start[1])) {
      return monthIdx;
    }
  }

  return 11;
}

const CURRENT_MONTH_INDEX = getCurrentPersianMonthIndex();

// ══════════════════════════════════════════════════════════════════════════════
// ضرایب امتیازدهی
// ══════════════════════════════════════════════════════════════════════════════

const COEFFICIENTS = {
  // جریمه کشنده (Lethal Penalty) - به جای حذف Hard Filter
  LETHAL_PENALTY: 0.1,

  // جهت منطقه
  REGION_MATCH: 1.5,
  REGION_MISMATCH: 0.8,

  // دسته‌های کلی
  GENERAL_MATCH: 1.5,

  // مقصد - ضرایب اصلاح‌شده
  DESTINATION_CITY_MATCH: 2.0,
  DESTINATION_COUNTRY_MATCH: 0.5,
  DESTINATION_DIFFERENT_COUNTRY: 0.4,

  // حمل‌ونقل
  TRANSPORT_MATCH: 2.0,
  TRANSPORT_MISMATCH: 0.75,
  TRANSPORT_NEUTRAL: 1.0,

  // ماه (وقتی source ماه دارد)
  MONTH_SAME: 3.0,
  MONTH_SAME_SEASON: 2.0,
  MONTH_NEXT_SEASON_LAST_MONTH: 1.8,
  MONTH_NEXT_SEASON_NOT_LAST: 0.8,

  // فصل (وقتی source فصل دارد، نه ماه)
  SEASON_SAME: 3.0,
  SEASON_MONTHS_IN_SEASON: 2.5,
  SEASON_NEXT: 2.0,

  // نوع سفر
  TRAVEL_TYPE_MATCH: 1.5,
  TRAVEL_TYPE_MISMATCH: 0.8,
  TRAVEL_TYPE_NEUTRAL: 1.0,

  // برچسب کلاس تور
  TOUR_CLASS_MATCH: 2.0,
  TOUR_CLASS_MISMATCH: 0.75,
  TOUR_CLASS_NEUTRAL: 1.0,

  // ستاره هتل
  HOTEL_STAR_SAME: 1.8,
  HOTEL_STAR_DIFF_1: 1.1,
  HOTEL_STAR_DIFF_2: 0.75,
  HOTEL_STAR_NEUTRAL: 1.0,

  // مبدا
  ORIGIN_MATCH: 3.0,
  ORIGIN_MISMATCH: 0.5,
  ORIGIN_NEUTRAL: 1.0,

  // نجات تورهای همیشگی (Evergreen Rescue)
  EVERGREEN_RESCUE: 0.9,

  // نامتقارنی زمان: سورس بدون زمان، تارگت با زمان
  TIME_ASYMMETRY_PENALTY: 0.8,

  // ماتریس جریمه متقاطع (Cross-Penalty Matrix)
  CROSS_PENALTY: {
    TIME_ONLY: {
      TO_ORIGIN: 0.7,
      TO_HOTEL: 0.4,
    },
    ORIGIN_ONLY: {
      TO_TIME: 0.4,
      TO_HOTEL: 0.4,
    },
    HOTEL_ONLY: {
      TO_TIME: 0.4,
      TO_ORIGIN: 0.4,
    },
  },

  // ضرایب صفحات مادر (God Multipliers)
  MOTHER_CITY: 10000,
  MOTHER_COUNTRY: 5000,

  // بونوس‌ها
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
  if (title) {
    const match = title.match(/(\d+)\s*ستاره/);
    if (match) return parseInt(match[1]);
  }
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
  if (/\d+\s*ستاره/.test(title)) return true;
  if (catHotel && String(catHotel).trim()) return true;
  return false;
}

function getMonthSeasonIdx(monthIdx: number): number {
  return Math.floor(monthIdx / 3);
}

function isLastMonthOfSeason(monthIdx: number): boolean {
  return monthIdx % 3 === 2;
}

/**
 * محاسبه فاصله چرخشی بین دو ماه (Circular Distance)
 * این تابع فاصله را در جهت آینده محاسبه می‌کند
 * مثال: از دی (9) به فروردین (0) = 3 ماه (نه -9)
 */
function getCircularMonthDistance(fromMonth: number, toMonth: number): number {
  return (toMonth - fromMonth + MONTHS_IN_YEAR) % MONTHS_IN_YEAR;
}

/**
 * آیا ماه تارگت در پنجره زمانی معتبر است؟
 * با استفاده از ریاضیات چرخشی (Modulo)
 */
function isMonthInValidWindow(targetMonthIdx: number, currentMonthIdx: number): boolean {
  const distance = getCircularMonthDistance(currentMonthIdx, targetMonthIdx);
  // ماه فعلی (distance = 0) یا ماه‌های آینده تا حداکثر VALID_FUTURE_WINDOW ماه
  return distance >= 0 && distance <= VALID_FUTURE_WINDOW;
}

/**
 * آیا ماه تارگت در گذشته است؟
 * با استفاده از ریاضیات چرخشی
 * ماه‌هایی که فاصله‌شان بیشتر از پنجره آینده است، "گذشته" محسوب می‌شوند
 */
function isMonthInPast(targetMonthIdx: number, currentMonthIdx: number): boolean {
  const distance = getCircularMonthDistance(currentMonthIdx, targetMonthIdx);
  // اگر فاصله بیشتر از پنجره معتبر باشد، یعنی گذشته است
  return distance > VALID_FUTURE_WINDOW;
}

/**
 * آیا ماه تارگت در فصل بعدی نسبت به سورس است؟
 */
function isInNextSeason(srcMonthIdx: number, tgtMonthIdx: number): boolean {
  const srcSeasonIdx = getMonthSeasonIdx(srcMonthIdx);
  const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);
  const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
  return tgtSeasonIdx === nextSeasonIdx;
}

/**
 * آیا ماه تارگت در همان فصل سورس است و بعد از آن می‌آید؟
 */
function isInSameSeasonAfter(srcMonthIdx: number, tgtMonthIdx: number): boolean {
  const srcSeasonIdx = getMonthSeasonIdx(srcMonthIdx);
  const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);
  if (srcSeasonIdx !== tgtSeasonIdx) return false;
  
  // استفاده از فاصله چرخشی برای مقایسه
  const distance = getCircularMonthDistance(srcMonthIdx, tgtMonthIdx);
  return distance > 0 && distance <= 2; // حداکثر 2 ماه در یک فصل
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
  
  const hasMonth = monthIdx !== -1;
  const hasSeason = seasonIdx !== -1 && !hasMonth;
  const hasTime = hasMonth || hasSeason;

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
    hasMonth,
    hasSeason,
    hasTime,
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
// تشخیص هویت صفحه (برای ماتریس جریمه متقاطع)
// ══════════════════════════════════════════════════════════════════════════════

type PageIdentity = 'TIME_ONLY' | 'ORIGIN_ONLY' | 'HOTEL_ONLY' | 'MULTI' | 'NONE';

function getPageIdentity(page: ParsedPage): PageIdentity {
  const hasTime = page.hasTime;
  const hasOrigin = page.hasOrigin;
  const hasHotel = page.hasHotel;

  const count = [hasTime, hasOrigin, hasHotel].filter(Boolean).length;

  if (count === 0) return 'NONE';
  if (count > 1) return 'MULTI';

  if (hasTime) return 'TIME_ONLY';
  if (hasOrigin) return 'ORIGIN_ONLY';
  if (hasHotel) return 'HOTEL_ONLY';

  return 'NONE';
}

// ══════════════════════════════════════════════════════════════════════════════
// توابع محاسبه ضرایب جداگانه
// ══════════════════════════════════════════════════════════════════════════════

/** جهت منطقه */
function calcRegionScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.regionDirection || !tgt.regionDirection) {
    return { coef: 1.0, tag: null };
  }
  if (src.regionDirection === tgt.regionDirection) {
    return { coef: COEFFICIENTS.REGION_MATCH, tag: 'جهت_در_منطقه' };
  }
  return { coef: COEFFICIENTS.REGION_MISMATCH, tag: null };
}

/** دسته‌های کلی */
function calcGeneralScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (src.generalKeywords.length === 0) {
    return { coef: 1.0, tag: null };
  }
  const hasMatch = src.generalKeywords.some(k => tgt.generalKeywords.includes(k));
  if (hasMatch) {
    return { coef: COEFFICIENTS.GENERAL_MATCH, tag: 'دسته_های_کلی' };
  }
  return { coef: 1.0, tag: null };
}

/**
 * مقصد - با ضرایب اصلاح‌شده
 * شهر یکسان: 2.0
 * کشور یکسان ولی شهر متفاوت: 0.5
 * کشور متفاوت: 0.4
 */
function calcDestinationScore(
  src: ParsedPage,
  tgt: ParsedPage
): { coef: number; tag: string | null; bonus: number } {
  const srcHasDest = !!(src.city || src.country);
  const tgtHasDest = !!(tgt.city || tgt.country);

  if (!srcHasDest || !tgtHasDest) {
    return { coef: 1.0, tag: null, bonus: 0 };
  }

  if (src.city && tgt.city && src.city === tgt.city) {
    return {
      coef: COEFFICIENTS.DESTINATION_CITY_MATCH,
      tag: 'شهر_یا_جزیره_مقصد',
      bonus: COEFFICIENTS.DESTINATION_BONUS,
    };
  }

  if (src.country && tgt.country && src.country === tgt.country) {
    return {
      coef: COEFFICIENTS.DESTINATION_COUNTRY_MATCH,
      tag: 'کشور_مقصد',
      bonus: COEFFICIENTS.DESTINATION_BONUS,
    };
  }

  return { coef: COEFFICIENTS.DESTINATION_DIFFERENT_COUNTRY, tag: null, bonus: 0 };
}

/**
 * حمل‌ونقل
 * خنثی: اگر یکی از طرفین ندارد
 * جریمه: فقط اگر هر دو دارند ولی متفاوت
 */
function calcTransportScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.transport || !tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_NEUTRAL, tag: null };
  }
  if (src.transport === tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_MATCH, tag: 'نوع_وسیله_نقلیه' };
  }
  return { coef: COEFFICIENTS.TRANSPORT_MISMATCH, tag: null };
}

/**
 * بررسی شرط نجات تورهای همیشگی (Evergreen Rescue)
 * شرط: تارگت کلمات کلی دارد و مقصد دقیقاً یکسان است
 */
function checkEvergreenRescue(src: ParsedPage, tgt: ParsedPage): boolean {
  const hasGeneralKeywords = tgt.isGeneral;
  const sameCityDestination = src.city && tgt.city && src.city === tgt.city;
  return hasGeneralKeywords && sameCityDestination;
}

/**
 * زمان (ماه/فصل) - با ریاضیات چرخشی
 * 
 * این تابع منطق کامل زمان را پیاده‌سازی می‌کند:
 * - از ریاضیات چرخشی (Modulo) برای جلوگیری از تله تقویم استفاده می‌کند
 * - منطق نجات تورهای همیشگی (Evergreen Rescue) داخل همین تابع است
 * - نامتقارنی زمان (سورس بدون زمان، تارگت با زمان) را مدیریت می‌کند
 */
function calcTimeScore(
  src: ParsedPage,
  tgt: ParsedPage,
  currentMonthIdx: number
): { coef: number; tag: string | null } {
  // ─────────────────────────────────────────────────────────────
  // حالت ۱: سورس ماه دارد
  // ─────────────────────────────────────────────────────────────
  if (src.hasMonth) {
    const srcMonthIdx = src.monthIdx;
    const srcSeasonIdx = getMonthSeasonIdx(srcMonthIdx);

    // تارگت ماه دارد
    if (tgt.hasMonth) {
      const tgtMonthIdx = tgt.monthIdx;
      const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);

      // جریمه کشنده: ماه‌های گذشته (با ریاضیات چرخشی)
      if (isMonthInPast(tgtMonthIdx, currentMonthIdx)) {
        return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
      }

      // همان ماه
      if (srcMonthIdx === tgtMonthIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME, tag: 'ماه_تقویمی_برگزاری' };
      }

      // همان فصل (ماه‌های بعد از سورس)
      if (isInSameSeasonAfter(srcMonthIdx, tgtMonthIdx)) {
        return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'فصل_برگزاری' };
      }

      // فصل بعدی
      if (isInNextSeason(srcMonthIdx, tgtMonthIdx)) {
        if (isLastMonthOfSeason(srcMonthIdx)) {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null };
        }
        return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_NOT_LAST, tag: null };
      }

      // سایر ماه‌ها - جریمه کشنده
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت فصل دارد
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      // همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'فصل_برگزاری' };
      }

      // فصل بعدی
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        if (isLastMonthOfSeason(srcMonthIdx)) {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null };
        }
        return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_NOT_LAST, tag: null };
      }

      // فصل‌های دیگر - جریمه کشنده
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت زمان ندارد - بررسی Evergreen Rescue
    if (checkEvergreenRescue(src, tgt)) {
      return { coef: COEFFICIENTS.EVERGREEN_RESCUE, tag: null };
    }
    
    // بدون نجات - جریمه کشنده
    return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
  }

  // ─────────────────────────────────────────────────────────────
  // حالت ۲: سورس فصل دارد (نه ماه)
  // ─────────────────────────────────────────────────────────────
  if (src.hasSeason) {
    const srcSeasonIdx = src.seasonIdx;

    // تارگت ماه دارد
    if (tgt.hasMonth) {
      const tgtMonthIdx = tgt.monthIdx;
      const tgtSeasonIdx = getMonthSeasonIdx(tgtMonthIdx);

      // جریمه کشنده: ماه‌های گذشته (با ریاضیات چرخشی)
      if (isMonthInPast(tgtMonthIdx, currentMonthIdx)) {
        return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
      }

      // ماه‌های همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_MONTHS_IN_SEASON, tag: 'فصل_برگزاری' };
      }

      // فصل بعدی
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_NEXT, tag: null };
      }

      // سایر ماه‌ها - جریمه کشنده
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت فصل دارد
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      // همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_SAME, tag: 'فصل_برگزاری' };
      }

      // فصل بعدی
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_NEXT, tag: null };
      }

      // فصل‌های دیگر - جریمه کشنده
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت زمان ندارد - بررسی Evergreen Rescue
    if (checkEvergreenRescue(src, tgt)) {
      return { coef: COEFFICIENTS.EVERGREEN_RESCUE, tag: null };
    }
    
    // بدون نجات - جریمه کشنده
    return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
  }

  // ─────────────────────────────────────────────────────────────
  // حالت ۳: سورس زمان ندارد
  // ─────────────────────────────────────────────────────────────
  
  // اگر تارگت زمان دارد - جریمه نامتقارنی (نه خنثی!)
  // تور بدون زمان نباید به تورهای زمان‌دار لینک‌های قوی بدهد
  if (tgt.hasTime) {
    return { coef: COEFFICIENTS.TIME_ASYMMETRY_PENALTY, tag: null };
  }

  // هر دو بدون زمان - خنثی
  return { coef: 1.0, tag: null };
}

/**
 * نوع سفر
 * خنثی: اگر یکی از طرفین ندارد
 * جریمه: فقط اگر هر دو دارند ولی متفاوت
 */
function calcTravelTypeScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  const srcType = src.travelType || src.tourType;
  const tgtType = tgt.travelType || tgt.tourType;

  if (!srcType || !tgtType) {
    return { coef: COEFFICIENTS.TRAVEL_TYPE_NEUTRAL, tag: null };
  }
  if (srcType === tgtType) {
    return { coef: COEFFICIENTS.TRAVEL_TYPE_MATCH, tag: src.travelType ? 'نوع_سفر' : 'نوع_تور' };
  }
  return { coef: COEFFICIENTS.TRAVEL_TYPE_MISMATCH, tag: null };
}

/**
 * برچسب کلاس تور
 * خنثی: اگر یکی از طرفین ندارد
 * جریمه: فقط اگر هر دو دارند ولی متفاوت
 */
function calcTourClassScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.tourClass || !tgt.tourClass) {
    return { coef: COEFFICIENTS.TOUR_CLASS_NEUTRAL, tag: null };
  }
  if (src.tourClass === tgt.tourClass) {
    return { coef: COEFFICIENTS.TOUR_CLASS_MATCH, tag: 'برچسب_کلاسی_تور' };
  }
  return { coef: COEFFICIENTS.TOUR_CLASS_MISMATCH, tag: null };
}

/**
 * ستاره هتل
 * خنثی: اگر یکی از طرفین ندارد
 * جریمه: فقط اگر هر دو دارند ولی متفاوت
 */
function calcHotelStarScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.hotelStar || !tgt.hotelStar) {
    return { coef: COEFFICIENTS.HOTEL_STAR_NEUTRAL, tag: null };
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

/**
 * مبدا
 * خنثی: اگر یکی از طرفین ندارد
 * جریمه: فقط اگر هر دو دارند ولی متفاوت
 */
function calcOriginScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null; bonus: number } {
  if (!src.hasOrigin || !tgt.hasOrigin) {
    return { coef: COEFFICIENTS.ORIGIN_NEUTRAL, tag: null, bonus: 0 };
  }
  if (src.origin && tgt.origin && src.origin === tgt.origin) {
    return { coef: COEFFICIENTS.ORIGIN_MATCH, tag: 'شهر_یا_استان_مبدا', bonus: COEFFICIENTS.ORIGIN_BONUS };
  }
  return { coef: COEFFICIENTS.ORIGIN_MISMATCH, tag: null, bonus: 0 };
}

/**
 * ماتریس جریمه متقاطع (Cross-Penalty Matrix)
 * فقط برای صفحات تک‌هویتی
 */
function calcCrossPenalty(src: ParsedPage, tgt: ParsedPage): { coef: number } {
  const srcIdentity = getPageIdentity(src);

  if (srcIdentity === 'MULTI' || srcIdentity === 'NONE') {
    return { coef: 1.0 };
  }

  let penalty = 1.0;

  switch (srcIdentity) {
    case 'TIME_ONLY':
      if (tgt.hasOrigin) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.TIME_ONLY.TO_ORIGIN;
      }
      if (tgt.hasHotel) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.TIME_ONLY.TO_HOTEL;
      }
      break;

    case 'ORIGIN_ONLY':
      if (tgt.hasTime) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.ORIGIN_ONLY.TO_TIME;
      }
      if (tgt.hasHotel) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.ORIGIN_ONLY.TO_HOTEL;
      }
      break;

    case 'HOTEL_ONLY':
      if (tgt.hasTime) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.HOTEL_ONLY.TO_TIME;
      }
      if (tgt.hasOrigin) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.HOTEL_ONLY.TO_ORIGIN;
      }
      break;
  }

  return { coef: penalty };
}

/**
 * صفحات مادر (Mother Page)
 */
function checkMotherPage(src: ParsedPage, tgt: ParsedPage): { 
  isCityMother: boolean; 
  isCountryMother: boolean;
  multiplier: number;
} {
  const tgtTitleClean = tgt.title.trim();

  const isCityMother = !!(src.city && tgtTitleClean === `تور ${src.city}`);
  const isCountryMother = !!(src.country && tgtTitleClean === `تور ${src.country}`);

  let multiplier = 1.0;
  if (isCityMother) multiplier = COEFFICIENTS.MOTHER_CITY;
  else if (isCountryMother) multiplier = COEFFICIENTS.MOTHER_COUNTRY;

  return { isCityMother, isCountryMother, multiplier };
}

// ══════════════════════════════════════════════════════════════════════════════
// الگوریتم امتیازدهی اصلی
// ══════════════════════════════════════════════════════════════════════════════

function calculateScore(
  sourcePage: PageInfo,
  sourceCat: Record<string, unknown>,
  targetPage: PageInfo,
  targetCat: Record<string, unknown>,
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): ScoreResult {
  const src = parsePage(sourcePage, sourceCat);
  const tgt = parsePage(targetPage, targetCat);

  let score = 1.0;
  const matchedTags: string[] = [];
  let originBonus = 0;
  let destinationBonus = 0;

  // ۱. جهت منطقه
  const region = calcRegionScore(src, tgt);
  score *= region.coef;
  if (region.tag) matchedTags.push(region.tag);

  // ۲. دسته‌های کلی
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

  // ۵. زمان (ماه/فصل) - شامل Evergreen Rescue و نامتقارنی
  const time = calcTimeScore(src, tgt, currentMonthIdx);
  score *= time.coef;
  if (time.tag) matchedTags.push(time.tag);

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

  // ۱۱. صفحات مادر (God Multipliers)
  const motherPage = checkMotherPage(src, tgt);
  score *= motherPage.multiplier;

  return {
    score,
    matchedTags,
    originBonus,
    destinationBonus,
    isCityMother: motherPage.isCityMother,
    isCountryMother: motherPage.isCountryMother,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// نرمال‌سازی امتیاز - فرمول لگاریتمی (فقط برای نمایش UI)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * نرمال‌سازی لگاریتمی
 * فرمول: (Math.log1p(raw) / Math.log1p(500)) * 10
 * 
 * نکته مهم: این تابع فقط برای نمایش در UI استفاده می‌شود.
 * مرتب‌سازی باید روی امتیاز خام (Raw Score) انجام شود.
 */
function normalizeScore(raw: number): number {
  if (raw <= 0) return 0;
  const normalized = (Math.log1p(raw) / Math.log1p(500)) * 10;
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

    // بدون Hard Filter - همه صفحات وارد می‌شوند
    if (result.score > 0) {
      rawCandidates.push({ page, result });
    }
  }

  // قانون ریشه‌ای: مرتب‌سازی روی امتیاز خام (Raw Score)
  rawCandidates.sort((a, b) => b.result.score - a.result.score);

  // تبدیل به CandidateWithTags با امتیاز نرمالایز شده برای UI
  const candidates: CandidateWithTags[] = rawCandidates.map(({ page, result }) => ({
    page_id: (page as any).id!,
    title: page.title,
    score: normalizeScore(result.score),    // برای نمایش UI
    rawScore: result.score,                   // برای مرتب‌سازی و دیباگ
    matched_tags: result.matchedTags,
    matchedTags: result.matchedTags,
    origin_bonus: result.originBonus,
    destination_bonus: result.destinationBonus,
    categories: parseCategories(page.categories),
  }));

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
