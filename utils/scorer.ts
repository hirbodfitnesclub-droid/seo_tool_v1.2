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

/**
 * تابع ۵: پیدا کردن کاندیداها با منطق چندلایه
 * 
 * لایه ۱: فیلتر Hard فصلی/زمانی → حذف صفحات نامعتبر
 * لایه ۲: امتیاز پایه → وزن تگ‌های مشترک
 * لایه ۳: بونوس‌ها → مبدا و مقصد
 * لایه ۴: مرتب‌سازی → بر اساس امتیاز کل
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
  
  const candidates: CandidateWithTags[] = [];
  
  for (const page of allPages) {
    // اسکیپ خود صفحه
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
    
    // لایه ۱: فیلتر Hard فصلی/زمانی
    if (!isValidSeasonalMatch(sourceCat, pageCat)) {
      continue; // حذف کامل
    }
    
    // لایه ۲: امتیاز پایه
    const baseScore = computeBaseScore(sourceCat, pageCat, weights, mode);
    
    // لایه ۳: بونوس‌ها
    const { originBonus, destinationBonus } = calculateBonuses(sourceCat, pageCat);
    
    // لایه ۳.۵: بونوس تشابه متنی عنوان (Jaccard) برای دقت سئویی نهایی
    const similarity = titleSimilarity(sourcePage.title, page.title);
    const titleScoreBoost = similarity * 4; // حداکثر ۴ امتیاز تشویقی برای عناوین بسیار مشابه
    
    // لایه ۳.۷: جریمه‌های زمانی برای اولویت ماه‌های گذشته و چرخه‌های قبلی
    const temporalPenalty = computeTemporalPenalty(sourceCat, pageCat);
    
    // امتیاز نهایی = پایه + بونوس زمان/مکان + بونوس تشابه عنوان - جریمه‌های زمانی
    let totalScore = baseScore + originBonus + destinationBonus + titleScoreBoost - temporalPenalty;
    if (totalScore <= 0) {
      totalScore = 0.05; // به هیچ وجه فیزیکی حذف نمی‌شوند بلکه اولویت فوق‌العاده اندکی می‌گیرند
    }
    totalScore = parseFloat(totalScore.toFixed(2));
    
    // فقط صفحات با تطابق مثبت و مجاز محتوایی
    if (totalScore > 0) {
      const matched = getMatchedTags(sourceCat, pageCat);
      candidates.push({
        page_id: page.id!,
        title: page.title,
        score: totalScore,
        matched_tags: matched,
        matchedTags: matched,
        origin_bonus: originBonus,
        destination_bonus: destinationBonus,
        categories: pageCat
      });
    }
  }
  
  // لایه ۴: مرتب‌سازی نهایی
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
