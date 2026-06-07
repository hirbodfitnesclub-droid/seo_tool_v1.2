import { TemporalEvent } from '../services/temporal/temporalService';

/**
 * مسئولیت: تعریف رویدادها و فصل‌های ثابت پیش‌فرض (Built-in) تقویم جلالی به همراه کلمات کلیدی مربوطه.
 */

export const BUILT_IN_TEMPORAL_EVENTS: TemporalEvent[] = [
  {
    id: 'builtin-spring',
    name: 'بهار',
    startDate: { year: 1405, month: 1, day: 1 },
    endDate: { year: 1405, month: 3, day: 31 },
    keywords: ['بهار', 'نوروز', 'عید نوروز', 'فروردین', 'اردیبهشت', 'خرداد'],
    source: 'builtin'
  },
  {
    id: 'builtin-summer',
    name: 'تابستان',
    startDate: { year: 1405, month: 4, day: 1 },
    endDate: { year: 1400, month: 6, day: 31 },
    keywords: ['تابستان', 'تیر', 'مرداد', 'شهریور', 'ساحل', 'گرما'],
    source: 'builtin'
  },
  {
    id: 'builtin-autumn',
    name: 'پاییز',
    startDate: { year: 1405, month: 7, day: 1 },
    endDate: { year: 1405, month: 9, day: 30 },
    keywords: ['پاییز', 'مهر', 'آبان', 'آذر', 'رنگارنگ'],
    source: 'builtin'
  },
  {
    id: 'builtin-winter',
    name: 'زمستان',
    startDate: { year: 1405, month: 10, day: 1 },
    endDate: { year: 1405, month: 12, day: 29 }, // طول پیش‌فرض ماه ۱۲ اسفند در تقویم آرایه ما ۲۹ است
    keywords: ['زمستان', 'دی', 'بهمن', 'اسفند', 'برف', 'اسکی'],
    source: 'builtin'
  },
  {
    id: 'builtin-nowruz',
    name: 'نوروز',
    startDate: { year: 1405, month: 12, day: 28 },
    endDate: { year: 1405, month: 1, day: 13 },
    keywords: ['نوروز', 'عید نوروز', 'تعطیلات نوروز', 'سیزده‌بدر'],
    source: 'builtin'
  },
  {
    id: 'builtin-yalda',
    name: 'یلدا',
    startDate: { year: 1405, month: 9, day: 30 },
    endDate: { year: 1405, month: 9, day: 30 },
    keywords: ['یلدا', 'شب چله'],
    source: 'builtin'
  }
];
