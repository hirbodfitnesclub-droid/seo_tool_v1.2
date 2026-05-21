import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON, ORIGIN_BONUS, DESTINATION_BONUS } from '../constants/categories';
import { titleSimilarity } from './titleSimilarity';

// اینترفیس با فیلدهای بونوس زمان/مکان
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
  matchedTags: string[]; // رونوشت برای همخوانی کامل با بخش‌های دیگر پروژه
  origin_bonus: number;
  destination_bonus: number;
  categories?: any; // پشتیبانی از دسته‌بندی و تگ‌های کامل صفحات کاندیدا برای پردازش هوش مصنوعی
}

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];

/**
 * نرمال‌سازی ماه‌های شمسی (معادل دانستن نوروز با فروردین طبق سیاست بیزینس)
 */
export function normalizeMonth(month: string): string {
  if (!month) return month;
  if (month === 'نوروز') return 'فروردین';
  return month;
}

/**
 * به دست آوردن فصل مؤثر صفحه بر اساس برچسب فصل یا ماه
 */
export function getEffectiveSeason(categories: any): string | undefined {
  if (categories['فصل_برگزاری']) {
    return categories['فصل_برگزاری'];
  }
  const month = categories['ماه_تقویمی_برگزاری'];
  if (month) {
    const norm = normalizeMonth(month);
    return MONTH_TO_SEASON[norm];
  }
  return undefined;
}

/**
 * محاسبه پویای جریمه‌های زمانی بر اساس رویکرد عدم حذف سئویی ولی افت شدید رتبه در گذشته
 */
export function computeTemporalPenalty(sourceCat: any, candidateCat: any): number {
  let penalty = 0;

  const srcMonthRaw = sourceCat['ماه_تقویمی_برگزاری'];
  const candMonthRaw = candidateCat['ماه_تقویمی_برگزاری'];
  const srcMonth = srcMonthRaw ? normalizeMonth(srcMonthRaw) : undefined;
  const candMonth = candMonthRaw ? normalizeMonth(candMonthRaw) : undefined;

  // ۱. کنترل جریمه پس‌روندگی ماه (Past Month) در چرخه سالانه
  if (srcMonth && candMonth) {
    const srcIdx = PERSIAN_MONTHS_ORDER.indexOf(srcMonth);
    const candIdx = PERSIAN_MONTHS_ORDER.indexOf(candMonth);

    if (srcIdx !== -1 && candIdx !== -1) {
      const backwardDist = (srcIdx - candIdx + 12) % 12; // فواصل چرخه‌ای معکوس
      if (backwardDist >= 1 && backwardDist <= 6) {
        // ماه در گذشته است! اعمال جریمه قاطع
        penalty += 15;
      }
    }
  }

  // ۲. کنترل جریمه عدم انطباق فصل (مخصوصاً فصول گذشته یا مخالف)
  const srcSeason = getEffectiveSeason(sourceCat);
  const candSeason = getEffectiveSeason(candidateCat);

  if (srcSeason && candSeason) {
    if (srcSeason !== candSeason) {
      const srcSeasIdx = SEASONS_ORDER.indexOf(srcSeason);
      const candSeasIdx = SEASONS_ORDER.indexOf(candSeason);

      if (srcSeasIdx !== -1 && candSeasIdx !== -1) {
        const backwardSeasDist = (srcSeasIdx - candSeasIdx + 4) % 4;

        if (backwardSeasDist === 1 || backwardSeasDist === 2) {
          // فصل گذشته یا کاملاً مخالف
          penalty += 18;
        } else if (backwardSeasDist === 3) {
          // فصل‌های آینده با جریمه بسیار جزئی لندینگ عبور داده می‌شوند
          penalty += 3;
        }
      } else {
        penalty += 8;
      }
    }
  }

  return penalty;
}

/**
 * تابع ۱: فهرست معتبر فصلی/زمانی (منطق نرم جدید)
 * 
 * بر اساس راهبرد جدید سئو، صفحات غیرهم‌فصل یا ماه‌های گذشته کاملاً حذف فیزیکی نمی‌شوند
 * بلکه حق انتخاب در لیست کاندیداها را دارند ولی با وزن و رتبه و اولویت‌های بسیار ناچیزتر.
 * برای حفظ کامل سازگاری ساختار پروژه، این تابع کماکان وجود دارد اما همواره true برمی‌گرداند.
 */
export function isValidSeasonalMatch(sourceCategories: any, candidateCategories: any): boolean {
  return true; // دیگر حذف سخت‌گیرانه نداریم؛ کاندیداها زنده می‌مانند و رتبه‌بندی می‌شوند
}

/**
 * تابع ۲: محاسبه بونوس مبدا و مقصد
 * 
 * قانون اولویت:
 *   ۱. مبدا یکسان = بونوس ۱۰ (اولویت اول)
 *   ۲. مقصد یکسان = بونوس ۵ (اولویت دوم)
 */
export function calculateBonuses(sourceCategories: any, candidateCategories: any): { originBonus: number; destinationBonus: number } {
  let originBonus = 0;
  let destinationBonus = 0;
  
  const sourceOrigin = sourceCategories['شهر_یا_استان_مبدا'];
  const candidateOrigin = candidateCategories['شهر_یا_استان_مبدا'];
  
  // بونوس مبدا
  if (sourceOrigin && candidateOrigin && sourceOrigin === candidateOrigin) {
    originBonus = ORIGIN_BONUS; // پیش فرض ۱۰
    
    // ارتقای هوشمند بونوس بر اساس همخوانی سگمنت سفر داخلی/داخلی یا خارجی/خارجی
    const sourCountry = sourceCategories['کشور_مقصد'];
    const candCountry = candidateCategories['کشور_مقصد'];
    if (sourCountry && candCountry) {
      const sourceIsDom = sourCountry === 'ایران';
      const candidateIsDom = candCountry === 'ایران';
      
      if (sourceIsDom === candidateIsDom) {
        originBonus += 7; // بونوس با اهمیت برای یکسان بودن ماهیت سفر (داخلی/خارجی)
        
        if (sourCountry === candCountry) {
          originBonus += 3; // بونوس اضافه برای کشور یکسان
        }
      }
    }
  }
  
  // بونوس مقصد
  const sourceDestination = sourceCategories['شهر_یا_جزیره_مقصد'];
  const candidateDestination = candidateCategories['شهر_یا_جزیره_مقصد'];
  if (sourceDestination && candidateDestination && sourceDestination === candidateDestination) {
    destinationBonus = DESTINATION_BONUS; // پیش فرض ۵
  }

  // اولویت سوم بیزینس — همخوانی یا ناهمخوانی کشور مقصد به صورت مستقل از مبدا
  const srcCountry = sourceCategories['کشور_مقصد'];
  const candCountry = candidateCategories['کشور_مقصد'];
  if (srcCountry && candCountry) {
    if (srcCountry === candCountry) {
      destinationBonus += 12; // بونوس قوی برای کشورهای یکسان جهت حفظ پیوند سئویی محصولات هم‌ریشه
    } else {
      destinationBonus -= 25; // جریمه بازدارنده بسیار بالا لایه ۳ برای کشورهای متمایز جهت تفکیک قاطع حوزه‌ها (مانند کوش‌آداسی به دبی)
    }
  }

  // بونوس‌های زمانی هوشمند (نیت ترجیحی کاربر برای ماه بعد و انتقال به صفحات فصلی عمومی)
  const sourceMonthRaw = sourceCategories['ماه_تقویمی_برگزاری'];
  const candidateMonthRaw = candidateCategories['ماه_تقویمی_برگزاری'];
  const sourceMonth = sourceMonthRaw ? normalizeMonth(sourceMonthRaw) : undefined;
  const candidateMonth = candidateMonthRaw ? normalizeMonth(candidateMonthRaw) : undefined;
  const sourceSeason = sourceCategories['فصل_برگزاری'];
  const candidateSeason = candidateCategories['فصل_برگزاری'];

  if (sourceMonth && candidateMonth) {
    const sourceIdx = PERSIAN_MONTHS_ORDER.indexOf(sourceMonth);
    const candidateIdx = PERSIAN_MONTHS_ORDER.indexOf(candidateMonth);
    if (sourceIdx !== -1 && candidateIdx !== -1) {
      const isNextMonth = candidateIdx === (sourceIdx + 1) % 12;
      if (isNextMonth) {
        // انتقال به ماه بعد برای همان مقصد دارای اولویت و ارزش سئویی بالایی است
        if (sourceDestination && candidateDestination && sourceDestination === candidateDestination) {
          destinationBonus += 8; // بونوس تشویقی ویژه برای حرکت زمانی به ماه بعد در یک مقصد یکسان
        } else {
          destinationBonus += 2; // بونوس تشویقی کلی ماه آینده
        }
      }
    }
  } else if (sourceMonth && !candidateMonth && sourceSeason && candidateSeason && sourceSeason === candidateSeason) {
    // انتقال از صفحه ماهانه یک مقصد به صفحه فصلی عمومی همان مقصد (مثل قشم تیر به قشم تابستان)
    if (sourceDestination && candidateDestination && sourceDestination === candidateDestination) {
      destinationBonus += 6; // بونوس تشویقی برای صفحات لندینگ فصلی عمومی
    }
  } else if (!sourceMonth && candidateMonth && sourceSeason && candidateSeason && sourceSeason === candidateSeason) {
    // انتقال از صفحه فصلی یک مقصد به صفحه ماهانه همان فصل (مثل قشم تابستان به قشم تیر)
    if (sourceDestination && candidateDestination && sourceDestination === candidateDestination) {
      destinationBonus += 4; // بونوس تشویقی ویژه برای حرکت از فصل به ماه همان فصل
    }
  }
  
  return { originBonus, destinationBonus };
}

/**
 * تابع ۳: محاسبه تگ‌های مشترک
 */
export function getMatchedTags(catA: any, catB: any): string[] {
  const matched: string[] = [];
  Object.keys(catA).forEach((field) => {
    if (
      catA[field] !== null && catA[field] !== undefined && catA[field] !== '' &&
      catB[field] !== null && catB[field] !== undefined && catB[field] !== '' &&
      catA[field] === catB[field]
    ) {
      matched.push(field);
    }
  });
  return matched;
}

/**
 * تابع ۴: محاسبه امتیاز پایه (وزن تگ‌های مشترک)
 */
export function computeBaseScore(catA: any, catB: any, weights: Record<string, number>, mode: 'linear' | 'weighted'): number {
  let score = 0;
  
  for (const field in catA) {
    if (field === 'ماه_تقویمی_برگزاری') {
      // این فیلد به صورت پویا با ضریب نزدیکی زمانی در ادامه محاسبه می‌شود
      continue;
    }
    if (
      catA[field] !== null && catA[field] !== undefined && catA[field] !== '' &&
      catB[field] !== null && catB[field] !== undefined && catB[field] !== '' &&
      catA[field] === catB[field]
    ) {
      if (mode === 'linear') {
        score += 1;
      } else {
        score += (weights[field] ?? 1);
      }
    }
  }

  // محاسبه پویای امتیاز نیت زمانی با رویکرد مدرن سئو (تطابق کامل، ماه بعد، ماه‌های آینده با تابع کاهشی، و عدم ترجیح ماه گذشته)
  const sourceMonthRaw = catA['ماه_تقویمی_برگزاری'];
  const candidateMonthRaw = catB['ماه_تقویمی_برگزاری'];
  const sourceMonth = sourceMonthRaw ? normalizeMonth(sourceMonthRaw) : undefined;
  const candidateMonth = candidateMonthRaw ? normalizeMonth(candidateMonthRaw) : undefined;
  const monthWeight = mode === 'linear' ? 1 : (weights['ماه_تقویمی_برگزاری'] ?? 3);

  if (sourceMonth && candidateMonth) {
    const sourceIdx = PERSIAN_MONTHS_ORDER.indexOf(sourceMonth);
    const candidateIdx = PERSIAN_MONTHS_ORDER.indexOf(candidateMonth);
    
    if (sourceIdx !== -1 && candidateIdx !== -1) {
      const diff = (candidateIdx - sourceIdx + 12) % 12;
      
      if (diff === 0) {
        score += monthWeight; // تطابق صددرصدی ماه جاری
      } else if (diff === 1) {
        score += monthWeight * 0.8; // اولویت عالی برای یک ماه بعد (آینده‌نگری کاربر)
      } else if (diff === 2) {
        score += monthWeight * 0.4; // اولویت متوسط برای دو ماه بعد
      } else if (diff >= 3 && diff <= 5) {
        score += monthWeight * 0.1; // اولویت بسیار ناچیز جهت پوشش ماه‌های دورتر همان نیم‌سال
      } else {
        // برای ماه‌های گذشته (diff >= 6) امتیازی داده نمی‌شود چون کاربر دنبال گذشته نیست
        score += 0;
      }
    }
  }
  
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// توابع معین و کمکی جدید برای استخراج و فیلتر ویژگی‌های الگوریتм آپدیت شده
// ─────────────────────────────────────────────────────────────────────────────

/**
 * تجزیه و استخراج دقیق لیست مقاصد/جزایر مقصد (پشتیبانی از تورهای ترکیبی)
 */
function parseDestinations(categories: any): string[] {
  const dest = categories?.['شهر_یا_جزیره_مقصد'];
  if (!dest) return [];
  // تفکیک مقاصد بر اساس خط فاصله (-)، ویرگول (،) یا ترجیحاً واژه ربط "و" با فواصل مناسب
  return String(dest)
    .split(/[\s,，、۔،\-و]+\s*/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0 && s !== 'و' && s !== 'تا');
}

/**
 * تشخیص هوشمند وجود مبدا در عنوان H1 یا دسته بندی ها
 */
function extractOrigin(title: string, categories: any): string | null {
  if (categories && categories['شهر_یا_استان_مبدا']) {
    return String(categories['شهر_یا_استان_مبدا']).trim();
  }
  // کشف کلمه کلیدی " از " در عنوان صفحه (از نوع "تور مشهد از اصفهان")
  if (title.includes(" از ")) {
    const parts = title.split(" از ");
    if (parts.length > 1) {
      const firstWordAfterAz = parts[1].trim().split(/\s+/)[0];
      return firstWordAfterAz.replace(/[\(\)\{\}\[\]]/g, '').trim();
    }
  }
  return null;
}

/**
 * تشخیص هوشمند صفحات اصلی مقصد (دسته ۱ یا صفحات پیلار عمومی)
 */
function isPillarPage(title: string, categories: any): boolean {
  // صفحه اصلی مقصد یا پیلار، فاقد شهر مبدأ (یا ساختار " از ") است
  const hasOrigin = title.includes(" از ") || !!categories?.['شهر_یا_استان_مبدا'];
  
  // فاقد ماه یا فصل خاصی است
  const hasTime = !!categories?.['ماه_تقویمی_برگزاری'] || !!categories?.['فصل_برگزاری'] ||
    PERSIAN_MONTHS_ORDER.some(m => title.includes(m)) ||
    ['بهار', 'تابستان', 'پاییز', 'زمستان'].some(s => title.includes(s)) ||
    title.includes("نوروز");
    
  // فاقد هتل مشخصی در عنوان است
  const hasHotel = title.includes("هتل") || !!categories?.['نام_دقیق_هتل'];
  
  // فاقد وضعیت تورهای ترکیبی است
  const isCombined = categories?.['نوع_تور']?.includes("ترکیبی") || title.includes("ترکیبی");
  
  return !hasOrigin && !hasTime && !hasHotel && !isCombined;
}

/**
 * استخراج ستاره هتل از عنوان یا متادیتا
 */
function getStarRating(title: string, categories: any): number | null {
  const starsRaw = categories?.['تعداد_ستاره_هتل'];
  if (starsRaw) {
    const parsed = parseInt(String(starsRaw).replace(/[^\d]/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  }
  if (title.includes("۵ ستاره") || title.includes("5 ستاره")) return 5;
  if (title.includes("۴ ستاره") || title.includes("4 ستاره")) return 4;
  if (title.includes("۳ ستاره") || title.includes("3 ستاره")) return 3;
  if (title.includes("۲ ستاره") || title.includes("2 ستاره")) return 2;
  return null;
}

/**
 * تابع ۵: پیدا کردن کاندیداها با الگوریتم بسیار پیشرفته جدید ۵ مرحله‌ای
 */
export function findTopCandidates(
  sourcePage: any, 
  allPages: any[], 
  weights: Record<string, number>, 
  arg4: any, // برای انطباق هر دو امضا (idfMap یا مستقیم mode)
  arg5?: 'linear' | 'weighted'
): CandidateWithTags[] {
  let mode: 'linear' | 'weighted' = 'linear';
  if (typeof arg4 === 'string') {
    mode = arg4 as 'linear' | 'weighted';
  } else if (arg5) {
    mode = arg5;
  }
  
  let sourceCat: any = {};
  if (typeof sourcePage.categories === 'string') {
    try {
      sourceCat = JSON.parse(sourcePage.categories);
    } catch {
      sourceCat = {};
    }
  } else {
    sourceCat = sourcePage.categories || {};
  }
  
  const sourceTitle = sourcePage.title;
  
  // ─── مرحله ۱: تجزیه موجودیت‌های منبع (ENTITY PARSING - SOURCE) ───
  const sourceDests = parseDestinations(sourceCat);
  const sourceOrigin = extractOrigin(sourceTitle, sourceCat);
  const sourceMonth = sourceCat['ماه_تقویمی_برگزاری'] ? normalizeMonth(sourceCat['ماه_تقویمی_برگزاری']) : null;
  const sourceSeason = getEffectiveSeason(sourceCat);
  const sourceHotel = sourceCat['نام_دقیق_هتل']?.trim();
  const sourceIsCheap = sourceTitle.includes("ارزان") || (sourceCat['برچسب_کلاسی_تور']?.includes("ارزان"));
  const sourceIsLuxury = sourceTitle.includes("لوکس") || (sourceCat['برچسب_کلاسی_تور']?.includes("لوکس")) || sourceTitle.includes("لاکچری");
  const sourceHasSpecificHotel = !!sourceHotel || (sourceTitle.includes("هتل ") && !sourceTitle.includes("هتل‌های") && !sourceTitle.includes("ستاره"));

  const candidates: CandidateWithTags[] = [];
  
  for (const page of allPages) {
    // صرف‌نظر کردن از خود صفحه منبع
    if (page.id === sourcePage.id) continue;
    
    let pageCat: any = {};
    if (typeof page.categories === 'string') {
      try {
        pageCat = JSON.parse(page.categories);
      } catch {
        pageCat = {};
      }
    } else {
      pageCat = page.categories || {};
    }
    
    const candTitle = page.title;
    
    // ─── مرحله ۱: تجزیه موجودیت‌های کاندیدا (ENTITY PARSING - CANDIDATE) ───
    const candDests = parseDestinations(pageCat);
    const candOrigin = extractOrigin(candTitle, pageCat);
    const candMonth = pageCat['ماه_تقویمی_برگزاری'] ? normalizeMonth(pageCat['ماه_تقویمی_برگزاری']) : null;
    const candSeason = getEffectiveSeason(pageCat);
    const candHotel = pageCat['نام_دقیق_هتل']?.trim();
    
    // بررسی تطابق‌های پایه‌ای
    const rawSourceDest = sourceCat['شهر_یا_جزیره_مقصد']?.trim();
    const rawCandDest = pageCat['شهر_یا_جزیره_مقصد']?.trim();
    
    const hasSharedDest = (sourceDests.length > 0 && candDests.length > 0 && sourceDests.some(d => candDests.includes(d))) ||
      (!!rawSourceDest && !!rawCandDest && rawSourceDest === rawCandDest);
      
    const isOriginMatch = !!sourceOrigin && !!candOrigin && sourceOrigin === candOrigin;
    const isTimeMatch = (sourceMonth && candMonth && sourceMonth === candMonth) ||
      (sourceSeason && candSeason && sourceSeason === candSeason);
    const isHotelMatch = !!sourceHotel && !!candHotel && sourceHotel === candHotel;
    
    // ─── مرحله ۲: قانون حاکم (THE ABSOLUTE OVERRIDE - PILLAR RULE) ───
    let pillarBonus = 0;
    if (isPillarPage(candTitle, pageCat) && hasSharedDest) {
      pillarBonus = 1000;
    }
    
    // ─── مرحله ۳: تخصیص وزن‌های پایه (BASE FALLBACK HIERARCHY) ───
    let destinationScore = hasSharedDest ? 100 : 0;
    let timeScore = isTimeMatch ? 60 : 0;
    let originScore = isOriginMatch ? 50 : 0;
    let hotelScore = isHotelMatch ? 30 : 0;
    
    const baseFallbackScore = destinationScore + timeScore + originScore + hotelScore;
    
    // ─── مرحله ۴: ماتریس‌های بونوس و جریمه هوشمند (SMART MATRICES) ───
    
    // الف) ماتریس زمان (Time Logic)
    let timeLogicBonus = 0;
    if (sourceMonth) {
      const srcIdx = PERSIAN_MONTHS_ORDER.indexOf(sourceMonth);
      const candIdx = candMonth ? PERSIAN_MONTHS_ORDER.indexOf(candMonth) : -1;
      
      if (hasSharedDest) {
        // کاندیدا مربوط به همان تور در ماه بعد باشد
        if (candMonth && srcIdx !== -1 && candIdx !== -1) {
          const isNextMonth = candIdx === (srcIdx + 1) % 12;
          if (isNextMonth) {
            timeLogicBonus += 40;
          }
        }
        
        // کاندیدا مربوط به همان تور در فصل فعلی (اما ماه‌های دیگر) باشد
        if (sourceSeason && candSeason && sourceSeason === candSeason && candMonth !== sourceMonth) {
          timeLogicBonus += 25;
        }
      }
      
      // قانون ماه آخر فصلی به فصل آینده
      const lastMonthsOfSeasons = ['خرداد', 'شهریور', 'آذر', 'اسفند'];
      const seasonSequence = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
      if (lastMonthsOfSeasons.includes(sourceMonth)) {
        const srcSeqIdx = seasonSequence.indexOf(sourceSeason || '');
        if (srcSeqIdx !== -1) {
          const nextSeason = seasonSequence[(srcSeqIdx + 1) % 4];
          if (candSeason === nextSeason) {
            timeLogicBonus += 20;
          }
        }
      }
    }
    
    // ب) ماتریس جغرافیایی (Geo Expansion)
    let geoExpansionBonus = 0;
    const isSameCountry = sourceCat['کشور_مقصد'] && pageCat['کشور_مقصد'] && 
      String(sourceCat['کشور_مقصد']).trim() === String(pageCat['کشور_مقصد']).trim();
      
    if (!hasSharedDest && isSameCountry && isTimeMatch) {
      geoExpansionBonus = 45;
    }
    
    // ج) ماتریس کلاس و بودجه (Budget & Class Alignment)
    let budgetClassScore = 0;
    const candStars = getStarRating(candTitle, pageCat);
    const candIsLuxury = candTitle.includes("لوکس") || (pageCat['برچسب_کلاسی_تور']?.includes("لوکس")) || candTitle.includes("لاکچری");
    const candIsCheap = candTitle.includes("ارزان") || (pageCat['برچسب_کلاسی_تور']?.includes("ارزان"));
    
    if (sourceIsCheap) {
      if (candStars === 3 || candIsCheap) {
        budgetClassScore += 20;
      } else if (candStars === 5 || candIsLuxury) {
        budgetClassScore -= 50;
      }
    } else if (sourceIsLuxury) {
      if (candStars === 5 || candIsLuxury) {
        budgetClassScore += 20;
      } else if (candStars === 3 || candIsCheap) {
        budgetClassScore -= 50;
      }
    }
    
    // د) ماتریس جایگزینی هتل (Hotel Fallback)
    let hotelFallbackBonus = 0;
    if (sourceHasSpecificHotel && !isHotelMatch && hasSharedDest) {
      // بررسی اینکه آیا کاندیدا از نوع دسته‌بندی ستاره‌ای هتل‌های همان مقصد است
      const isStarCategoryCand = !candHotel && (candTitle.includes("هتل‌های") || candTitle.includes("ستاره") || !!pageCat['تعداد_ستاره_هتل']);
      const candHasSpecificHotel = !!candHotel || (candTitle.includes("هتل") && !isStarCategoryCand);
      
      if (isStarCategoryCand) {
        hotelFallbackBonus = 15;
      } else if (candHasSpecificHotel) {
        hotelFallbackBonus = 5;
      }
    }
    
    // هـ) ماتریس مبدأ در برابر لجستیک (Origin vs. Transport)
    // بر اساس قانون ۴: تطابق دقیق مبدأ (isOriginMatch) امتیاز ۵۰+ خود را کامل می‌گیرد.
    // تغییر وسیله نقلیه (هوایی، زمینی، قطار) هیچ جریمه‌ای در پی ندارد. بدین ترتیب سیستم،
    // "تور مشهد از اهواز هوایی" را بسیار بالاتر از "تور مشهد از تهران با قطار" برای کاربر اهوازی رتبه‌دهی می‌کند.
    
    // بونوس جزئی تشابه عنوان (Jaccard) سئو برای تفکیک بهتر در صورت تشابه کامل گزینه‌ها
    const similarity = titleSimilarity(sourcePage.title, page.title);
    const titleScoreBoost = similarity * 2; // حداکثر ۲ امتیاز تشویقی
    
    // ─── مرحله ۵: محاسبه نهایی و رتبه‌بندی (SUMMATION & SORTING) ───
    let totalScore = pillarBonus + baseFallbackScore + timeLogicBonus + geoExpansionBonus + budgetClassScore + hotelFallbackBonus + titleScoreBoost;
    
    if (totalScore <= 0) {
      totalScore = 0.05; // به هیچ وجه فیزیکی حذف نمی‌شوند بلکه رتبه پایین می‌گیرند
    }
    totalScore = parseFloat(totalScore.toFixed(2));
    
    const matched = getMatchedTags(sourceCat, pageCat);
    candidates.push({
      page_id: page.id!,
      title: page.title,
      score: totalScore,
      matched_tags: matched,
      matchedTags: matched,
      origin_bonus: isOriginMatch ? 50 : 0,
      destination_bonus: hasSharedDest ? 100 : 0,
      categories: pageCat
    });
  }
  
  // ردیابی و مرتب‌سازی نزولی کاندیداها
  candidates.sort((a, b) => b.score - a.score);
  
  return candidates;
}

/**
 * تابع ۶: محاسبه کاندیداها برای همه صفحات با امضای سازگار
 */
export function computeAllCandidates(
  pages: any[], 
  weights: Record<string, number>, 
  arg3: any, // سازگاری با idfMap یا مستقیم mode
  arg4?: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();
  
  let mode: 'linear' | 'weighted' = 'linear';
  let idfMap: any = null;

  if (typeof arg3 === 'string') {
    mode = arg3 as 'linear' | 'weighted';
  } else {
    idfMap = arg3;
    mode = arg4 || 'linear';
  }
  
  for (const page of pages) {
    const candidates = findTopCandidates(page, pages, weights, idfMap, mode);
    map.set(page.id!, candidates);
  }
  
  return map;
}
