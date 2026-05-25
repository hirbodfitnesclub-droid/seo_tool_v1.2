# tasks.md — نقشه راه ریفکتور لایه‌ای (فاز ۱.۵)

> فاز ۱ (تسک‌های ۱ تا ۱۱) کامل شده و در history این فایل بایگانی است. این نسخه فقط تسک‌های ریفکتور را تعریف می‌کند.

---

## قوانین مشترک تمام تسک‌های این فاز

این بندها برای **هر تسک** بدون استثنا اعمال می‌شوند:

۱. **حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.**

۲. **الگوریتم `scorer.ts` و خروجی عددی آن مطلقاً تغییر نمی‌کند.** کپی مرجع در ریشه پروژه (`/scorer.ts`) قرار دارد. بعد از هر تسکی که به `scorer` نزدیک می‌شود، خروجی این فایل را با کپی مرجع `diff` بگیر و اطمینان حاصل کن فقط `import path`ها تغییر کرده‌اند.

۳. هیچ کتابخانه جدیدی اضافه نمی‌شود مگر `zod` (در تسک ۳). سایر افزایش‌ها ممنوع.

۴. کامنت‌ها فارسی. متن UI فارسی. RTL.

۵. اگر یک فایل قدیمی به مکان جدید منتقل شد، در محل قدیمی **یک شیم re-export** بگذار تا importهای موجود نشکنند. در آخرین تسک شیم‌ها پاک می‌شوند.

۶. هیچ تسکی نباید رفتار قابل مشاهده برای کاربر را تغییر دهد. این فاز ریفکتور است نه ویژگی.

---

## تسک R1 — لایه Infrastructure: ساخت Repository Pattern روی Dexie

### هدف
حذف وابستگی مستقیم کامپوننت‌ها و هوک‌ها به `db.*`. تمام دسترسی به Dexie پشت تعدادی تابع async در `src/repositories/*` قرار می‌گیرد.

### راهنمای پیاده‌سازی فنی
۱. پوشه `src/repositories/` بساز.
۲. این فایل‌ها را ایجاد کن — هر کدام فقط توابع async ناب با signature تایپ‌دار:
   - `projectRepository.ts` → `getById`, `list`, `create`, `update`, `remove`
   - `pageRepository.ts` → `listByProject`, `getById`, `bulkAdd`, `countByProject`
   - `weightRepository.ts` → `listByProject`, `bulkUpsert`
   - `candidateRepository.ts` → `getByPage`, `bulkAdd`, `clearByProject`, `countByProject`
   - `resultRepository.ts` → `getByPage`, `listByProject`, `upsert`, `clearByProject`
   - `queueRepository.ts` → `getByProject`, `create`, `update`, `markStatus(id, status)`, `advance(id, idx)`, `findInterrupted()`
   - `idfRepository.ts` → `getByProject`, `upsert`
۳. هیچ کامپوننت/هوکی در این تسک ویرایش نشود؛ فقط زیرساخت اضافه می‌شود.
۴. هر فایل با کامنت فارسی هدر شروع شود که مسئولیتش را توضیح دهد.

### محدودیت‌ها
- ✅ فقط wrapper روی `db.*` — هیچ منطق بیزینسی
- ✅ هر تابع باید Promise بازگرداند با تایپ خروجی دقیق
- ⛔ هیچ import از React یا lucide یا کامپوننت

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/db.ts", "src/hooks/useAnalysisQueue.ts", "src/utils/queueProcessor.ts", "src/utils/candidateStorage.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R2 — لایه API: کلاینت Gemini با Exponential Backoff + جداسازی PromptBuilder

### هدف
شکستن `src/utils/gemini.ts` به سه فایل با مسئولیت‌های جدا، و افزودن مقاومت در برابر خطاهای 429 و 5xx.

### راهنمای پیاده‌سازی فنی
۱. پوشه `src/services/api/` بساز.
۲. `src/services/api/promptBuilder.ts`:
   - تابع `buildSinglePagePrompt` را **بدون تغییر متن پرامپت** از `src/utils/gemini.ts` به اینجا منتقل کن.
   - تابع legacy `buildPrompt` را هم منتقل کن.
۳. `src/services/api/geminiSchema.ts`:
   - **این تسک نصب Zod است.** ابتدا با Bash نصب کن: `pnpm add zod` (یا package manager پروژه — lockfile را چک کن).
   - schema تعریف کن:
     ```ts
     export const GeminiSelectedLinksSchema = z.object({
       user_intent: z.string().optional(),
       selected_links: z.array(z.object({
         page_id: z.number(),
         title: z.string(),
         reason: z.string()
       }))
     });
     ```
۴. `src/services/api/geminiClient.ts`:
   - تابع `callGemini(prompt, model)` با همان signature قبلی.
   - حلقه retry با حداکثر ۵ تلاش.
   - فقط برای `429` و `5xx` retry با delay `min(60000, 2^attempt * 1000 + random jitter 0-500)`.
   - بعد از parse JSON، آن را با `GeminiSelectedLinksSchema.safeParse` اعتبارسنجی کن. اگر invalid بود، error با پیام فارسی throw کن.
۵. `src/utils/gemini.ts` را به یک شیم re-export تبدیل کن که `callGemini` و `buildSinglePagePrompt` و `buildPrompt` را از مسیرهای جدید export می‌کند — به این ترتیب importهای فعلی در `queueProcessor.ts` و سایر جاها نمی‌شکنند.

### محدودیت‌ها
- ✅ متن پرامپت یک بایت هم تغییر نکند
- ✅ signature تابع `callGemini` ثابت بماند
- ⛔ بدون تغییر در `/api/gemini` proxy یا `server.ts`

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/gemini.ts", "src/utils/queueProcessor.ts", "src/pages/PageDetail.tsx", "package.json"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R3 — مقاوم‌سازی CSV Parser با Zod

### هدف
جلوگیری از crash برنامه وقتی ستون CSV گم یا نامعتبر است. خطاها به صورت گزارش به کاربر برمی‌گردند نه exception.

### راهنمای پیاده‌سازی فنی
۱. `src/services/io/csvParser.ts` بساز.
۲. منطق فعلی `src/utils/csvParser.ts` را به اینجا منتقل کن، اما:
   - یک `z.object({...})` schema بر اساس `CATEGORIES` (از `src/constants/categories.ts`) بساز که فیلد `'عنوان_H1'` اجباری و باقی optional/nullable.
   - برای هر ردیف `safeParse` اجرا کن؛ اگر invalid بود به آرایه `errors` پیام واضح فارسی اضافه کن (مثلاً «ردیف ۴۲: ستون عنوان_H1 خالی است») و آن ردیف را skip کن.
   - تابع `sanitizeString` همان است.
۳. signature خروجی `parseCSV` (یعنی `ParseResult`) و نحوه استفاده آن تغییر نکند.
۴. `src/utils/csvParser.ts` را به شیم re-export تبدیل کن.

### محدودیت‌ها
- ✅ قراردادهای ورودی/خروجی تابع `parseCSV` ثابت
- ✅ ردیف‌های invalid حذف می‌شوند نه کل فایل
- ⛔ هیچ تغییر در UI آپلود (`NewProject.tsx`)

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/csvParser.ts", "src/constants/categories.ts", "src/pages/NewProject.tsx"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R4 — انتقال Core Algorithm به مکان جدید (بدون تغییر منطق)

### هدف
جداسازی منطق امتیازدهی از پوشه `utils` و انتقال به `src/core/scoring/` به‌گونه‌ای که در Web Worker قابل اجرا باشد (هیچ ارجاع به `window`/`document`/`db` نداشته باشد).

### راهنمای پیاده‌سازی فنی
۱. پوشه `src/core/scoring/` بساز.
۲. `src/utils/scorer.ts` را به `src/core/scoring/scorer.ts` **کپی کن — بدون یک کاراکتر تغییر در توابع، ضرایب، یا ترتیب لایه‌ها.** فقط مسیر `import { PERSIAN_MONTHS_ORDER, MONTH_TO_SEASON } from '../constants/categories'` به `'../../constants/categories'` تغییر می‌کند.
۳. `src/utils/idfCalculator.ts` را به همان روش به `src/core/scoring/idfCalculator.ts` منتقل کن. مسیر `import { type Page } from '../db'` به این تبدیل می‌شود: یک type محلی `interface PageLike { categories: string }` در همان فایل تعریف کن و وابستگی به `db.ts` را قطع کن (زیرا core نباید به Dexie وصل باشد). signature `computeIDFMap(pages)` ثابت می‌ماند چون فقط `categories: string` استفاده می‌شود.
۴. تأیید کن هیچ‌جای فایل scorer جدید به `db`، `window`، `document`، یا React وابسته نیست.
۵. فایل‌های قدیمی `src/utils/scorer.ts` و `src/utils/idfCalculator.ts` را به شیم re-export تبدیل کن:
   ```ts
   export * from '../core/scoring/scorer';
   ```
۶. **اعتبارسنجی نهایی:** فایل `src/core/scoring/scorer.ts` را با `/scorer.ts` (کپی مرجع کاربر در ریشه) از نظر منطقی diff بگیر. تنها تفاوت مجاز: مسیر import.

### محدودیت‌ها
- ✅ منطق scorer دست‌نخورده
- ✅ test فایل `src/utils/scorer.test.ts` باید بدون تغییر pass شود
- ⛔ هیچ تغییر در signature توابع صادر شده

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "scorer.ts", "src/utils/scorer.ts", "src/utils/idfCalculator.ts", "src/utils/scorer.test.ts", "src/constants/categories.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R5 — انتقال محاسبه سنگین به Web Worker

### هدف
خروج `computeAllCandidates` و `computeIDFMap` از Main Thread برای حذف UI Freeze در پروژه‌های چند هزار صفحه‌ای.

### راهنمای پیاده‌سازی فنی
۱. `src/workers/scoringWorker.ts` بساز:
   - import از `../core/scoring/scorer` و `../core/scoring/idfCalculator`
   - گوش دادن به message با `type: 'COMPUTE'`، اجرا، و post نتیجه با `type: 'DONE'` یا `type: 'ERROR'`.
   - چون خروجی scorer یک `Map` است، قبل از postMessage آن را به `Array.from(map.entries())` تبدیل کن (Map قابل clone نیست).
۲. `src/services/scoring/scoringService.ts` بساز:
   - تابع `computeCandidatesInWorker(pages): Promise<Map<number, CandidateWithTags[]>>`
   - از سینتکس Vite worker: `import ScoringWorker from '../../workers/scoringWorker?worker'`
   - بعد از دریافت پیام، آرایه را دوباره به Map تبدیل کن و worker را terminate کن.
   - تابع `computeIDFInWorker(pages): Promise<IDFMap>` هم اضافه کن.
۳. `src/utils/candidateStorage.ts` را آپدیت کن:
   - به‌جای صدا زدن مستقیم `computeAllCandidates` و `computeIDFMap`، از `scoringService` استفاده کن.
   - دسترسی به Dexie را با `candidateRepository` و `idfRepository` (از تسک R1) جایگزین کن.

### محدودیت‌ها
- ✅ خروجی نهایی ذخیره‌شده در Dexie باید **بایت-به-بایت** با قبل برابر باشد (همان الگوریتم، همان داده)
- ✅ کاربر باید UI روان داشته باشد حتی با ۵۰۰۰ صفحه
- ⛔ هیچ logic algorithm درون worker تغییر نکند — فقط فراخوانی توابع core

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/candidateStorage.ts", "src/core/scoring/scorer.ts", "src/core/scoring/idfCalculator.ts", "vite.config.ts", "src/repositories/candidateRepository.ts", "src/repositories/idfRepository.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R6 — شکستن queueProcessor به QueueManager + TaskExecutor + Coordinator

### هدف
حذف فایل خداگونه `queueProcessor.ts` و تقسیم به سه ماژول با مسئولیت تک‌وظیفه‌ای (SRP).

### راهنمای پیاده‌سازی فنی
۱. پوشه `src/core/queue/` بساز.

۲. `src/core/queue/QueueManager.ts`:
   - فقط مسئول state transitions صف.
   - متدها: `start(projectId, totalPages, model)`, `markProcessing(queueId)`, `markPaused(queueId)`, `markCompleted(queueId)`, `markFailed(queueId, error)`, `advance(queueId, newIndex)`, `isPausedOrFailed(queueId)`.
   - تمام عملیات Dexie از طریق `queueRepository` (تسک R1) انجام شود.

۳. `src/core/queue/TaskExecutor.ts`:
   - یک متد `executePage(projectId, pageId, model): Promise<void>`.
   - مراحل: `candidateRepository.getByPage` → enrichment فعلی → `promptBuilder.buildSinglePagePrompt` → `geminiClient.callGemini` → `resultRepository.upsert` در یک transaction.
   - **منطق enrichment کاندیداها** (همان `enrichedCandidates` در queueProcessor فعلی که categories را از pages می‌گیرد) را دقیقاً منتقل کن.

۴. `src/core/queue/QueueCoordinator.ts`:
   - تابع entry: `runQueue(projectId): Promise<void>`.
   - حلقه از `current_page_index` تا `total_pages`:
     - چک `QueueManager.isPausedOrFailed` در هر iteration
     - `TaskExecutor.executePage(...)`
     - `QueueManager.advance(...)`
     - `sleep(2000)`
   - در پایان `markCompleted`. در exception داخلی `markFailed`.

۵. `src/utils/queueProcessor.ts` را به شیم تبدیل کن:
   ```ts
   export { runQueue as processQueue } from '../core/queue/QueueCoordinator';
   ```

### محدودیت‌ها
- ✅ رفتار قابل مشاهده صف یکسان (مکث ۲ ثانیه، ذخیره دانه‌به‌دانه، pause/resume)
- ✅ `TaskExecutor` به Web Worker وابسته نیست (فقط `Coordinator` و `Worker` در آینده برای scoring استفاده می‌شوند)
- ⛔ بدون تغییر در فرمت ذخیره `results`

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/queueProcessor.ts", "src/repositories/queueRepository.ts", "src/repositories/resultRepository.ts", "src/repositories/candidateRepository.ts", "src/repositories/pageRepository.ts", "src/services/api/promptBuilder.ts", "src/services/api/geminiClient.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R7 — Auto-Resume Hook بعد از بسته شدن تب

### هدف
وقتی کاربر در میان پردازش تب را می‌بندد و دوباره باز می‌کند، صف‌هایی که status='processing' دارند ولی updated_at آن‌ها قدیمی است باید به وضعیت 'paused' تبدیل شوند تا کاربر بتواند آگاهانه resume کند.

### راهنمای پیاده‌سازی فن��
۱. `src/repositories/queueRepository.ts` (از تسک R1) — متد `findInterrupted()` را پیاده کن:
   - تمام رکوردهای `status === 'processing'` که `updated_at` آن‌ها بیش از ۳۰ ثانیه از زمان فعلی فاصله دارد را بازگرداند.

۲. `src/hooks/useQueueAutoResume.ts` بساز:
   - یک `useEffect` با dependency خالی که در mount اول اپ اجرا می‌شود.
   - `queueRepository.findInterrupted()` را صدا بزن و برای هر کدام `QueueManager.markPaused(id, 'برنامه به‌طور غیرمنتظره بسته شد. برای ادامه روی resume کلیک کنید.')` را اجرا کن.

۳. `src/App.tsx` — هوک را در سطح بالای کامپوننت App صدا بزن (یک‌بار در lifetime اپ).

### محدودیت‌ها
- ✅ هیچ auto-resume خودکار. فقط mark as paused. کاربر دکمه را خودش بزند.
- ✅ پیام خطا فارسی
- ⛔ بدون تغییر در `QueueProgress.tsx` (پشتیبانی paused از قبل هست)

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/repositories/queueRepository.ts", "src/core/queue/QueueManager.ts", "src/App.tsx", "src/components/QueueProgress.tsx"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R8 — Slim کردن useAnalysisQueue + ساخت Selector Hooks (تکمیل شده)

### هدف
کاهش re-render در پروژه‌های با صفحات زیاد. هوک `useAnalysisQueue` فعلاً هر تغییر کوچک status باعث rerender کل لیست می‌شود.

### راهنمای پیاده‌سازی فنی
۱. `src/hooks/useAnalysisQueue.ts` — refactor:
   - `useLiveQuery` همان جا بماند ولی توابع کنترل (`startQueue`, `pauseQueue`, `resumeQueue`) با `QueueManager` (تسک R6) جایگزین شوند نه فراخوانی مستقیم `db.*`.
   - هیچ منطق پردازش در این هوک نباشد (فقط getter + control).

۲. `src/hooks/useQueueStatus.ts` بساز (هوک سبک selector):
   ```ts
   // فقط فیلد status را برمی‌گرداند؛ تغییر current_page_index باعث re-render نمی‌شود
   export function useQueueStatus(projectId: number): QueueStatus | undefined {
     return useLiveQuery(
       () => queueRepository.getByProject(projectId).then(q => q?.status),
       [projectId]
     );
   }
   ```
   مشابه `useQueueProgress` (فقط `{ current, total }`).

۳. `src/pages/ProjectPages.tsx`:
   - جاهایی که فقط به `status` نیاز است از `useQueueStatus` استفاده کن.
   - `QueueProgress` کامپوننت را با `React.memo` بپیچ.
   - row صفحه‌ها در لیست را به یک کامپوننت جدا `PageListItem` با `React.memo` تبدیل کن.

### محدودیت‌ها
- ✅ رفتار UI ثابت بماند
- ✅ هیچ خطای تایپ
- ⛔ بدون تغییر در API هوک‌های صادر شده

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/hooks/useAnalysisQueue.ts", "src/pages/ProjectPages.tsx", "src/components/QueueProgress.tsx", "src/repositories/queueRepository.ts", "src/core/queue/QueueManager.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R9 — انتقال منطق بیزینسی از کامپوننت‌ها به analysisService (تکمیل شده)

### هدف
صفحات React باید Dumb باشند. تمام handlerهای پیچیده درون `ProjectPages.tsx` و `PageDetail.tsx` به یک service مرکزی منتقل می‌شوند.

### راهنمای پیاده‌سازی فنی
۱. `src/services/analysis/analysisService.ts` بساز با این توابع:
   - `startProjectAnalysis(projectId, model, mode: 'all' | 'pending')` — معادل `handleRunAnalysis` فعلی.
   - `runSinglePageAnalysis(projectId, pageId, model)` — معادل کلیک «بررسی با هوش مصنوعی» در `PageDetail.tsx`.
   - `recomputeCandidates(projectId)` — معادل `handleComputeCandidates`.
   - هر کدام از این توابع از repositories، scoringService، و QueueManager استفاده می‌کند.

۲. `src/pages/ProjectPages.tsx`:
   - حذف منطق داخل `handleRunAnalysis`/`handleComputeCandidates`؛ فقط `await analysisService.startProjectAnalysis(...)` و toast.
   - کامپوننت فقط با hooks (state UI) و service صحبت می‌کند.

۳. `src/pages/PageDetail.tsx`:
   - معادل بالا برای handler تک‌صفحه‌ای.

۴. `src/pages/Results.tsx`:
   - منطق `downloadCSV` به `src/services/io/csvExporter.ts` منتقل شود.

### محدودیت‌ها
- ✅ رفتار قابل مشاهده ثابت
- ✅ کامپوننت‌ها بعد از این، هیچ `import { db }` نداشته باشند
- ⛔ بدون تغییر در ظاهر صفحات

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/ProjectPages.tsx", "src/pages/PageDetail.tsx", "src/pages/Results.tsx", "src/repositories/projectRepository.ts", "src/repositories/queueRepository.ts", "src/core/queue/QueueManager.ts", "src/utils/candidateStorage.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک R10 — پاک‌سازی نهایی، حذف شیم‌ها و فایل‌های تکراری

### هدف
بعد از پایداری تسک‌های R1..R9، شیم‌های موقتی و کپی‌های تکراری حذف می‌شوند.

### راهنمای پیاده‌سازی فنی
۱. پوشه ریشه‌ای `/utils/` (که حاوی نسخه قدیمی فایل‌هاست — `utils/scorer.ts`, `utils/queueProcessor.ts`, ...) را به‌طور کامل **حذف کن**. این فایل‌ها هیچ‌جا import نمی‌شوند (با grep تأیید کن).

۲. شیم‌های re-export در `src/utils/` که در تسک‌های قبلی گذاشته شده بودند:
   - برای هر کدام، grep بزن و مطمئن شو که هیچ فایلی از مسیر قدیمی import نمی‌کند.
   - **اگر هیچ مصرف‌کننده‌ای نداشت**، فایل را حذف کن.
   - **اگر مصرف‌کننده داشت**، آن importها را به مسیر جدید آپدیت کن، سپس شیم را حذف کن.
   - این شامل: `src/utils/queueProcessor.ts`, `src/utils/gemini.ts`, `src/utils/csvParser.ts`, `src/utils/scorer.ts` (شیم), `src/utils/idfCalculator.ts` (شیم).
   - **استثنا:** `src/utils/safeJson.ts`, `src/utils/titleSimilarity.ts`, `src/utils/candidateStorage.ts`, `src/utils/scorer.test.ts` در همان مکان باقی می‌مانند (utilities واقعی).

۳. فایل کپی مرجع `/scorer.ts` در ریشه پروژه را **دست نزن**؛ این متعلق به کاربر است و او خودش حذف می‌کند.

۴. اجرای typecheck نهایی: `pnpm exec tsc --noEmit` (یا معادل با package manager پروژه).

### محدودیت‌ها
- ✅ بعد از این تسک، هیچ import کوچک‌ترین خطا نداشته باشد
- ✅ هیچ‌جا `import { db } from ...` در `src/pages/` یا `src/components/` نباشد
- ⛔ کپی مرجع `/scorer.ts` ریشه دست‌نخورده باقی بماند

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/queueProcessor.ts", "src/utils/gemini.ts", "src/utils/csvParser.ts", "src/utils/scorer.ts", "src/utils/idfCalculator.ts", "src/App.tsx", "package.json"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## ترتیب اجرا (الزامی، غیرقابل موازی‌سازی)

```
R1 (Repositories)
  └→ R2 (Gemini Client) ── R3 (CSV+Zod) ── R4 (Core scorer move)
                                                  └→ R5 (Web Worker)
                                                         └→ R6 (Queue split)
                                                                └→ R7 (Auto-Resume)
                                                                     └→ R8 (Slim hooks)
                                                                          └→ R9 (Service layer)
                                                                               └→ R10 (Cleanup)
```

R2, R3, R4 می‌توانند مستقل اجرا شوند ولی همگی به R1 وابسته‌اند.

---

## معیار پذیرش کل فاز

1. هیچ `import { db } from` در پوشه‌های `src/pages/` و `src/components/` وجود ندارد.
2. باز کردن یک پروژه با ۱۰۰۰+ صفحه باعث UI Freeze نمی‌شود (دکمه‌ها responsive).
3. خروجی Dexie (`candidates`، `results`) بعد از اجرای تحلیل با نسخه قبل از ریفکتور **بایت-به-بایت یکسان** است.
4. تست `src/utils/scorer.test.ts` (یا معادل منتقل‌شده) pass می‌شود.
5. `tsc --noEmit` بدون خطا.
6. تست دستی: قطع کردن اینترنت در میان پردازش → نمایش backoff → بازگشتن اینترنت → ادامه طبیعی صف.
7. بستن تب در میان پردازش → باز کردن دوباره → نمایش وضعیت paused با پیام واضح.


## تسک R11 (دیباگ) — تلاش برای بهینه‌سازی پرفورمنس (نیازمند بررسی معمار)

### هدف
رفع مشکل فریز شدن UI در زمان "ذخیره و ادامه" (CSV Parse) و کندی شدید در زمان "محاسبه با الگوریتم داخلی".

### کارهای انجام شده (توسط لایه پیاده‌سازی)
۱. **جلوگیری از فریز Zod:** حلقه پردازش اعتبارسنجی در `csvParser.ts` شکسته شد و با استفاده از `await new Promise(res => setTimeout(res, 0))` به Event Loop تنفس داده شد.
۲. **کاهش سربار IPC:** خروجی Web Worker قبل از `postMessage` با `.slice(0, 50)` برش داده شد تا از قفل شدن مرورگر هنگام Serialization جلوگیری شود.
۳. **کاهش مرتبه زمانی O(N^2):** توابع `parseCategories` و `parsePage` از درون حلقه‌های تو در توی الگوریتم خارج شده و به صورت یک‌باره (Pre-parsed) محاسبه و کش شدند.

### وضعیت فعلی (مسئله باز)
علی‌رغم پیاده‌سازی موارد فوق، هنوز پرفورمنس مطلوب (زیر ۱ ثانیه) به دست نیامده است و UI درگیر سربار پردازشی است. 

### درخواست از لایه معماری
نیاز به بررسی عمیق معماری برای یافتن گلوگاه‌های پنهان. مظنونین احتمالی:
- نحوه ذخیره‌سازی Dexie (تراکنش‌های تودرتو یا سربار حجیم).
- Re-render های کشنده در لایه React (مثلاً هوک‌های متصل به دیتابیس).
- رفتار Vite در کلاینت برای اجرای Web Worker.

---

## تسک R12 (بهینه‌سازی ریشه‌ای) — حذف گلوگاه IPC و یکپارچه‌سازی ورکر

### تحلیل معماری (Root Cause)

پس از بازبینی کامل مسیر داغ (`computeAndStoreCandidates` → ورکر → `bulkAdd`)، چهار گلوگاه قطعی شناسایی شد. R11 فقط لایه CPU را بهینه کرد ولی **گلوگاه واقعی در IPC و Worker Spawning است** نه CPU.

| # | گلوگاه | محل | تاثیر تخمینی |
|---|---|---|---|
| A | اسپاون دو ورکر متوالی (IDF و Candidates) | `candidateStorage.ts` | ۴–۱۰ ثانیه در dev |
| B | چسبیدن `categories` کامل به هر کاندیدا → IPC غول‌پیکر | `scorer.ts` خط ~۱۱۶۸ | ۲–۵ ثانیه structured-clone |
| C | `JSON.stringify` ۵۰۰۰‌بار روی main thread با داده آلوده B | `candidateStorage.ts` | ۱–۳ ثانیه فریز |
| D | chunk=100 با `setTimeout(0)` در CSV | `csvParser.ts` | ۲۰۰ms اضافی |

### هدف
رساندن زمان «آپلود → ورود به پروژه» و «بررسی الگوریتم» به زیر ۲ ثانیه برای پروژه‌های ۵۰۰۰ صفحه‌ای، **بدون یک کاراکتر تغییر در منطق scorer**.

### قانون مطلق
> الگوریتم scorer و خروجی عددی آن مطلقاً تغییر نمی‌کند. تنها چیزی که از خروجی scorer **حذف** می‌شود فیلد `categories` آبجکت کاندیدا است — این فیلد در `TaskExecutor.executePage` و `PageDetail` همین حالا هم از طریق `allPages.find(...)` یا `pageRepository.getById` از منبع اصلی غنی‌سازی می‌شود، پس حذفش از payload کاندیدا هیچ اثر رفتاری ندارد.

### راهنمای پیاده‌سازی فنی (دقیق و گام‌به‌گام)

#### گام ۱ — حذف `categories` از خروجی scorer (گلوگاه B)
فایل: `src/core/scoring/scorer.ts`

در تابع `computeAllCandidates` (حدود خط ۱۱۵۹–۱۱۶۹)، در map نهایی، فیلد `categories: cat` را **حذف کن**. خروجی هر کاندیدا باید این فیلدها را داشته باشد و فقط همین‌ها:
```
page_id, title, score, rawScore, matched_tags, matchedTags, origin_bonus, destination_bonus
```

دلیل: این فیلد در ادامه مسیر (TaskExecutor و PageDetail) از منبع اصلی دوباره خوانده می‌شود. نگه داشتنش در کاندیدا یعنی ۲۵۰هزار کپی آبجکت در structured-clone و در JSON دیتابیس.

در `findTopCandidates` هم (حدود خط ۱۱۰۰–۱۱۱۰) دقیقاً همین کار را بکن — `categories: cat` را حذف کن.

تایپ `CandidateWithTags` در همان فایل: فیلد `categories?` را به فیلدی **اختیاری و deprecated** نگه دار (برای backward compatibility با کدهایی که شاید بخوانند) ولی **هیچ‌کجا مقدار نده**.

#### گام ۲ — یکپارچه‌سازی دو فراخوانی ورکر در یک Job (گلوگاه A)
فایل: `src/workers/scoringWorker.ts`

یک message type جدید اضافه کن: `COMPUTE_ALL`. وقتی این type دریافت شد:
1. اول `computeIDFMap(payload.pages)` را اجرا کن
2. بعد `computeAllCandidates(payload.pages)` را اجرا کن
3. در یک postMessage هر دو خروجی را بازگردان:
```ts
self.postMessage({
  type: 'DONE_ALL',
  payload: {
    idfMap,
    candidates: candidatesArrayWithSlice50
  }
});
```
type‌های قبلی `COMPUTE`، `COMPUTE_CANDIDATES`، `COMPUTE_IDF` را نگه دار (شکستن سازگاری ممنوع).

فایل: `src/services/scoring/scoringService.ts`

یک تابع جدید `computeAllInWorker(pages): Promise<{ idfMap, candidatesMap }>` اضافه کن که فقط یک‌بار `new ScoringWorker()` کند، یک پیام بفرستد، نتیجه را پارس کند، و worker را terminate کند. توابع `computeCandidatesInWorker` و `computeIDFInWorker` فعلی حذف نمی‌شوند (deprecated می‌مانند).

فایل: `src/utils/candidateStorage.ts`

به‌جای دو فراخوانی متوالی `computeIDFInWorker` و `computeCandidatesInWorker`، یک‌بار `computeAllInWorker(pages)` صدا بزن. ترتیب بعدی (ذخیره IDF → clear candidates → bulkAdd) ثابت می‌ماند.

#### گام ۳ — bulkAdd درون transaction واحد (گلوگاه E + پایداری)
فایل: `src/utils/candidateStorage.ts`

`idfRepository.upsert(...)` و `candidateRepository.clearByProject(...)` و `candidateRepository.bulkAdd(...)` را در یک `db.transaction('rw', [db.idfCache, db.candidates], async () => { ... })` بپیچ. این کار:
- تعداد notification های Dexie را به یک‌بار کاهش می‌دهد (یک‌بار re-render در main thread)
- اتمیک می‌شود (یا همه ذخیره یا هیچ‌کدام)

**هشدار**: چون `idfRepository.upsert` خودش یک transaction داخلی دارد، باید این transaction داخلی را حذف کنی یا یک نسخه «بدون-transaction» از upsert (مثلاً `upsertInTx`) به repository اضافه کنی و در candidateStorage از آن استفاده کنی. روش پیشنهادی: یک تابع جدید `upsertInTx(projectId, idfJson)` به `idfRepository` اضافه کن که فرض می‌کند داخل یک transaction باز است.

#### گام ۴ — افزایش chunk size در CSV (گلوگاه D)
فایل: `src/services/io/csvParser.ts`

مقدار `chunkSize = 100` را به `chunkSize = 1000` تغییر بده. Zod `safeParse` در همین مقیاس هم زیر ۵۰ms اجرا می‌شود و event loop به اندازه کافی تنفس می‌کند.

#### گام ۵ — Pre-warm worker (اختیاری ولی توصیه‌شده)
فایل: `src/main.tsx` (یا `src/App.tsx` در یک useEffect یک‌بار)

```ts
// پیش‌گرم‌کردن کامپایل ورکر در dev mode تا اولین استفاده سریع باشد
import('./workers/scoringWorker?worker').catch(() => {});
```
این کار module graph ورکر را در بک‌گراند به‌محض لود اپ کامپایل می‌کند.

#### گام ۶ — Memo کردن `useLiveQuery` در ProjectPages (گلوگاه E)
فایل: `src/pages/ProjectPages.tsx`

سه `useLiveQuery` (queue، candidatesCount، results) باعث می‌شود هر تغییر Dexie کل صفحه را rerender کند. در حین `clearByProject` + `bulkAdd` چند notification پشت سر هم می‌خورد. راه‌حل:

- `QueueProgress` و `PageListItem` همین حالا داخل کامپوننت جدا هستند — مطمئن شو `React.memo` روی هردو فعال است.
- آرایه `paginatedPages` و `stats` و `filteredPages` همگی در `useMemo` هستند — نگاه کن dependency arrayشان درست باشد.
- این گام «دیفنسیو» است: لازم نیست تغییر اساسی بدهی، فقط مطمئن شو سه کامپوننت سنگین (QueueProgress، PageListItem، CandidateCard) با `memo` پوشانده شده‌اند.

### معیار پذیرش R12

۱. روی یک CSV ۵۰۰۰ ردیفی:
   - زمان «انتخاب فایل → ورود به صفحه Config» باید **زیر ۳ ثانیه** باشد (قبل از این تسک: ۲۰–۴۰ ثانیه).
   - زمان کلیک «بررسی الگوریتم» تا اتمام تحلیل باید **زیر ۲ ثانیه** باشد.
۲. خروجی عددی `scorer.ts` بایت‌به‌بایت یکسان است (تست `scorer.test.ts` pass می‌شود).
۳. فقط یک‌بار `new ScoringWorker()` به‌ازای هر اجرای `computeAndStoreCandidates`.
۴. payload structured-clone از ورکر به main حداکثر ~۱۰ مگابایت (قبل: ۱۰۰–۵۰۰ مگابایت).
۵. در هیچ کاندیدای ذخیره‌شده در Dexie، فیلد `categories` وجود ندارد.
۶. `tsc --noEmit` بدون خطا.

### محدودیت‌ها (Anti-patterns برای این تسک)
- ⛔ تغییر هیچ ضریب، تابع، یا ترتیب لایه‌های امتیازدهی در scorer
- ⛔ افزودن کتابخانه جدید
- ⛔ حذف توابع قبلی ورکر (`COMPUTE`, `COMPUTE_IDF`) — backward compat لازم است
- ⛔ تغییر signature های public تابع `computeAndStoreCandidates`
- ⛔ تغییر فرمت ذخیره `candidates.candidate_list` (همان JSON آرایه می‌ماند، فقط فیلد `categories` داخلش حذف می‌شود)
- ✅ حذف `categories` از خروجی scorer مجاز است چون رفتار پایین‌دستی به آن وابسته نیست (با Grep تایید شده)
- ✅ افزایش chunkSize از 100 به 1000 مجاز است

### بررسی Grep قبل از پیاده‌سازی (الزامی)
کدنویس باید قبل از حذف `categories` از scorer، این grep ها را اجرا کند تا اطمینان حاصل کند هیچ مصرف‌کننده‌ای از `candidate.categories` (نه از `page.categories`) وجود ندارد:
```
grep -rn "\.categories" src/ --include="*.ts" --include="*.tsx"
```
موارد مشروع (که `page.categories` می‌خوانند نه `candidate.categories`):
- `TaskExecutor.ts` خط ~۵۰: `fullPage.categories` ← OK، از صفحه می‌خواند نه از کاندیدا
- `analysisService.runSinglePageAnalysis` خط ~۹۰: `fullPage.categories` ← OK
- `PageDetail.tsx`: `page.categories` ← OK
- `promptBuilder.ts`: `sourcePage.categories` ← OK، از سورس می‌خواند

اگر کدنویس کشف کرد جایی **مستقیماً** `candidate.categories` می‌خواند، باید آن نقطه را به lookup از `pageRepository.getById(cand.page_id)` تغییر دهد (مشابه الگوی موجود در `TaskExecutor`).

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "Docks/CURRENT_TASK.md", "src/core/scoring/scorer.ts", "src/workers/scoringWorker.ts", "src/services/scoring/scoringService.ts", "src/utils/candidateStorage.ts", "src/services/io/csvParser.ts", "src/repositories/idfRepository.ts", "src/repositories/candidateRepository.ts", "src/core/queue/TaskExecutor.ts", "src/services/analysis/analysisService.ts", "src/pages/PageDetail.tsx", "src/pages/ProjectPages.tsx", "src/main.tsx", "src/db.ts"]`

> **یادآوری حیاتی:** قبل از تغییر scorer، فایل `/scorer.ts` (کپی مرجع کاربر) را با `src/core/scoring/scorer.ts` خط‌به‌خط diff بگیر. بعد از تغییر هم، فقط و فقط فیلد `categories: cat` باید از دو نقطه (در `findTopCandidates` و `computeAllCandidates`) حذف شده باشد. سایر کاراکترها دست‌نخورده باقی بمانند.
