# CURRENT_TASK.md — سند انتقال کانتکست و تمرکز فعلی (تسک‌های F3.6 و F3.7)

> **توجه بسیار حیاتی برای شروع چت جدید (Context Bridge):**
> این سند، پل ارتباطی قدرتمندی برای آغاز چت بعدی است. تمام تسک‌های قبلی (تا F3.5) کاملاً پیاده‌سازی شده، بی‌نقص با لایه‌های سیستمی یکپارچه شده و با موفقیت ۱۰۰٪ بیلد (`compile_applet` و `lint_applet` موفق) شده‌اند. 
> به دلیل این که چت بعدی در کانتکست جدید آغاز خواهد شد، این سند به شکل کاملاً خودمختار و جامع طراحی شده تا نماینده ارشد بعدی بتواند با خواندن این سند، سریعاً و با کم‌ترین چرخه فیدبک وظیفه را شروع کند.

---

## ۱. درخت تمرکز (Focus Tree) در این مرحله
در فاز بعدی، تمرکز انحصاری و نهایی ما روی پیاده‌سازی دو تسک **F3.6** و **F3.7** جهت بستن پرونده فیچر **F3 (عینک سهمیه سراسری)** خواهد بود:

```
src/
├── pages/
│   ├── Config.tsx                            [تسک F3.6 ◀ افزودن پنل تنظیمات سهمیه، آپلود CSV و گزارش عدم تطبیق]
│   ├── PageDetail.tsx                        [تسک F3.6 ◀ مجهز به دکمه Quick Toggle سهمیه هماهنگ با لایو]
│   └── ProjectPages.tsx                      [تسک F3.7 ◀ تزریق تخصیص و رویدادهای فعال زنده به صف دسته‌ای]
│
├── core/queue/
│   ├── QueueCoordinator.ts                   [تسک F3.7 ◀ پذیرش اختیاری پارامترهای عینک (Lenses) در فرآیند چرخش صف]
│   └── TaskExecutor.ts                       [تسک F3.7 ◀ عبور دادن لیست کاندیداهای صف از پایپ‌لاین یکپارچه lensPipeline قبل از ارسال به AI]
│
├── services/pipeline/
│   └── lensPipeline.ts                       [پایپ‌لاین تک‌مرجع ادغام لایو + سهمیه — پیاده‌سازی‌شده و کامل ✅]
│
└── contexts/
    └── QuotaContext.tsx                      [مدیریت وضعیت سهمیه و همگام‌سازی localStorage — پیاده‌سازی‌شده و کامل ✅]
```

---

## ۲. وضعیت فعلی فیچر F3 (پایه‌های استوار و ساخته‌شده)
تا اینجا، تمامی مکانیزم‌های پردازش ریاضی Pure، همگام‌سازی Context و ساخت پایپ‌لاین تک‌مرجع به بهترین شکل صیقل یافته‌اند:
1. **`quotaService.ts` (کامل ✅):** حاوی محاسبات `computeImpressionWeights` (لگاریتمی فشرده در دامنه ۱ تا ۲)، فیلتر `applyQuotaLens` و مرتب‌سازی قطعی `sortByFinalScore`.
2. **`quotaAllocationService.ts` (کامل ✅):** عهده‌دار پیش‌محاسبه مپ تخصیص برای پروژه‌ها به روش Chunked صدتایی به همراه الگوریتم مقتدر بررسی امضا (Signature Key) بر پایه تعداد صفحات و زمان آخرین تحلیل.
3. **`quotaCsvService.ts` (کامل ✅):** فراهم‌کننده الگوهای دانلود CSV فارسی هماهنگ با Excel و پارسر مجهز به Zod جهت اعتبار‌سنجی داد‌ه‌ها و پاک‌سازی هوشمند اعداد فارسی/عربی.
4. **`QuotaContext.tsx` (کامل ✅):** ارائه دهنده وضعیت فعال‌بودن سهمیه (`globalEnabled`), سهمیه‌های اختصاصی صفحات (`perPageEnabled`), کل لینک‌های داخلی و rows. هماهنگ با `localStorage`. در `App.tsx` قرار دارد.
5. **`lensPipeline.ts` (کامل ✅):** ارکستراتور Pure ادغامِ همزمانِ لایو-زمانی و سهمیه‌بندی. تضمین‌کننده خروجی ۱۰۰٪ هم‌تراز در خروجی UI و ورودی Gemini.

---

## ۳. شرح فنی کامل تسک‌های فاز بعد

### تسک F3.6 — بخش رابط کاربری (UI): پنل Config + دکمه سریع PageDetail
این بخش مأموریت دارد ابزارهای مدیریتی فیچر سهمیه را به کاربر نهایی (متخصص SEO) تحویل دهد.

#### ۱. پنل تنظیمات در `src/pages/Config.tsx`
باید یک کارت شکیل با عنوان **«سهمیه سراسری و مدیریت ایمپرشن‌ها»** دقیقاً هماهنگ با استایل «Live Boost» (با رنگ اصلی آبی برند لینک‌مش) ایجاد شود:
* **سوییچ فعال‌بودن سراسری:** متصل به `quotaCtx.globalEnabled` و تابع تغییر آن.
* **ورودی عددی «تعداد کل لینک‌های داخلی سایت»:** یک input عددی شیک متصل به `quotaCtx.totalInternalLinks` با دکمه ذخیره یا همگام‌سازی بلادرنگ.
* **مدیریت CSV کاندیداها:**
  - دکمه **«دانلود فایل خام الگو»** متصل به `quotaCsvService.triggerDownloadTemplate()`.
  - دکمه **«آپلود فایل سهمیه»** مجهز به دراگ-اند-دراپ یا دیالوگ فایل که پس از دریافت فایل، متد `quotaCsvService.parseCsvFile` را به صورت ناهمزمان فرخوانده، خطاها را با Toast فارسی به کاربر نشان داده و ردیف‌های معتبر را روی `quotaCtx.setRows` ذخیره کند.
  - دکمه **«پاک کردن همه»** جهت ریست کردن ردیف‌ها و غیرفعال ساختن تخصیص با کانفِرم دیالوگ فارسی.
* **جدول پیش‌نمایش ردیف‌ها (Preview Table):**
  - نمایش ۲۵ ردیف نخست فایل بارگذاری شده شامل ستون‌های: `آدرس صفحه`، `عنوان (H1)`، `ایمپرشن`، `درصد سهمیه` و ستون محاسباتیِ **`سهمیه مجاز (دفعات لینک‌دهی)`** که فرمول آن عبارت است از:
    $$\text{Quota} = \max\left(0, \text{Math.round}\left(\frac{\text{percentage}}{100} \times \text{totalInternalLinks}\right)\right)$$
* **گزارش عدم تطبیق عنوان‌ها (Unmatched Titles Warning Alert):**
  - به کمک هوک یا افکت ساده، متد `getOrBuildAllocation(projectId, querySettings)` را با ردیف‌ها و لینک‌های فعلی صدا بزنید.
  - اگر خروجی دارای `unmatchedTitles` غیر تهی بود، یک نوتیفیکیشن هشدار زرد رنگ ملایم در پایین سکشن رندر کنید: **«تعداد N عنوان از فایل CSV با هیچ‌یک از صفحات پروژه مطابقت ندارند (دقت کنید عنوان‌ها باید با H1 صفحات در دیتابیس یکسان باشند)»** همراه با لیست دکمه‌ای جهت بازشدن پاپ‌آپ ریز عناوین جهت عیب‌یابی راحت.

#### ۲. دکمه فعال‌سازی سریع در `src/pages/PageDetail.tsx`
* دکمه فعال‌سازی انفرادی صفحه (Quick Toggle) کنار دکمه لایو: متصل به `quotaCtx.setPageEnabled(pgId, !isQuotaActiveHere)` با نشانگر رتینا برای مانیتورینگ سریع فعال یا غیرفعال بودن.
* ما از قبل کامپوننت `QuotaBadge` را طراحی کرده‌ایم و کارتها مجهز به آن هستند؛ فقط مطمئن شوید اطلاعات تخصیص (`quotaInfo`) به زیبایی لود و به نشانگر پاس داده شوند.

---

### تسک F3.7 — پیاده‌سازی تضمین سهمیه سراسری در پردازش صف دسته‌ای (`TaskExecutor`)
صف پردازش دسته‌ای کل پروژه تا پیش از این کاندیداها را به شکل کاملاً خام برش می‌زد. برای این که سقف لینک‌دهی سراسری به طور فیزیکی و با دقت ۱۰۰٪ اعمال شود، باید موتور فیلترینگ و تقویت را به درونِ فرآیند خودکار تحلیل صف دسته‌ای ببریم.

#### ۱. ارتقای متدهای لایه صف (با حفظ خلوص و عدم وابستگی به React/localStorage)
* **`QueueCoordinator.ts` / `runQueue`:**
  - امضای متد را به شرح زیر توسعه دهید تا ورودی عینک‌ها را به شکل اختیاری دریافت کند:
    ```typescript
    export async function runQueue(
      projectId: number,
      lensParams?: {
        temporalEvents?: TemporalEvent[];
        quotaAllocation?: QuotaAllocation;
      }
    ): Promise<void>
    ```
  - در زمان چرخش تکرارهای صفحات بدنه حلقه، این داده را مستقیماً به تابع executor منتقل کنید:
    ```typescript
    const executed = await executePage(projectId, page.id!, selectedModel, pages, lensParams);
    ```
* **`TaskExecutor.ts` / `executePage`:**
  - امضای پردازنده را پذیرای متغیرهای محیطی لایو و سهمیه کنید:
    ```typescript
    export async function executePage(
      projectId: number,
      pageId: number,
      model: string,
      allPages: Page[],
      lensParams?: {
        temporalEvents?: TemporalEvent[];
        quotaAllocation?: QuotaAllocation;
      }
    ): Promise<boolean>
    ```
  - متد برش کاندیداها را اصلاح کنید:
    - **به‌جای:** `const top30 = candidateList.slice(0, 30);`
    - **باید از:**
      ```typescript
      const processedCandidates = buildFinalCandidateList({
        candidates: candidateList,
        sourcePageId: pageId,
        temporal: lensParams?.temporalEvents && lensParams.temporalEvents.length > 0 ? {
          events: lensParams.temporalEvents,
          targetMetadata: new Map()
        } : undefined,
        quota: lensParams?.quotaAllocation ? {
          allocation: lensParams.quotaAllocation
        } : undefined
      });
      const top30 = processedCandidates.slice(0, 30);
      ```
  - غنی‌سازی کاندیداها را متناسب با `top30` ن نهایی انجام دهید.
  - کاندیداهای ورودی پرامپت ساز را با فراخوانی مجدد پایپ‌لاین یکپارچه هم‌تراز کنید:
    ```typescript
    const finalAiCandidates = buildFinalCandidateList({
      candidates: enrichedCandidates,
      sourcePageId: pageId,
      temporal: lensParams?.temporalEvents && lensParams.temporalEvents.length > 0 ? {
        events: lensParams.temporalEvents,
        targetMetadata: new Map()
      } : undefined,
      quota: lensParams?.quotaAllocation ? {
        allocation: lensParams.quotaAllocation
      } : undefined
    });
    ```
  - متد `finalAiCandidates` غنی‌شده و هم‌تراز را تحویل سازنده پرامپت `buildSinglePagePrompt(...)` دهید.

#### ۲. تزریق و مانیتورینگ در `src/pages/ProjectPages.tsx` (صفحه رنک و مدیریتِ صف)
* در بدنه صفحه `ProjectPages.tsx` ما از قبل به `useQuotaContext()` و `useTemporalContext()` دسترسی داریم (یا می‌توانیم اضافه کنیم).
* در زمان فراخوانی اثرگذار پردازش صف (`useEffect` راه‌اندازی و مانیتورینگ صف):
  - تدارکات سهمیه و لایحه زمانی را برآورد کنید:
    ```typescript
    const temporalEvents = temporalCtx.globalEnabled ? temporalCtx.getAllActiveEvents() : undefined;
    
    // لود ناهمزمان تخصیص سهمیه‌بندی با رعایت کش لایه سرویس
    let quotaAllocation: QuotaAllocation | undefined = undefined;
    if (quotaCtx.globalEnabled && quotaCtx.rows.length > 0) {
      quotaAllocation = await getOrBuildAllocation(id, quotaCtx.getSettings());
    }
    ```
  - پس از دریافت، تابع `processQueue(id, { temporalEvents, quotaAllocation })` را با اطلاعات غنی فراخوانی کنید.
  - این متد بسیار با اهمیت است، چرا که فرآیند صف را کاملاً با عینک‌ها هماهنگ می‌کند.
* پس از ثبت اتمام صف در `startProjectAnalysis` لایه انباشت یا شروع مجدد، فرمان ابطال کش سهمیه را نیز صادر کنید:
  `quotaAllocationService.invalidateProject(projectId)`.

---

## ۴. قوانین حیاتی و مطلق و ضد باگ‌ها
1. **قانون عدم دسترسی مستقیم دیتابیسی:** هیچ‌یک از لایه‌های صف یا UI کانفیگ نباید مستقیماً با آرایه‌های داخلی `db.ts` تعامل کنند؛ تمامی خواندن/نوشتن‌های اتمیک کماکان توسط Repositoryها انجام می‌شود.
2. **پیش‌فرض خاموش عینک سهمیه:** برخلاف لایحه لایو که به صورت سراسری در حالت پیش‌فرض روشن بود، عینک سهمیه به طور اکید تا زمانی که CSV معتبر لود نگردیده و سوییچ آن توسط متخصص روشن نشده باشد، در وضعیت **خاموش** کامل به سر خواهد برد تا الگوریتم‌های مرسوم سئو به خطر نیفتند.
3. **سازگاری ۱۰۰٪ با انواع مدل‌ها:** هر دو مسیر پردازش تک‌صفحه و صف خودکار به هیچ عنوان خروجی‌های Zod Schema جی‌سان جمینای را تغییر نداده و فرمت برگردانده شده توسط Gemini کاملاً معادل ساختار فاز اول باقی خواهد ماند.
4. **فارسی‌سازی پیام‌ها:** جهت تداعی هرچه صمیمانه‌تر حس کاربری، فیلدها و کلماتی لایک دکمه‌های کنترلی و هشدارهای تطابقی باید تماماً به صورت فارسی سلیس رندر شوند.

---

## ۵. چک‌لیست نهایی تست کیفیت (Acceptance Criteria)
نماینده بعدی باید با اجرای این سناریوها از اتمام بی‌نقص کار مطمئن شود:
- [x] در فرانت پیج `Config` فایل نمونه CSV دانلود شده هماهنگ با اکسل فارسی باشد و با کشیدن آن، جدول ردیف‌ها بدون باگ لود شود.
- [x] پس از وارد کردن مقدار تعداد کل لینک‌ها، سهمیه مجاز ردیف‌ها با دقت ریاضی و رند گردیدن در جدول منعکس شود.
- [x] فعال‌کردن سوییچ سریع در صفحه `PageDetail` کاندیداها را فیلتر کند (مقاصد فاقد سهمیه مبدأ مجاز کاملاً ناپدید شوند و مدیریت‌شده‌ها مجهز به `<QuotaBadge>` با حجم مصرفی مناسب گردند).
- [x] شروع تحلیل صف در پروژه با عینک سهمیه فعال، کاندیداهای در اولویت بالا همراه با سهمیه را جهت تایید و نگارش لینک‌ها به پرامپت Gemini پاس دهد.
- [x] دستور `npm run lint` و `npm run build` با حداکثر خلوص و فاقد ارور تایپی به اتمام برسد.
