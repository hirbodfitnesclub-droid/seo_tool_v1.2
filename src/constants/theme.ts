/**
 * ثوابت طراحی، رنگ‌ها و استانداردهای چیدمان (Layout) یکپارچه در کل برنامه.
 * استفاده از این مقادیر سبب یکپارچگی بصری و هماهنگی کامل فرانت‌اند خواهد شد.
 */

export const COLORS = {
  primary: 'blue-600',
  primaryHover: 'blue-700',
  success: 'green-600',
  error: 'red-600',
  warning: 'amber-500',
} as const;

// ساختار و محدودیت عرض کانتینر در تمام صفحات بزرگ
export const CONTAINER_WIDTH = 'max-w-6xl';
