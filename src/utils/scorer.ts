import { PERSIAN_MONTHS_ORDER } from '../constants/categories';

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];
  matchedTags: string[]; // رونوشت برای همخوانی کامل با بخش‌های دیگر پروژه
  origin_bonus: number;
  destination_bonus: number;
  categories?: any;
}

const SEASONS_ORDER = ['بهار', 'تابستان', 'پاییز', 'زمستان'];

export function normalizeMonth(month: string): string {
  if (!month) return month;
  if (month === 'نوروز') return 'فروردین';
  return month;
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
    
    const { score, matchedTags } = calculateMultiplierScore(sourcePage, sourceCat, page, pageCat);
    
    candidates.push({
      page_id: page.id!,
      title: page.title,
      score: parseFloat(score.toFixed(3)),
      matched_tags: matchedTags,
      matchedTags: matchedTags,
      origin_bonus: 0,
      destination_bonus: 0,
      categories: pageCat
    });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function calculateMultiplierScore(sourcePage: any, sourceCat: any, targetPage: any, targetCat: any): {score: number, matchedTags: string[]} {
    let score = 1.0;
    const matchedTags: string[] = [];

    const matchTag = (key: string) => {
      if (sourceCat[key] && targetCat[key] && sourceCat[key] === targetCat[key]) {
        matchedTags.push(key);
      }
    };

    // 1. جهت منطقه
    const srcRegion = sourceCat['جهت_در_منطقه'];
    const tgtRegion = targetCat['جهت_در_منطقه'];
    if (!srcRegion && tgtRegion) {
        score *= 1.0; 
    } else if (srcRegion && !tgtRegion) {
        score *= 0.8;
    } else if (srcRegion && tgtRegion) {
        if (srcRegion === tgtRegion) { score *= 1.5; matchTag('جهت_در_منطقه'); }
        else { score *= 0.8; }
    }

    // 2. دسته های کلی
    const generalKeywords = ['ارزان', 'لوکس', 'قطار', 'اتوبوس', 'هوایی', 'لحظه آخری'];
    const sTitle = sourcePage.title || '';
    const tTitle = targetPage.title || '';
    let hasMatchedGeneral = false;
    for (const word of generalKeywords) {
        if (sTitle.includes(word) && tTitle.includes(word)) {
            hasMatchedGeneral = true;
            break;
        }
    }
    if (hasMatchedGeneral) {
        score *= 1.5;
        matchedTags.push('دسته_های_کلی');
    }

    // 3. مقصد
    const srcDestCity = sourceCat['شهر_یا_جزیره_مقصد'];
    const tgtDestCity = targetCat['شهر_یا_جزیره_مقصد'];
    const srcDestCountry = sourceCat['کشور_مقصد'];
    const tgtDestCountry = targetCat['کشور_مقصد'];
    
    const sDest = srcDestCity || srcDestCountry;
    const tDest = tgtDestCity || tgtDestCountry;

    if (!sDest && tDest) {
        score *= 1.0;
    } else if (sDest && !tDest) {
        score *= 0.7;
    } else if (sDest && tDest) {
        let isDestMatch = false;
        if (srcDestCity && tgtDestCity && srcDestCity === tgtDestCity) {
            isDestMatch = true;
        } else if (!srcDestCity && !tgtDestCity && srcDestCountry && tgtDestCountry && srcDestCountry === tgtDestCountry) {
            isDestMatch = true;
        }
        
        if (isDestMatch) {
            score *= 2.0;
            if (srcDestCity) matchTag('شهر_یا_جزیره_مقصد');
            if (srcDestCountry) matchTag('کشور_مقصد');
        } else {
            score *= 0.7;
        }
    }

    // 4. حمل و نقل
    const sTrans = sourceCat['نوع_وسیله_نقلیه'];
    const tTrans = targetCat['نوع_وسیله_نقلیه'];
    if (!sTrans && tTrans) {
        score *= 1.0;
    } else if (sTrans && !tTrans) {
        score *= 0.75;
    } else if (sTrans && tTrans) {
        if (sTrans === tTrans) { score *= 2.0; matchTag('نوع_وسیله_نقلیه'); }
        else { score *= 0.75; }
    }

    // 5. ماه و 6. فصل
    const sMonthRaw = sourceCat['ماه_تقویمی_برگزاری'];
    const tMonthRaw = targetCat['ماه_تقویمی_برگزاری'];
    const sSeasonRaw = sourceCat['فصل_برگزاری'];
    const tSeasonRaw = targetCat['فصل_برگزاری'];

    const sMonth = sMonthRaw ? normalizeMonth(sMonthRaw) : null;
    const tMonth = tMonthRaw ? normalizeMonth(tMonthRaw) : null;
    const sMonthIdx = sMonth ? PERSIAN_MONTHS_ORDER.indexOf(sMonth) : -1;
    const tMonthIdx = tMonth ? PERSIAN_MONTHS_ORDER.indexOf(tMonth) : -1;

    let timeMulti = 1.0;

    if (sMonthIdx !== -1) {
        if (tMonthIdx !== -1) {
            if (sMonthIdx === tMonthIdx) {
                timeMulti *= 3;
                matchTag('ماه_تقویمی_برگزاری');
            } else {
                const sSeasonIdx = Math.floor(sMonthIdx / 3);
                const tSeasonIdx = Math.floor(tMonthIdx / 3);
                if (sSeasonIdx === tSeasonIdx) {
                    timeMulti *= 2; 
                } else if (tSeasonIdx === ((sSeasonIdx + 1) % 4)) {
                    const isLateMonth = (sMonthIdx % 3 === 2);
                    if (isLateMonth) timeMulti *= 1.8;
                    else timeMulti *= 0.8;
                } else {
                    timeMulti *= 0.2;
                }
            }
        } else if (tSeasonRaw) {
            const sSeasonIdx = Math.floor(sMonthIdx / 3);
            const tSeasonIdx = SEASONS_ORDER.indexOf(tSeasonRaw);
            if (sSeasonIdx === tSeasonIdx) {
                timeMulti *= 2;
            } else if (tSeasonIdx === ((sSeasonIdx + 1) % 4)) {
                const isLateMonth = (sMonthIdx % 3 === 2);
                if (isLateMonth) timeMulti *= 1.8;
                else timeMulti *= 0.8;
            } else {
                timeMulti *= 0.2;
            }
        } else {
            timeMulti *= 0.2;
        }
    } else if (sSeasonRaw) {
        const sSeasonIdx = SEASONS_ORDER.indexOf(sSeasonRaw);
        if (tMonthIdx !== -1) {
            const tSeasonIdx = Math.floor(tMonthIdx / 3);
            if (sSeasonIdx === tSeasonIdx) {
                timeMulti *= 2.5; 
            } else if (tSeasonIdx === ((sSeasonIdx + 1) % 4)) {
                timeMulti *= 2; 
            } else {
                timeMulti *= 0.2;
            }
        } else if (tSeasonRaw) {
            const tSeasonIdx = SEASONS_ORDER.indexOf(tSeasonRaw);
            if (sSeasonIdx === tSeasonIdx) {
                timeMulti *= 3; 
                matchTag('فصل_برگزاری');
            } else if (tSeasonIdx === ((sSeasonIdx + 1) % 4)) {
                timeMulti *= 2; 
            } else {
                timeMulti *= 0.2;
            }
        } else {
            timeMulti *= 0.2;
        }
    } else {
        if (tMonthIdx !== -1 || tSeasonRaw) {
            timeMulti *= 0.2;
        }
    }
    score *= timeMulti;

    // 7. نوع سفر
    const sType = sourceCat['نوع_سفر'] || sourceCat['نوع_تور'];
    const tType = targetCat['نوع_سفر'] || targetCat['نوع_تور'];
    if (!sType && tType) {
        score *= 1.0;
    } else if (sType && !tType) {
        score *= 0.8;
    } else if (sType && tType) {
        if (sType === tType) { score *= 1.5; matchTag(sourceCat['نوع_سفر'] ? 'نوع_سفر' : 'نوع_تور'); }
        else score *= 0.8;
    }

    // 8. برچسب کلاس تور
    const sClass = sourceCat['برچسب_کلاسی_تور'];
    const tClass = targetCat['برچسب_کلاسی_تور'];
    if (!sClass && tClass) {
        score *= 1.0;
    } else if (sClass && !tClass) {
        score *= 0.75;
    } else if (sClass && tClass) {
        if (sClass === tClass) { score *= 2.0; matchTag('برچسب_کلاسی_تور'); }
        else { score *= 0.75; }
    }

    // 9. ستاره هتل
    const sStar = sourceCat['تعداد_ستاره_هتل'];
    const tStar = targetCat['تعداد_ستاره_هتل'];
    if (!sStar && tStar) {
        score *= 1.0;
    } else if (sStar && !tStar) {
        score *= 0.75;
    } else if (sStar && tStar) {
        const sMatch = String(sStar).match(/(\d+)/);
        const tMatch = String(tStar).match(/(\d+)/);
        if (sMatch && tMatch) {
            const sInt = parseInt(sMatch[1]);
            const tInt = parseInt(tMatch[1]);
            const diff = Math.abs(sInt - tInt);
            if (diff === 0) { score *= 1.8; matchTag('تعداد_ستاره_هتل'); }
            else if (diff === 1) score *= 1.1;
            else score *= 0.75; 
        } else {
            if (sStar === tStar) { score *= 1.8; matchTag('تعداد_ستاره_هتل'); }
            else score *= 0.75;
        }
    }

    // 10. مبدا
    const sOrig = sourceCat['شهر_یا_استان_مبدا'];
    const tOrig = targetCat['شهر_یا_استان_مبدا'];
    if (!sOrig && tOrig) {
        score *= 1.0;
    } else if (sOrig && !tOrig) {
        score *= 0.5;
    } else if (sOrig && tOrig) {
        if (sOrig === tOrig) { score *= 3.0; matchTag('شهر_یا_استان_مبدا'); }
        else { score *= 0.5; }
    }

    return { score, matchedTags };
}

