/**
 * @file queueRepository.ts
 * @description مخزن ذخیره‌سازی و مدیریت وضعیت صف‌های پردازشی لینک‌های هوشمند در دیتابیس Dexie.js
 * این بخش برای پایداری پردازش‌ها، کنترل توقف و رزومه، و ردیابی پیشرفت صف طراحی مبرهن شده است.
 */

import { db, type AnalysisQueue } from '../db';

/**
 * دریافت اطلاعات صف پردازش برای یک پروژه خاص
 * @param projectId شناسه عددی پروژه
 * @returns اطلاعات صف یا undefined در صورت عدم وجود صف برای پروژه
 */
export async function getByProject(projectId: number): Promise<AnalysisQueue | undefined> {
  return db.analysisQueue.where('project_id').equals(projectId).first();
}

/**
 * دریافت اطلاعات صف پردازش به صورت مستقیم با شناسه عددی آن
 * @param id شناسه عددی خودکار صف پردازش
 * @returns اطلاعات صف یا undefined در صورت عدم وجود
 */
export async function getById(id: number): Promise<AnalysisQueue | undefined> {
  return db.analysisQueue.get(id);
}

/**
 * ایجاد یک صف پردازش جدید برای پروژه
 * @param queue اطلاعات اولیه صف بدون شناسه عددی خودکار دیتابیس
 * @returns شناسه عددی صف ایجاد شده
 */
export async function create(queue: Omit<AnalysisQueue, 'id'>): Promise<number> {
  return db.analysisQueue.add(queue) as unknown as Promise<number>;
}

/**
 * به‌روزرسانی کلی فیلدهای یک صف پردازشی
 * @param id شناسه عددی صف پردازش
 * @param queue فیلدهای جدید صف جهت بروزرسانی
 * @returns تعداد رکوردهای تحت تاثیر قرار گرفته
 */
export async function update(id: number, queue: Partial<AnalysisQueue>): Promise<number> {
  return db.analysisQueue.update(id, {
    ...queue,
    updated_at: new Date().toISOString()
  });
}

/**
 * تغییر سریع وضعیت کلی صف پردازش
 * @param id شناسه عددی صف پردازش
 * @param status وضعیت جدید صف (مانند pending, processing, completed, failed, paused)
 * @param errorMessage پیام خطای اختیاری در صورت بروز شکست صف
 */
export async function markStatus(
  id: number,
  status: AnalysisQueue['status'],
  errorMessage: string | null = null
): Promise<void> {
  await db.analysisQueue.update(id, {
    status,
    error_message: errorMessage,
    updated_at: new Date().toISOString()
  });
}

/**
 * پیش بردن ایندکس صفحه پردازش شده جاری درون صف
 * @param id شناسه عددی صف پردازش
 * @param idx ایندکس جدید صفحه پردازش شده جاری
 */
export async function advance(id: number, idx: number): Promise<void> {
  await db.analysisQueue.update(id, {
    current_page_index: idx,
    updated_at: new Date().toISOString()
  });
}

/**
 * پاکسازی کامل صف مربوط به یک پروژه خاص
 * @param projectId شناسه عددی پروژه
 */
export async function deleteByProject(projectId: number): Promise<void> {
  await db.analysisQueue.where('project_id').equals(projectId).delete();
}

/**
 * جستجو و یافتن صف‌هایی که کار پردازش آن‌ها نیمه‌کاره مانده است (مثلاً در پی بسته شدن غیرمنتظره تب)
 * برای ردیابی این موضوع، صف‌هایی جستجو می‌شوند که وضعیت درحال پردازش ('processing') دارند اما
 * بیش از ۳۰ ثانیه از آخرین بروزرسانی آن‌ها گذشته است.
 * @returns لیست صف‌های نیمه‌کاره رها شده
 */
export async function findInterrupted(): Promise<AnalysisQueue[]> {
  const records = await db.analysisQueue.toArray();
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  
  return records.filter(q => {
    try {
      const isProcessing = q.status === 'processing';
      const isStale = new Date(q.updated_at) < thirtySecondsAgo;
      return isProcessing && isStale;
    } catch {
      return false;
    }
  });
}
