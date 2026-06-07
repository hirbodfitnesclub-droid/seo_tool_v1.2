/**
 * @file temporalCsvService.ts
 * @description سرویس مدیریت قالب و بارگذاری مناسبت‌های زمانی از طریق فایل‌های CSV به همراه اعتبارسنجی Zod.
 */

import Papa from 'papaparse';
import { z } from 'zod';
import { parseJalaliDate } from './jalaliCalendar';
import { TemporalEvent } from './temporalService';

/**
 * تولید رشته تمپلیت خام CSV به همراه کاراکتر BOM برای سازگاری کامل با Excel فارسی
 */
export function generateCsvTemplate(): string {
  const headers = "نام مناسبت,تاریخ شروع (شمسی),تاریخ پایان (شمسی),کلمات کلیدی";
  const row1 = "شب یلدا,1404/09/30,1404/09/30,یلدا|شب چله|انار";
  const row2 = "نوروز,1404/12/29,1405/01/13,نوروز|عید|تعطیلات بهاری";
  return `\uFEFF${headers}\n${row1}\n${row2}`;
}

/**
 * اجرای عملیات دانلود تمپلیت CSV در مرورگر کاربر
 */
export function triggerDownloadTemplate(): void {
  if (typeof window === "undefined") return;
  const csvContent = generateCsvTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "linkmesh-temporal-template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * پردازش و اعتبارسنجی فایل CSV مناسبت‌ها با به کارگیری قید‌های Zod
 * @param file فایل ارسالی کاربر
 */
export function parseCsvFile(file: File): Promise<{ events: TemporalEvent[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        const errors: string[] = [];
        const events: TemporalEvent[] = [];

        if (results.errors && results.errors.length > 0) {
          errors.push("خطای قالب محتوایی در خواندن ساختار فایل CSV");
        }

        const data = results.data as Record<string, string | undefined>[];

        if (data.length === 0) {
          errors.push("فایل محتوای معتبری ندارد و خالی است.");
          resolve({ events, errors });
          return;
        }

        // اعتبارسنجی ستون‌های الزامی برای ردیف‌های فایل
        const RowSchema = z.object({
          'نام مناسبت': z.string().min(1, 'ستون نام مناسبت نباید خالی باشد'),
          'تاریخ شروع (شمسی)': z.string().min(1, 'ستون تاریخ شروع (شمسی) نباید خالی باشد'),
          'تاریخ پایان (شمسی)': z.string().min(1, 'ستون تاریخ پایان (شمسی) نباید خالی باشد'),
          'کلمات کلیدی': z.string().min(1, 'ستون کلمات کلیدی نباید خالی باشد')
        });

        const nowTimestamp = Date.now();

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const validation = RowSchema.safeParse(row);
          if (!validation.success) {
            errors.push(`ردیف ${i + 1}: ستون اجباری خالی است`);
            continue;
          }

          const valid = validation.data;
          const startStr = valid['تاریخ شروع (شمسی)'];
          const endStr = valid['تاریخ پایان (شمسی)'];

          const startDate = parseJalaliDate(startStr);
          const endDate = parseJalaliDate(endStr);

          if (!startDate || !endDate) {
            errors.push(`ردیف ${i + 1}: فرمت تاریخ نامعتبر`);
            continue;
          }

          const keywords = valid['کلمات کلیدی']
            .split(/[|،,\-]+/)
            .map(k => k.trim().toLowerCase())
            .filter(Boolean);

          if (keywords.length === 0) {
            errors.push(`ردیف ${i + 1}: لیست کلمات کلیدی خالی است`);
            continue;
          }

          const event: TemporalEvent = {
            id: `csv-${nowTimestamp}-${i}`,
            name: valid['نام مناسبت'].trim(),
            startDate,
            endDate,
            keywords,
            source: 'csv'
          };
          events.push(event);
        }

        resolve({ events, errors });
      },
      error: (err) => {
        resolve({
          events: [],
          errors: [`خطا در تجزیه فایل CSV: ${err.message}`]
        });
      }
    });
  });
}
