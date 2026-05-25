/**
 * @file resultRepository.ts
 * @description مخزن ذخیره، ویرایش و بازیابی نتایج نهایی لینک‌های پیشنهادی هوش مصنوعی در دیتابیس Dexie.js
 * این بخش نتایج قطعی را به همراه وضعیت تغییرات دستی انجام شده توسط کاربر نگهداری می‌کند.
 */

import { db, type Result } from '../db';

/**
 * دریافت لینک‌های پیشنهادی نهایی ثبت شده برای یک صفحه خاص
 * @param pageId شناسه عددی صفحه مبدأ
 * @returns رکورد نتیجه یا undefined در صورت عدم وجود
 */
export async function getByPage(pageId: number): Promise<Result | undefined> {
  return db.results.where('source_page_id').equals(pageId).first();
}

/**
 * دریافت لیست تمامی نتایج لینک پیشنهادی ثبت شده برای یک پروژه
 * @param projectId شناسه عددی پروژه
 * @returns آرایه‌ای از رکوردهای خروجی پیشنهاد لینک‌سازی
 */
export async function listByProject(projectId: number): Promise<Result[]> {
  return db.results.where('project_id').equals(projectId).toArray();
}

/**
 * ذخیره‌سازی، درج، یا بروزرسانی اتمیک نتیجه یک صفحه خاص در بانک اطلاعاتی
 * @param result رکورد نتیجه جدید برای ذخیره‌سازی
 */
export async function upsert(result: Result): Promise<void> {
  await db.transaction('rw', db.results, async () => {
    // ابتدا در صورت وجود رکورد قبلی برای این صفحه آن را پاک می‌کنیم
    await db.results.where('source_page_id').equals(result.source_page_id).delete();
    // رکورد جدید با آخرین وضعیت را درج می‌کنیم
    await db.results.add(result);
  });
}

/**
 * پاکسازی کامل تمامی نتایج پیشنهادی ثبت شده برای یک پروژه معین
 * @param projectId شناسه عددی پروژه
 */
export async function clearByProject(projectId: number): Promise<void> {
  await db.results.where('project_id').equals(projectId).delete();
}
