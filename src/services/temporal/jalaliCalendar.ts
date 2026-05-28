/**
 * مسئولیت: ابزارهای پایه‌ای برای کار با تاریخ جلالی (هجری شمسی) با استفاده از Intl بومی مرورگر.
 * این سرویس بدون وابستگی بیرونی (Pure) طراحی شده است.
 */

export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی لاتیین
 */
function toLatinDigits(str: string): string {
  return str
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48))
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
}

/**
 * ردیف ترتیبی روزها در سال شمسی بدون در نظر گرفتن سال (برای مقایسه‌های فصلی درون‌سالی)
 */
function jalaliMonthDayOrdinal(d: JalaliDate): number {
  return (d.month - 1) * 31 + d.day;
}

/**
 * دریافت تاریخ شمسی فعلی سیستم
 */
export function getCurrentJalaliDate(): JalaliDate {
  const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(new Date());

  let year = 1400;
  let month = 1;
  let day = 1;

  for (const part of parts) {
    if (part.type === 'year') {
      year = parseInt(part.value, 10);
    } else if (part.type === 'month') {
      month = parseInt(part.value, 10);
    } else if (part.type === 'day') {
      day = parseInt(part.value, 10);
    }
  }

  return { year, month, day };
}

/**
 * پارس کردن رشته تاریخ شمسی در قالب YYYY/MM/DD با پشتیبانی از ارقام فارسی/عربی
 */
export function parseJalaliDate(input: string): JalaliDate | null {
  if (!input) return null;
  
  const normalized = toLatinDigits(input.trim());
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // بررسی معتبر بودن مقادیر ورودی
  if (year < 1300 || year > 1500) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return { year, month, day };
}

/**
 * محاسبه عدد ترتیبی روز برای تاریخ شمسی (فرمول ریاضی ساده بدون اثر کبیسه‌ی دقیق اخترشناسی)
 */
export function jalaliToOrdinal(d: JalaliDate): number {
  const monthLengths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let dayOfYear = 0;
  for (let m = 1; m < d.month; m++) {
    dayOfYear += monthLengths[m - 1];
  }
  dayOfYear += d.day;
  return d.year * 366 + dayOfYear;
}

/**
 * محاسبه فاصله‌ی تاریخ b از تاریخ a بر حسب روز (اگر b بعد از a باشد، خروجی مثبت است)
 */
export function jalaliDaysBetween(a: JalaliDate, b: JalaliDate): number {
  return jalaliToOrdinal(b) - jalaliToOrdinal(a);
}

/**
 * بررسی اینکه آیا تاریخ d در بازه زمانی بین start و end قرار دارد یا خیر
 * پشتیبانی کامل از بازه‌های عبور کننده از سال (مثلا نوروز ۲۸ اسفند تا ۱۳ فروردین)
 */
export function isJalaliInRange(d: JalaliDate, start: JalaliDate, end: JalaliDate): boolean {
  const dOrd = jalaliMonthDayOrdinal(d);
  const startOrd = jalaliMonthDayOrdinal(start);
  const endOrd = jalaliMonthDayOrdinal(end);

  // در صورتی که پایان بازه کوچک‌تر از شروع باشد، یعنی بازه از مرز سال عبور می‌کند
  if (endOrd < startOrd) {
    return dOrd >= startOrd || dOrd <= endOrd;
  }
  
  return dOrd >= startOrd && dOrd <= endOrd;
}
