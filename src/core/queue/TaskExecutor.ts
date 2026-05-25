/**
 * @file TaskExecutor.ts
 * @description مسئولیت پردازش و اجرای تحلیل تک‌به‌تک صفحات (اتومیک) همراه با غنی‌سازی اطلاعات و ارسال به هوش مصنوعی
 */

import * as pageRepository from '../../repositories/pageRepository';
import * as candidateRepository from '../../repositories/candidateRepository';
import * as resultRepository from '../../repositories/resultRepository';
import { callGemini } from '../../services/api/geminiClient';
import { buildSinglePagePrompt } from '../../services/api/promptBuilder';
import { safeJsonParse } from '../../utils/safeJson';
import { type CandidateWithTags } from '../../core/scoring/scorer';
import { type Page } from '../../db';

/**
 * اجرای تحلیل سئو و پیشنهاد لینک برای یک صفحه خاص با قابلیت بازگشت فیدبک موفقیت یا پرش (Skip)
 * @param projectId شناسه عددی پروژه
 * @param pageId شناسه عددی صفحه مبدأ جهت تحلیل
 * @param model مدل هوش مصنوعی انتخابی
 * @param allPages لیست تمام صفحات پروژه جهت رجوع و غنی‌سازی تگ‌ها
 * @returns پرامیس حاوی وضعیت موفقیت تحلیل صفحه (در صورت نبود کاندیدا پرش انجام شده و false برگردانده می‌شود)
 */
export async function executePage(
  projectId: number,
  pageId: number,
  model: string,
  allPages: Page[]
): Promise<boolean> {
  const page = await pageRepository.getById(pageId);
  if (!page) {
    throw new Error(`صفحه با شناسه ${pageId} در دیتابیس یافت نشد.`);
  }

  // الف: خواندن کاندیداهای امتیازدهی شده
  const candidateRecord = await candidateRepository.getByPage(pageId);
  if (!candidateRecord) {
    // در صورت نبود کاندیدای تایید شده، فاز تحلیل این صفحه پرش (Skip) می‌گردد
    return false;
  }

  const candidateList: CandidateWithTags[] = safeJsonParse(candidateRecord.candidate_list, []);
  const top30 = candidateList.slice(0, 30);

  // غنی‌سازی پویای کاندیداها با تگ‌های واقعی صفحات مقصد
  const enrichedCandidates = top30.map(cand => {
    const fullPage = allPages.find(p => p.id === cand.page_id);
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
  });

  // ب: ساخت پرامپت اختصاصی و فراخوانی مدل جمینای
  const prompt = buildSinglePagePrompt({ title: page.title, categories: page.categories }, enrichedCandidates);
  const response = await callGemini(prompt, model);

  // ج: ذخیره نتیجه آماده در جدول نتایج نهایی
  await resultRepository.upsert({
    project_id: projectId,
    source_page_id: pageId,
    source_title: page.title,
    recommended_links: JSON.stringify(response.selected_links || []),
    is_manual_edit: false,
    generated_at: new Date().toISOString()
  });

  return true;
}
