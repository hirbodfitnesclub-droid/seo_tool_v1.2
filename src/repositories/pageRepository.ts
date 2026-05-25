/**
 * @file pageRepository.ts
 * @description مخزن مدیریت داده‌های صفحات پروژه‌ها در دیتابیس محلی Dexie.js
 * این فایل به عنوان یک لاپیچ (Wrapper) روی جداول صفحات هر پروژه برای لایه برنامه‌نویسی عمل می‌کند.
 */

import { db, type Page } from '../db';

/**
 * دریافت لیست تمامی صفحات ثبت شده برای یک پروژه خاص
 * @param projectId شناسه عددی پروژه مربوطه
 * @returns آرایه‌ای از صفحات مرتبط با پروژه
 */
export async function listByProject(projectId: number): Promise<Page[]> {
  return db.pages.where('project_id').equals(projectId).toArray();
}

/**
 * دریافت اطلاعات کامل یک صفحه بر اساس شناسه منحصربه‌فرد آن
 * @param id شناسه عددی صفحه
 * @returns صفحه مورد نظر یا undefined در صورت عدم وجود
 */
export async function getById(id: number): Promise<Page | undefined> {
  return db.pages.get(id);
}

/**
 * افزودن گروهی صفحات به بانک اطلاعاتی جهت افزایش سرعت درج
 * @param pages آرایه‌ای از اشیاء صفحات جدید
 */
export async function bulkAdd(pages: Page[]): Promise<void> {
  await db.pages.bulkAdd(pages);
}

/**
 * شمارش تعداد صفحات ثبت شده برای یک پروژه خاص
 * @param projectId شناسه عددی پروژه مورد نظر
 * @returns تعداد صفحات موجود در پروژه
 */
export async function countByProject(projectId: number): Promise<number> {
  return db.pages.where('project_id').equals(projectId).count();
}
