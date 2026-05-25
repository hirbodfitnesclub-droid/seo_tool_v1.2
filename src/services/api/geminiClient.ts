/**
 * @file geminiClient.ts
 * @description کلاینت توسعه‌یافته برقراری ارتباط با پورتال هوش مصنوعی Gemini
 * مجهز به سیستم تاخیر تصاعدی (Exponential Backoff + Jitter) برای غلبه بر خطاهای نرخ مصرف (429) و خطاهای ناگهانی سرور (5xx).
 */

import { GeminiSelectedLinksSchema } from './geminiSchema';

/**
 * ایجاد وقفه ناهمگام سودمند
 * @param ms مدت زمان تاخیر بر حسب میلی‌ثانیه
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * فراخوانی هوش مصنوعی Gemini به همراه مکانیزم مقاوم خطایی و اعتبارسنجی خروجی
 * @param prompt متن دستورالعمل ورودی برای هوش مصنوعی
 * @param model مدل انتخابی برای تحلیل داده‌ها (به طور پیش‌فرض gemini-3.1-flash-lite)
 * @returns پاسخ پردازش شده و تایید شده توسط Zod
 */
export async function callGemini(prompt: string, model: string = 'gemini-3.1-flash-lite') {
  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, model })
      });

      if (!response.ok) {
        const statusCode = response.status;
        
        // در صورت بروز خطاهای 429 (تعداد درخواست زیاد) یا خطاهای سرور (5xx)، از تاخیر تصاعدی استفاده می‌شود
        if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
          attempt++;
          if (attempt >= maxAttempts) {
            throw new Error(`شکست پس از ${maxAttempts} بار تلاش ناموفق به دلیل دریافت خطای سرور با کد ${statusCode}`);
          }

          // محاسبه تاخیر: min(60000, 2^attempt * 1000 + jitter)
          const jitter = Math.floor(Math.random() * 500); // افزودن نویز تصادفی بین 0 تا 500 میلی‌ثانیه
          const delay = Math.min(60000, Math.pow(2, attempt) * 1000 + jitter);
          
          console.warn(`دریافت خطای قابل بازپردازش کلاینت (${statusCode}). تلاش مجدد شماره ${attempt} پس از ${delay} میلی‌ثانیه...`);
          await sleep(delay);
          continue;
        }

        // خطاهای غیرقابل بازپردازش (مثل 400 Bad Request یا 401/403 Unauthorized) مستقیما خطا پرتاب می‌کنند
        let errorMsg = 'خطای ارتباط با سرور هوش مصنوعی';
        try {
          const errData = await response.json();
          errorMsg = errData.error?.message || errorMsg;
        } catch {
          errorMsg = `خطای ارتباطی با کد وضعیت ${statusCode}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      let text = data.text;

      if (!text) {
        throw new Error('پاسخ خالی از طرف سرور هوش مصنوعی دریافت شد');
      }

      // بهینه‌سازی و حذف کدهای قالبی فرمت مارک‌داون چسبانده شده توسط برخی مدل‌ها
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(text);
      } catch (e) {
        console.error('ناتوانی در پارس پاسخ حاصله به صورت JSON:', text);
        throw new Error('قالب پاسخ دریافتی از هوش مصنوعی معتبر نیست و امکان پارس ندارد.');
      }

      // اعتبارسنجی ساختار خروجی دیتای مدل با طرحواره Zod صریح
      const validationResult = GeminiSelectedLinksSchema.safeParse(parsedJson);
      
      if (!validationResult.success) {
        console.error('اعتبارسنجی فیلدهای پاسخ با Zod شکست خورد:', validationResult.error);
        throw new Error('اطلاعات خروجی هوش مصنوعی قالب سئویی استاندارد LinkMesh را ندارد و رد شد.');
      }

      return validationResult.data;

    } catch (error: any) {
      // اگر خطای پرتاب شده یک خطای سیستمی داخلی معتبر نیست و همچنان نوبت تلاش داریم، پیش می‌رویم
      if (error instanceof Error && error.message.includes('شکست پس از')) {
        throw error;
      }
      
      // در غیر این صورت، این یک خطای مستقیم شبکه یا کلاینت متوقف کننده است
      if (attempt >= maxAttempts - 1) {
        throw new Error(error.message || 'خطا در ارتباط شبکه با سرور کلاینت هوش مصنوعی');
      }
      
      attempt++;
      const jitter = Math.floor(Math.random() * 500);
      const delay = Math.min(60000, Math.pow(2, attempt) * 1000 + jitter);
      console.warn(`بروز خطای متفرقه شبکه (${error.message || 'بدون پیام'}). تلاش مجدد شماره ${attempt} پس از ${delay} میلی‌ثانیه...`);
      await sleep(delay);
    }
  }

  throw new Error('تعداد کل تلاش‌های مجاز برای ارتباط با هوش مصنوعی پایان یافت.');
}
