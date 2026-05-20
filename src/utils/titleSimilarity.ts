// کلمات بی‌معنی که از مقایسه حذف می‌شوند
const STOP_WORDS = new Set([
  'تور', 'به', 'از', 'در', 'با', 'و', 'یا', 'که', 'را', 'این', 'آن', 'برای'
]);

// نرمال‌سازی عنوان
function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    // حذف اعداد فارسی و انگلیسی
    .replace(/[۰-۹0-9]/g, '')
    // حذف علائم نگارشی
    .replace(/[،؛:!؟.\-_«»()]/g, ' ')
    // حذف فاصله‌های اضافی
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// استخراج کلمات معنادار
function extractWords(title: string): Set<string> {
  const normalized = normalizeTitle(title);
  if (!normalized) return new Set();
  const words = normalized.split(' ').filter(w => 
    w.length > 1 && !STOP_WORDS.has(w)
  );
  return new Set(words);
}

// محاسبه شباهت Jaccard بین دو عنوان
export function titleSimilarity(titleA: string, titleB: string): number {
  if (!titleA || !titleB) return 0;
  const wordsA = extractWords(titleA);
  const wordsB = extractWords(titleB);
  
  // اگر یکی از دو مجموعه خالی بود
  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }
  
  // محاسبه اشتراک
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  
  // محاسبه اجتماع
  const union = new Set([...wordsA, ...wordsB]).size;
  
  // Jaccard
  return union > 0 ? intersection / union : 0;
}

// وزن ثابت برای اضافه شدن به امتیاز نهایی
export const TITLE_SIMILARITY_WEIGHT = 1.5;
