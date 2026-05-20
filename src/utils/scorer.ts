import { Page } from '../db';
import { safeJsonParse } from './safeJson';

export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;           // امتیاز ۱-۱۰ (با یک رقم اعشار)
  matched_tags: string[];  // نام تگ‌های مشترک
  matched_count: number;   // تعداد تگ‌های مشترک
  rank?: number;           // رتبه براساس اولویت و امتیاز (1, 2, 3...)
}

/**
 * محاسبه امتیاز نرمالایز شده ۱-۱۰ بین کاندیدا و منبع
 */
export function computeNormalizedScore(
  sourceCategories: Record<string, string | null>,
  candidateCategories: Record<string, string | null>,
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): { score: number; matchedTags: string[]; matchedCount: number } {
  
  const matchedTags: string[] = [];
  
  // یافتن تگ‌های مشترک
  Object.keys(sourceCategories).forEach(key => {
    const sourceVal = sourceCategories[key];
    const candidateVal = candidateCategories[key];
    if (
      sourceVal !== null && sourceVal !== undefined && sourceVal !== '' &&
      candidateVal !== null && candidateVal !== undefined && candidateVal !== '' &&
      sourceVal === candidateVal
    ) {
      matchedTags.push(key);
    }
  });
  
  const matchedCount = matchedTags.length;
  
  // شمارش تگ‌های غیرنال صفحه منبع
  const nonNullSourceTags = Object.keys(sourceCategories).filter(key => {
    const val = sourceCategories[key];
    return val !== null && val !== undefined && val !== '';
  }).length;
  
  let score = 0;
  
  if (mode === 'linear') {
    // خطی: نسبت ساده تگ‌های مشترک به کل تگ‌های غیرنال صفحه منبع ضربدر ۱۰
    score = (matchedCount / Math.max(nonNullSourceTags, 1)) * 10;
  } else {
    // وزن‌دار: مجموع وزن‌های مشترک / مجموع وزن‌های صفحه منبع ضربدر ۱۰
    let matchedWeight = 0;
    let totalWeight = 0;
    
    matchedTags.forEach(tag => {
      matchedWeight += weights[tag] ?? 1;
    });
    
    Object.keys(sourceCategories).forEach(key => {
      const val = sourceCategories[key];
      if (val !== null && val !== undefined && val !== '') {
        totalWeight += weights[key] ?? 1;
      }
    });
    
    score = (matchedWeight / Math.max(totalWeight, 1)) * 10;
  }
  
  if (score > 0 && score < 1.0) {
    score = 1.0;
  }
  
  // گرد کردن به یک رقم اعشار
  score = Math.round(score * 10) / 10;
  
  return { score, matchedTags, matchedCount };
}

export function findTopCandidates(
  sourcePage: Page,
  allPages: Page[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): CandidateWithTags[] {
  const sourceCat: Record<string, string | null> = safeJsonParse(sourcePage.categories, {});
  
  const sortedCandidates = allPages
    .filter(p => p.id !== sourcePage.id)
    .map(p => {
      const pCat: Record<string, string | null> = safeJsonParse(p.categories, {});
      const { score, matchedTags, matchedCount } = computeNormalizedScore(sourceCat, pCat, weights, mode);
      return {
        page_id: p.id!,
        title: p.title,
        score,
        matched_tags: matchedTags,
        matched_count: matchedCount
      };
    })
    .filter(c => c.score >= 1.0) // فیلتر: فقط کاندیداهایی که امتیاز حداقل ۱ دارند
    .sort((a, b) => {
      // مرتب‌سازی: اول بر اساس امتیاز نزولی، سپس بر اساس تعداد تگ‌های مشترک نزولی
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.matched_count - a.matched_count;
    });

  // شماره‌گذاری ترتیبی ۱، ۲، ۳... براساس رتبه و اولویت
  return sortedCandidates.map((c, index) => ({
    ...c,
    rank: index + 1
  }));
}

export function computeAllCandidates(
  pages: Page[],
  weights: Record<string, number>,
  mode: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();
  
  pages.forEach(p => {
    map.set(p.id!, findTopCandidates(p, pages, weights, mode));
  });
  
  return map;
}
