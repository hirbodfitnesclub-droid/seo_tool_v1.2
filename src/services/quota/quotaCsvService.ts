/**
 * @file quotaCsvService.ts
 * @description سرویس مدیریت قالب و بارگذاری سهمیه‌ها از طریق فایل‌های CSV به همراه اعتبارسنجی Zod و تبدیل ارقام فارسی.
 */

import Papa from 'papaparse';
import { z } from 'zod';
import { type QuotaRow } from './quotaService';

/**
 * تبدیل ارقام فارسی و عربی به ارقام انگلیسی
 */
function toEnglishDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
}

/**
 * تولید رشته تمپلیت خام CSV به همراه کاراکتر BOM برای سازگاری کامل با Excel فارسی
 */
export function generateCsvTemplate(): string {
  const headers = "آدرس صفحه,عنوان (H1),ایمپرشن,درصد سهمیه";
  const row1 = "https://nahalgasht.com/tour/kish,تور کیش,5400,1.5";
  const row2 = "https://nahalgasht.com/tour/mashhad,تور مشهد,4200,2.0";
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
  link.setAttribute("download", "linkmesh-quota-template.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * پردازش و اعتبارسنجی فایل CSV سهمیه‌ها با استفاده از Zod
 * @param file فایل ارسالی کاربر
 */
export function parseCsvFile(file: File): Promise<{ rows: QuotaRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        const errors: string[] = [];
        const rows: QuotaRow[] = [];

        if (results.errors && results.errors.length > 0) {
          errors.push("خطای قالب محتوایی در خواندن ساختار فایل CSV");
        }

        const data = results.data as Record<string, string | undefined>[];

        if (data.length === 0) {
          errors.push("فایل محتوای معتبری ندارد و خالی است.");
          resolve({ rows, errors });
          return;
        }

        // اعتبارسنجی ستون‌های الزامی برای ردیف‌های فایل با Zod
        const RowSchema = z.object({
          'عنوان (H1)': z.string().min(1, 'ستون عنوان (H1) نباید خالی باشد'),
          'درصد سهمیه': z.string().min(1, 'ستون درصد سهمیه نباید خالی باشد')
        });

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const validation = RowSchema.safeParse(row);
          if (!validation.success) {
            errors.push(`ردیف ${i + 1}: ستون اجباری "عنوان (H1)" یا "درصد سهمیه" خالی است`);
            continue;
          }

          const valid = validation.data;
          
          // نرمال‌سازی درصد سهمیه: تبدیل ارقام تفکیک شده، حذف % فرضی
          let percentageStr = toEnglishDigits(valid['درصد سهمیه'].trim())
            .replace(/%/g, '')
            .replace(/[\s,]+/g, '');
          
          const percentage = Number(percentageStr);

          if (isNaN(percentage) || percentage <= 0) {
            errors.push(`ردیف ${i + 1}: درصد سهمیه باید عددی بزرگتر از صفر باشد`);
            continue;
          }

          // نرمال‌سازی ایمپرشن (پیش‌فرض ۰)
          let impressions = 0;
          const rawImpr = row['ایمپرشن'];
          if (rawImpr && rawImpr.trim().length > 0) {
            let imprStr = toEnglishDigits(rawImpr.trim()).replace(/[\s,]+/g, '');
            const parsedImpr = Number(imprStr);
            if (!isNaN(parsedImpr) && parsedImpr >= 0) {
              impressions = parsedImpr;
            } else {
              errors.push(`ردیف ${i + 1}: مقدار ایمپرشن باید عددی بزرگتر یا مساوی صفر باشد`);
              continue;
            }
          }

          const quotaRow: QuotaRow = {
            title: valid['عنوان (H1)'].trim(),
            url: row['آدرس صفحه'] ? row['آدرس صفحه'].trim() : undefined,
            impressions,
            percentage
          };
          rows.push(quotaRow);
        }

        resolve({ rows, errors });
      },
      error: (err) => {
        resolve({
          rows: [],
          errors: [`خطا در تجزیه فایل CSV: ${err.message}`]
        });
      }
    });
  });
}
