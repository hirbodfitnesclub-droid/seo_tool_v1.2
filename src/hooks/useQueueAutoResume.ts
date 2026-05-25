/**
 * @file useQueueAutoResume.ts
 * @description هوک اختصاصی پایش در سطح برنامه به منظور شناسایی صف‌های در حال پردازشی که نیمه‌کاره بسته شده‌اند و انتقال آنها به حالت paused
 */

import { useEffect } from 'react';
import * as queueRepository from '../repositories/queueRepository';
import * as QueueManager from '../core/queue/QueueManager';

/**
 * هوک عمومی پایش و بازیابی صف‌های قطع شده غیرمنتظره
 */
export function useQueueAutoResume(): void {
  useEffect(() => {
    async function checkAndAutoPauseInterrupted(): Promise<void> {
      try {
        // یافتن صف‌هایی که بیش از ۳۰ ثانیه از آخرین پردازش آنها گذشته است
        const interruptedQueues = await queueRepository.findInterrupted();
        
        for (const queue of interruptedQueues) {
          if (queue.id) {
            await QueueManager.markPaused(
              queue.id,
              'برنامه به‌طور غیرمنتظره بسته شد. برای ادامه روی لینک رزومه (Resume) کلیک کنید.'
            );
          }
        }
      } catch (err) {
        console.error('بروز خطا در زمان بازیابی خودکار صف‌های متلاشی‌شده:', err);
      }
    }

    checkAndAutoPauseInterrupted();
  }, []);
}
