import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/**
 * مدیریت وضعیت صف پردازش در دیتابیس
 */
export function useAnalysisQueue(projectId: number) {
  const queue = useLiveQuery(
    () => db.analysisQueue.where('project_id').equals(projectId).first(),
    [projectId]
  );

  const startQueue = async (totalPages: number) => {
    // پاک کردن وضعیت قبلی
    await db.analysisQueue.where('project_id').equals(projectId).delete();
    
    // ایجاد صف جدید
    return await db.analysisQueue.add({
      project_id: projectId,
      status: 'pending',
      current_page_index: 0,
      total_pages: totalPages,
      error_message: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  };

  const pauseQueue = async () => {
    if (queue?.id) {
      await db.analysisQueue.update(queue.id, { 
        status: 'paused',
        updated_at: new Date().toISOString()
      });
    }
  };

  const resumeQueue = async () => {
    if (queue?.id) {
      await db.analysisQueue.update(queue.id, { 
        status: 'processing',
        updated_at: new Date().toISOString()
      });
    }
  };

  const resetQueue = async () => {
    await db.analysisQueue.where('project_id').equals(projectId).delete();
  };

  return { queue, startQueue, pauseQueue, resumeQueue, resetQueue };
}
