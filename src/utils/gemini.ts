
import { CandidateWithTags } from './scorer';

export function buildSinglePagePrompt(
  sourcePage: { title: string; categories: string },
  candidates: CandidateWithTags[]
): string {
  // فقط ۳۰ کاندیدای برتر به AI ارسال می‌شود
  const top30 = candidates.slice(0, 30);
  
  return `
تو یک متخصص SEO و معمار محتوا هستی. وظیفه تو انتخاب ۱۵ لینک داخلی برتر از بین ۳۰ کاندیدای پیشنهادی است.

استراتژی انتخاب:
1. اولویت اول: کاندیداهایی با امتیاز بالاتر (نزدیک‌تر به ۱۰)
2. اولویت دوم: تعداد تگ‌های مشترک بیشتر
3. اولویت سوم: ارتباط معنایی و تکمیل‌کنندگی سفر کاربر

دستورالعمل حیاتی:
- اگر کاندیداهای ورودی کمتر از ۱۵ عدد است، تمام آن‌ها را انتخاب کن. در غیر این صورت، دقیقاً ۱۵ لینک برتر انتخاب کن.
- لینک‌ها را به ترتیب اولویت شماره‌گذاری کن (۱ = مهم‌ترین)
- برای هر لینک یک دلیل ۱ خطی به زبان فارسی روان بنویس

خروجی را فقط به صورت JSON معتبر برگردان (بدون هیچگونه مارک‌داون یا توضیح اضافی):
{
  "selected_links": [
    { "rank": 1, "page_id": 12, "title": "...", "reason": "..." },
    { "rank": 2, "page_id": 45, "title": "...", "reason": "..." }
  ]
}

--- صفحه اصلی ---
عنوان: ${sourcePage.title}
اطلاعات: ${sourcePage.categories}

--- ۳۰ کاندیدای برتر (به ترتیب امتیاز) ---
${top30.map((c, i) => `${i + 1}. [ID: ${c.page_id}] ${c.title} | امتیاز: ${c.score}/10 | تگ‌های مشترک: ${c.matched_count} (${c.matched_tags.join(', ')})`).join('\n')}
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
