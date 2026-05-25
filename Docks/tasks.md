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

### راهنمای پیاده‌سازی فنی
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

## تسک R8 — Slim کردن useAnalysisQueue + ساخت Selector Hooks

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

## تسک R9 — انتقال منطق بیزینسی از کامپوننت‌ها به analysisService

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
