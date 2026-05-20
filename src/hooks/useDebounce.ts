import { useState, useEffect } from 'react';

/**
 * هوک شخصی‌سازی شده برای ایجاد تاخیر (Debounce) روی تغییرات یک مقدار.
 * معمولاً برای بهینه‌سازی فرآیند جستجوی لایو استفاده می‌شود.
 * 
 * @param value مقدار ورودی که می‌خواهیم دیبانس شود
 * @param delay میزان تاخیر به میلی‌ثانیه (پیش‌فرض ۳۰۰ میلی‌ثانیه)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // ایجاد تایمر جدید برای آپدیت مقدار بعد از گذشت تاخیر مورد نظر
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // پاکسازی تایمر قبلی در صورتی که قبل از اتمام تاخیر، مقدار تغییر یابد
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
