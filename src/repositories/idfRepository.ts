/**
 * @file idfRepository.ts
 * @description مخزن ذخیره، کش‌سازی و بازیابی مقادیر IDF (فرکانس معکوس سند) برای کلمات کلیدی دسته‌بندی‌ها در دیتابیس Dexie.js
 * این جدول از محاسبه مجدد و تکراری مقادیر IDF در هر گام جلوگیری کرده و کلید بازدهی محاسبات لایه Core است.
 */

import { db, type IDFCacheRecord } from '../db';

/**
 * دریافت اطلاعات حافظه موقت (کش) IDF برای یک پروژه مشخص
 * @param projectId شناسه عددی پروژه
 * @returns رکورد کش‌شده IDF یا undefined در صورت عدم وجود کش قبلی
 */
export async function getByProject(projectId: number): Promise<IDFCacheRecord | undefined> {
  return db.idfCache.where('project_id').equals(projectId).first();
}

/**
 * بروزرسانی یا درج جدید مقدار نگاشت IDF برای یک پروژه معین
 * این کار در قالب یک تراکنش اتمیک مطمئن ابتدا کش قبلی را پاک کرده و سپس مقدار جدید را ثبت می‌کند.
 * @param projectId شناسه عددی پروژه
 * @param idfMapJson رشته JSON معتبر از شیء الگوی فرکانس کلمات (IDFMap)
 */
export async function upsert(projectId: number, idfMapJson: string): Promise<void> {
  await db.transaction('rw', db.idfCache, async () => {
    // پاک کردن تکرارهای قبلی برای جلوگیری از انباشت داده‌های نامعتبر
    await db.idfCache.where('project_id').equals(projectId).delete();
    // ثبت رکورد کش جدید همراه با زمان دقیق اتمام محاسبات
    await db.idfCache.add({
      project_id: projectId,
      idf_map: idfMapJson,
      computed_at: new Date().toISOString()
    });
  });
}
