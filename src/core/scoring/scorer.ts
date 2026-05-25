import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON } from '../../constants/categories';

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
  hasNorouz: boolean;
  hasOccasion: boolean;
  isMotherPage: boolean;
  generalKeywords: string[];
  isGeneral: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// ثوابت
// ══════════════════════════════════════════════════════════════════════════════

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
const GENERAL_KEYWORDS = ['ارزان', 'لوکس', 'قطار', 'اتوبوس', 'هوایی', 'زمینی', 'لحظه آخری'];
const TRANSPORT_KEYWORDS = ['هوایی', 'قطار', 'اتوبوس', 'پرواز', 'کشتی', 'زمینی'];

// تعداد ماه‌ها در سال شمسی
const MONTHS_IN_YEAR = 12;

// پنجره زمانی معتبر در تقویم چرخشی ۱۲ ماهه
// فاصله‌های ۰ تا ۸ → آینده (تا ۸ ماه جلوتر، شامل پیش‌فروش نوروز و تابستان)
// فاصله‌های ۹ تا ۱۱ → گذشته (یعنی ۱ تا ۳ ماهِ قبل که تمام شده‌اند)
// این عدد برای بیزینس گردشگری حیاتی است: کاربری در مهر باید تورهای فروردین (نوروز) را ببیند
//const VALID_FUTURE_WINDOW = 8;
const VALID_FUTURE_WINDOW = 8;

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
  LETHAL_PENALTY: 0.02,

  // جهت منطقه
  REGION_MATCH: 1.5,
  REGION_MISMATCH: 0.8,

  // دسته‌های کلی
  GENERAL_MATCH: 1.5,

  // مقصد
  DESTINATION_CITY_MATCH: 3.0,
  DESTINATION_COUNTRY_MATCH: 0.5,
  DESTINATION_DIFFERENT_COUNTRY: 0.1,

  // حمل‌ونقل
  TRANSPORT_MATCH: 2.0,
  TRANSPORT_MISMATCH: 0.75,
  TRANSPORT_NEUTRAL: 1.0,
  TRANSPORT_ALTERNATIVE: 1.5,

  // ماه (وقتی source ماه دارد)
  MONTH_SAME: 3.0,
  MONTH_SAME_SEASON: 2.0,
  MONTH_NEXT_SEASON_LAST_MONTH: 1.8,

  // نوروز - استثنای بیزینسی
  NOROUZ_TO_NOROUZ: 5.0,
  NOROUZ_TO_FARVARDIN_OR_BAHAR: 4.0,

  // فصل
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

  // نجات تورهای همیشگی
  EVERGREEN_RESCUE: 0.9,

  // نامتقارنی زمان
  TIME_ASYMMETRY_PENALTY: 0.8,

  // 👑 ماتریس جریمه متقاطع (اصلاح شده و ضدگلوله)
  CROSS_PENALTY: {
    TIME_ONLY: {
      TO_ORIGIN: 0.2,
      TO_HOTEL: 0.2,
    },
    ORIGIN_ONLY: {
      TO_TIME: 0.2,
      TO_HOTEL: 0.2,
    },
    HOTEL_ONLY: {
      TO_TIME: 0.2,
      TO_ORIGIN: 0.2,
    },
    MOTHER_PAGE: {
      TO_TIME: 0.2,
      TO_HOTEL: 0.2,
      TO_TRANSPORT: 0.2, // اضافه شدن حیاتی برای جلوگیری از باگ NaN
      TO_ORIGIN: 0.75,
      TO_MOTHER: 4, 
      TO_OCCASION: 0.2,
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
  
  // ۱. بررسی الگوهای ستاره‌دار مثل "۵ ستاره"
  if (/\d+\s*ستاره/.test(title)) return true;
  
  // ۲. اسکن مستقیم کلمات کلیدی "هتل" و "اقامتگاه" در عنوان
  if (title.includes('هتل') || title.includes('اقامتگاه')) return true;

  // ۳. بررسی از روی دسته‌بندی دیتابیس با خنثی‌سازی باگ رشته‌های "null"
  if (catHotel) {
    const val = String(catHotel).trim().toLowerCase();
    if (val && val !== 'null' && val !== 'undefined') return true;
  }
  
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





// ══════════════════════════════════════════════════════════════════════════════
// پارس کردن صفحه
// ══════════════════════════════════════════════════════════════════════════════

export function parsePage(page: PageInfo, cat: Record<string, unknown>): ParsedPage {
  const title = page.title || '';
  const month = extractMonth(title);
  const monthIdx = month ? PERSIAN_MONTHS_ORDER.indexOf(month) : -1;
  const season = extractSeason(title);
  const seasonIdx = season ? SEASONS_ORDER.indexOf(season) : -1;
  const generalKeywords = extractGeneralKeywords(title);

  const hasMonth = monthIdx !== -1;
  const hasSeason = seasonIdx !== -1 && !hasMonth;
  const hasTime = hasMonth || hasSeason;
  const hasNorouz = title.includes('نوروز') || title.includes('نوروزی');

  const cityRaw = (cat['شهر_یا_جزیره_مقصد'] as string)?.trim();
  const city = cityRaw && cityRaw !== 'null' ? cityRaw : null;
  const countryRaw = (cat['کشور_مقصد'] as string)?.trim();
  const country = countryRaw && countryRaw !== 'null' ? countryRaw : null;

  // صفحه مادر: عنوان دقیقاً «تور [شهر]» یا «تور [کشور]» باشد.
  // این صفحات هاب اصلی مقصد هستند و در ماتریس جریمه متقاطع رفتار خاصی دارند.
  const titleClean = title.trim();
  
  // تشخیص قوی صفحه مادر: مقصد دارد ولی هیچ ویژگی تخصصی ندارد
  const hasTransportMark = !!extractTransport(title);
  const hasHotelMark = hasHotelInTitle(title, cat['نام_دقیق_هتل']);
  const hasOriginMark = hasOriginInTitle(title);
  const hasDestination = !!city || !!country;
  const hasGeneralMark = generalKeywords.length > 0;
  // تشخیص تعطیلات و مناسبت
  const holiday = cat['تعطیلات_خاص_تقویمی'];
  const event = cat['رویداد_یا_مناسبت_خاص'];
  const hasOccasion =
    (typeof holiday === 'string' && holiday.trim() !== '' && holiday !== 'null') ||
    (typeof event === 'string' && event.trim() !== '' && event !== 'null');

  const isMotherPage =
    hasDestination &&
    !hasMonth &&
    !hasSeason &&
    !hasTransportMark &&
    !hasHotelMark &&
    !hasOriginMark &&
    !hasGeneralMark &&
    !hasOccasion;

  return {
    title,
    city,
    country,
    origin: (() => {
      const o = (cat['شهر_یا_استان_مبدا'] as string)?.trim();
      return o && o !== 'null' ? o : null;
    })(),
    month,
    monthIdx,
    season,
    seasonIdx,
    transport: extractTransport(title),
    hotelStar: extractHotelStar(title, cat['تعداد_ستاره_هتل']),
    tourType: cat['نوع_تور'] !== 'null' ? (cat['نوع_تور'] as string) : null,
    travelType: cat['نوع_سفر'] !== 'null' ? (cat['نوع_سفر'] as string) : null,
    tourClass: cat['برچسب_کلاسی_تور'] !== 'null' ? (cat['برچسب_کلاسی_تور'] as string) : null,
    regionDirection: cat['جهت_در_منطقه'] !== 'null' ? (cat['جهت_در_منطقه'] as string) : null,
    hasOrigin: hasOriginInTitle(title),
    hasMonth,
    hasSeason,
    hasTime,
    hasHotel: hasHotelInTitle(title, cat['نام_دقیق_هتل']),
    hasNorouz,
    hasOccasion,
    isMotherPage,
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

type PageIdentity =
  | 'MOTHER_PAGE'
  | 'TIME_ONLY'
  | 'ORIGIN_ONLY'
  | 'HOTEL_ONLY'
  | 'OCCASION_ONLY'
  | 'MULTI'
  | 'NONE';

/**
 * تشخیص هویت صفحه برای ماتریس جریمه متقاطع.
 *
 * اولویت تشخیص:
 *   ۱. MOTHER_PAGE - صفحه هاب مقصد (مثل «تور کیش» یا «تور ترکیه»). این هویت
 *      حتی وقتی صفحه زمان/مبدا/هتل ندارد هم باید شناسایی شود تا در گیت‌وی
 *      جریمه گیر کند و به فرزندان تخصصی‌اش لینک قوی ندهد.
 *   ۲. MULTI - بیش از یک ویژگی هویتی دارد
 *   ۳. تک‌هویتی‌ها (TIME_ONLY / ORIGIN_ONLY / HOTEL_ONLY)
 *   ۴. NONE - هیچ‌کدام (صفحات کلی بدون هویت خاص)
 */
function getPageIdentity(page: ParsedPage): PageIdentity {
  if (page.isMotherPage) return 'MOTHER_PAGE';

  const { hasTime, hasOrigin, hasHotel, hasOccasion } = page;
  const count = [hasTime, hasOrigin, hasHotel, hasOccasion].filter(Boolean).length;

  if (count === 0) return 'NONE';
  if (count > 1) return 'MULTI';

  if (hasTime) return 'TIME_ONLY';
  if (hasOrigin) return 'ORIGIN_ONLY';
  if (hasHotel) return 'HOTEL_ONLY';
  if (hasOccasion) return 'OCCASION_ONLY';

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
 * جریمه: فقط اگر هر دو دارند ولی متفاوت هستند و مقصدشان هم فرق دارد
 * جایگزین (Alternative): هر دو دارند و متفاوت است ولی مقصد یکسانی دارند
 */
function calcTransportScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  if (!src.transport || !tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_NEUTRAL, tag: null };
  }
  if (src.transport === tgt.transport) {
    return { coef: COEFFICIENTS.TRANSPORT_MATCH, tag: 'نوع_وسیله_نقلیه' };
  }

  // بررسی می‌کنیم که آیا مقصد این تور با تور فعلی یکی است؟
  const sameDestination = (src.city && src.city === tgt.city) || (!src.city && src.country && src.country === tgt.country);
  
  if (sameDestination) {
    // 👈 اگر مقصد یکسان بود اما وسیله متفاوت است، این یک پیشنهاد عالی به عنوان گزینه جایگزین است
    return { coef: COEFFICIENTS.TRANSPORT_ALTERNATIVE, tag: 'سایر_وسایل_نقلیه' }; 
  }

  // فقط زمانی جریمه کن که وسیله‌ها متفاوت باشند و مقصد هم هیچ ربطی به هم نداشته باشد
  return { coef: COEFFICIENTS.TRANSPORT_MISMATCH, tag: null };
}

/**
 * بررسی شرط نجات تورهای همیشگی (Evergreen Rescue)
 *
 * شرط: تارگت کلمات کلی (ارزان، لوکس، هوایی، ...) دارد و مقصد دقیقاً یکسان است.
 * تعریف "مقصد دقیقاً یکسان" در دو حالت:
 *   ۱. هر دو شهر دارند و شهرهایشان برابر است
 *   ۲. هیچ‌کدام شهر ندارند ولی هر دو کشور دارند و کشورهایشان برابر است
 *      (مثلاً «تور ترکیه» و «تور ارزان ترکیه» باید نجات پیدا کنند)
 *
 * اگر یکی شهر داشته باشد و دیگری نداشته باشد، نجات اتفاق نمی‌افتد چون
 * گرانولاریتیِ مقصد متفاوت است و از نظر سئو نباید لینک قوی بدهیم.
 */
function checkEvergreenRescue(src: ParsedPage, tgt: ParsedPage): boolean {
  if (!tgt.isGeneral) return false;

  const isExactCityMatch =
    !!src.city && !!tgt.city && src.city === tgt.city;

  const isExactCountryMatch =
    !src.city &&
    !tgt.city &&
    !!src.country &&
    !!tgt.country &&
    src.country === tgt.country;

  return isExactCityMatch || isExactCountryMatch;
}

/**
 * قانون استثنایی نوروز (Norouz Override)
 *
 * اگر سورس در عنوانش «نوروز» داشت، اولویت مطلق با تارگت‌های نوروزی است.
 * این قانون قبل از سایر منطق‌های زمان اجرا می‌شود تا لینک‌سازی اجباری
 * و قدرتمند برای فصل پرفروش نوروز تضمین شود.
 *
 * بازگشت null یعنی این قانون اعمال نشده و باید منطق عادی اجرا شود.
 */
function applyNorouzOverride(
  src: ParsedPage,
  tgt: ParsedPage
): { coef: number; tag: string | null } | null {
  if (!src.hasNorouz) return null;

  // تارگت هم نوروز دارد → بالاترین اولویت
  if (tgt.hasNorouz) {
    return { coef: COEFFICIENTS.NOROUZ_TO_NOROUZ, tag: 'ماه_تقویمی_برگزاری' };
  }

  // تارگت ماه فروردین یا فصل بهار دارد → اولویت قوی
  const isFarvardin = tgt.hasMonth && tgt.month === 'فروردین';
  const isBahar = tgt.hasSeason && tgt.season === 'بهار';
  if (isFarvardin || isBahar) {
    return {
      coef: COEFFICIENTS.NOROUZ_TO_FARVARDIN_OR_BAHAR,
      tag: isFarvardin ? 'ماه_تقویمی_برگزاری' : 'فصل_برگزاری',
    };
  }

  return null;
}

/**
 * زمان (ماه/فصل) - با ریاضیات چرخشی
 *
 * این تابع منطق کامل زمان را پیاده‌سازی می‌کند:
 * - قانون استثنایی نوروز در ابتدا اعمال می‌شود
 * - از ریاضیات چرخشی (Modulo) برای جلوگیری از تله تقویم استفاده می‌کند
 * - ماه‌های قبلی همان فصل و فصل بعدی غیر-آخر-فصل با LETHAL_PENALTY دفن می‌شوند
 * - منطق نجات تورهای همیشگی (Evergreen Rescue) داخل همین تابع است
 * - نامتقارنی زمان (سورس بدون زمان، تارگت با زمان) را مدیریت می‌کند
 */
function calcTimeScore(
  src: ParsedPage,
  tgt: ParsedPage,
  currentMonthIdx: number
): { coef: number; tag: string | null } {
  // قانون استثنایی نوروز (قبل از همه چیز)
  const norouzResult = applyNorouzOverride(src, tgt);
  if (norouzResult) return norouzResult;

  // ─────────────────────────────────────────────────────────────
  // حالت ۱: سورس ماه دارد
  // ─────────────────────────────────────────────────────────────
  if (src.hasMonth) {
    const srcMonthIdx = src.monthIdx;
    const srcSeasonIdx = getMonthSeasonIdx(srcMonthIdx);
    const srcIsLastMonth = isLastMonthOfSeason(srcMonthIdx);

    // تارگت ماه دارد
    if (tgt.hasMonth) {
      const tgtMonthIdx = tgt.monthIdx;

      // جریمه کشنده: ماه‌های گذشته (تقویم چرخشی)
      if (isMonthInPast(tgtMonthIdx, currentMonthIdx)) {
        return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
      }

      // همان ماه
      if (srcMonthIdx === tgtMonthIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME, tag: 'ماه_تقویمی_برگزاری' };
      }

      // فقط ماه بعدی (مثلاً سورس اردیبهشت، تارگت خرداد)
      if (tgtMonthIdx === (srcMonthIdx + 1) % 12) {
        if (srcIsLastMonth) {
          return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null };
        } else {
          return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'توالی_زمانی' };
        }
      }

      // سایر حالات (شامل تمام ماه‌های دیگر همان فصل، فصل‌های دیگر و غیره)
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت فصل دارد
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      // همان فصل (سورس فروردین → تارگت بهار)
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.MONTH_SAME_SEASON, tag: 'فصل_برگزاری' };
      }

      // فصل بعدی - فقط اگر سورس آخرین ماه فصل باشد
      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (srcIsLastMonth && tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.MONTH_NEXT_SEASON_LAST_MONTH, tag: null };
      }

      // فصل‌های دیگر - جریمه کشنده
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت زمان ندارد - بررسی Evergreen Rescue
    if (checkEvergreenRescue(src, tgt)) {
      return { coef: COEFFICIENTS.EVERGREEN_RESCUE, tag: null };
    }

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

      // جریمه کشنده: ماه‌های گذشته
      if (isMonthInPast(tgtMonthIdx, currentMonthIdx)) {
        return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
      }

      // ماه‌های همان فصل
      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_MONTHS_IN_SEASON, tag: 'فصل_برگزاری' };
      }

      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت فصل دارد
    if (tgt.hasSeason) {
      const tgtSeasonIdx = tgt.seasonIdx;

      if (srcSeasonIdx === tgtSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_SAME, tag: 'فصل_برگزاری' };
      }

      const nextSeasonIdx = (srcSeasonIdx + 1) % 4;
      if (tgtSeasonIdx === nextSeasonIdx) {
        return { coef: COEFFICIENTS.SEASON_NEXT, tag: null };
      }

      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }

    // تارگت زمان ندارد - بررسی Evergreen Rescue
    if (checkEvergreenRescue(src, tgt)) {
      return { coef: COEFFICIENTS.EVERGREEN_RESCUE, tag: null };
    }

    return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
  }

  // ─────────────────────────────────────────────────────────────
  // حالت ۳: سورس زمان ندارد
  // ─────────────────────────────────────────────────────────────

  // تارگت ماه دارد - اگر گذشته است دفن، در غیر این صورت جریمه نامتقارنی
  if (tgt.hasMonth) {
    if (isMonthInPast(tgt.monthIdx, currentMonthIdx)) {
      return { coef: COEFFICIENTS.LETHAL_PENALTY, tag: null };
    }
    return { coef: COEFFICIENTS.TIME_ASYMMETRY_PENALTY, tag: null };
  }

  if (tgt.hasSeason) {
    return { coef: COEFFICIENTS.TIME_ASYMMETRY_PENALTY, tag: null };
  }

  // هر دو بدون زمان - خنثی
  return { coef: 1.0, tag: null };
}

/**
 * بررسی نوع سفر با بونوس تدریجی برای کلمات مشترک 
 */
function calcTravelTypeScore(src: ParsedPage, tgt: ParsedPage): { coef: number; tag: string | null } {
  const srcType = src.travelType || src.tourType;
  const tgtType = tgt.travelType || tgt.tourType;

  if (!srcType || !tgtType || srcType === 'null' || tgtType === 'null') {
    return { coef: COEFFICIENTS.TRAVEL_TYPE_NEUTRAL, tag: null };
  }
  
  if (srcType === tgtType) {
    return { coef: COEFFICIENTS.TRAVEL_TYPE_MATCH, tag: src.travelType ? 'نوع_سفر' : 'نوع_تور' };
  }

  // بررسی اشتراک کلمات با جداکننده‌های مختلف (مثل ویرگول فارسی و انگلیسی)
  const splitWords = (str: string) => str.split(/[,،]/).map(w => w.trim()).filter(Boolean);
  const srcWords = splitWords(srcType);
  const tgtWords = splitWords(tgtType);

  const intersection = srcWords.filter(w => tgtWords.includes(w));
  
  if (intersection.length > 0) {
    // بونوس تصاعدی: پایه ۱.۱۵ به علاوه ۰.۱۵ بابت هر کلمه مشترک
    const partialCoef = Math.min(COEFFICIENTS.TRAVEL_TYPE_MATCH, 1.15 + (intersection.length * 0.15));
    return { coef: partialCoef, tag: src.travelType ? `نوع_سفر (${intersection.length} ویژگی مشابه)` : 'نوع_تور' };
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
 *
 * اعمال جریمه بر اساس هویت سورس:
 *   - MOTHER_PAGE: قطعی به تارگت‌های زمان/هتل ضریب ۰.۲ و به مبدادار ۰.۷۵ می‌دهد
 *   - تک‌هویتی‌ها: طبق ماتریس مربوطه
 *   - MULTI / NONE: بدون جریمه (1.0)
 */
function calcCrossPenalty(src: ParsedPage, tgt: ParsedPage): { coef: number } {
  const srcIdentity = getPageIdentity(src);

  if (srcIdentity === 'MULTI' || srcIdentity === 'NONE') {
    return { coef: 1.0 };
  }

  let penalty = 1.0;

  switch (srcIdentity) {
    case 'MOTHER_PAGE':
      if (tgt.hasTime) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_TIME;
      }
      if (tgt.hasOrigin) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_ORIGIN;
      }
      
      // 👈 این بلوک را برای جریمه ۰.۲ مناسبت‌ها اضافه کن
      if (tgt.hasOccasion) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_OCCASION;
      }
      if (tgt.hasHotel) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_HOTEL;
      }
      
      // بستن حفره حمل‌ونقل: «تور کیش با پرواز ماهان» نباید زیر «تور کیش» رتبه دوم شود.
      // اگر تارگت حمل‌ونقل خاص دارد ولی خودش مادر نیست و کلی هم نیست، جریمه سنگین.
      // جریمه حمل‌ونقل در صورتی که مقصد مشترک باشد و تارگت مادر یا عمومی نباشد
      const sameDestination = (src.city && src.city === tgt.city) || (!src.city && src.country && src.country === tgt.country);
      if (tgt.transport && sameDestination && !tgt.isMotherPage && !tgt.isGeneral) {
        penalty *= COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_TRANSPORT;
      }
      // بونوس قوی برای لینک‌دهی تقاطعی بین مقاصد مختلف (مادر به مادر)
      if (tgt.isMotherPage && !sameDestination) {
        let motherBonus = COEFFICIENTS.CROSS_PENALTY.MOTHER_PAGE.TO_MOTHER;
        
        // جایزه ویژه و مجزا برای تشابه نوع سفر و جهت منطقه در صفحات اصلی
        // این تصمیم باعث می‌شود مقاصد مشابه (مانند کیش و قشم که هر دو جنوبی و داخلی هستند) استثنائاً سریع‌تر لینک شوند
        if (src.tourType && tgt.tourType && src.tourType === tgt.tourType) {
          motherBonus *= 1.5; // جایزه تشابه نوع تور (مثلاً هر دو داخلی)
        }
        
        if (src.regionDirection && tgt.regionDirection && src.regionDirection === tgt.regionDirection) {
          motherBonus *= 1.5; // جایزه تشابه منطقه (مثلاً هر دو جنوب)
        }

        penalty *= motherBonus;
      }
      break;

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
        penalty *= COEFFICIENTS.CROSS_PENALTY.HOTEL_ONLY.TO_ORIGIN;   // ← *=
      }
      break;
  }

  return { coef: penalty };
}

/**
 *   صفحات مادر (Mother Page)
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

export function calculateScoreParsed(
  src: ParsedPage,
  tgt: ParsedPage,
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): ScoreResult {
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

function calculateScore(
  sourcePage: PageInfo,
  sourceCat: Record<string, unknown>,
  targetPage: PageInfo,
  targetCat: Record<string, unknown>,
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): ScoreResult {
  const src = parsePage(sourcePage, sourceCat);
  const tgt = parsePage(targetPage, targetCat);
  return calculateScoreParsed(src, tgt, currentMonthIdx);
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
  const srcParsed = parsePage(sourcePage, sourceCat);

  const rawCandidates: Array<{
    page: PageInfo;
    result: ScoreResult;
    cat: Record<string, unknown>;
  }> = [];

  // محاسبه امتیاز برای همه صفحات
  for (const page of allPages) {
    if ((page as any).id === (sourcePage as any).id) continue;

    const pageCat = parseCategories(page.categories);
    const tgtParsed = parsePage(page, pageCat);
    const result = calculateScoreParsed(srcParsed, tgtParsed, currentMonthIdx);

    // بدون Hard Filter - همه صفحات وارد می‌شوند
    if (result.score > 0) {
      rawCandidates.push({ page, result, cat: pageCat });
    }
  }

  // قانون ریشه‌ای: مرتب‌سازی روی امتیاز خام (Raw Score)
  rawCandidates.sort((a, b) => b.result.score - a.result.score);

  // تبدیل به CandidateWithTags با امتیاز نرمالایز شده برای UI
  const candidates: CandidateWithTags[] = rawCandidates.map(({ page, result, cat }) => ({
    page_id: (page as any).id!,
    title: page.title,
    score: normalizeScore(result.score),    // برای نمایش UI
    rawScore: result.score,                   // برای مرتب‌سازی و دیباگ
    matched_tags: result.matchedTags,
    matchedTags: result.matchedTags,
    origin_bonus: result.originBonus,
    destination_bonus: result.destinationBonus,
    categories: cat,
  }));

  return candidates;
}

export function computeAllCandidates(
  pages: PageInfo[],
  currentMonthIdx: number = CURRENT_MONTH_INDEX
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();

  // ۱. پیش‌پردازش همه‌ی صفحات (Pre-parsing Step) - فقط یکبار برای O(N)
  const preparsed = pages.map(page => {
    const cat = parseCategories(page.categories);
    return {
      id: (page as any).id!,
      page,
      cat,
      parsed: parsePage(page, cat)
    };
  });

  // ۲. اجرای مقایسه دو به دو O(N^2) فوق‌العاده سریع بدون پارس مجدد
  for (const src of preparsed) {
    const rawCandidates: Array<{
      id: number;
      title: string;
      result: ScoreResult;
      cat: Record<string, unknown>;
    }> = [];

    for (const tgt of preparsed) {
      if (src.id === tgt.id) continue;

      const result = calculateScoreParsed(src.parsed, tgt.parsed, currentMonthIdx);
      if (result.score > 0) {
        rawCandidates.push({
          id: tgt.id,
          title: tgt.page.title,
          result,
          cat: tgt.cat
        });
      }
    }

    // مرتب‌سازی بر اساس امتیاز خام
    rawCandidates.sort((a, b) => b.result.score - a.result.score);

    // تبدیل به CandidateWithTags با امتیاز نرمالایز شده برای UI
    const candidates: CandidateWithTags[] = rawCandidates.map(({ id, title, result, cat }) => ({
      page_id: id,
      title,
      score: normalizeScore(result.score),
      rawScore: result.score,
      matched_tags: result.matchedTags,
      matchedTags: result.matchedTags,
      origin_bonus: result.originBonus,
      destination_bonus: result.destinationBonus,
      categories: cat,
    }));

    map.set(src.id, candidates);
  }

  return map;
}
