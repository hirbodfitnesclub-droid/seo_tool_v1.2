/**
 * @file scoringWorker.ts
 * @description وب‌ورکر اختصاصی جهت اجرای محاسبات سنگین الگوریتم امتیازدهی در پس‌زمینه (رشته پردازشی غیرمسدودساز)
 */

import { computeAllCandidates } from '../core/scoring/scorer';
import { computeIDFMap } from '../core/scoring/idfCalculator';

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;
  try {
    if (type === 'COMPUTE' || type === 'COMPUTE_CANDIDATES') {
      const candidatesMap = computeAllCandidates(payload.pages);
      // تبدیل Map به Array و فیلتر کردن کاندیداها به برترین ۵۰ مورد در وب‌ورکر برای جلوگیری از OOM و فریز شدن مرورگر در serialization
      const candidatesArray = Array.from(candidatesMap.entries()).map(([pageId, candidates]) => {
        return [pageId, candidates.slice(0, 50)];
      });
      self.postMessage({ type: 'DONE', payload: candidatesArray });
    } else if (type === 'COMPUTE_IDF') {
      const idfMap = computeIDFMap(payload.pages);
      self.postMessage({ type: 'DONE', payload: idfMap });
    } else {
      self.postMessage({ type: 'ERROR', error: 'دستور نامعتبر برای ورکر' });
    }
  } catch (err: any) {
    self.postMessage({ type: 'ERROR', error: err?.message || String(err) });
  }
};
