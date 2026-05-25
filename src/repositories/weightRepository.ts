/**
 * @file weightRepository.ts
 * @description مخزن مدیریت داده‌های وزن‌های اختصاص داده شده به گروه‌ها/دسته‌بندی‌های هر پروژه در دیتابیس Dexie.js
 * این فایل دسترسی به ضرایب وزنی تعریف شده توسط کاربر SEO برای دسته‌بندی‌های پروژه را تسهیل می‌کند.
 */

import { db, type Weight } from '../db';

/**
 * دریافت لیست تمامی ضرایب وزنی ثبت شده برای یک پروژه مشخص
 * @param projectId شناسه عددی پروژه مورد نظر
 * @returns آرایه‌ای از رکوردهای وزن دسته‌ها
 */
export async function listByProject(projectId: number): Promise<Weight[]> {
  return db.weights.where('project_id').equals(projectId).toArray();
}

/**
 * بروزرسانی یا درج گروهی وزن دسته‌بندی‌ها برای یک پروژه خاص
 * این عملیات در قالب یک تراکنش اتمیک ابتدا وزن‌های قبلی را پاک کرده و سپس رکوردهای جدید را ثبت می‌کند.
 * @param projectId شناسه عددی پروژه
 * @param weights لیست رکوردهای جدید وزن برای ثبت در دیتابیس
 */
export async function bulkUpsert(projectId: number, weights: Weight[]): Promise<void> {
  await db.transaction('rw', db.weights, async () => {
    await db.weights.where('project_id').equals(projectId).delete();
    await db.weights.bulkAdd(weights);
  });
}
