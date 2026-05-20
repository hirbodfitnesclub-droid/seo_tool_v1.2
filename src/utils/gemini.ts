
import { CandidateWithTags } from './scorer';

export function buildSinglePagePrompt(
  sourcePage: { title: string; categories: string },
  candidates: CandidateWithTags[]
): string {
  const top30 = candidates.slice(0, 30);

  // پارس و فرمت‌بندی فشرده تگ‌های صفحه منبع
  let sourceTags: Record<string, string | null> = {};
  try { sourceTags = JSON.parse(sourcePage.categories); } catch { /* ignore */ }

  const sourceTagsStr = Object.entries(sourceTags)
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' | ');

  // فرمت‌بندی کاندیداها با دو لایه اطلاعاتی:
  // all_tags: تصویر کلان (ماهیت صفحه کاندیدا)
  // shared_with_source: نقطه اتصال (چه چیزی مشترک است)
  const candidateLines = top30.map((c, i) =>
    `${i + 1}. {"page_id": ${c.page_id}, "title": "${c.title}", "all_tags": "${c.candidate_all_tags?.join(', ') || c.matched_tags?.join(', ') || 'نامشخص'}", "shared_with_source": "${c.matched_tags?.join(', ') || 'None'}"}`
  ).join('\n');

  return `تو یک معمار ارشد محتوا و متخصص سئو در حوزه گردشگری هستی.
ما در حال پیاده‌سازی یک استراتژی قدرتمند لینک‌سازی داخلی (Topical Mapping) هستیم.
هدف اصلی ما: ساخت شبکه‌ای از لینک‌هاست که سلسله‌مراتب صفحات (Pillar and Cluster) را به گوگل نشان دهد و کاربر را در طول قیف فروش (از جستجوی کلی تا خرید تور خاص) هدایت کند.
وظیفه تو: بررسی ${top30.length} کاندیدای زیر و انتخاب ۱۵ لینک برتر برای صفحه مبدا، با نادیده گرفتن کامل ترتیب فعلی لیست.

اصول ریشه‌ای و استراتژی انتخاب (بسیار مهم):
۱. حمایت از ساختار والد-فرزند: لینک دادن بین صفحات خاص (مثل تورهای ماهانه/فصلی) و صفحات جامع (مثل تور اصلی مقصد) به شدت توصیه می‌شود.
۲. تکمیل سفر کاربر: لینک باید نیاز بعدی یا قبلی مسافر را پاسخ دهد (مثلاً از هتل‌های کیش به تور کیش، یا از تور کیش به راهنمای سفر کیش).
۳. تنوع هدف (Search Intent): ترکیبی از لینک‌های بالادستی (جامع‌تر)، پایین‌دستی (جزئی‌تر) و هم‌عرض (مقاصد یا تورهای مشابه) را انتخاب کن تا شبکه محتوایی کامل شود.
۴. پرهیز از keyword cannibalization: صفحات بیش از حد مشابه که با هم رقابت می‌کنند انتخاب نشوند.

دستورالعمل خروجی:
- دقیقاً ۱۵ لینک برتر را انتخاب کن (اگر لیست کمتر بود، همه را بیاور).
- آن‌ها را از ۱ (مهم‌ترین و استراتژیک‌ترین) تا ۱۵ رتبه‌بندی کن.
- برای هر انتخاب، ۱ خط دلیل منطقی سئویی به زبان فارسی روان بنویس.
- خروجی فقط و فقط یک JSON معتبر بدون هیچ متن یا فرمت‌بندی اضافه باشد.

{"selected_links":[{"rank":1,"page_id":0,"title":"...","reason":"..."}]}

--- صفحه مبدا ---
عنوان: ${sourcePage.title}
مشخصات: ${sourceTagsStr}

--- ${top30.length} کاندیدا جهت تحلیل معنایی و رتبه‌بندی ---
${candidateLines}`;
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
