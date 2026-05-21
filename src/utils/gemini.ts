
import { CandidateWithTags } from './scorer';

export function buildSinglePagePrompt(
  sourcePage: { title: string; categories: string | object },
  candidates: CandidateWithTags[]
): string {
  let sourceCategoriesObj: any = {};
  if (typeof sourcePage.categories === 'string') {
    try {
      sourceCategoriesObj = JSON.parse(sourcePage.categories);
    } catch {
      sourceCategoriesObj = {};
    }
  } else {
    sourceCategoriesObj = sourcePage.categories || {};
  }

  // انتخاب حداکثر ۳۰ کاندیدای برتر برای پرامپت جهت مدیریت بهینه کانتکست و تمرکز مدلی
  const topCandidates = candidates.slice(0, 30);

  return `
تو یک متخصص SEO و معمار لینک‌سازی داخلی برای سایت تور مسافرتی «نهال‌گشت» هستی.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 مهم‌ترین وظیفه تو: درک نیت کاربر
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

قبل از انتخاب لینک‌ها، باید به این سوالات پاسخ دهی:

۱. **چه کسی** به این صفحه می‌آید؟
   - کاربری که دنبال تور ${sourcePage.title} است

۲. **چه زمانی** می‌خواهد سفر کند؟
   - به تگ «ماه_تقویمی_برگزاری» و «فصل_برگزاری» نگاه کن
   - اگر صفحه مثلاً مال تیرماه است، کاربر برای تابستان برنامه دارد
   - پس فقط صفحات همان بازه زمانی مرتبط هستند

۳. **دغدغه اصلی** کاربر چیست؟
   - آیا دنبال مقصد خاص است؟ → صفحات همان مقصد
   - آیا از شهر خاصی می‌خواهد برود؟ → صفحات همان مبدا (اولویت بالاتر!)
   - آیا نوع خاصی از تور می‌خواهد? → صفحات همان نوع

۴. **سفر کاربر در سایت** چگونه تکمیل می‌شود؟
   - صفحاتی که اطلاعات **مکمل** (نه تکراری) ارائه می‌دهند
   - مثلاً: تور قشم → تور کیش (مقصد مشابه در همان فصل)
   - مثلاً: تور آنتالیا تابستان → تور مارماریس تابستان (کشور و فصل مشترک)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 قوانین انتخاب لینک
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

۱. **قانون زمانی و فصلی (مهم!):**
   - اولویت حداکثری با ماه یکسان، ماه بعدی یا همان فصل برگزاری است.
   - کاربری که به عنوان مثال تور «قشم تیر» را مشاهده می‌کند، به احتمال بسیار بالا تمایلی به حرکت به عقب (مثلا خرداد) ندارد، بلکه حرکت به سمت ماه بعد (مرداد) یا لندینگ فصلی مقصد (قشم تابستان) برای او بسیار جذاب‌تر است.
   - صفحات سایر فصول یا ماه‌های بسیار دورتر را به طور کامل نادیده نگیر، اما اولویت بسیار پایینی به آنها بده و ترجیحاً زمانی برگزین که گزینه‌های نزدیک‌تر مناسبی وجود نداشته باشند.

۲. **قانون مبدا (اولویت اول):**
   - صفحات با مبدای یکسان بالاترین ارتباط را دارند
   - به فیلد «origin_bonus» نگاه کن — اگر ۱۰ است یعنی مبدا یکسان است

۳. **قانون مقصد (اولویت دوم):**
   - صفحات با مقصد یکسان ارتباط بالایی دارند
   - به فیلد «destination_bonus» نگاه کن — اگر ۵ است یعنی مقصد یکسان است

۴. **قانون تکمیل‌کنندگی:**
   - صفحاتی که «گزینه‌های جایگزین» ارائه می‌دهند، نه تکرار همان صفحه

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 صفحه اصلی (Source Page)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
عنوان: ${sourcePage.title}
اطلاعات طبقه‌بندی و تگ‌ها: ${JSON.stringify(sourceCategoriesObj, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ۳۰ کاندیدای برتر پیشنهادی (پیش‌فیلتر شده بر اساس زمان و امتیازدهی چندلایه)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
توضیح: برای تک تک گزینه‌های زیر علاوه بر امتیاز الگوریتمی، تگ‌های کامل صفحه را بررسی کن تا متقاعدکننده‌ترین‌ها را برگزینی:
${topCandidates.map((c, i) => {
  let tagsStr = 'فاقد تگ مشخص';
  if (c.categories) {
    tagsStr = typeof c.categories === 'string' ? c.categories : JSON.stringify(c.categories, null, 2);
  }
  return `
${i + 1}. [ID: ${c.page_id}] ${c.title}
   📊 امتیاز الگوریتمی کل: ${c.score}
   🏷️ تگ‌های کامل صفحه کاندیدا: ${tagsStr}
   🏠 بونوس مبدا: ${c.origin_bonus > 0 ? `✅ ${c.origin_bonus}` : '—'}
   🎯 بونوس مقصد: ${c.destination_bonus > 0 ? `✅ ${c.destination_bonus}` : '—'}
   🔹 تگ‌های مشترک با منبع: ${c.matched_tags ? c.matched_tags.join(' | ') : ''}
`;
}).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 فرمت خروجی (بسیار مهم: حتماً دقیقاً ۱۵ مورد ارائه‌شود)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
وظیفه ویژه تو در طراحی لینک: از ۳۰ کاندیدای بالا، **دقیقاً ۱۵ مورد** از مرتبط‌ترین و بهترین گزینه‌ها را بر اساس امتیاز و تطابق سئویی انتخاب کن. 
اگر تعداد کل کاندیداهای ورودی کمتر از ۱۵ مورد باشد، تمام موارد موجود را بازگردان، اما در غیر این صورت حتماً خروجی باید شامل **دقیقاً ۱۵ مورد** در لیست "selected_links" باشد. نه کمتر و نه بیشتر.

خروجی را **فقط** به صورت JSON خالص برگردان (بدون markdown، بدون توضیح اضافی یا کدهای پشت صحنه):

{
  "user_intent": "توضیح کوتاه: کاربر این صفحه چه می‌خواهد؟",
  "selected_links": [
    { 
      "page_id": 42, 
      "title": "عنوان صفحه", 
      "reason": "دلیل منطقی و سئویی انتخاب این کاندیدا و چگونگی انطباق تگ‌های آن با صفحه منبع"
    }
    // ... ادامه دارد تا دقیقاً ۱۵ مورد تکمیل شود ...
  ]
}
`;
}

export function buildPrompt(pages: any[], candidatesMap: Map<number, any[]>, maxLinks: number): string {
  let prompt = `
تو یک متخصص SEO حرفه‌ای هستی. وظیفه تو انتخاب بهترین لینک‌های داخلی برای صفحات یک سایت گردشگری (نهال‌گشت) است.

دستورالعمل:
1. برای هر صفحه منبع (source_page)، از بین کاندیداهای پیشنهادی، بهترین لینک‌ها را انتخاب کن.
2. معیار انتخاب: شباهت معنایی، ارتباط موضوعی و تکمیل‌کنندگی سفر کاربر.
3. برای هر لینک انتخاب شده، یک دلیل کوتاه و متقاعدکننده به فارسی بنویس.

خروجی نهایی را دقیقاً به صورت یک آرایه JSON خالص برگردان (بدون هیچ متن اضافی یا علامت \` \` \`):
[
  {
    "source_id": 1,
    "source_title": "...",
    "links": [
      { "page_id": 2, "title": "...", "reason": "..." }
    ]
  }
]

--- اطلاعات صفحات سایت ---
`;

  pages.forEach(p => {
    prompt += `ID: ${p.id} | Title: ${p.title} | Data: ${p.categories}\n`;
  });

  prompt += `\n--- کاندیداهای پیشنهادی برای هر صفحه (Top 20) ---\n`;
  
  candidatesMap.forEach((candidates, sourceId) => {
    const sourcePage = pages.find(p => p.id === sourceId);
    prompt += `Source: ${sourcePage?.title} (ID: ${sourceId})\n`;
    candidates.forEach(c => {
      prompt += `- Candidate ID: ${c.page_id} | Title: ${c.title} | Similarity Score: ${c.score} | Matched Tags: ${c.matched_tags?.join(',')}\n`;
    });
    prompt += `\n`;
  });

  return prompt;
}

export async function callGemini(prompt: string, model: string = 'gemini-3.1-flash-lite') {
  // We use our local server-side proxy to use the platform's GEMINI_API_KEY safely
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, model })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'خطا در ارتباط با سرور (Gemini Proxy)');
  }

  const data = await response.json();
  let text = data.text;
  
  if (!text) throw new Error('پاسخ خالی دریافت شد');

  // Strip code blocks if AI included them
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse AI JSON:', text);
    throw new Error('پاسخ قابل پارس نیست. لطفاً مجدد تلاش کنید.');
  }
}
