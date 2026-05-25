/**
 * @file QueueManager.ts
 * @description مدیریت اتمیک وضعیت‌ها و انتقال حالت‌های صف پردازش در دیتابیس
 */

import * as queueRepository from '../../repositories/queueRepository';
import { type AnalysisQueue } from '../../db';

/**
 * راه‌اندازی و بازنشانی وضعیت صف پردازشی برای یک پروژه مشخص
 * @param projectId شناسه عددی پروژه
 * @param totalPages تعداد کل صفحات پروژه جهت تحلیل
 * @param model مدل هوش مصنوعی انتخاب شده
 * @returns شناسه عددی تحلیل در صف
 */
export async function start(projectId: number, totalPages: number, model: string): Promise<number> {
  const existing = await queueRepository.getByProject(projectId);
  const now = new Date().toISOString();

  if (existing) {
    await queueRepository.update(existing.id!, {
      status: 'processing',
      current_page_index: 0,
      total_pages: totalPages,
      selected_model: model,
      error_message: null,
      started_at: now,
      updated_at: now
    });
    return existing.id!;
  } else {
    return queueRepository.create({
      project_id: projectId,
      status: 'processing',
      current_page_index: 0,
      total_pages: totalPages,
      selected_model: model,
      error_message: null,
      started_at: now,
      updated_at: now
    });
  }
}

/**
 * تنظیم وضعیت صف به در حال پردازش
 */
export async function markProcessing(queueId: number): Promise<void> {
  await queueRepository.markStatus(queueId, 'processing', null);
}

/**
 * متوقف کردن موقت صف
 */
export async function markPaused(queueId: number, errorMessage: string | null = null): Promise<void> {
  await queueRepository.markStatus(queueId, 'paused', errorMessage);
}

/**
 * تکمیل صف با موفقیت کامل
 */
export async function markCompleted(queueId: number): Promise<void> {
  await queueRepository.markStatus(queueId, 'completed', null);
}

/**
 * ثبت شکست صف به علت رویداد ناگهانی یا خطای API
 */
export async function markFailed(queueId: number, errorMessage: string): Promise<void> {
  await queueRepository.markStatus(queueId, 'failed', errorMessage);
}

/**
 * پیش بردن شاخص ایندکس صفحه جاری در صف
 */
export async function advance(queueId: number, idx: number): Promise<void> {
  await queueRepository.advance(queueId, idx);
}

/**
 * بررسی اینکه آیا صف فریز، متوقف، یا با خطا شکست خورده است
 */
export async function isPausedOrFailed(queueId: number): Promise<boolean> {
  const queue = await queueRepository.getById(queueId);
  if (!queue) return true;
  return queue.status === 'paused' || queue.status === 'failed';
}
