import { PARTIAL_MATCH_COEFFICIENTS, isNeighborMonth, isNeighborSeason } from '../constants/timeNeighbors';
import { titleSimilarity, TITLE_SIMILARITY_WEIGHT } from './titleSimilarity';
import { type IDFMap, getIDF } from './idfCalculator';

// ساختار خروجی هر کاندیدا
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matchedTags: string[];
  matched_tags: string[];       // رونوشت برای سازگاری کامل با بخش‌های دیگر سیستم
  candidate_all_tags: string[];  // نام تمام تگ‌های غیرخالی کاندیدا
  scoreDetails?: {
    tagScore: number;
    jaccardScore: number;
    titleScore: number;
  };
}

// نوع categories
type CategoriesMap = Record<string, string | null>;

// فیلدهایی که Partial Match دارند
const MONTH_FIELD = 'ماه_تقویمی_برگزاری';
const SEASON_FIELD = 'فصل_برگزاری';

// محاسبه امتیاز یک جفت صفحه
export function computeAdvancedScore(
  sourceCat: CategoriesMap,
  candidateCat: CategoriesMap,
  sourceTitle: string,
  candidateTitle: string,
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): { score: number; matchedTags: string[]; details: Required<CandidateWithTags>['scoreDetails'] } {
  
  let tagScore = 0;
  const matchedTags: string[] = [];
  
  // شمارش فیلدهای غیرnull برای Jaccard
  const sourceNonNullFields: string[] = [];
  const candidateNonNullFields: string[] = [];
  let exactMatchCount = 0;
  
  // ۱. امتیاز تگ‌ها با IDF و Partial Match
  for (const field of Object.keys(sourceCat)) {
    const srcVal = sourceCat[field];
    const candVal = candidateCat[field];
    
    // شمارش فیلدهای غیرnull
    if (srcVal !== null && srcVal !== undefined && srcVal !== '') {
      sourceNonNullFields.push(field);
    }
    if (candVal !== null && candVal !== undefined && candVal !== '') {
      candidateNonNullFields.push(field);
    }
    
    // اگر یکی null بود، skip
    if (
      srcVal === null || srcVal === undefined || srcVal === '' ||
      candVal === null || candVal === undefined || candVal === ''
    ) {
      continue;
    }
    
    const baseWeight = mode === 'linear' ? 1 : (weights[field] ?? 1);
    const idf = getIDF(idfMap, field, srcVal);
    
    // تطابق دقیق
    if (srcVal === candVal) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.EXACT;
      matchedTags.push(field);
      exactMatchCount++;
    }
    // Partial Match برای ماه
    else if (field === MONTH_FIELD && isNeighborMonth(srcVal, candVal)) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.NEIGHBOR_MONTH;
      matchedTags.push(`${field}(مجاور)`);
    }
    // Partial Match برای فصل
    else if (field === SEASON_FIELD && isNeighborSeason(srcVal, candVal)) {
      tagScore += baseWeight * idf * PARTIAL_MATCH_COEFFICIENTS.NEIGHBOR_SEASON;
      matchedTags.push(`${field}(مجاور)`);
    }
  }
  
  // ۲. Jaccard Bidirectional
  const union = new Set([...sourceNonNullFields, ...candidateNonNullFields]).size;
  const jaccardScore = union > 0 ? (exactMatchCount / union) * 10 : 0;
  
  // ۳. Title Similarity
  const titleScore = titleSimilarity(sourceTitle, candidateTitle) * TITLE_SIMILARITY_WEIGHT;
  
  // ۴. امتیاز نهایی
  const finalScore = tagScore + jaccardScore + titleScore;
  
  return {
    score: Math.round(finalScore * 100) / 100,
    matchedTags,
    details: {
      tagScore: Math.round(tagScore * 100) / 100,
      jaccardScore: Math.round(jaccardScore * 100) / 100,
      titleScore: Math.round(titleScore * 100) / 100
    }
  };
}

// پیدا کردن بهترین کاندیداها برای یک صفحه
export function findTopCandidates(
  sourcePage: { id: number; title: string; categories: string },
  allPages: { id: number; title: string; categories: string }[],
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): CandidateWithTags[] {
  
  let sourceCat: CategoriesMap = {};
  try {
    sourceCat = JSON.parse(sourcePage.categories);
  } catch {
    // fallback
  }
  
  return allPages
    // خود صفحه را حذف کن
    .filter(p => p.id !== sourcePage.id)
    // امتیاز هر کاندیدا را حساب کن
    .map(p => {
      let pCat: CategoriesMap = {};
      try {
        pCat = JSON.parse(p.categories);
      } catch {
        // fallback
      }
      
      const { score, matchedTags, details } = computeAdvancedScore(
        sourceCat, pCat,
        sourcePage.title, p.title,
        weights, idfMap, mode
      );
      
      const candidateAllTags = Object.keys(pCat).filter(key => {
        const val = pCat[key];
        return val !== null && val !== undefined && val !== '';
      });
      
      return {
        page_id: p.id,
        title: p.title,
        score,
        matchedTags,
        matched_tags: matchedTags, // دابلیکیت برای سازگاری کامل
        candidate_all_tags: candidateAllTags,
        scoreDetails: details
      };
    })
    // فقط کسانی که امتیاز مثبت دارند
    .filter(c => c.score > 0)
    // مرتب‌سازی نزولی بر اساس امتیاز
    .sort((a, b) => b.score - a.score);
}

// محاسبه کاندیداها برای تمام صفحات
export function computeAllCandidates(
  pages: { id: number; title: string; categories: string }[],
  weights: Record<string, number>,
  idfMap: IDFMap,
  mode: 'linear' | 'weighted'
): Map<number, CandidateWithTags[]> {
  
  const map = new Map<number, CandidateWithTags[]>();
  
  for (const page of pages) {
    const candidates = findTopCandidates(page, pages, weights, idfMap, mode);
    map.set(page.id, candidates);
  }
  
  return map;
}
