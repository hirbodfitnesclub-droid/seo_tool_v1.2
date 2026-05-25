/**
 * @file projectRepository.ts
 * @description مخزن مدیریت داده‌های پروژه‌ها در دیتابیس محلی Dexie.js
 * این فایل به عنوان یک لاپیچ (Wrapper) روی متدهای مربوط به جدول پروژه‌ها عمل می‌کند.
 */

import { db, type Project } from '../db';

/**
 * دریافت اطلاعات یک پروژه خاص با استفاده از شناسه آن
 * @param id شناسه عددی پروژه
 * @returns اطلاعات پروژه یا undefined در صورت عدم وجود
 */
export async function getById(id: number): Promise<Project | undefined> {
  return db.projects.get(id);
}

/**
 * دریافت لیست تمامی پروژه‌های موجود
 * @returns آرایه‌ای از تمامی پروژه‌ها
 */
export async function list(): Promise<Project[]> {
  return db.projects.toArray();
}

/**
 * ایجاد یک پروژه جدید در دیتابیس
 * @param project شیء اطلاعات پروژه خام بدون شناسه عددی
 * @returns شناسه عددی پروژه ایجاد شده
 */
export async function create(project: Project): Promise<number> {
  return db.projects.add(project) as unknown as Promise<number>;
}

/**
 * به‌روزرسانی اطلاعات یک پروژه‌ی خاص
 * @param id شناسه عددی پروژه
 * @param project بخش‌های تغییر یافته مربوط به پروژه
 * @returns تعداد رکوردهای به‌روزرسانی شده (یا شناسه به‌روزرسانی شده)
 */
export async function update(id: number, project: Partial<Project>): Promise<number> {
  return db.projects.update(id, project);
}

/**
 * حذف یک پروژه از دیتابیس
 * @param id شناسه عددی پروژه مورد نظر برای حذف
 */
export async function remove(id: number): Promise<void> {
  await db.projects.delete(id);
}

/**
 * دریافت لیست پروژه‌ها مرتب شده بر اساس تاریخ ایجاد نزولی
 * @returns آرایه‌ای از پروژه‌ها
 */
export async function listOrderedByCreatedAtDesc(): Promise<Project[]> {
  return db.projects.orderBy('created_at').reverse().toArray();
}

/**
 * حذف یک پروژه به همراه کلیه وابستگی‌های آن (صفحات، وزن‌ها، نتایج، نامزدها و صف تحلیل) به صورت تراکنشی (آبشاری)
 * @param projectId شناسه عددی پروژه مورد نظر برای حذف آبشاری
 */
export async function deleteProjectCascade(projectId: number): Promise<void> {
  await db.transaction('rw', [db.projects, db.pages, db.weights, db.results, db.candidates, db.analysisQueue], async () => {
    await db.projects.delete(projectId);
    await db.pages.where('project_id').equals(projectId).delete();
    await db.weights.where('project_id').equals(projectId).delete();
    await db.results.where('project_id').equals(projectId).delete();
    await db.candidates.where('project_id').equals(projectId).delete();
    await db.analysisQueue.where('project_id').equals(projectId).delete();
  });
}
