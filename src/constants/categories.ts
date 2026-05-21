
export const CATEGORIES = [
  { name: 'قاره_یا_منطقه', defaultWeight: 2 },
  { name: 'کشور_مقصد', defaultWeight: 4 },
  { name: 'جهت_در_منطقه', defaultWeight: 2 },
  { name: 'شهر_یا_جزیره_مقصد', defaultWeight: 5 },
  { name: 'شهر_یا_استان_مبدا', defaultWeight: 6 },
  { name: 'نوع_تور', defaultWeight: 3 },
  { name: 'فصل_برگزاری', defaultWeight: 3 },
  { name: 'ماه_تقویمی_برگزاری', defaultWeight: 3 },
  { name: 'تعطیلات_خاص_تقویمی', defaultWeight: 1 },
  { name: 'رویداد_یا_مناسبت_خاص', defaultWeight: 1 },
  { name: 'تم_یا_هدف_سفر', defaultWeight: 2 },
  { name: 'نوع_وسیله_نقلیه', defaultWeight: 1 },
  { name: 'نام_دقیق_هتل', defaultWeight: 1 },
  { name: 'تعداد_ستاره_هتل', defaultWeight: 1 },
  { name: 'برچسب_کلاسی_تور', defaultWeight: 1 },
  { name: 'پرسونای_مخاطب', defaultWeight: 1 },
  { name: 'وضعیت_ویزا', defaultWeight: 1 },
  { name: 'نوع_سفر', defaultWeight: 2 },
];

// ترتیب ماه‌های شمسی برای مقایسه زمانی
export const PERSIAN_MONTHS_ORDER = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

// نگاشت ماه به فصل
export const MONTH_TO_SEASON: Record<string, string> = {
  'فروردین': 'بهار',
  'اردیبهشت': 'بهار',
  'خرداد': 'بهار',
  'تیر': 'تابستان',
  'مرداد': 'تابستان',
  'شهریور': 'تابستان',
  'مهر': 'پاییز',
  'آبان': 'پاییز',
  'آذر': 'پاییز',
  'دی': 'زمستان',
  'بهمن': 'زمستان',
  'اسفند': 'زمستان'
};

// بونوس‌های ثابت
export const ORIGIN_BONUS = 10;      // بونوس مبدای یکسان
export const DESTINATION_BONUS = 5;  // بونوس مقصد یکسان
