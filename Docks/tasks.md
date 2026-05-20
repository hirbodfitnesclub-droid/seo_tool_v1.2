# فاز E: اصلاح زنجیره داده کاندیداها برای تحلیل معنایی واقعی

> این فاز پیش‌نیاز هر بهینه‌سازی بعدی (الگوریتم یا پرامپت) است.
> ترتیب تسک‌ها اجباری است — تسک E2 به خروجی E1 وابسته است.

---

## ریشه مشکل

`CandidateWithTags` در حال حاضر فقط `matched_tags` (تگ‌های **مشترک** بین منبع و کاندیدا) را نگه می‌دارد.
این یعنی اگر کاندیدایی اشتراک مستقیمی با صفحه منبع نداشته باشد، هوش مصنوعی فقط عنوانش را می‌بیند و هیچ اطلاعاتی از ماهیت آن صفحه ندارد.
برای اینکه AI بتواند روابط معنایی (Pillar→Cluster، تکمیل سفر کاربر) را درک کند، باید **همه تگ‌های هر کاندیدا** را هم ببیند.

## زنجیره داده کامل (برای درک وابستگی‌ها)

```
scorer.ts → findTopCandidates() → CandidateWithTags[]
    ↓
candidateStorage.ts → JSON.stringify() → ذخیره در DB (جدول candidates)
    ↓
queueProcessor.ts → safeJsonParse() → CandidateWithTags[] → buildSinglePagePrompt()
    ↓
gemini.ts → buildSinglePagePrompt() → پرامپت نهایی به AI

همچنین موازی:
PageDetail.tsx → safeJsonParse(candidateRec.candidate_list) → نمایش CandidateCard
```

**نکته مهم:** چون `candidateStorage.ts` از `JSON.stringify` روی کل آبجکت استفاده می‌کند، اضافه کردن فیلد جدید در `scorer.ts` به‌طور خودکار در DB هم ذخیره خواهد شد — این فایل نیاز به تغییر ندارد.

---

## تسک E1 — اصلاح `scorer.ts`: اضافه کردن `candidate_all_tags`

**هدف:** تزریق کل تگ‌های معتبر هر کاندیدا به اینترفیس و خروجی الگوریتم.

**فایل:** `src/utils/scorer.ts`

### تغییر ۱ — اینترفیس `CandidateWithTags`

فیلد `candidate_all_tags` را به اینترفیس اضافه کن:

```typescript
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[];   // تگ‌های مشترک با صفحه منبع (بدون تغییر)
  matched_count: number;
  candidate_all_tags: string[]; // 👈 فیلد جدید: نام تمام تگ‌های غیرخالی کاندیدا
  rank?: number;
}
```

### تغییر ۲ — تابع `findTopCandidates`

در بلاک `.map(p => { ... })` داخل این تابع، بعد از فراخوانی `computeNormalizedScore`، استخراج کل تگ‌های کاندیدا را اضافه کن:

```typescript
// استخراج نام تمام تگ‌هایی که مقدار غیرخالی دارند
const candidateAllTags = Object.keys(pCat).filter(key => {
  const val = pCat[key];
  return val !== null && val !== undefined && val !== '';
});
```

و در آبجکت return، فیلد جدید را اضافه کن:

```typescript
return {
  page_id: p.id!,
  title: p.title,
  score,
  matched_tags: matchedTags,
  matched_count: matchedCount,
  candidate_all_tags: candidateAllTags  // 👈 اضافه شد
};
```

**⚠️ نکته:** فیلد `rank` در همان تابع بعد از sort اضافه می‌شود (در `.map((c, index) => ({...c, rank: index + 1}))`). مطمئن شو که spread operator (`...c`) این فیلد جدید را هم منتقل می‌کند — چون از spread استفاده می‌شود، به‌طور خودکار منتقل خواهد شد.

**محدودیت‌های این تسک:**
- ✅ فقط `scorer.ts` تغییر کند
- ✅ تایپ `CandidateWithTags` در همه جا به‌روز شود (TypeScript خودش خطا می‌دهد اگر جایی استفاده نادرست باشد)
- ⛔ منطق امتیازدهی (`computeNormalizedScore`) تغییر نکند
- ⛔ فایل‌های دیگر (candidateStorage، queueProcessor، PageDetail) تغییر نکنند

`CONTEXT_FILES: ["src/utils/scorer.ts", "src/db.ts"]`

---

## تسک E2 — اصلاح `gemini.ts`: بازنویسی پرامپت با دیتای کامل

**پیش‌نیاز:** تسک E1 کامل شده باشد.

**هدف:** جایگزینی پرامپت فعلی با نسخه‌ای که:
1. از `candidate_all_tags` (کل تگ‌ها) + `matched_tags` (نقطه اتصال) استفاده کند
2. فریم‌بندی استراتژیک SEO داشته باشد (Pillar-Cluster، قیف فروش)
3. امتیاز و ترتیب الگوریتمی **کاملاً حذف** شده باشند تا AI مستقلاً رتبه‌بندی کند

**فایل:** `src/utils/gemini.ts`

### تغییر — تابع `buildSinglePagePrompt`

تابع فعلی را کامل با نسخه زیر جایگزین کن:

```typescript
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
    `${i + 1}. {"page_id": ${c.page_id}, "title": "${c.title}", "all_tags": "${c.candidate_all_tags.join(', ')}", "shared_with_source": "${c.matched_tags.join(', ') || 'None'}"}`
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
```

**محدودیت‌های این تسک:**
- ✅ فقط تابع `buildSinglePagePrompt` تغییر کند
- ✅ توابع `buildPrompt` و `callGemini` دست نخورند
- ⛔ امتیاز (`score`) یا ترتیب الگوریتمی (`rank`) به هیچ شکلی در پرامپت ظاهر نشود
- ⛔ اگر `candidate_all_tags` روی یک آیتم undefined بود، باید gracefully handle شود:
  `c.candidate_all_tags?.join(', ') || c.matched_tags.join(', ') || 'نامشخص'`

`CONTEXT_FILES: ["src/utils/gemini.ts", "src/utils/scorer.ts"]`

---

## چک‌لیست تأیید نهایی

بعد از هر دو تسک، این موارد را بررسی کن:

- [ ] `tsc --noEmit` بدون خطا اجرا شود (type safety حفظ شده باشد)
- [ ] در `PageDetail.tsx` که از `CandidateWithTags` استفاده می‌کند، هیچ خطای TypeScript نباشد
- [ ] در `queueProcessor.ts` که `safeJsonParse(candidateRecord.candidate_list, [])` را صدا می‌زند، داده‌های قدیمی DB (که `candidate_all_tags` ندارند) با fallback خالی `[]` gracefully handle شوند
- [ ] بعد از ذخیره پروژه جدید، یک کاندیدای نمونه از DB بخوان و مطمئن شو `candidate_all_tags` در JSON ذخیره شده است
- [ ] پرامپت نهایی `console.log` شود و تأیید شود که هیچ عدد امتیازی در آن نیست

---

## نکته مهم درباره داده‌های قدیمی DB

کاندیداهایی که **قبل از این اصلاح** محاسبه و ذخیره شده‌اند، فیلد `candidate_all_tags` را ندارند.
بنابراین بعد از deploy این تغییر، باید در صفحه پروژه دکمه **«محاسبه مجدد امتیاز کاندیداها»** زده شود تا DB با ساختار جدید بازنویسی شود.
این یک عملیات یک‌بار است و نیاز به تغییر کد اضافه ندارد.