import { safeJsonParse } from '../../utils/safeJson';

export interface PageLike {
  categories: string;
}

// ساختار خروجی IDF: هر فیلد → هر مقدار → امتیاز IDF
export type IDFMap = Record<string, Record<string, number>>;

// محاسبه IDF برای تمام صفحات یک پروژه
export function computeIDFMap(pages: PageLike[]): IDFMap {
  const totalPages = pages.length;
  
  // شمارش تعداد صفحات برای هر مقدار هر فیلد
  // ساختار: { field: { value: count } }
  const valueCounts: Record<string, Record<string, number>> = {};
  
  // مرحله ۱: شمارش
  for (const page of pages) {
    const categories = safeJsonParse<Record<string, string | null>>(page.categories, {});
    
    for (const [field, value] of Object.entries(categories)) {
      if (value === null || value === undefined || value === '') continue;
      
      if (!valueCounts[field]) {
        valueCounts[field] = {};
      }
      
      if (!valueCounts[field][value]) {
        valueCounts[field][value] = 0;
      }
      
      valueCounts[field][value]++;
    }
  }
  
  // مرحله ۲: محاسبه IDF
  const idfMap: IDFMap = {};
  
  for (const [field, values] of Object.entries(valueCounts)) {
    idfMap[field] = {};
    
    for (const [value, count] of Object.entries(values)) {
      // فرمول IDF با smoothing برای جلوگیری از صفر شدن یا مقادیر منفی غیرمنطقی
      // IDF = log(totalPages / (count + 1))
      // بخش Math.max برای تضمین همیشگی مثبت بودن یا معتبر بودن مقدار
      const idfValue = Math.max(0.1, Math.log(totalPages / (count + 1)));
      idfMap[field][value] = idfValue;
    }
  }
  
  return idfMap;
}

// گرفتن IDF یک مقدار خاص (با fallback به ۱)
export function getIDF(idfMap: IDFMap, field: string, value: string): number {
  if (!idfMap || !field || !value) return 1;
  return idfMap[field]?.[value] ?? 1;
}
