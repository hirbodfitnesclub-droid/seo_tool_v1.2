// نگاشت ماه‌های شمسی و همسایه‌هایشان
export const MONTH_NEIGHBORS: Record<string, string[]> = {
  'فروردین':   ['اسفند', 'اردیبهشت'],
  'اردیبهشت': ['فروردین', 'خرداد'],
  'خرداد':    ['اردیبهشت', 'تیر'],
  'تیر':      ['خرداد', 'مرداد'],
  'مرداد':    ['تیر', 'شهریور'],
  'شهریور':   ['مرداد', 'مهر'],
  'مهر':      ['شهریور', 'آبان'],
  'آبان':     ['مهر', 'آذر'],
  'آذر':      ['آبان', 'دی'],
  'دی':       ['آذر', 'بهمن'],
  'بهمن':     ['دی', 'اسفند'],
  'اسفند':    ['بهمن', 'فروردین']
};

// نگاشت فصل‌ها و همسایه‌هایشان
export const SEASON_NEIGHBORS: Record<string, string[]> = {
  'بهار':     ['زمستان', 'تابستان'],
  'تابستان': ['بهار', 'پاییز'],
  'پاییز':    ['تابستان', 'زمستان'],
  'زمستان':  ['پاییز', 'بهار']
};

// تابع کمکی: آیا دو ماه همسایه هستند؟
export function isNeighborMonth(monthA: string, monthB: string): boolean {
  if (!monthA || !monthB) return false;
  const neighbors = MONTH_NEIGHBORS[monthA];
  return neighbors ? neighbors.includes(monthB) : false;
}

// تابع کمکی: آیا دو فصل همسایه هستند؟
export function isNeighborSeason(seasonA: string, seasonB: string): boolean {
  if (!seasonA || !seasonB) return false;
  const neighbors = SEASON_NEIGHBORS[seasonA];
  return neighbors ? neighbors.includes(seasonB) : false;
}

// ضرایب امتیازدهی Partial Match
export const PARTIAL_MATCH_COEFFICIENTS = {
  EXACT: 1.0,          // تطابق دقیق
  NEIGHBOR_MONTH: 0.4, // ماه مجاور
  NEIGHBOR_SEASON: 0.5 // فصل مجاور
};
