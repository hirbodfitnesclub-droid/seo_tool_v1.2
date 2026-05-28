/**
 * @file candidateRepository.ts
 * @description مخزن ذخیره‌سازی و بازیابی کاندیداهای لینک‌سازی هوشمند در دیتابیس Dexie.js
 * نتایج حاصل از محاسبات شباهت و ضرایب در قالب لیست‌های کاندیدا در این جدول ذخیره می‌شوند.
 */

import { db, type CandidateRecord } from '../db';

/**
 * دریافت رکورد کاندیداهای محاسبه شده برای یک صفحه مبدأ خاص
 * @param pageId شناسه عددی صفحه مبدأ
 * @returns رکورد کاندیدا شامل آرایه JSON شده یا undefined در صورت عدم وجود
 */
export async function getByPage(pageId: number): Promise<CandidateRecord | undefined> {
  return db.candidates.where('source_page_id').equals(pageId).first();
}

/**
 * ذخیره گروهی رکوردهای کاندیداها به منظور افزایش کارایی دیتابیس در حجم‌های بالا
 * @param records آرایه‌ای از رکوردهای کاندیداهای صفحات
 */
export async function bulkAdd(records: CandidateRecord[]): Promise<void> {
  await db.candidates.bulkAdd(records);
}

/**
 * پاک کردن کل نتایج کاندیداهای یک پروژه خاص
 * @param projectId شناسه عددی پروژه
 */
export async function clearByProject(projectId: number): Promise<void> {
  await db.candidates.where('project_id').equals(projectId).delete();
}

/**
 * شمارش تعداد صفحات دارای کاندیدا در یک پروژه خاص
 * @param projectId شناسه عددی پروژه
 * @returns تعداد رکوردهای کاندیدای موجود برای این پروژه
 */
export async function countByProject(projectId: number): Promise<number> {
  return db.candidates.where('project_id').equals(projectId).count();
}

/**
 * دریافت تمام رکوردهای کاندیدا برای یک پروژه (برای ساخت Reverse Index)
 * @param projectId شناسه عددی پروژه
 * @returns تمام رکوردهای کاندیدا یافت شده
 */
export async function listByProject(projectId: number): Promise<CandidateRecord[]> {
  return db.candidates.where('project_id').equals(projectId).toArray();
}

