/**
 * @file analysisService.ts
 * @description سرویس مرکزی ارکستراسیون تحلیل صفحات و یکپارچه‌سازی منطق سئو و شبیه‌سازی صف هوش مصنوعی
 */

import * as projectRepository from '../../repositories/projectRepository';
import * as pageRepository from '../../repositories/pageRepository';
import * as weightRepository from '../../repositories/weightRepository';
import * as candidateRepository from '../../repositories/candidateRepository';
import * as resultRepository from '../../repositories/resultRepository';
import * as queueRepository from '../../repositories/queueRepository';
import * as inlinkGraphService from './inlinkGraphService';
import { computeAndStoreCandidates } from '../../utils/candidateStorage';
import { buildSinglePagePrompt } from '../api/promptBuilder';
import { callGemini } from '../api/geminiClient';
import { safeJsonParse } from '../../utils/safeJson';
import { buildLiveOrderedList, TemporalEvent } from '../temporal/temporalService';
import { buildFinalCandidateList } from '../pipeline/lensPipeline';
import { QuotaAllocation } from '../quota/quotaService';
import { invalidateProject as invalidateProjectQuota } from '../quota/quotaAllocationService';

/**
 * شروع فرآیند تحلیل کل صفحات یک پروژه
 * @param projectId شناسه عددی پروژه
 * @param model مدل انتخابی هوش مصنوعی
 * @param mode حالت بررسی (all: برای بررسی مجدد همه، pending: فقط تحلیل نشده‌ها)
 */
export async function startProjectAnalysis(
  projectId: number,
  model: string,
  mode: 'all' | 'pending'
): Promise<void> {
  const project = await projectRepository.getById(projectId);
  if (!project) {
    throw new Error('پروژه مورد نظر یافت نشد.');
  }

  const pages = await pageRepository.listByProject(projectId);
  const weights = await weightRepository.listByProject(projectId);

  // در صورتی که نیاز به بررسی مجدد کل صفحات باشد، نتایج قبلی پاک می‌شوند
  if (mode === 'all') {
    await resultRepository.clearByProject(projectId);
  }

  // آماده‌سازی نقشه وزنی دسته‌بندی‌ها
  const weightMap: Record<string, number> = {};
  weights.forEach(w => {
    weightMap[w.category_name] = w.weight_value;
  });

  // ۱. اجرای محاسبات و ذخیره کاندیداها با الگوریتم و ورکر
  await computeAndStoreCandidates(projectId, pages, weightMap, project.scoring_mode || 'linear');

  // ۲. مدیریت و ثبت صف در جدول دیتابیس
  const existingQueue = await queueRepository.getByProject(projectId);
  if (existingQueue) {
    await queueRepository.update(existingQueue.id!, {
      selected_model: model,
      status: 'pending',
      current_page_index: mode === 'all' ? 0 : existingQueue.current_page_index,
      error_message: null
    });
  } else {
    await queueRepository.create({
      project_id: projectId,
      status: 'pending',
      current_page_index: 0,
      total_pages: pages.length,
      selected_model: model,
      error_message: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  // ابطال کش پس از اتمام/شروع مجدد یا تخصیص صف جدید تحلیل در پروژه
  inlinkGraphService.invalidateProject(projectId);
  invalidateProjectQuota(projectId);
}

/**
 * شبیه‌سازی و بررسی تحلیل هوشمند برای تک صفحه منحصربه‌فرد بر اساس ۳۰ کاندیدای برتر
 * @param projectId شناسه عددی پروژه
 * @param pageId شناسه عددی صفحه مبدأ
 * @param model مدل انتخابی هوش مصنوعی
 * @returns لیست لینک‌های پیشنهادی هوش مصنوعی
 */
export async function runSinglePageAnalysis(
  projectId: number,
  pageId: number,
  model: string,
  temporalEvents?: TemporalEvent[],
  quotaAllocation?: QuotaAllocation
): Promise<any[]> {
  const page = await pageRepository.getById(pageId);
  if (!page) {
    throw new Error('صفحه مورد نظر یافت نشد.');
  }

  const candidateRec = await candidateRepository.getByPage(pageId);
  const candidateList = candidateRec ? safeJsonParse(candidateRec.candidate_list, []) : [];
  
  const processedCandidates = buildFinalCandidateList({
    candidates: candidateList,
    sourcePageId: pageId,
    temporal: temporalEvents && temporalEvents.length > 0 ? {
      events: temporalEvents,
      targetMetadata: new Map()
    } : undefined,
    quota: quotaAllocation ? {
      allocation: quotaAllocation
    } : undefined
  });

  const top30 = processedCandidates.slice(0, 30);

  // غنی‌سازی کاندیداها به صورت بلادرنگ از روی جدول با اطلاعات دسته‌بندی‌ها
  const enrichedCandidates = await Promise.all(
    top30.map(async (cand: any) => {
      const fullPage = await pageRepository.getById(cand.page_id);
      if (fullPage) {
        try {
          return {
            ...cand,
            categories: typeof fullPage.categories === 'string'
              ? JSON.parse(fullPage.categories)
              : fullPage.categories
          };
        } catch {
          return { ...cand, categories: fullPage.categories };
        }
      }
      return cand;
    })
  );

  // اعمال لوله فیلترینگ و مرتب‌سازی زنده به داده‌های ورودی جمینای در صورت فعال بودن لایو یا سهمیه
  const finalAiCandidates = buildFinalCandidateList({
    candidates: enrichedCandidates,
    sourcePageId: pageId,
    temporal: temporalEvents && temporalEvents.length > 0 ? {
      events: temporalEvents,
      targetMetadata: new Map()
    } : undefined,
    quota: quotaAllocation ? {
      allocation: quotaAllocation
    } : undefined
  });

  const prompt = buildSinglePagePrompt(
    { title: page.title, categories: page.categories },
    finalAiCandidates as any
  );

  const response = await callGemini(prompt, model);
  
  // ابطال حافظه گراف معکوس پروژه پس از تحلیل تک صفحه‌ای موفق
  inlinkGraphService.invalidateProject(projectId);

  return response.selected_links || [];
}

/**
 * بازمحاسبه امتیازدهی مجدد الگوریتمی کل کاندیداها بدون اجرای هوش مصنوعی
 * @param projectId شناسه عددی پروژه
 */
export async function recomputeCandidates(projectId: number): Promise<void> {
  const project = await projectRepository.getById(projectId);
  if (!project) {
    throw new Error('پروژه مورد نظر یافت نشد.');
  }

  const pages = await pageRepository.listByProject(projectId);
  const weights = await weightRepository.listByProject(projectId);

  const weightMap: Record<string, number> = {};
  weights.forEach(w => {
    weightMap[w.category_name] = w.weight_value;
  });

  await computeAndStoreCandidates(projectId, pages, weightMap, project.scoring_mode || 'linear');

  // ابطال کش پس از بازمحاسبه الگوریتمی کل کاندیداها
  inlinkGraphService.invalidateProject(projectId);
}
