import { db } from '../db';
import { callGemini } from './gemini';
import { CandidateWithTags } from './scorer';

/**
 * پردازشگر اصلی صف هوش مصنوعی
 * این تابع به صورت صفحه‌به‌صفحه کال می‌زند و در دیتابیس ذخیره می‌کند
 */
export async function processQueue(projectId: number) {
  const queue = await db.analysisQueue.where('project_id').equals(projectId).first();
  if (!queue || queue.status === 'completed') return;

  const selectedModel = queue.selected_model || 'gemini-3.1-flash-lite';

  // ۱. تغییر وضعیت به در حال پردازش
  await db.analysisQueue.update(queue.id!, { 
    status: 'processing',
    updated_at: new Date().toISOString()
  });

  const pages = await db.pages.where('project_id').equals(projectId).toArray();

  // ۲. شروع حلقه پردازش از ایندکس فعلی
  for (let i = queue.current_page_index; i < pages.length; i++) {
    // بررسی وضعیت لحظه‌ای صف (ممکن است کاربر Pause کرده باشد)
    const currentQueue = await db.analysisQueue.get(queue.id!);
    if (!currentQueue || currentQueue.status === 'paused' || currentQueue.status === 'failed') break;

    const page = pages[i];
    
    try {
      // الف: خواندن کاندیداهای امتیازدهی شده
      const candidateRecord = await db.candidates.where('source_page_id').equals(page.id!).first();
      if (!candidateRecord) {
        // اگر کاندیدا محاسبه نشده، اسکیپ می‌کنیم یا ایندکس را جلو می‌بریم
        await db.analysisQueue.update(queue.id!, { current_page_index: i + 1 });
        continue;
      }

      const candidateList: CandidateWithTags[] = JSON.parse(candidateRecord.candidate_list);
      const categories = JSON.parse(page.categories);

      // ب: ساخت پرامپت و فراخوانی API
      const prompt = buildSinglePagePrompt({ title: page.title, categories }, candidateList);
      const response = await callGemini(prompt, selectedModel);

      // ج: ذخیره نتیجه بلافاصله (اتومیک)
      await db.transaction('rw', [db.results, db.analysisQueue], async () => {
        // پاک کردن نتیجه قبلی احتمالی
        await db.results.where('source_page_id').equals(page.id!).delete();
        
        // ثبت نتیجه جدید
        await db.results.add({
          project_id: projectId,
          source_page_id: page.id!,
          source_title: page.title,
          recommended_links: JSON.stringify(response.selected_links || []),
          is_manual_edit: false,
          generated_at: new Date().toISOString()
        });

        // آپدیت ایندکس در صف
        await db.analysisQueue.update(queue.id!, {
          current_page_index: i + 1,
          updated_at: new Date().toISOString()
        });
      });

      // د: تاخیر ۲ ثانیه‌ای برای جلوگیری از Rate Limit
      if (i < pages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (err: any) {
      // ثبت خطا در دیتابیس و توقف
      await db.analysisQueue.update(queue.id!, {
        status: 'failed',
        error_message: err.message || 'خطای نامشخص در ارتباط با هوش مصنوعی',
        updated_at: new Date().toISOString()
      });
      break;
    }
  }

  // ۳. بررسی اتمام کار
  const finalQueue = await db.analysisQueue.get(queue.id!);
  if (finalQueue && finalQueue.current_page_index >= pages.length) {
    await db.analysisQueue.update(queue.id!, {
      status: 'completed',
      updated_at: new Date().toISOString()
    });
  }
}

/**
 * پرامپت برای تحلیل تکی هر صفحه
 */
export function buildSinglePagePrompt(
  sourcePage: { title: string; categories: object },
  candidates: CandidateWithTags[]
): string {
  return `
تو یک متخصص SEO و معمار محتوا هستی. وظیفه تو تحلیل "عمیق" و انتخاب بهترین لینک‌های داخلی برای صفحه اصلی از بین تمام کاندیداهای پیشنهادی است.

استراتژی انتخاب:
1. ارتباط موضوعی مستقیم: صفحاتی که تگ‌های مشترک زیادی دارند.
2. تکمیل‌کنندگی سفر کاربر: صفحاتی که اطلاعات تکمیلی برای صفحه منبع ارائه می‌دهند.
3. خوشه‌بندی محتوایی (Topic Clusters): صفحاتی که در یک دسته جغرافیایی یا خدماتی هستند.

دستورالعمل حیاتی:
- محدودیت عددی وجود ندارد. هر تعداد از کاندیداها که واقعاً برای سئو و کاربر مفید هستند را انتخاب کن.
- اگر تمام ${candidates.length} کاندیدا مرتبط هستند، همه را انتخاب کن.
- پاسخ باید شامل "دلیل استراتژیک" برای هر انتخاب باشد.

خروجی را "فقط" به صورت یک آبجکت JSON معتبر برگردان:
{
  "selected_links": [
    { "page_id": 12, "title": "...", "reason": "تحلیل مشترک تگ منطقه و نوع تور..." }
  ]
}

--- صفحه اصلی ---
عنوان: ${sourcePage.title}
اطلاعات طبقه‌بندی: ${JSON.stringify(sourcePage.categories)}

--- تمام کاندیداهای پیشنهادی (به ترتیب امتیاز شباهت) ---
${candidates.map((c, i) => `${i + 1}. [ID: ${c.page_id}] ${c.title} | امتیاز: ${c.score} | تگ‌های مشترک: ${c.matched_tags.join(', ')}`).join('\n')}
`;
}
