/**
 * @file scoringService.ts
 * @description سرویس مدیریت و هماهنگی محاسبات الگوریتم امتیازدهی با اجرای ناهمگام در وب‌ورکر
 */

// @ts-ignore - نادیده گرفتن خطای ایمپورت پسوند مخصوص وایت برای لودر ورکر
import ScoringWorker from '../../workers/scoringWorker?worker';
import { type CandidateWithTags } from '../../core/scoring/scorer';
import { type IDFMap, type PageLike } from '../../core/scoring/idfCalculator';

/**
 * اجرای الگوریتم امتیازدهی و محاسبه کاندیداها به صورت ناهمگام در وب‌ورکر
 * @param pages لیست صفحات همراه با آیدی و دسته‌بندی‌های پارس شده
 * @returns پرامیس حاوی نگاشت آیدی صفحه به کاندیداهای متناظر
 */
export async function computeCandidatesInWorker(pages: any[]): Promise<Map<number, CandidateWithTags[]>> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new ScoringWorker();

      worker.onmessage = (e: MessageEvent) => {
        const { type, payload, error } = e.data;
        if (type === 'DONE') {
          // بازسازی شیء Map از آرایه ارسال شده توسط ورکر
          const candidatesMap = new Map<number, CandidateWithTags[]>(payload);
          resolve(candidatesMap);
          worker.terminate();
        } else if (type === 'ERROR') {
          reject(new Error(error || 'خطای ناشناخته در زمان محاسبه کاندیداها'));
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ type: 'COMPUTE', payload: { pages } });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * اجرای الگوریتم محاسبه IDF به صورت ناهمگام در وب‌ورکر
 * @param pages لیست صفحات پروژه
 * @returns پرامیس حاوی نقشه IDF کلمات
 */
export async function computeIDFInWorker(pages: PageLike[]): Promise<IDFMap> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new ScoringWorker();

      worker.onmessage = (e: MessageEvent) => {
        const { type, payload, error } = e.data;
        if (type === 'DONE') {
          resolve(payload as IDFMap);
          worker.terminate();
        } else if (type === 'ERROR') {
          reject(new Error(error || 'خطای ناشناخته در زمان محاسبه IDF'));
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ type: 'COMPUTE_IDF', payload: { pages } });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * محاسبه همزمان IDF و کاندیداها در یک مرحله فرستادن پیام به وب‌ورکر بهینه شده (R12)
 * @param pages لیست صفحات پروژه همراه با اطلاعات دسته‌بندی
 * @returns پرامیس حاوی نقشه IDF و نگاشت کاندیداهای متناظر هر صفحه
 */
export async function computeAllInWorker(pages: any[]): Promise<{ idfMap: IDFMap; candidatesMap: Map<number, CandidateWithTags[]> }> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new ScoringWorker();

      worker.onmessage = (e: MessageEvent) => {
        const { type, payload, error } = e.data;
        if (type === 'DONE_ALL') {
          const { idfMap, candidates } = payload;
          const candidatesMap = new Map<number, CandidateWithTags[]>(candidates);
          resolve({ idfMap, candidatesMap });
          worker.terminate();
        } else if (type === 'ERROR') {
          reject(new Error(error || 'خطای ناشناخته در محاسبات جامع ورکر'));
          worker.terminate();
        }
      };

      worker.onerror = (err) => {
        reject(err);
        worker.terminate();
      };

      worker.postMessage({ type: 'COMPUTE_ALL', payload: { pages } });
    } catch (err) {
      reject(err);
    }
  });
}
