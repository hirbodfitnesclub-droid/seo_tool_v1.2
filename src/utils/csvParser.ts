
import Papa from 'papaparse';
import { CATEGORIES } from '../constants/categories';

export interface ParseResult {
  rows: any[];
  totalCount: number;
  errors: string[];
}

export const parseCSV = (file: File): Promise<ParseResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        const rows: any[] = [];

        if (results.errors.length > 0) {
          errors.push('خطا در خواندن فایل CSV');
        }

        const data = results.data as any[];

        if (data.length === 0) {
          errors.push('فایل خالی است');
        } else if (!data[0]['عنوان_H1']) {
          errors.push('ستون "عنوان_H1" یافت نشد. این ستون برای شناسایی صفحات اجباری است.');
        }

        if (errors.length === 0) {
          data.forEach((row) => {
            const categories: any = {};
            CATEGORIES.forEach((cat) => {
              const val = row[cat.name];
              categories[cat.name] = (val === undefined || val === '') ? null : val;
            });

            rows.push({
              title: row['عنوان_H1'],
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
