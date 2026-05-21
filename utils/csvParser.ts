
import Papa from 'papaparse';
import { CATEGORIES } from '../constants/categories';

export interface ParsedRow {
  title: string;
  categories: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalCount: number;
  errors: string[];
}

function sanitizeString(str: string): string {
  if (!str) return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const parseCSV = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const rows: ParsedRow[] = [];

        if (results.errors.length > 0) {
          errors.push('خطا در خواندن فایل CSV');
        }

        const data = results.data as Record<string, string | undefined>[];

        if (data.length === 0) {
          errors.push('فایل خالی است');
        } else if (!data[0] || !data[0]['عنوان_H1']) {
          errors.push('ستون "عنوان_H1" یافت نشد. این ستون برای شناسایی صفحات اجباری است.');
        }

        if (errors.length === 0) {
          data.forEach((row) => {
            const categories: Record<string, string | null> = {};
            CATEGORIES.forEach((cat) => {
              const val = row[cat.name];
              const stringVal = (val === undefined || val === '') ? null : String(val);
              categories[cat.name] = stringVal ? sanitizeString(stringVal) : null;
            });

            rows.push({
              title: sanitizeString(row['عنوان_H1'] || ''),
              categories: JSON.stringify(categories)
            });
          });
        }

        resolve({
          rows,
          totalCount: rows.length,
          errors
        });
      }
    });
  });
};
