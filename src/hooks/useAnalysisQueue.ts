import { useLiveQuery } from 'dexie-react-hooks';
import * as queueRepository from '../repositories/queueRepository';
import * as QueueManager from '../core/queue/QueueManager';

/**
 * مدیریت وضعیت صف پردازش بر پایه لایه‌های سرویس دهنده و مخازن داده
 */
export function useAnalysisQueue(projectId: number) {
  // استفاده از کلاینت ریپازیتوری لایه‌ای برای استعلام پویای دیتابیس
  const queue = useLiveQuery(
    () => queueRepository.getByProject(projectId),
    [projectId]
  );

  const startQueue = async (totalPages: number, model: string = 'gemini-3.1-flash-lite') => {
    return QueueManager.start(projectId, totalPages, model);
  };

  const pauseQueue = async () => {
    if (queue?.id) {
      await QueueManager.markPaused(queue.id);
    }
  };

  const resumeQueue = async () => {
    if (queue?.id) {
      await QueueManager.markProcessing(queue.id);
    }
  };

  const resetQueue = async () => {
    await queueRepository.deleteByProject(projectId);
  };

  return { queue, startQueue, pauseQueue, resumeQueue, resetQueue };
}

