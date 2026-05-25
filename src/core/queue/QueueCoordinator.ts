/**
 * @file QueueCoordinator.ts
 * @description حلقه‌گردان و هماهنگ‌کننده مرکزی صف پردازش تحلیل صفحات همراه با ایجاد سلیپ ۲ ثانیه‌ای و هندل توقف‌ها
 */

import * as queueRepository from '../../repositories/queueRepository';
import * as pageRepository from '../../repositories/pageRepository';
import * as QueueManager from './QueueManager';
import { executePage } from './TaskExecutor';

/**
 * ناظر و مجری پردازش متوالی صف پروژه‌ها
 * @param projectId شناسه عددی پروژه مورد نیاز تحلیل
 */
export async function runQueue(projectId: number): Promise<void> {
  const queue = await queueRepository.getByProject(projectId);
  if (!queue || queue.status === 'completed') return;

  const selectedModel = queue.selected_model || 'gemini-3.1-flash-lite';

  // ۱. ارتقاء وضعیت صف به در حال پردازش به صورت اتمیک
  await QueueManager.markProcessing(queue.id!);

  // ۲. استخراج لیست تمامی صفحات پروژه
  const pages = await pageRepository.listByProject(projectId);

  // ۳. اجرای مکانیزم چرخش روی صفحات از ایندکس ردیف ذخیره‌شده
  for (let i = queue.current_page_index; i < pages.length; i++) {
    // بازبینی وضعیت پیشرفت یا امکان تعلیق (Pause) صف توسط کاربر
    if (await QueueManager.isPausedOrFailed(queue.id!)) {
      break;
    }

    const page = pages[i];

    try {
      // اجرای گام تحلیل و خروج اتمیک
      const executed = await executePage(projectId, page.id!, selectedModel, pages);
      
      // جلو بردن شاخص پیشرفت ردیف در صف دیتابیس
      await QueueManager.advance(queue.id!, i + 1);

      // ایجاد تاخیر مفید ۲ ثانیه‌ای برای پیشگیری از انسداد (Rate-Limit) فقط در صورت تحلیل واقعی و نبود در انتهای آرایه
      if (executed && i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err: any) {
      // تغییر و تغییر وضعیت صف به شکست همراه با پیام خطا و توقف گام حلقه
      await QueueManager.markFailed(
        queue.id!,
        err?.message || 'خطای نامشخص در زمان تعامل با هوش مصنوعی کلاینت'
      );
      break;
    }
  }

  // ۴. کنترل وضعیت صحت تکمیل و پایان کل صف
  const finalQueue = await queueRepository.getById(queue.id!);
  if (finalQueue && finalQueue.current_page_index >= pages.length) {
    await QueueManager.markCompleted(queue.id!);
  }
}
