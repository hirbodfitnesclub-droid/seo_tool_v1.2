/**
 * @file csvParser.ts
 * @description تجزیه‌کننده پیشرفته فایل‌های CSV مجهز به تاییدیه سلامت داده‌ها با Zod
 * بروز خطاهای ستونی در این پردازنده مانع اجرای کل فرآیند نمی‌شود و ردیف‌های آسیب‌دیده با درج خطا رد می‌شوند.
 */

import Papa from 'papaparse';
import { z } from 'zod';
import { CATEGORIES } from '../../constants/categories';

export interface ParsedRow {
  title: string;
  categories: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalCount: number;
  errors: string[];
}

/**
 * ضدعفونی‌سازی رشته‌ها جهت امنیت فرانت‌اند و پیشگیری از درج کدهای مخرب HTML
 * @param str رشته خام
 */
function sanitizeString(str: string): string {
  if (!str) return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ساخت فیلدهای اعتبارسنجی پویا بر مبنای لیست دسته‌بندی‌های SEO برنامه
const schemaFields: Record<string, any> = {
  'عنوان_H1': z.string().min(1, 'ستون عنوان_H1 نباید خالی باشد')
};

CATEGORIES.forEach((cat) => {
  // هر ستون دسته‌بندی اختیاری یا نال‌پذیر طراحی می‌شود تا فقدان آنها کل فرآیند را مختل نکند
  schemaFields[cat.name] = z.string().nullable().optional().or(z.literal(''));
});

// تعریف اسکیما با قابلیت عبور دادن فیلدهای ثبت نشده اضافی (passthrough)
const CSVRowSchema = z.object(schemaFields).passthrough();

/**
 * تجزیه فایل CSV آپلود شده توسط کاربر با کنترل خطا در سطح ردیفی
 * @param file فایل فایل اکسل CSV ارسالی از سمت کاربر
 * @returns نتیجه خروجی پارس شامل آرایه ردیف‌های به دست آمده و گزارش خطاهای ردیابی شده
 */
export const parseCSV = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const rows: ParsedRow[] = [];

        if (results.errors.length > 0) {
          errors.push('خطای قالب محتوایی در خواندن ساختار فایل CSV');
        }

        const data = results.data as Record<string, string | undefined>[];

        if (data.length === 0) {
          errors.push('فایل محتوای معتبری ندارد و خالی است.');
        } else if (!data[0] || !data[0]['عنوان_H1']) {
          errors.push('ستون حیاتی "عنوان_H1" در ردیف نخست فایل یافت نشد. این ستون برای همخوانی اجباری است.');
        }

        const processData = async () => {
          if (errors.length === 0) {
            const chunkSize = 1000;
            for (let i = 0; i < data.length; i += chunkSize) {
              const chunk = data.slice(i, i + chunkSize);
              
              for (let j = 0; j < chunk.length; j++) {
                const index = i + j;
                const row = chunk[j];
                const validation = CSVRowSchema.safeParse(row);
                
                if (!validation.success) {
                  const rowNum = index + 1;
                  const errorMsgs = validation.error.issues.map(err => err.message).join(' - ');
                  errors.push(`ردیف ${rowNum}: ${errorMsgs}`);
                  continue; // رد کردن (Skip) ردیف آسیب دیده و عبور به ردیف بعدی
                }

                const validatedData = validation.data as any;
                const categories: Record<string, string | null> = {};
                
                CATEGORIES.forEach((cat) => {
                  const val = validatedData[cat.name];
                  const stringVal = (val === undefined || val === '') ? null : String(val);
                  categories[cat.name] = stringVal ? sanitizeString(stringVal) : null;
                });

                rows.push({
                  title: sanitizeString(validatedData['عنوان_H1'] || ''),
                  categories: JSON.stringify(categories)
                });
              }

              // ایجاد تنفس در رشته اصلی (Event Loop Yielding) بعد از پردازش هر تکه ۱۰۰ تایی
              await new Promise((res) => setTimeout(res, 0));
            }
          }

          resolve({
            rows,
            totalCount: rows.length,
            errors
          });
        };

        processData();
      }
    });
  });
};
