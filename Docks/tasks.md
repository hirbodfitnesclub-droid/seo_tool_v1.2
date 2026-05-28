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

### راهنمای پیاده‌سازی فن������
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

### ��دف
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

۴. اجرای typecheck نهایی: `pnpm exec tsc --noEmit` (یا معاد�� با package manager پروژه).

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

## تسک R12 — یکپارچه‌سازی Worker و حذف رفت‌و‌برگشت IPC

### مسئله
بعد از R11 معلوم شد گلوگاه نه الگوریتم، بلکه **سربار IPC و تراکنش‌های چندگانه Dexie** است: ابتدا `computeIDFInWorker` صدا زده می‌شد، نتیجه به Main برمی‌گشت، سپس `computeAllInWorker` دوباره Worker اسپاون می‌کرد، نتیجه (به‌صورت Map) دوباره به Main برمی‌گشت و در دو تراکنش جداگانه Dexie ذخیره می‌شد.

### کارهای انجام‌شده
۱. **یک Worker، یک پیام (`COMPUTE_ALL`)**: پیام‌های `COMPUTE_IDF` و دو spawn جدا حذف شد. حالا فقط یک‌بار Worker اسپاون می‌شود، `pages + currentDoc + topK` می‌رود، `{ idfMap, candidates }` در یک پیام `DONE_ALL` برمی‌گردد.
۲. **حذف Map از مرز Worker**: خروجی idf به‌صورت `Array<[string, number]>` منتقل می‌شود تا از سربار structured-clone روی Map جلوگیری شود؛ Main آن را یک‌بار به Map تبدیل می‌کند.
۳. **تراکنش واحد Dexie**: ذخیره `idfCache` و `candidates` در یک `db.transaction('rw', ...)` ادغام شد.
۴. **حذف فیلد `categories` از candidate**: این فیلد فقط در زمان score استفاده می‌شد و در Dexie redundancy ایجاد می‌کرد؛ حالا فقط `pageId` ذخیره و در زمان نمایش از pages join می‌شود.

### نتیجه
سربار IPC تقریباً نصف شد و تراکنش‌های Dexie از ۲ به ۱ کاهش یافت. اما برای پروژه‌های کوچک/متوسط (~۷۰۰ صفحه) همچنان هزینه راه‌اندازی Worker از کل کار CPU بزرگ‌تر است → نیاز به R13.

---

## تسک R13 — معماری تطبیقی (Adaptive Pipeline: Fast-Track / Heavy-Track)

### مسئله
برای پروژه‌های ≤ ~۱۰۰۰ صفحه، **هزینه ثابت اسپاون Worker + structured-clone + transfer دوطرفه** از خود کار CPU بزرگ‌تر است. اجرای همان منطق Pure روی Main Thread در زیر ۱ ثانیه تمام می‌شود، در حالی که مسیر Worker چند ثانیه طول می‌کشد.

### تصمیم
دو مسیر مجزا با انتخاب runtime:

- **Fast-Track** (`pages.length ≤ 1000`): اجرای مستقیم `computeIDFMap` و `computeAllCandidates` از `core/scoring/*` روی Main Thread، بدون Worker، بدون postMessage.
- **Heavy-Track** (`pages.length > 1000`): همان مسیر R12 (`computeAllInWorker`) برای جلوگیری از freeze در پروژه‌های بزرگ.

ثابت `SCORING_WORKER_THRESHOLD = 1000` در `src/utils/candidateStorage.ts` تعریف می‌شود.

### محدوده تغییر
- **فقط** `src/utils/candidateStorage.ts` ویرایش می‌شود.
- خروجی Dexie (`idfCache`, `candidates`) در هر دو مسیر بایت-به-بایت یکسان است.
- `scoringService.ts` و `scoringWorker.ts` بدون تغییر باقی می‌مانند (Heavy-Track همچنان از آن‌ها استفاده می‌کند).
- `core/scoring/*` بدون تغییر باقی می‌ماند (Pure functions، از R4 قابل استفاده روی Main Thread است).

### معیار پذیرش
1. پروژه ۷۰۰ صفحه‌ای: تحلیل با الگوریتم داخلی در زیر ۱ ثانیه تمام می‌شود.
2. پروژه ۵۰۰۰ صفحه‌ای: UI freeze نمی‌شود (Worker مسیر).
3. خروجی Dexie هر دو مسیر یکسان است.
4. `tsc --noEmit` بدون خطا.

---

# فاز ۲ — توسعه ویژگی‌ها

## قوانین مشترک تمام تسک‌های این فاز

۱. **حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.**

۲. **خط قرمز مطلق:** `src/db.ts` لمس نمی‌شود. هیچ جدول/ایندکس/migration ج��ید. اسکیمای Dexie v3 ثابت است.

۳. **خط قرمز مطلق:** `src/core/scoring/scorer.ts` و `src/core/scoring/idfCalculator.ts` لمس نمی‌شوند.

۴. هیچ کتابخانه جدیدی اضافه نمی‌شود.

۵. کامنت‌ها فارسی. متن UI فارسی. RTL.

۶. لایه‌بندی پروژه (UI → Hooks → Services → Repositories → Dexie) رعایت شود. کامپوننت `import { db }` ندارد.

---

## تسک F1.1 — زیرساخت Reverse Index Service

### هدف
ساخت سرویس `inlinkGraphService` که یک Reverse Index in-memory از گراف لینک‌سازی پروژه می‌سازد و آن را با کش module-level + signature-based invalidation مدیریت می‌کند. این تسک هیچ UI تولید نمی‌کند؛ فقط زیرساخت داده.

### راهنمای پیاده‌سازی فنی

۱. **افزودن متد جدید به `src/repositories/candidateRepository.ts`:**
   ```ts
   /**
    * دریافت تمام رکوردهای کاندیدا برای یک پروژه (برای ساخت Reverse Index)
    */
   export async function listByProject(projectId: number): Promise<CandidateRecord[]> {
     return db.candidates.where('project_id').equals(projectId).toArray();
   }
   ```
   ایندکس `project_id` از قبل در `db.ts` موجود است؛ بنابراین این کوئری بهینه است.

۲. **ساخت فایل جدید `src/services/analysis/inlinkGraphService.ts`:**
   - تایپ‌های صادر شده:
     ```ts
     export type InlinkOrigin = 'result' | 'candidate';
     export interface InlinkSourceEntry {
       sourcePageId: number;
       sourceTitle: string;
       rank: number;          // ۱-based ترتیب لینک در صفحه مبدأ
       score?: number;        // فقط در مسیر candidate
       matchedTags?: string[];// فقط در مسیر candidate
       origin: InlinkOrigin;
     }
     export type InlinkIndex = Map<number, InlinkSourceEntry[]>;
     ```
   - کش module-level:
     ```ts
     interface CacheEntry {
       index: InlinkIndex;
       signature: string;
       builtAt: number;
       buildPromise?: Promise<InlinkIndex>; // برای جلوگیری از build همزمان دوبار
     }
     const cache = new Map<number, CacheEntry>();
     ```
   - تابع `computeSignature(projectId)`:
     - `count(results) + ':' + count(candidates) + ':' + max(results.generated_at || '')`
     - از `resultRepository.listByProject` و `candidateRepository.countByProject` استفاده کن. **برای max نیازی به scan کامل نیست**: یک `await db.results.where('project_id').equals(projectId).count()` و یک `db.results.where('project_id').equals(projectId).last()` کافی است (آخرین رکورد inserted = آخرین generated_at).
     - **توجه:** برای جلوگیری از وابستگی مستقیم به `db`، یک متد کمکی به `resultRepository.ts` اضافه کن: `getLatestGeneratedAt(projectId): Promise<string | null>`.

   - تابع اصلی:
     ```ts
     export async function getOrBuildIndex(projectId: number): Promise<InlinkIndex>
     ```
     - signature را محاسبه کن.
     - اگر cache hit با signature یکسان → بازگشت `cache.index`.
     - اگر `cache.buildPromise` موجود (در حال build) → همان promise را return کن.
     - در غیر این صورت، یک `buildPromise` بساز و در cache ذخیره کن، سپس await و در پایان signature را تثبیت کن.

   - تابع build داخلی:
     ```ts
     async function buildIndex(projectId: number): Promise<InlinkIndex>
     ```
     - `pages = await pageRepository.listByProject(projectId)` → ساخت `Map<pageId, title>` برای lookup.
     - `results = await resultRepository.listByProject(projectId)` → ساخت `Set<sourcePageId>` صفحات دارای result.
     - `candidates = await candidateRepository.listByProject(projectId)`.
     - `index = new Map<number, InlinkSourceEntry[]>()`.
     - حلقه روی همه pages با chunking:
       ```ts
       const CHUNK_SIZE = 100;
       for (let i = 0; i < pages.length; i++) {
         const sourceId = pages[i].id!;
         const sourceTitle = pages[i].title;
         // اگر در results باشد → از recommended_links بخوان (origin='result')
         // در غیر اینصورت اگر در candidates باشد → از candidate_list بخوان (origin='candidate')
         // برای هر link.page_id: index.get(targetId).push({...})
         if (i % CHUNK_SIZE === 0 && i > 0) {
           await new Promise(r => setTimeout(r, 0)); // تنفس به Event Loop
         }
       }
       ```
     - از `safeJsonParse` برای پارس امن استفاده شود.
     - self-link حذف شود (`if (link.page_id === sourceId) continue`).
     - برای جستجو `O(1)` سریع‌تر، از `resultsBySourceId = new Map<number, Result>()` استفاده کن.

   - تابع‌های کمکی صادر شده:
     ```ts
     export async function getInlinksFor(projectId: number, targetPageId: number): Promise<InlinkSourceEntry[]>
     export function invalidateProject(projectId: number): void
     ```
     - `getInlinksFor` ابتدا `getOrBuildIndex` را صدا می‌زند، سپس entries را برای `targetPageId` برمی‌گرداند، با مرتب‌سازی:
       1. ابتدا `origin === 'result'`
       2. سپس بر اساس `score` نزولی (undefined در آخر)
       3. در نهایت `rank` صعودی به‌عنوان tie-breaker
     - `invalidateProject(projectId)` فقط `cache.delete(projectId)` انجام می‌دهد. (در آینده توسط analysisService بعد از تحلیل صدا زده می‌شود — در این تسک فقط export کن.)

۳. **هیچ تغییری در UI/Hooks/Components.** این تسک خالص infrastructure است.

### محدودیت‌ها
- ✅ هیچ تغییر در `db.ts`
- ✅ هیچ ایندکس/جدول جدید
- ✅ تمام کوئری‌ها از repositories (نه `import { db }` در service)
- ⛔ بدون Web Worker
- ⛔ بدون `useLiveQuery`

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- یک تست دستی: در DevTools console فراخوانی `getOrBuildIndex(projectId)` در یک پروژه ۷۰۰ صفحه زیر ۲ ثانیه تمام شود و UI در طول build پاسخ‌گو باشد.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "Docks/PROJECT.md", "src/db.ts", "src/repositories/candidateRepository.ts", "src/repositories/resultRepository.ts", "src/repositories/pageRepository.ts", "src/utils/safeJson.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک F1.2 — هوک `useInlinkAnalytics` + اتصال به analysisService

### هدف
ساخت یک هوک React که Reverse Index را به‌صورت lazy و non-blocking برای یک `targetPageId` در دسترس قرار می‌دهد، و اتصال invalidation به نقاط تغییر داده.

### راهنمای پیاده‌سازی فنی

۱. **ساخت فایل جدید `src/hooks/useInlinkAnalytics.ts`:**
   ```ts
   export function useInlinkAnalytics(
     projectId: number,
     targetPageId: number
   ): {
     count: number;
     sources: InlinkSourceEntry[];
     loading: boolean;
   }
   ```
   - State داخلی: `sources`, `loading`.
   - یک `useEffect` با dependency `[projectId, targetPageId]`:
     - `setLoading(true)`
     - `inlinkGraphService.getInlinksFor(projectId, targetPageId)` را await کن
     - `setSources(result); setLoading(false)`
     - cleanup با flag `cancelled` تا اگر unmount شد، setState اجرا نشود.
   - `count = sources.length`.

۲. **اتصال invalidation در `src/services/analysis/analysisService.ts`:**
   - بعد از `runSinglePageAnalysis` (هر جا که `resultRepository.upsert` اتفاق می‌افتد) فراخوانی `inlinkGraphService.invalidateProject(projectId)`.
   - بعد از `startProjectAnalysis` (در نقطه پایان موفق صف) همینطور.
   - بعد از `recomputeCandidates` همینطور.
   - **توجه:** فقط در نقاطی که داده‌های منبع (results یا candidates) تغییر می‌کنند. در ویرایش دستی کاربر هم (در PageDetail.tsx → `handleSaveManual`) باید یک invalidation انجام شود — این نقطه را در تسک F1.3 هنگام لمس PageDetail اضافه می‌کنیم.

۳. **هیچ کامپوننتی در این تسک ویرایش نشود.** فقط hook + invalidation در service.

### محدودیت‌ها
- ✅ هوک باید resilient باشد (در صورت unmount، بدون خطا)
- ✅ count صفر معتبر است (نه null/undefined)
- ⛔ بدون useLiveQuery
- ⛔ بدون state global

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- اگر در analysisService تحلیل تک‌صفحه‌ای انجام شود، فراخوانی بعدی هوک Index تازه بسازد (نه کش قدیمی).

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/analysis/inlinkGraphService.ts", "src/services/analysis/analysisService.ts", "src/hooks/useProject.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## تسک F1.3 — UI: Badge شمارنده + مودال لینک‌های ورودی در PageDetail

### هدف
نمایش بصری Inlink Analytics در صفحه `PageDetail`: یک Badge شمارنده در هدر و یک مودال با لیست صفحات مبدأ.

### راهنمای پیاده‌سازی فنی

۱. **ساخت کامپوننت جدید `src/components/InlinkBadge.tsx`:**
   - props: `count: number; loading: boolean; onClick: () => void`.
   - وقتی `loading=true` → نمایش Spinner کوچک.
   - وقتی `count=0` → Badge خاکستری با متن «هیچ لینک ورودی». غیر قابل کلیک یا با cursor default.
   - وقتی `count>0` → Badge آبی با عدد + آیکون `Link2` از lucide. کلیک‌پذیر.
   - استایل با Tailwind، RTL، فقط فارسی. شبیه سایر Badgeهای موجود در PageDetail.

۲. **ساخت کامپوننت جدید `src/components/InlinkModal.tsx`:**
   - props:
     ```ts
     {
       isOpen: boolean;
       onClose: () => void;
       targetTitle: string;
       sources: InlinkSourceEntry[];
       loading: boolean;
       projectId: number;
     }
     ```
   - از `src/components/ui/Modal.tsx` موجود استفاده کن.
   - اگر `loading=true` → Spinner مرکزی با متن «در حال محاسبه گراف معکوس...».
   - اگر `sources.length=0` → EmptyState با متن «هیچ صفحه‌ای به این صفحه لینک نداده است».
   - در غیر اینصورت لیست:
     - برای هر `entry`:
       - عنوان صفحه مبدأ به‌صورت `<Link to={`/project/${projectId}/page/${entry.sourcePageId}`}>` (با onClose قبل از navigate یا استفاده از react-router Link).
       - Badge کوچک با `entry.origin === 'result' ? 'تایید AI' : 'پیشنهاد الگوریتم'` (سبز برای result، خاکستری برای candidate).
       - رتبه: `«رتبه ${entry.rank}»` در آن صفحه.
       - score: اگر موجود `Score: ${entry.score!.toFixed(2)}`.
       - matchedTags: اگر موجود و طول > 0، نمایش با Badgeهای کوچک. **حد ۵ تگ نمایش داده شود** و اگر بیشتر بود `+${n} more` (طبق درخواست کاربر برای جلوگیری از افت پرفورمنس).
   - **Virtualization ساده:** اگر `sources.length > 100`، فقط ۱۰۰ تای اول رندر شود + پیام «بقیه پنهان شدند برای حفظ پرفورمنس». (نه نصب react-window.)

۳. **ویرایش `src/pages/PageDetail.tsx`:**
   - فراخوانی هوک:
     ```ts
     const inlink = useInlinkAnalytics(pId, pgId);
     const [inlinkModalOpen, setInlinkModalOpen] = useState(false);
     ```
   - در هدر صفحه (همان flexbox که Badgeهای دیگر هستند، خط `<Badge variant="blue">SEO Workstation</Badge>`)، یک `<InlinkBadge count={inlink.count} loading={inlink.loading} onClick={() => setInlinkModalOpen(true)} />` اضافه شود.
   - در پایین JSX، رندر `<InlinkModal isOpen={inlinkModalOpen} onClose={() => setInlinkModalOpen(false)} targetTitle={page.title} sources={inlink.sources} loading={inlink.loading} projectId={pId} />`.
   - در `handleSaveManual` بعد از `resultRepository.upsert` صدا زدن `inlinkGraphService.invalidateProject(pId)` (تا اگر کاربر در همان نشست به صفحه مقصد برود، Index تازه ساخته شود).
     - import مستقیم `inlinkGraphService` اشکالی ندارد چون این یک service است نه db.

### محدودیت‌ها
- ✅ بدون افزودن کتابخانه
- ✅ تمام متن UI فارسی
- ✅ بدون lazy loading حلقه‌ای — یک‌بار در mount صفحه load می‌شود
- ⛔ بدون drag-and-drop
- ⛔ بدون react-window یا کتابخانه virtualization
- ⛔ بدون تغییر در سایر کامپوننت‌ها (CandidateCard, ProjectPages, ...)

### معیار پذیرش
1. در صفحه PageDetail یک Badge شمارنده در هدر دیده می‌شود.
2. کلیک روی آن مودالی باز می‌کند با لیست صفحاتی که به این صفحه لینک می‌دهند.
3. در هر ردیف: عنوان مبدأ، origin (تایید AI / پیشنهاد الگوریتم)، رتبه، score (اگر باشد)، matched_tags (حداکثر ۵).
4. کلیک روی عنوان صفحه مبدأ → navigate به `PageDetail` آن صفحه.
5. باز شدن مودال در پروژه ۷۰۰ صفحه‌ای بدون freeze (Spinner اگر هنوز Index آماده نیست، در غیر اینصورت لحظه‌ای).
6. ویرایش دستی لینک‌ها در یک صفحه → فراخوانی بعدی Index تازه ساخته می‌شود.
7. `tsc --noEmit` بدون خطا.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/PageDetail.tsx", "src/components/ui/Modal.tsx", "src/components/ui/Badge.tsx", "src/components/ui/Spinner.tsx", "src/components/ui/EmptyState.tsx", "src/services/analysis/inlinkGraphService.ts", "src/hooks/useInlinkAnalytics.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.

---

## ترتیب اجرای فاز ۲ (الزامی)

```
F1.1 (Reverse Index Service)
  └→ F1.2 (Hook + invalidation)
       └→ F1.3 (UI Badge + Modal)
```

## معیار پذیرش کل فیچر F1

1. هیچ تغییری در `src/db.ts` (diff خالی).
2. هیچ تغییری در `src/core/scoring/*` (diff خالی).
3. باز کردن PageDetail در پروژه ۵۰۰۰ صفحه‌ای → UI پاسخ‌گو، Spinner در Badge تا Index آماده شود، سپس عدد ظاهر می‌شود. هیچ freeze.
4. کلیک روی مودال در میانه build → Spinner داخل مودال، سپس لیست.
5. منطق Hybrid: صفحاتی که در `results` هستند فقط از آنجا خوانده می‌شوند، بقیه از `candidates`.
6. `tsc --noEmit` بدون خطا.

---

# فاز ۲ — فیچر F2: Live / Temporal Boost

## قوانین مشترک تمام تسک‌های F2

۱. **حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار calling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.**

۲. **خط قرمز مطلق:** `src/db.ts`، `src/core/scoring/scorer.ts`، `src/core/scoring/idfCalculator.ts` — هیچ تغییر.

۳. **خط قرمز مطلق:** هیچ امتیازی که در Dexie ذخیره شده (`candidates.candidate_list`) بازنویسی نشود. F2 فقط لایه نمایش/قبل-از-Gemini است.

۴. **هیچ کتابخانه جدیدی نصب نمی‌شود.** تاریخ شمسی فقط با `Intl.DateTimeFormat('fa-IR')`. ممنوع: `moment-jalaali`, `jalali-moment`, `dayjs-jalali`, `date-fns-jalali`, `jalaali-js`.

۵. **State با Context API** — نه Zustand، نه Redux. (تطبیق با Anti-Patterns پروژه که توسط معمار تثبیت شده.)

۶. **Persistence فقط localStorage** با کلیدهای `LINKMESH_TEMPORAL_*`. هیچ جدول Dexie جدید.

۷. کامنت‌ها فارسی. متن UI فارسی. RTL.

۸. لایه‌بندی: UI → Context/Hooks → Services (Pure) → Constants. کامپوننت `import { db }` ندارد.

---

## تسک F2.1 — زیرساخت تقویم شمسی + ثابت‌های Built-in

### هدف
ساخت دو فایل پایه: یک wrapper Pure روی `Intl.DateTimeFormat('fa-IR')` برای کار با تاریخ شمسی، و یک constant با تعریف فصل‌ها/مناسبت‌های ثابت. این تسک هیچ UI و state ندارد؛ فقط زیرساخت.

### راهنمای پیاده‌سازی فنی

۱. **ساخت فایل جدید `src/services/temporal/jalaliCalendar.ts`:**
   - تایپ صادر شده:
     ```ts
     export interface JalaliDate { year: number; month: number; day: number; }
     ```
   - تابع `getCurrentJalaliDate(): JalaliDate`:
     - با `new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date())` پارت‌ها را بگیر.
     - **توجه:** `nu-latn` (numeric: latin) باعث می‌شود اعداد به‌صورت انگلیسی (`1404`) برگردد نه فارسی (`۱۴۰۴`). این برای parseInt حیاتی است.
     - از پارت‌های `year`, `month`, `day` آبجکت بساز.
   - تابع `parseJalaliDate(input: string): JalaliDate | null`:
     - ابتدا اعداد فارسی/عربی را به انگلیسی normalize کن (یک تابع داخلی `toLatinDigits`):
       - `۰..۹` → `0..9` (charCode 0x06F0..0x06F9)
       - `٠..٩` → `0..9` (charCode 0x0660..0x0669)
     - سپس با regex `/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/` پارس کن.
     - اعتبار محدوده: `month ∈ [1,12]`, `day ∈ [1,31]`, `year ∈ [1300, 1500]`. در صورت تخطی، `null`.
   - تابع `jalaliToOrdinal(d: JalaliDate): number`:
     - یک عدد ترتیبی که برای مقایسه و محاسبه فاصله استفاده می‌شود.
     - فرمول ساده و کافی برای دامنه ما (نه دقت اخترشناسی):
       ```ts
       // ۶ ماه اول هر کدام ۳۱ روز، ۵ ماه بعدی هر کدام ۳۰ روز، اسفند ۲۹ روز (تقریبی)
       const monthLengths = [31,31,31,31,31,31,30,30,30,30,30,29];
       let dayOfYear = 0;
       for (let m = 1; m < d.month; m++) dayOfYear += monthLengths[m-1];
       dayOfYear += d.day;
       return d.year * 366 + dayOfYear;
       ```
     - این فقط برای محاسبه فاصله نسبی (روزها) استفاده می‌شود نه ذخیره‌سازی. کسری روزهای کبیسه برای محاسبه «۳۰ تا ۶۰ روز مانده» اهمیت قابل اغماض دارد (خطای حداکثر ۱-۲ روز).
   - تابع `jalaliDaysBetween(a: JalaliDate, b: JalaliDate): number`:
     - `return jalaliToOrdinal(b) - jalaliToOrdinal(a);` — مثبت یعنی b بعد از a.
   - تابع `isJalaliInRange(d: JalaliDate, start: JalaliDate, end: JalaliDate): boolean`:
     - با ordinal مقایسه کن: `dOrd >= startOrd && dOrd <= endOrd`.
     - **پشتیبانی از بازه عبوری از سال (مانند نوروز ۲۸ اسفند → ۱۳ فروردین):**
       اگر `endOrd < startOrd`، یعنی بازه عبوری است. در این حالت:
       `return dOrd >= startOrd || dOrd <= endOrd;`
       (نکته: ordinal سال متفاوت است؛ این منطق فقط با مقایسه month/day بدون year کار می‌کند → یک تابع کمکی `jalaliMonthDayOrdinal(d)` بساز که فقط `(d.month-1)*31 + d.day` می‌دهد و برای مقایسه intra-year استفاده شود.)
   - هیچ import خارجی به جز توابع داخلی. هیچ ارجاع به React/db.

۲. **ساخت فایل جدید `src/constants/temporalSeasons.ts`:**
   - import نوع `JalaliDate` و `TemporalEvent` (که در تسک F2.2 ساخته می‌شود — موقتاً تایپ‌های inline استفاده کن یا تایپ را در همین فایل تعریف کن و در F2.2 از اینجا re-export شود).
   - **روش پیشنهادی:** تایپ `TemporalEvent` را در همین تسک به‌صورت یک‌بار در `src/services/temporal/temporalService.ts` (فایل بعدی این تسک، بدون پر کردن منطق) تعریف کن، و در constants فقط import کن.
   - یک آرایه `BUILT_IN_TEMPORAL_EVENTS: TemporalEvent[]` با ۶ event (بهار، تابستان، پاییز، زمستان، نوروز، یلدا) دقیقاً طبق جدول بخش ۱۰ ARCHITECTURE.md.
   - `id` هر event: `'builtin-spring'`, `'builtin-summer'`, ...
   - `source: 'builtin'`.
   - keywords lowercase + trim.

۳. **ساخت stub فایل `src/services/temporal/temporalService.ts`:**
   - فقط تعریف تایپ‌های `TemporalLabel`, `TemporalEvent`, `BoostedCandidate` (طبق بخش ۱۰ ARCHITECTURE.md).
   - تابع `applyTemporalBoost` در تسک F2.2 پیاده می‌شود؛ فعلاً یک stub که فقط آرایه ورودی را بدون تغییر برمی‌گرداند با `temporalMultiplier=1`. کامنت `// TODO: F2.2` بگذار.

### محدودیت‌ها
- ✅ تابع‌ها Pure باشند (بدون side-effect).
- ✅ هیچ import از React/Dexie.
- ⛔ بدون moment-jalaali یا هر کتابخانه تاریخ.
- ⛔ بدون `new Date(jalaliString)` (که گرگوری پارس می‌کند).

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- در DevTools: `getCurrentJalaliDate()` آبجکت معتبر شمسی برگرداند (مثلاً `{year: 1404, month: 3, day: 7}` برای ۲۸ خرداد ۱۴۰۴).
- `parseJalaliDate('۱۴۰۴/۰۹/۳۰')` و `parseJalaliDate('1404/9/30')` هر دو باید `{year:1404, month:9, day:30}` بدهند.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "Docks/PROJECT.md", "src/constants/categories.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان فایل‌های کانتکست را بخوان و سپس کد این تسک را بنویس.

---

## تسک F2.2 — هسته سرویس Temporal Boost (Pure Logic)

### هدف
پیاده‌سازی تابع اصلی `applyTemporalBoost` که آرایه‌ای از کاندیداها را می‌گیرد و نسخه boosted آن را برمی‌گرداند. این تابع قلب فیچر است — Pure، بدون side-effect، بدون وابستگی DOM/Dexie/React.

### راهنمای پیاده‌سازی فنی

۱. **در `src/services/temporal/temporalService.ts` — پیاده‌سازی کامل:**
   - تایپ‌ها از تسک F2.1 موجود است.
   - تابع کمکی داخلی `extractKeywordsFromCandidate(candidate, targetMetadata?): string[]`:
     - ترکیب از: `candidate.title.toLowerCase()` + `candidate.matched_tags` (lower-cased) + اگر `targetMetadata.get(candidate.page_id)` موجود بود، `categoryValues` آن.
     - خروجی: یک آرایه string lowercase + trim + dedupe.
   - تابع کمکی داخلی `matchEventToKeywords(event, keywords): boolean`:
     - برای هر `kw of event.keywords`: اگر `keywords.some(k => k.includes(kw) || kw.includes(k))` → match.
     - **توجه به نیم‌فاصله/فاصله:** قبل از مقایسه، هر دو طرف را با replace `/\s+/g => ' '` و `replace(/\u200c/g, ' ')` (نیم‌فاصله → فاصله) normalize کن.
   - تابع کمکی داخلی `classifyEventTiming(event, today): { label: TemporalLabel | null; multiplier: number; reason: string } | null`:
     - اگر `isJalaliInRange(today, event.startDate, event.endDate)` → `{label:'current', multiplier:3, reason:`در حال برگزاری: ${event.name}`}`.
     - وگرنه `daysToStart = jalaliDaysBetween(today, event.startDate)`. اگر `daysToStart >= 30 && daysToStart <= 60` → `{label:'pre', multiplier:4, reason:`پیش‌واز ${event.name} — ${daysToStart} روز مانده`}`.
     - **حالت خاص بازه‌های سال‌گردنده (مثل نوروز/یلدا):** اگر event سالانه است (مثلاً سال در `startDate` کوچک‌تر یا برابر امسال است)، یک «نمونه امسال» از event بساز با تطبیق `year = today.year` (یا `today.year + 1` اگر تاریخ امسال گذشته است). سپس همان منطق بالا را اعمال کن.
       - این منطق در یک تابع کمکی `projectEventToCurrentYear(event, today): TemporalEvent` انجام شود.
     - در غیر این صورت `null` (event بر این کاندیدا اثر ندارد).
   - تابع کمکی داخلی `detectOutOfSeason(keywords, today, builtInEvents): string | null`:
     - اگر یکی از keywords حاوی نام یک فصل ('بهار', 'تابستان', 'پاییز', 'زمستان') است **و** آن فصل الان در جریان نیست → برگشت نام فصل به‌عنوان دلیل penalty.
     - وگرنه `null`.
   - **تابع اصلی `applyTemporalBoost(candidates, options)`:**
     ```
     today = options.today ?? getCurrentJalaliDate()
     events = options.events
     
     return candidates.map(c => {
       keywords = extractKeywordsFromCandidate(c, options.targetMetadata)
       
       bestMatch = null
       for (event of events):
         if (!matchEventToKeywords(event, keywords)) continue
         projected = projectEventToCurrentYear(event, today)
         classification = classifyEventTiming(projected, today)
         if (!classification) continue
         if (!bestMatch || classification.multiplier > bestMatch.multiplier):
           bestMatch = { ...classification, eventName: event.name }
       
       if (bestMatch):
         return { ...c, boostedScore: c.score * bestMatch.multiplier, 
                  temporalMultiplier: bestMatch.multiplier, 
                  temporalLabel: bestMatch.label, 
                  temporalReason: bestMatch.reason, 
                  matchedEventName: bestMatch.eventName }
       
       outOfSeasonReason = detectOutOfSeason(keywords, today, events.filter(e=>e.source==='builtin'))
       if (outOfSeasonReason):
         return { ...c, boostedScore: c.score * 0.15, 
                  temporalMultiplier: 0.15, 
                  temporalLabel: 'out-of-season', 
                  temporalReason: `خارج از فصل: ${outOfSeasonReason}`, 
                  matchedEventName: null }
       
       return { ...c, boostedScore: c.score, temporalMultiplier: 1, 
                temporalLabel: 'neutral', temporalReason: '', matchedEventName: null }
     })
     ```
   - تابع helper اضافی صادر شده برای تست/UI:
     ```ts
     export function sortByBoostedScore(boosted: BoostedCandidate[]): BoostedCandidate[]
     ```
     که آرایه را immutable مرتب می‌کند (clone + sort نزولی بر `boostedScore`).

۲. **هیچ تغییر در UI/Context/Repositories در این تسک.** فقط service.

### محدودیت‌ها
- ✅ تابع Pure — بدون side-effect، بدون mutation ورودی.
- ✅ پوشش حالت‌ها: pre, current, out-of-season, neutral.
- ✅ پشتیبانی نیم‌فاصله در keyword matching.
- ⛔ بدون فراخوانی `Date.now()` داخل تابع (فقط از `options.today` یا یک‌بار `getCurrentJalaliDate()`).
- ⛔ بدون console.log در نسخه نهایی.

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- یک کاندیدا با عنوان «تور پیست اسکی توچال» در دی‌ماه → `temporalLabel: 'current'`, `multiplier: 3`.
- همان کاندیدا در تیر‌ماه → `temporalLabel: 'out-of-season'`, `multiplier: 0.15`.
- کاندیدا با عنوان «تور یلدا» در ۱۵ آبان → `temporalLabel: 'pre'`, `multiplier: 4` (۴۵ روز تا ۳۰ آذر).

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/temporal/jalaliCalendar.ts", "src/constants/temporalSeasons.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ فایل‌های کانتکست را بخوان و کد را بنویس.

---

## تسک F2.3 — سرویس CSV (Generate / Parse) با Zod

### هدف
ساخت سرویسی که یک تمپلیت CSV قابل دانلود تولید می‌کند و فایل‌های آپلودی کاربر را با Zod اعتبارسنجی و به آرایه `TemporalEvent` تبدیل می‌کند.

### راهنمای پیاده‌سازی فنی

۱. **ساخت فایل جدید `src/services/temporal/temporalCsvService.ts`:**
   - import: `Papa` از `papaparse`, `z` از `zod`, `parseJalaliDate` از `./jalaliCalendar`, تایپ‌ها از `./temporalService`.
   - تابع `generateCsvTemplate(): string`:
     - رشته CSV با هدر فارسی + ۲ ردیف نمونه:
       ```
       نام_مناسبت,تاریخ_شروع_شمسی,تاریخ_پایان_شمسی,کلمات_کلیدی
       شب یلدا,1404/09/30,1404/09/30,یلدا|شب چله|انار
       نوروز,1404/12/29,1405/01/13,نوروز|عید|تعطیلات بهاری
       ```
     - اضافه کردن BOM `\uFEFF` در ابتدای رشته برای پشتیبانی Excel فارسی (الگوی موجود در `csvExporter.ts` فعلی پروژه را بررسی کن).
   - تابع کمکی `triggerDownloadTemplate(): void`:
     - یک Blob با `text/csv;charset=utf-8` بساز و با URL.createObjectURL + `<a download>` دانلود را trigger کن. نام فایل: `linkmesh-temporal-template.csv`.
   - تابع `parseCsvFile(file: File): Promise<{ events: TemporalEvent[]; errors: string[] }>`:
     - با `Papa.parse` و `header: true` parse کن.
     - schema Zod:
       ```ts
       const RowSchema = z.object({
         'نام_مناسبت': z.string().min(1),
         'تاریخ_شروع_شمسی': z.string().min(1),
         'تاریخ_پایان_شمسی': z.string().min(1),
         'کلمات_کلیدی': z.string().min(1)
       });
       ```
     - برای هر ردیف:
       - `safeParse` کن. اگر invalid → `errors.push(`ردیف ${i+1}: ستون اجباری خالی است`)` و skip.
       - `parseJalaliDate(startStr)` و `parseJalaliDate(endStr)`. اگر `null` → `errors.push(`ردیف ${i+1}: فرمت تاریخ نامعتبر`)` و skip.
       - keywords را با `.split('|').map(k => k.trim().toLowerCase()).filter(Boolean)` پردازش کن.
       - اگر keywords خالی → خطا و skip.
       - `id = `csv-${Date.now()}-${i}``, `source: 'csv'`.
       - به آرایه events اضافه کن.
     - return `{ events, errors }`.

۲. **هیچ تغییر در UI در این تسک.** فقط service.

### محدودیت‌ها
- ✅ ردیف نامعتبر → skip + پیام خطا، نه crash.
- ✅ پشتیبانی اعداد فارسی در تاریخ.
- ✅ BOM برای Excel.
- ⛔ بدون نصب کتابخانه جدید (Papa Parse و Zod هر دو موجود).
- ⛔ بدون ذخیره مستقیم در localStorage از داخل service (Context آن را هندل می‌کند).

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- یک CSV با ۳ ردیف صحیح → `events.length === 3, errors.length === 0`.
- یک CSV با ۲ ردیف صحیح + ۱ ردیف با تاریخ خراب → `events.length === 2, errors.length === 1`.
- `generateCsvTemplate()` خروجی با BOM و ۳ خط (۱ هدر + ۲ نمونه).

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/services/temporal/jalaliCalendar.ts", "src/services/temporal/temporalService.ts", "src/services/io/csvExporter.ts", "src/services/io/csvParser.ts", "package.json"]`

> **یادآوری:** فایل‌های کانتکست را بخوان و کد را بنویس.

---

## تسک F2.4 — TemporalContext + Persistence (localStorage)

### هدف
ساخت Context Provider که state فیچر F2 را مدیریت می‌کند: سوییچ سراسری، override موضعی صفحه، و آرایه eventهای CSV. تمام تغییرات در localStorage persist شوند.

### راهنمای پیاده‌سازی فنی

۱. **ساخت فایل جدید `src/contexts/TemporalContext.tsx`:**
   - تایپ `TemporalContextValue` (طبق بخش ۱۰ ARCHITECTURE.md).
   - کلیدهای localStorage به‌صورت ثابت در بالای فایل:
     ```ts
     const KEY_GLOBAL = 'LINKMESH_TEMPORAL_GLOBAL_ENABLED';
     const KEY_PER_PAGE = 'LINKMESH_TEMPORAL_PER_PAGE';
     const KEY_CSV = 'LINKMESH_TEMPORAL_CSV_EVENTS';
     ```
   - تابع‌های کمکی `loadFromStorage` (سه تا، یکی برای هر کلید):
     - با `try/catch` در صورت parse error → return default.
     - default values: `globalEnabled = false`, `perPageEnabled = {}`, `csvEvents = []`.
   - کامپوننت `TemporalProvider({ children })`:
     - state اولیه با `useState(() => loadFromStorage(...))` (lazy init).
     - `useEffect` برای هر state → write به localStorage.
     - متدها:
       ```ts
       setGlobalEnabled(v) → setState + localStorage.setItem
       setPageEnabled(pageId, v) → state.perPageEnabled[pageId] = v + سinco
       setCsvEvents(events) → setState + localStorage
       isEnabledForPage(pageId) → 
         اگر perPageEnabled[pageId] !== undefined: return perPageEnabled[pageId]
         وگرنه: return globalEnabled
       getAllActiveEvents() → [...BUILT_IN_TEMPORAL_EVENTS, ...csvEvents]
       ```
     - **مهم:** `getAllActiveEvents` و سایر computed values را با `useMemo` cache کن تا re-render اضافی نداشته باشد.
     - return `<TemporalContext.Provider value={...}>{children}</...>`.
   - hook `useTemporalContext(): TemporalContextValue`:
     - با `useContext(TemporalContext)`. اگر undefined → throw `'useTemporalContext باید داخل TemporalProvider استفاده شود'`.

۲. **ویرایش `src/main.tsx` (یا `src/App.tsx` — هرکدام محل root است):**
   - `<TemporalProvider>` را در سطح بالای درخت کامپوننت‌ها (داخل `<ToastContext>` یا بیرون آن — معمولاً نزدیک ریشه) wrap کن.
   - **توجه:** فقط یک Provider اضافه می‌شود؛ ساختار route و سایر providerها دست‌نخورده.

۳. **هیچ تغییر در UI کاربر در این تسک.** Provider فعال است ولی هیچ کامپوننتی هنوز از آن استفاده نمی‌کند.

### محدودیت‌ها
- ✅ lazy init برای جلوگیری از read مکرر localStorage.
- ✅ try/catch در parse JSON.
- ✅ useMemo برای computed values.
- ⛔ بدون useReducer (overkill برای این case).
- ⛔ بدون Zustand.

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- در DevTools React: TemporalProvider در درخت دیده می‌شود.
- تغییر مقدار از داخل یک کامپوننت تستی → مقدار در `localStorage` مرورگر persist می‌شود → reload → مقدار حفظ می‌شود.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/main.tsx", "src/App.tsx", "src/contexts/ToastContext.tsx", "src/services/temporal/temporalService.ts", "src/constants/temporalSeasons.ts"]`

> **یادآوری:** فایل‌های کانتکست را بخوان و کد را بنویس.

---

## تسک F2.5 — UI: بخش تنظیمات Live در Config.tsx

### هدف
افزودن یک سکشن جدید به صفحه `Config.tsx` با: سوییچ سراسری «لینک‌سازی Live»، دکمه دانلود تمپلیت، آپلود CSV، و جدول preview eventهای فعال.

### راهنمای پیاده‌سازی فنی

۱. **ویرایش `src/pages/Config.tsx`:**
   - import:
     ```ts
     import { useTemporalContext } from '../contexts/TemporalContext';
     import { generateCsvTemplate, parseCsvFile } from '../services/temporal/temporalCsvService';
     import { Calendar, Upload, Download } from 'lucide-react';
     ```
   - داخل کامپوننت:
     ```ts
     const temporal = useTemporalContext();
     const fileInputRef = useRef<HTMLInputElement>(null);
     ```
   - یک سکشن جدید (بعد از سکشن «محدودیت تعداد لینک» در ستون چپ، یا یک `<section>` در سطح اول grid) با ساختار:
     - عنوان: «هوشمندسازی فصلی-زمانی (Live Boost)» با آیکون `Calendar`.
     - یک Toggle (می‌توانی با یک `<button>` ساده + استایل Tailwind بسازی، الگوی توگل ساده با `bg-blue-600` و دایره متحرک):
       ```tsx
       <button onClick={() => temporal.setGlobalEnabled(!temporal.globalEnabled)}
               className={`relative w-11 h-6 rounded-full transition-colors ${temporal.globalEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
         <span className={`absolute top-0.5 ${temporal.globalEnabled ? 'right-0.5' : 'right-5'} w-5 h-5 bg-white rounded-full shadow transition-all`} />
       </button>
       ```
     - متن توضیحی فارسی: «با فعال‌سازی این گزینه، صفحاتی که با مناسبت‌های جاری/آینده مرتبط هستند اولویت بالاتر می‌گیرند.»
     - دکمه «دانلود تمپلیت CSV» → فراخوانی helper `triggerDownloadTemplate` یا inline blob download از `generateCsvTemplate()`.
     - input file مخفی + دکمه «آپلود فایل مناسبت‌ها» که `fileInputRef.current?.click()` می‌زند.
     - در `onChange` فایل:
       ```ts
       const file = e.target.files?.[0]; if (!file) return;
       const { events, errors } = await parseCsvFile(file);
       if (errors.length > 0) {
         showToast({ type: 'error', message: `خطا در ${errors.length} ردیف. تمپلیت را دانلود و بازبینی کنید.` });
       }
       if (events.length > 0) {
         temporal.setCsvEvents(events);
         showToast({ type: 'success', message: `${events.length} مناسبت با موفقیت بارگذاری شد.` });
       }
       e.target.value = ''; // ریست برای آپلود مجدد فایل یکسان
       ```
     - جدول preview: لیست `temporal.csvEvents` (اگر طولش > 0) با ستون‌های نام، بازه شمسی، تعداد keywords. در بالا یک خط ثابت: «مناسبت‌های built-in: ۶ مورد (فصل‌ها + نوروز + یلدا)».
     - دکمه «حذف همه مناسبت‌های CSV» → `temporal.setCsvEvents([])`.

۲. **هیچ تغییر در منطق امتیازدهی Config یا save.** این سکشن مستقل است.

### محدودیت‌ها
- ✅ تمام متن فارسی، RTL.
- ✅ Toast هم برای موفقیت هم خطا.
- ✅ پاک کردن `e.target.value` برای امکان آپلود مجدد فایل یکسان.
- ⛔ بدون Drag-and-Drop آپلود (out of scope).
- ⛔ بدون preview محتوای CSV قبل از parse.

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- صفحه Config جدید — سکشن Live boost قابل مشاهده.
- آپلود یک CSV معتبر → toast سبز + لیست در جدول.
- آپلود CSV نامعتبر → toast قرمز + پیشنهاد دانلود تمپلیت.
- reload صفحه → CSV events حفظ می‌شوند.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/Config.tsx", "src/contexts/TemporalContext.tsx", "src/services/temporal/temporalCsvService.ts", "src/components/ui/Button.tsx", "src/hooks/useToast.ts"]`

> **یادآوری:** فایل‌های کانتکست را بخوان و کد را بنویس.

---

## تسک F2.6 — UI: Quick Toggle + اعمال Boost در PageDetail.tsx

### هدف
افزودن سوییچ سریع در هدر `PageDetail`، اعمال `applyTemporalBoost` روی `displayedCandidates` در صورت فعال بودن، و نمایش Badge کوچک روی هر CandidateCard که multiplier ≠ 1 دارد.

### راهنمای پیاده‌سازی فنی

۱. **ساخت کامپوننت جدید `src/components/TemporalBadge.tsx`:**
   - props:
     ```ts
     { multiplier: number; label: 'pre' | 'current' | 'neutral' | 'out-of-season'; reason: string; }
     ```
   - رفتار:
     - اگر `label === 'neutral'` → `return null` (هیچ نمایشی).
     - اگر `pre` → Badge سبز با متن `+4x` و آیکون `TrendingUp`.
     - اگر `current` → Badge آبی با متن `+3x` و آیکون `Calendar`.
     - اگر `out-of-season` → Badge قرمز کم‌رنگ با متن `−penalty` و آیکون `TrendingDown`.
     - `title={reason}` برای tooltip native.
   - استایل با Tailwind، فقط فارسی.

۲. **ویرایش `src/pages/PageDetail.tsx`:**
   - import:
     ```ts
     import { useTemporalContext } from '../contexts/TemporalContext';
     import { applyTemporalBoost, sortByBoostedScore, type BoostedCandidate } from '../services/temporal/temporalService';
     import TemporalBadge from '../components/TemporalBadge';
     ```
   - داخل کامپوننت:
     ```ts
     const temporal = useTemporalContext();
     const isTemporalActiveHere = temporal.isEnabledForPage(pgId);
     ```
   - **محاسبه boostedList با useMemo** (حیاتی برای پرفورمنس):
     ```ts
     const processedCandidates = useMemo(() => {
       if (!isTemporalActiveHere) return candidateList;
       const boosted = applyTemporalBoost(candidateList, {
         events: temporal.getAllActiveEvents(),
         targetMetadata: new Map() // در فاز اول از خود candidate.title و matched_tags استفاده می‌شود
       });
       return sortByBoostedScore(boosted);
     }, [candidateList, isTemporalActiveHere, temporal.csvEvents, temporal.globalEnabled]);
     
     const displayedCandidates = showAllCandidates ? processedCandidates : processedCandidates.slice(0, 30);
     ```
   - **افزودن Quick Toggle در هدر** (همان ردیف Badgeها، کنار `<InlinkBadge>`):
     ```tsx
     <button onClick={() => temporal.setPageEnabled(pgId, !isTemporalActiveHere)}
             className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
               isTemporalActiveHere ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-100'
             }`}
             title="فعال/غیرفعال‌سازی هوشمندسازی فصلی برای این صفحه">
       <Calendar size={12} />
       <span>{isTemporalActiveHere ? 'Live: روشن' : 'Live: خاموش'}</span>
     </button>
     ```
   - **اعمال TemporalBadge داخل هر CandidateCard:**
     - **توجه:** برای رعایت محدودیت «بدون تغییر در سایر کامپوننت‌ها» (در اصل این کامپوننت متعلق به فاز قبلی است)، **یک wrapper** در PageDetail ایجاد کن: کارت داخل یک `<div className="relative">` قرار گیرد و `<TemporalBadge ... />` به‌صورت `absolute top-2 left-2` روی کارت گذاشته شود (فقط برای موارد boosted). این روش بدون لمس `CandidateCard.tsx` نتیجه می‌دهد.
     - شرط رندر badge: کاندیدا یک `BoostedCandidate` است (`'temporalLabel' in c`) و `c.temporalMultiplier !== 1`.

۳. **اعمال boost در زمان ارسال به Gemini:**
   - در `handleAIAnalysis` فعلی `analysisService.runSinglePageAnalysis` صدا زده می‌شود. **تغییر امضای آن service** را در این تسک انجام می‌دهیم؟ → خیر، چون قانون «حداقل تغییر». به جای آن:
     - یک پارامتر اختیاری `temporalEvents?: TemporalEvent[]` به امضای `runSinglePageAnalysis` اضافه می‌شود (default = `undefined` → no-op، رفتار قبلی).
     - وقتی `temporalEvents` پاس داده شد، در داخل service قبل از ارسال top30 به promptBuilder، با `applyTemporalBoost` و `sortByBoostedScore` آن‌ها را بازترتیب کن.
     - در PageDetail اگر `isTemporalActiveHere` → `temporalEvents = temporal.getAllActiveEvents()` پاس بده. وگرنه `undefined`.

### محدودیت‌ها
- ✅ بدون لمس `CandidateCard.tsx` (الگوی wrapper).
- ✅ useMemo برای پرفورمنس.
- ✅ Quick Toggle آنی، بدون reload.
- ⛔ بدون animation روی Toggle (out of scope).
- ⛔ بدون تغییر در ساختار prompt Gemini.

### معیار پذیرش
- `tsc --noEmit` بدون خطا.
- روشن کردن Quick Toggle → ترتیب کاندیداها فوراً تغییر می‌کند، Badgeهای Temporal دیده می‌شوند.
- خاموش کردن Quick Toggle → بازگشت به مرتب‌سازی score خام.
- زدن «تحلیل جادویی AI» در حالت فعال → AI بر اساس ترتیب جدید (boosted) پرامپت دریافت می‌کند.
- در پروژه ۷۰۰ صفحه‌ای، روشن/خاموش کردن Toggle بدون hesitation محسوس.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/pages/PageDetail.tsx", "src/contexts/TemporalContext.tsx", "src/services/temporal/temporalService.ts", "src/services/analysis/analysisService.ts", "src/components/CandidateCard.tsx"]`

> **یادآوری:** فایل‌های کانتکست را بخوان و کد را بنویس.

---

## ترتیب اجرای فاز ۲-F2 (الزامی)

```
F2.1 (Calendar + Constants)
  └→ F2.2 (Core Service)
       └→ F2.3 (CSV Service)
            └→ F2.4 (Context + Persistence)
                 └→ F2.5 (Config UI)
                      └→ F2.6 (PageDetail UI + Gemini wiring)
```

F2.2 و F2.3 می‌توانند موازی نباشند — F2.3 به تایپ‌های F2.2 وابسته است.

## معیار پذیرش کل فیچر F2

1. هیچ تغییری در `src/db.ts`, `src/core/scoring/scorer.ts`, `src/core/scoring/idfCalculator.ts` (diff خالی).
2. هیچ کتابخانه جدید نصب نشده (دستورات `pnpm add` ممنوع در این فاز).
3. در پروژه ۷۰۰ صفحه‌ای: توگل سراسری روشن → ترتیب صفحات لیست‌ها فوراً متغیر می‌شود (بدون freeze).
4. آپلود CSV نامعتبر → خطای فارسی + پیشنهاد دانلود تمپلیت.
5. تنظیمات بعد از reload صفحه از localStorage بازخوانی می‌شوند.
6. تاریخ شمسی صحیح از `Intl.DateTimeFormat('fa-IR-u-nu-latn')` استخراج می‌شود (بدون moment-jalaali).
7. `tsc --noEmit` بدون خطا.
