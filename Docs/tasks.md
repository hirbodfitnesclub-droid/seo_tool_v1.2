# tasks.md — نقشه راه تسک‌ها (فاز فعال)

> **توجه آرشیو:** تسک‌های فازهای قبلی (R1–R13 ریفکتور لایه‌ای، F1 Inlink Analytics، F2 Temporal/Live Boost) **تکمیل شده‌اند** و برای کاهش بار کانتکست از این فایل حذف شدند. تاریخچهٔ کامل آن‌ها در history گیت موجود است. خلاصهٔ معماریِ ماندگارِ آن فیچرها در `ARCHITECTURE.md` نگه‌داری می‌شود.
>
> این فایل فقط تسک‌های **فیچر فعال F3 — عینک سهمیه سراسری** را نگه می‌دارد.

---

# فیچر F3 — Global Quota & Impression Lens (عینک سهمیه سراسری)

> **مرجع مطلق:** «شش قانون قطعی عینک سهمیه سراسری» در `PROJECT.md` و معماری کامل در `ARCHITECTURE.md §F3`. هر تصمیم در تسک‌های F3 باید با آن شش قانون سازگار باشد.
>
> **درس‌های منجمد از F2 که اینجا هم مطلق‌اند:** (الف) کل منطق لنز در سرویس Pure بماند، **هیچ** منطقی داخل کامپوننت UI جاسازی نشود. (ب) یک پایپ‌لاین **تک‌مرجع** هم برای نمایش و هم برای ارسال به AI صدا زده شود تا واگرایی UI/AI رخ ندهد. (ج) صفر تغییر در `scorer.ts`/`idfCalculator.ts`/`db.ts`/اسکیمای Dexie.
>
> **قاعدهٔ مشترک همهٔ تسک‌های F3:** حق نداری هیچ کدی را حدس بزنی؛ همین الان فایل‌های کانتکست را زنده بخوان، سپس کد بزن. کامنت‌ها و UI فارسی، RTL. هیچ کتابخانهٔ جدیدی (Papa Parse و Zod از قبل موجودند).

---

## تسک F3.1 — هستهٔ سرویس Pure عینک سهمیه (`quotaService.ts`)

### هدف
تعریف تایپ‌ها و منطق محاسباتی Pure لنز سهمیه: محاسبهٔ `impressionWeight`، اعمال فیلتر/وزن per-source، و سورت اکید. این فایل **هیچ** وابستگی به Dexie/React/localStorage ندارد (لایه Core/Service).

### راهنمای پیاده‌سازی فنی
۱. پوشهٔ `src/services/quota/` بساز. فایل `quotaService.ts`:
۲. تایپ‌ها را دقیقاً طبق `ARCHITECTURE.md §F3` تعریف کن: `QuotaRow`, `QuotaTargetInfo`, `QuotaAllocation`, `FinalCandidate`.
۳. `export const IMPRESSION_BOOST_STRENGTH = 1;` (ضریب کران‌دار؛ K=1 ⇒ بازهٔ ضریب [۱،۲]). به‌صورت ثابت بالای فایل با کامنت توضیحی.
۴. تابع `computeImpressionWeights(rows, matchedTitleToPageId): Map<number, number>`:
   - روی مقاصدِ matched: `logImpr = Math.log(impressions + 1)`؛ `minLog`/`maxLog`؛ `norm = (logImpr - minLog) / (maxLog - minLog)` با گارد تقسیم‌بر‌صفر (اگر `maxLog === minLog` → `norm = 0`).
   - `weight = 1 + IMPRESSION_BOOST_STRENGTH * norm`.
۵. تابع `normalizeTitle(s: string): string` — **هم‌رفتار با** `normalizeString` در `temporalService.ts` (حذف نیم‌فاصله `\u200c`→فاصله، فشرده‌سازی فاصله، trim، toLowerCase). برای تطبیق H1↔title.
۶. تابع `applyQuotaLens(candidates: any[], sourcePageId: number, allocation: QuotaAllocation): FinalCandidate[]`:
   - برای هر کاندیدا T: اگر `!allocation.byTarget.has(T.page_id)` → عبور با `quotaLabel='unmanaged'` (بدون تغییر امتیاز).
   - اگر managed و `allocation.byTarget.get(T.page_id).allowedSources.has(sourcePageId)` → نگه‌دار، `impressionWeight` را برای ضرب در `lensPipeline` الصاق کن، `quotaLabel='within-quota'`، `quotaInfo` را پر کن.
   - اگر managed و خارج از allowedSources → **از خروجی حذف کن** (`filter`).
   - **توجه:** این تابع `finalScore` را نمی‌سازد؛ ساخت `finalScore` و سورت نهایی در `lensPipeline` (تسک F3.5) متمرکز است تا ترکیب با لایو در یک نقطه باشد. این تابع فقط فیلتر + الصاق `impressionWeight`/برچسب‌ها را انجام می‌دهد.
۷. تابع `sortByFinalScore(list: FinalCandidate[]): FinalCandidate[]` — سورت اکید نزولی بر `finalScore`، tie-break: `page_id` صعودی (قطعی).

### محدودیت‌ها
- ✅ Pure و بدون side-effect؛ بدون import از React/Dexie/`window`/localStorage.
- ⛔ هیچ خواندن از Dexie یا تنظیمات؛ همه‌چیز از آرگومان می‌آید.
- ⛔ ساخت Allocation اینجا انجام **نمی‌شود** (آن در تسک F3.2 است).

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "Docks/PROJECT.md", "src/services/temporal/temporalService.ts", "src/core/scoring/scorer.ts", "src/utils/safeJson.ts"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.2 — سرویس تخصیص سراسری + کش (`quotaAllocationService.ts`)

### هدف
پیش‌محاسبهٔ سراسریِ «هر مقصد در کدام صفحات مجاز است» با کش per-project و الگوی Lazy/Chunked — آینهٔ دقیق `inlinkGraphService.ts`.

### راهنمای پیاده‌سازی فنی
۱. فایل `src/services/quota/quotaAllocationService.ts`. ساختار کش module-level دقیقاً مثل `inlinkGraphService` (Map با `signature`, `builtAt`, `buildPromise` برای جلوگیری از build همزمان).
۲. تایپ ورودی تنظیمات: `interface QuotaSettings { totalInternalLinks: number; rows: QuotaRow[]; }`.
۳. `computeSignature(projectId, settings)`: `${candidatesCount}:${latestComputedAt}:${hash(JSON.stringify(settings))}`.
   - `candidateRepository.countByProject` موجود است. برای `latestComputedAt` در صورت نبود متد، یک هلپر سبک با `listByProject` و `max(computed_at)` بنویس (یا متد جدید در repository با همان الگوی `resultRepository.getLatestGeneratedAt`).
   - `hash` می‌تواند یک hash رشته‌ای سادهٔ deterministic باشد (نه کتابخانه).
۴. `getOrBuildAllocation(projectId, settings): Promise<QuotaAllocation>` — منطق کش/buildPromise عیناً مثل `getOrBuildIndex`.
۵. `buildAllocation(projectId, settings)` طبق الگوریتم ۵مرحله‌ای `ARCHITECTURE.md §F3`:
   - `pageRepository.listByProject` → نقشهٔ `normalizeTitle(title) → pageId` (از `quotaService.normalizeTitle`).
   - تطبیق ردیف‌ها؛ `unmatchedTitles` را جمع کن؛ `quota = max(0, Math.round(percentage/100 * totalInternalLinks))`.
   - پیمایش `candidateRepository.listByProject` به‌صورت **chunked ۱۰۰تایی** با `await new Promise(r => setTimeout(r, 0))`؛ ساخت `edges: Map<targetId, {sourcePageId, edgeScore}[]>` با `safeJsonParse` (رکورد خراب skip شود).
   - `impressionWeight` با `quotaService.computeImpressionWeights`.
   - برای هر مقصد دارای quota: سورت یال‌ها بر `edgeScore` نزولی (tie-break `sourcePageId` صعودی) → `allowedSources = Set(top quota)` ؛ `assigned = min(quota, edges.length)`.
۶. `invalidateProject(projectId): void` — `cache.delete(projectId)`.

### محدودیت‌ها
- ✅ Main Thread با chunking؛ ⛔ بدون Web Worker، ⛔ بدون اسکن کامل بدون chunk.
- ⛔ بدون تغییر اسکیما؛ فقط کوئری‌های موجود repository (در صورت نیاز فقط متد read جدید سبک).
- ✅ انتخاب مبدأها صرفاً بر `edgeScore` خام (نه ایمپرشن) — طبق توجیه §F3.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/analysis/inlinkGraphService.ts", "src/repositories/candidateRepository.ts", "src/repositories/pageRepository.ts", "src/repositories/resultRepository.ts", "src/services/quota/quotaService.ts", "src/utils/safeJson.ts", "src/db.ts"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.3 — سرویس CSV سهمیه (`quotaCsvService.ts`) با Zod

### هدف
تولید تمپلیت و پارس امن CSV سهمیه (ستون‌های `URL، H1، Impressions، Percentage`) با نرمال‌سازی عددی — آینهٔ `temporalCsvService.ts`.

### راهنمای پیاده‌سازی فنی
۱. فایل `src/services/quota/quotaCsvService.ts`.
۲. `generateCsvTemplate()`: هدر فارسی + BOM (`\uFEFF`) برای Excel فارسی. ستون‌ها: `آدرس صفحه,عنوان (H1),ایمپرشن,درصد سهمیه`. دو ردیف نمونه (مثلاً تور کیش/تور مشهد).
۳. `triggerDownloadTemplate()`: عیناً الگوی دانلود temporalCsvService با نام فایل `linkmesh-quota-template.csv`.
۴. `parseCsvFile(file): Promise<{ rows: QuotaRow[]; errors: string[] }>` با Papa Parse (`header:true`, `skipEmptyLines:true`, `transformHeader` برای حذف BOM/trim) و Zod:
   - schema: `عنوان (H1)` اجباری (`min(1)`)، `درصد سهمیه` اجباری، `ایمپرشن` و `آدرس صفحه` اختیاری.
   - **نرمال‌سازی عددی:** ارقام فارسی/عربی → لاتین؛ حذف `%`، جداکنندهٔ هزارگان و فاصله؛ سپس `Number(...)`. اگر `percentage` نامعتبر یا ≤۰ → ردیف skip با پیام فارسی «ردیف N: درصد سهمیه نامعتبر». `impressions` نامعتبر → پیش‌فرض ۰.
   - هر ردیف معتبر → `QuotaRow` (title همان مقدار خام H1؛ نرمال‌سازی برای تطبیق در زمان build انجام می‌شود نه ذخیره).

### محدودیت‌ها
- ✅ ردیف نامعتبر skip شود نه crash؛ پیام‌های خطا فارسی و شماره‌دار.
- ⛔ بدون کتابخانهٔ جدید؛ فقط Papa Parse + Zod موجود.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/temporal/temporalCsvService.ts", "src/services/quota/quotaService.ts", "package.json"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.4 — `QuotaContext` + Persistence (localStorage)

### هدف
مدیریت state سراسری سهمیه و sync با localStorage — آینهٔ `TemporalContext.tsx`.

### راهنمای پیاده‌سازی فنی
۱. فایل `src/contexts/QuotaContext.tsx`. کلیدها: `LINKMESH_QUOTA_GLOBAL_ENABLED` (پیش‌فرض `false` — این فیچر باید آگاهانه روشن شود)، `LINKMESH_QUOTA_PER_PAGE`، `LINKMESH_QUOTA_TOTAL_LINKS` (عدد)، `LINKMESH_QUOTA_CSV_ROWS`.
۲. state: `globalEnabled`, `perPageEnabled: Record<number, boolean>`, `totalInternalLinks: number`, `rows: QuotaRow[]`. Lazy init از localStorage + `useEffect` برای sync (عیناً الگوی TemporalContext).
۳. توابع: `setGlobalEnabled`, `setPageEnabled`, `setTotalInternalLinks`, `setRows`, `isEnabledForPage(pageId)`, و یک هلپر `getSettings(): QuotaSettings` که `{ totalInternalLinks, rows }` برمی‌گرداند (برای پاس به `getOrBuildAllocation`). `useMemo` برای contextValue.
۴. `App.tsx`: `<QuotaProvider>` را **بیرونی‌تر یا کنار** `<TemporalProvider>` قرار بده (هر دو provider مستقل‌اند).

### محدودیت‌ها
- ✅ پیش‌فرض `globalEnabled=false` (برخلاف لایو که true بود) — تا بدون CSV/عدد، رفتار سیستم تغییر نکند.
- ⛔ بدون ذخیره در Dexie.

`CONTEXT_FILES: ["src/contexts/TemporalContext.tsx", "src/App.tsx", "src/services/quota/quotaService.ts", "src/services/quota/quotaCsvService.ts"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.5 — پایپ‌لاین ترکیبی تک‌مرجع (`lensPipeline.ts`) + هم‌ترازی مسیر AI و نمایش

### هدف
**مهم‌ترین تسک F3.** ساخت یک نقطهٔ واحد که ترتیب و ترکیب لنزها (لایو سپس سهمیه) را تعریف می‌کند، و بازآرایی `PageDetail.tsx` و `analysisService.ts` تا **هر دو** همین تابع را صدا بزنند (درس F2).

### راهنمای پیاده‌سازی فنی
۱. فایل `src/services/pipeline/lensPipeline.ts`. تابع:
   ```
   buildFinalCandidateList({
     candidates, sourcePageId,
     temporal?: { events: TemporalEvent[]; today? },
     quota?: { allocation: QuotaAllocation },
   }): FinalCandidate[]
   ```
   منطق:
   - `list = candidates`
   - اگر `temporal` → `list = applyTemporalBoost(list, temporal)` (از temporalService).
   - اگر `quota` → `list = applyQuotaLens(list, sourcePageId, quota.allocation)` (از quotaService).
   - محاسبهٔ `finalScore = baseScore × (temporalMultiplier ?? 1) × (impressionWeight ?? 1)` که `baseScore = c.score` خام.
   - **حفظ رفتار F2 (بدون رگرسیون):** اگر `quota` نباشد و فقط `temporal` باشد، باید **دقیقاً** معادل `buildLiveOrderedList` خروجی بدهد (سورت: `temporalMultiplier` نزولی سپس `boostedScore` نزولی). یعنی در این حالت به همان مسیر delegate کن. فقط وقتی `quota` حاضر است، سورت یکپارچهٔ `sortByFinalScore` اعمال شود.
   - اگر نه temporal و نه quota → همان `candidates` بدون تغییر برگردد.
۲. `PageDetail.tsx`:
   - یک allocation برای صفحه لازم است؛ آن را از طریق یک هوک سبک `useQuotaAllocation(projectId)` (یا مستقیم در یک `useEffect`/state) از `quotaAllocationService.getOrBuildAllocation(projectId, quotaCtx.getSettings())` بگیر (با Spinner در حال ساخت، مثل inlink).
   - `processedCandidates` useMemo را طوری به‌روزرسانی کن که `buildFinalCandidateList({ candidates: candidateList, sourcePageId: pgId, temporal: isTemporalActiveHere ? {events} : undefined, quota: isQuotaActiveHere && allocation ? {allocation} : undefined })` را صدا بزند.
   - **هیچ** منطق فیلتر/سورت/تخصیص داخل کامپوننت اضافه نشود.
۳. `analysisService.runSinglePageAnalysis`:
   - امضا را گسترش بده تا allocation (یا quotaSettings) اختیاری بپذیرد؛ به‌جای فراخوانی مستقیم `buildLiveOrderedList`، `buildFinalCandidateList(...)` را صدا بزن (هم قبل از enrichment برای انتخاب، هم پس از enrichment برای ترتیب نهایی — مطابق الگوی فعلی دو مرحله‌ای). سپس `top30` از لیست نهایی.
   - فراخوان از `PageDetail.handleAIAnalysis` باید allocation/فعال‌بودن سهمیه را پاس بدهد.

### محدودیت‌ها
- ⛔ صفر منطق لنز در UI؛ تنها صدا زدن `buildFinalCandidateList`.
- ✅ ترتیب نمایش = ترتیب ورودی AI (تست انطباق).
- ✅ خاموش بودن سهمیه ⇒ خروجی بایت-به-بایت معادل رفتار فعلی F2.
- ⛔ بدون تغییر در فرمت prompt یا schema Gemini.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/temporal/temporalService.ts", "src/services/quota/quotaService.ts", "src/services/quota/quotaAllocationService.ts", "src/services/analysis/analysisService.ts", "src/pages/PageDetail.tsx", "src/contexts/QuotaContext.tsx", "src/contexts/TemporalContext.tsx"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.6 — UI: سکشن تنظیمات در Config + Quick Toggle + `QuotaBadge`

### هدف
رابط کاربری فیچر: ورودی عدد کل لینک‌ها، آپلود CSV، سوییچ سراسری، گزارش تطبیق، و نشانگر روی کارت‌ها — آینهٔ بصری سکشن لایو.

### راهنمای پیاده‌سازی فنی
۱. `src/pages/Config.tsx` — یک سکشن جدید «سهمیه سراسری و اولویت ایمپرشن» (هم‌سبک سکشن Live Boost):
   - سوییچ سراسری (`quotaCtx.globalEnabled`).
   - **ورودی عددی** «تعداد کل لینک‌های داخلی سایت» (مثلاً ۳۶۸۷) → `quotaCtx.setTotalInternalLinks`.
   - دکمه‌های «دانلود تمپلیت» و «آپلود CSV» با `quotaCsvService` (الگوی دقیق آپلود temporal: try/parse/toast خطا+موفق، ریست input).
   - جدول preview ردیف‌های بارگذاری‌شده (عنوان، درصد، ایمپرشن، سهمیهٔ محاسبه‌شده اگر total موجود) + «حذف همه».
   - نمایش گزارش `unmatchedTitles` (اگر allocation ساخته شد) به‌صورت هشدار فارسی.
۲. `src/components/QuotaBadge.tsx` — آینهٔ `TemporalBadge`: روی کارت‌های `within-quota` نشانگر کوچک (مثلاً «سهمیه N» + آیکن ایمپرشن). برای `unmanaged` چیزی نمایش نده.
۳. `src/pages/PageDetail.tsx` — یک Quick Toggle کوچک کنار toggle لایو (`quotaCtx.setPageEnabled(pgId, ...)`) و رندر `QuotaBadge` روی کارت‌ها (مثل TemporalBadge).

### محدودیت‌ها
- ✅ فارسی، RTL، هم‌سبک با سکشن لایو موجود (رنگ‌های emerald/blue).
- ⛔ هیچ منطق محاسباتی در UI؛ فقط فراخوانی سرویس/Context.

`CONTEXT_FILES: ["src/pages/Config.tsx", "src/pages/PageDetail.tsx", "src/contexts/QuotaContext.tsx", "src/components/TemporalBadge.tsx", "src/services/quota/quotaAllocationService.ts", "src/services/quota/quotaCsvService.ts"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## تسک F3.7 — تضمین سراسری در مسیر صف دسته‌ای (`TaskExecutor`) [تکمیلی]

### هدف
سقف سراسری فقط زمانی واقعاً تضمین می‌شود که **تحلیل دسته‌ای کل پروژه** هم لنز را اعمال کند. این تسک لنز را به مسیر صف می‌برد، با حفظ خلوص لایه `core/queue` (بدون localStorage/React).

### راهنمای پیاده‌سازی فنی
۱. در `analysisService.startProjectAnalysis` (که تنظیمات/Context در دسترس‌اند یا از caller پاس داده می‌شوند)، یک‌بار `allocation` و `events` لایو را resolve کن.
۲. این داده‌ها را از طریق `QueueCoordinator` به `TaskExecutor.executePage` **تزریق** کن (پارامتر جدید اختیاری مثل `lensContext`). `core/queue` نباید مستقیم localStorage بخواند.
۳. در `executePage`، اگر `lensContext` حاضر بود، به‌جای `candidateList.slice(0,30)` خام، `buildFinalCandidateList(...)` را صدا بزن سپس top30.
۴. در `startProjectAnalysis` پس از اتمام، `quotaAllocationService.invalidateProject(projectId)` را هم‌گام با `inlinkGraphService.invalidateProject` صدا بزن.

### محدودیت‌ها
- ⛔ `core/queue` به localStorage/React وصل نشود؛ همه‌چیز تزریقی.
- ✅ اگر `lensContext` نباشد، رفتار صف دقیقاً مثل قبل (سازگاری عقب‌رو).
- ⛔ بدون تغییر در فرمت `results` یا schema Gemini.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/core/queue/TaskExecutor.ts", "src/core/queue/QueueCoordinator.ts", "src/services/analysis/analysisService.ts", "src/services/pipeline/lensPipeline.ts", "src/services/quota/quotaAllocationService.ts"]`

> **یادآوری:** فایل‌های کانتکست را زنده بخوان، سپس کد بزن.

---

## ترتیب اجرای فیچر F3 (الزامی)

```
F3.1 (quotaService — Pure)
   └→ F3.2 (Allocation + Cache)        ── F3.3 (CSV Service)
            │                                   │
            └────────────┬──────────────────────┘
                         └→ F3.4 (QuotaContext)
                                 └→ F3.5 (lensPipeline + هم‌ترازی UI/AI)   ← قلب فیچر
                                         └→ F3.6 (UI: Config + Badge + Toggle)
                                                 └→ F3.7 (مسیر صف دسته‌ای — تکمیلی)
```

- F3.1، F3.3 می‌توانند مستقل شروع شوند؛ F3.2 به F3.1 وابسته است.
- F3.5 به F3.1/F3.2/F3.4 وابسته است و **حساس‌ترین** تسک از نظر «تک‌مرجع بودن پایپ‌لاین» است.
- F3.7 آخرین و اختیاری است (می‌تواند به فاز بعد موکول شود اگر صرفاً نمایش/تک‌صفحه کافی باشد).

## معیار پذیرش کل فیچر F3
1. `scorer.ts`/`idfCalculator.ts`/`db.ts`/اسکیمای Dexie diff = 0. هیچ جدول/ایندکس/migration جدید.
2. مقصد با سهمیهٔ ۶۰ در حداکثر ۶۰ صفحهٔ مبدأ (بهترین‌ها بر اساس edgeScore) کاندیدا می‌شود و در بقیه حذف است.
3. مقصد پرایمپرشن نسبت به مقصدِ کم‌ایمپرشن با امتیاز خام مشابه، بالاتر نمایش داده می‌شود؛ ضریب کران‌دار است (ربط معنایی حاکم می‌ماند).
4. خاموش بودن سهمیه ⇒ رفتار F2/خام دقیقاً حفظ شود.
5. ترتیب `displayedCandidates` در UI با ورودی `buildSinglePagePrompt` یکسان است (انطباق UI/AI).
6. CSV نامعتبر → خطای فارسی + گزارش `unmatchedTitles`؛ تنظیمات پس از reload بازخوانی شود.
7. پروژهٔ ۷۰۰ صفحه‌ای: ساخت Allocation بدون freeze؛ `tsc --noEmit` بدون خطا.
