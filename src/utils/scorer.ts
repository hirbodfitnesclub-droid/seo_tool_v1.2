import { PERSIAN_MONTHS_ORDER } from '../constants/categories';

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
  matchedTags: string[];
  origin_bonus: number;
  destination_bonus: number;
  categories?: any;
}

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];

// دسته‌های کلی (ترکیب کلاس تور و وسیله نقلیه)
const GENERAL_KEYWORDS = ['ارزان', 'لوکس', 'قطار', 'اتوبوس', 'هوایی', 'زمینی', 'لحظه آخری'];
const TRANSPORT_KEYWORDS = ['هوایی', 'قطار', 'اتوبوس', 'کشتی', 'زمینی'];

// حداکثر تئوری (بدون احتساب صفحات مادر) حدود ۵۰۰ است.
const LOG_NORMALIZER = Math.log1p(500);

export function normalizeMonth(month: string): string {
  if (!month) return month;
  if (month === 'نوروز' || month === 'نوروزی') return 'فروردین';
  return month;
}

// ──────────────────────────────────────────────
// توابع استخراج از H1
// ──────────────────────────────────────────────

function extractMonthFromTitle(title: string): string | null {
  if (!title) return null;
  if (title.includes('نوروز') || title.includes('نوروزی')) return 'فروردین';
  for (const m of PERSIAN_MONTHS_ORDER) {
    if (title.includes(m)) return m;
  }
  return null;
}

function extractSeasonFromTitle(title: string): string | null {
  if (!title) return null;
  for (const s of SEASONS_ORDER) {
    if (title.includes(s)) return s;
  }
  return null;
}

function extractTransportFromTitle(title: string): string | null {
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

function extractHotelStarFromTitle(title: string): number | null {
  if (!title) return null;
  const match = title.match(/(\d+)\s*ستاره/);
  return match ? parseInt(match[1]) : null;
}

function hasOriginInTitle(title: string): boolean {
  if (!title) return false;
  return title.includes(' از ');
}

function getMonthSeasonIdx(monthIdx: number): number {
  return Math.floor(monthIdx / 3);
}

function isLastMonthOfSeason(monthIdx: number): boolean {
  return monthIdx % 3 === 2;
}

function normalizeScore(raw: number): number {
  return parseFloat(Math.min(10, (Math.log1p(raw) / LOG_NORMALIZER) * 10).toFixed(2));
}

// ──────────────────────────────────────────────
// الگوریتم امتیازدهی اصلی (موتور سئو)
// ──────────────────────────────────────────────

function calculateScore(
  sourcePage: any, sourceCat: any,
  targetPage: any, targetCat: any
): { score: number; matchedTags: string[]; originBonus: number; destinationBonus: number } {
  let score = 1.0;
  const matchedTags: string[] = [];
  let originBonus = 0;
  let destinationBonus = 0;

  const sTitle = sourcePage.title || '';
  const tTitle = targetPage.title || '';

  // بررسی اینکه آیا تارگت کلمات جادویی را دارد یا نه
  const tgtGenerals = extractGeneralKeywords(tTitle);
  const isTgtGeneral = tgtGenerals.length > 0;

  // ۱. جهت منطقه
  const srcRegion = sourceCat['جهت_در_منطقه'];
  const tgtRegion = targetCat['جهت_در_منطقه'];
  if (srcRegion) {
    if (tgtRegion && srcRegion === tgtRegion) {
      score *= 1.5;
      matchedTags.push('جهت_در_منطقه');
    } else {
      score *= 0.8;
    }
  }

  // ۲. دسته‌های کلی (پاداش ۱.۵ قطعی برای تارگت‌های دارای کلمات خاص)
  if (isTgtGeneral) {
    score *= 1.5;
    matchedTags.push('دسته_های_کلی');
  }

  // ۳. مقصد
  const srcCity = sourceCat['شهر_یا_جزیره_مقصد']?.trim();
  const tgtCity = targetCat['شهر_یا_جزیره_مقصد']?.trim();
  const srcCountry = sourceCat['کشور_مقصد']?.trim();
  const tgtCountry = targetCat['کشور_مقصد']?.trim();
  const srcHasDest = !!(srcCity || srcCountry);
  const tgtHasDest = !!(tgtCity || tgtCountry);

  let isExactDest = false; // 🔴 پرچم برای تشخیص مقصد دقیقاً یکسان

  if (srcHasDest) {
    if (tgtHasDest) {
      if (srcCity && tgtCity && srcCity === tgtCity) {
        score *= 2.0; destinationBonus = 5; matchedTags.push('شهر_یا_جزیره_مقصد');
        isExactDest = true; // شهر یکی است
      } else if (srcCountry && tgtCountry && srcCountry === tgtCountry) {
        score *= 0.5; matchedTags.push('هم_کشور');
        if (!srcCity && !tgtCity) {
          isExactDest = true; // هیچکدام شهر ندارند ولی کشور یکی است
        }
      } else {
        score *= 0.4;
      }
    } else {
      score *= 0.4;
    }
  }

  // ۴. حمل‌ونقل 
  const srcTransport = extractTransportFromTitle(sTitle);
  if (srcTransport) {
    const tgtTransport = extractTransportFromTitle(tTitle);
    if (tgtTransport) {
      if (srcTransport === tgtTransport) {
        score *= 2.0; matchedTags.push('نوع_وسیله_نقلیه');
      } else {
        score *= 0.75;
      }
    } else {
      score *= 0.75;
    }
  }

  // ۵ و ۶. زمان (ماه و فصل)
  const sMonth = extractMonthFromTitle(sTitle);
  const tMonth = extractMonthFromTitle(tTitle);
  const sSeason = extractSeasonFromTitle(sTitle);
  const tSeason = extractSeasonFromTitle(tTitle);

  const sMonthIdx = sMonth ? PERSIAN_MONTHS_ORDER.indexOf(sMonth) : -1;
  const tMonthIdx = tMonth ? PERSIAN_MONTHS_ORDER.indexOf(tMonth) : -1;

  let timeMulti = 1.0;

  if (sMonthIdx !== -1) {
    if (tMonthIdx !== -1) {
      if (sMonthIdx === tMonthIdx) { 
        timeMulti = 3.0; matchedTags.push('ماه_تقویمی_برگزاری'); 
      } else {
        const sSzn = getMonthSeasonIdx(sMonthIdx);
        const tSzn = getMonthSeasonIdx(tMonthIdx);
        if (sSzn === tSzn) { 
          timeMulti = 2.0; matchedTags.push('فصل_برگزاری'); 
        } else if (tSzn === (sSzn + 1) % 4) { 
          timeMulti = isLastMonthOfSeason(sMonthIdx) ? 1.8 : 0.1; 
        } else { 
          timeMulti = 0.1; 
        }
      }
    } else if (tSeason) {
      const sSzn = getMonthSeasonIdx(sMonthIdx);
      const tSzn = SEASONS_ORDER.indexOf(tSeason);
      if (sSzn === tSzn) { 
        timeMulti = 2.0; matchedTags.push('فصل_برگزاری'); 
      } else if (tSzn === (sSzn + 1) % 4) { 
        timeMulti = isLastMonthOfSeason(sMonthIdx) ? 1.8 : 0.1; 
      } else { 
        timeMulti = 0.1; 
      }
    } else { 
      // 🔴 نجات فقط برای دسته‌های کلی که دقیقاً همان مقصد را دارند
      timeMulti = (isTgtGeneral && isExactDest) ? 0.9 : 0.1; 
    }
  } else if (sSeason) {
    const sSzn = SEASONS_ORDER.indexOf(sSeason);
    if (tMonthIdx !== -1) {
      const tSzn = getMonthSeasonIdx(tMonthIdx);
      if (sSzn === tSzn) { 
        timeMulti = 2.5; matchedTags.push('فصل_برگزاری'); 
      } else if (tSzn === (sSzn + 1) % 4) { 
        timeMulti = 1.2; 
      } else { 
        timeMulti = 0.1; 
      }
    } else if (tSeason) {
      const tSzn = SEASONS_ORDER.indexOf(tSeason);
      if (sSzn === tSzn) { 
        timeMulti = 3.0; matchedTags.push('فصل_برگزاری'); 
      } else if (tSzn === (sSzn + 1) % 4) { 
        timeMulti = 1.2; 
      } else { 
        timeMulti = 0.1; 
      }
    } else { 
      // 🔴 نجات فقط برای دسته‌های کلی که دقیقاً همان مقصد را دارند
      timeMulti = (isTgtGeneral && isExactDest) ? 0.9 : 0.1; 
    }
  } else {
    if (tMonthIdx !== -1 || tSeason) { 
      timeMulti = 0.8; 
    }
  }
  score *= timeMulti;

  // ۷. نوع سفر/تور
  const sType = sourceCat['نوع_سفر'] || sourceCat['نوع_تور'];
  const tType = targetCat['نوع_سفر'] || targetCat['نوع_تور'];
  if (sType) {
    if (tType) {
      if (sType === tType) {
        score *= 1.5; matchedTags.push(sourceCat['نوع_سفر'] ? 'نوع_سفر' : 'نوع_تور');
      } else { score *= 0.8; }
    } else { score *= 0.8; }
  }

  // ۸. برچسب کلاس تور
  const sClass = sourceCat['برچسب_کلاسی_تور'];
  const tClass = targetCat['برچسب_کلاسی_تور'];
  if (sClass) {
    if (tClass) {
      if (sClass === tClass) {
        score *= 2.0; matchedTags.push('برچسب_کلاسی_تور');
      } else { score *= 0.75; }
    } else { score *= 0.75; }
  }

  // ۹. ستاره هتل
  const sStarH1 = extractHotelStarFromTitle(sTitle);
  const tStarH1 = extractHotelStarFromTitle(tTitle);
  const sStarCat = sourceCat['تعداد_ستاره_هتل'];
  const tStarCat = targetCat['تعداد_ستاره_هتل'];
  
  const sNum = sStarH1 || parseInt(String(sStarCat).match(/(\d+)/)?.[1] || '0');
  const tNum = tStarH1 || parseInt(String(tStarCat).match(/(\d+)/)?.[1] || '0');

  if (sNum) {
    if (tNum) {
      const diff = Math.abs(sNum - tNum);
      if (diff === 0) { score *= 1.8; matchedTags.push('تعداد_ستاره_هتل'); }
      else if (diff === 1) score *= 1.1;
      else score *= 0.75;
    } else { score *= 0.75; }
  }

  // ۱۰. مبدا
  const srcHasOrigin = hasOriginInTitle(sTitle);
  const tgtHasOrigin = hasOriginInTitle(tTitle);

  if (srcHasOrigin) {
    if (tgtHasOrigin) {
      const srcOrigVal = sourceCat['شهر_یا_استان_مبدا'];
      const tgtOrigVal = targetCat['شهر_یا_استان_مبدا'];
      if (srcOrigVal && tgtOrigVal && srcOrigVal === tgtOrigVal) {
        score *= 3.0; originBonus = 10; matchedTags.push('شهر_یا_استان_مبدا');
      } else {
        score *= 0.3;
      }
    } else {
      score *= 0.3; 
    }
  }

  // ──────────────────────────────────────────────
  // 👑 ضریب مگا (God Multiplier) برای صفحات مادر
  // ──────────────────────────────────────────────
  const tTitleClean = tTitle.trim();
  
  if (srcCity && tTitleClean === `تور ${srcCity}`) {
    score *= 10000;
    matchedTags.push('صفحه_مادر_شهر');
  } else if (srcCountry && tTitleClean === `تور ${srcCountry}`) {
    score *= 5000;
    matchedTags.push('صفحه_مادر_کشور');
  }

  return { score, matchedTags, originBonus, destinationBonus };
}

// ──────────────────────────────────────────────
// توابع عمومی
// ──────────────────────────────────────────────

export function findTopCandidates(
  sourcePage: any,
  allPages: any[],
  ...args: any[]
): CandidateWithTags[] {
  let sourceCat: any = {};
  if (typeof sourcePage.categories === 'string') {
    try { sourceCat = JSON.parse(sourcePage.categories); } catch { sourceCat = {}; }
  } else {
    sourceCat = sourcePage.categories || {};
  }

  const candidates: CandidateWithTags[] = [];

  for (const page of allPages) {
    if (page.id === sourcePage.id) continue;

    let pageCat: any = {};
    if (typeof page.categories === 'string') {
      try { pageCat = JSON.parse(page.categories); } catch { pageCat = {}; }
    } else {
      pageCat = page.categories || {};
    }

    const { score, matchedTags, originBonus, destinationBonus } = calculateScore(
      sourcePage, sourceCat, page, pageCat
    );

    candidates.push({
      page_id: page.id!,
      title: page.title,
      score: normalizeScore(score),
      matched_tags: matchedTags,
      matchedTags,
      origin_bonus: originBonus,
      destination_bonus: destinationBonus,
      categories: pageCat
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function computeAllCandidates(
  pages: any[],
  ...args: any[]
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();
  for (const page of pages) {
    const candidates = findTopCandidates(page, pages);
    map.set(page.id!, candidates);
  }
  return map;
}