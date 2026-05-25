# ARCHITECTURE.md — لنگرگاه سیستمی (نسخه ریفکتور لایه‌ای + Adaptive Scoring)

> این سند معماری **هدف نهایی** فاز ۱.۵ ریفکتور را تعریف می‌کند. اسکیمای دیتابیس و الگوریتم scorer دست‌نخورده می‌ماند؛ ساختار فایل‌ها و جریان وابستگی‌ها بازسازی می‌شود.
>
> **به‌روزرسانی R13:** بخش جدید «۷.۵ — Adaptive Scoring Pipeline» اضافه شد تا گلوگاه پرفورمنس در پروژه‌های کوچک/متوسط (≤ ۱۰۰۰ صفحه) از طریق رویکرد تطبیقی برطرف شود.

---

## ۱. معماری لایه‌ای (Layered Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — UI (React Components)                            │
│  src/pages/*, src/components/*                              │
│  وظیفه: فقط نمایش. هیچ db.* یا منطق بیزینسی ندارد           │
└──────────────────────┬──────────────────────────────────────┘
                       │ فقط از طریق services و hooks
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 2 — State (UI Hooks)                                 │
│  src/hooks/*                                                │
│  وظیفه: فقط state UI + اتصال به services/repositories      │
│  ممنوع: انجام مستقیم API call یا منطق صف                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 3 — Services (Use-Cases)                             │
│  src/services/analysis/*, src/services/scoring/*            │
│  وظیفه: ارکستراسیون use-case (مثل "اجرای تحلیل یک صفحه")    │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 4 — Core Domain                                      │
│  src/core/scoring/* (BLACK BOX — scorer.ts بدون تغییر)      │
│  src/core/queue/* (QueueManager, Coordinator, TaskExecutor) │
│  وظیفه: منطق خالص. هیچ وابستگی به مرورگر/Dexie/React        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Layer 5 — Infrastructure                                   │
│  src/repositories/* (Dexie wrappers)                        │
│  src/services/api/* (Gemini Client + Backoff)               │
│  src/services/io/* (CSV Parser + Zod)                       │
│  src/workers/* (Web Worker entry)                           │
└─────────────────────────────────────────────────────────────┘
```

### قواعد جریان وابستگی (الزامی)
- لایه بالاتر فقط از لایه پایین‌تر import می‌کند، **هرگز بالعکس**.
- Layer 4 (Core) هیچ import از Dexie، React، یا `window` ندارد → قابل اجرا در Web Worker و همچنین قابل فراخوانی sync از Main Thread.
- Layer 1 (UI) **هرگز** `import { db }` نمی‌کند.

---

## ۲. اسکیمای دیتابیس (Dexie — بدون تغییر)

نسخه فعلی `version(3)` با ۷ جدول حفظ می‌شود:
- `projects`, `pages`, `weights`, `candidates`, `results`, `analysisQueue`, `idfCache`

اسکیمای کامل و فیلدها در نسخه قبلی این سند (پایین این فایل در بخش "ضمیمه — اسکیما") حفظ شده است. **هیچ migration جدید در این فاز.**

---

## ۳. درخت فایل هدف (بعد از ریفکتور)

```
src/
├── App.tsx
├── main.tsx
├── db.ts                              ← فقط تعریف schema، بدون منطق
│
├── pages/                             ← Layer 1 (Dumb)
│   ├── Home.tsx
│   ├── NewProject.tsx
│   ├── Config.tsx
│   ├── ProjectPages.tsx               ← [ویرایش] منطق به analysisService منتقل
│   ├── PageDetail.tsx                 ← [ویرایش] منطق به analysisService منتقل
│   └── Results.tsx
│
├── components/                        ← Layer 1
│   ├── ui/*
│   ├── QueueProgress.tsx              ← React.memo اضافه شود
│   ├── CandidateCard.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectEmptyState.tsx
│   ├── ConfirmDialog.tsx
│   └── Breadcrumb.tsx
│
├── hooks/                             ← Layer 2 (فقط state UI)
│   ├── useProject.ts                  ← [ویرایش] از projectRepository بخواند
│   ├── useAnalysisQueue.ts            ← [ویرایش] فقط getter/control، نه پردازش
│   ├── useQueueStatus.ts              ← [جدید] selector برای جلوگیری از re-render
│   ├── useQueueAutoResume.ts          ← [جدید] mark interrupted as paused
│   ├── useDebounce.ts
│   └── useToast.ts
│
├── services/                          ← Layer 3
│   ├── analysis/
│   │   ├── analysisService.ts         ← [جدید] runSinglePage, runAllPages, resume
│   │   └── candidateService.ts        ← [جدید] wrapper روی scoring worker
│   ├── api/
│   │   ├── geminiClient.ts            ← [جدید] fetch + exponential backoff (429/5xx)
│   │   ├── promptBuilder.ts           ← [جدید] buildSinglePagePrompt (منتقل از gemini.ts)
│   │   └── geminiSchema.ts            ← [جدید] Zod schema پاسخ AI
│   ├── io/
│   │   ├── csvParser.ts               ← [ویرایش] Zod-based validation
│   │   └── csvExporter.ts             ← [جدید] منطق export از Results.tsx منتقل
│   └── scoring/
│       └── scoringService.ts          ← [جدید] postMessage به Web Worker
│
├── core/                              ← Layer 4 (Pure, No-DOM, Worker-Safe)
│   ├── scoring/
│   │   ├── scorer.ts                  ← [انتقال — بدون تغییر منطق] از utils/
│   │   └── idfCalculator.ts           ← [انتقال — بدون تغییر] از utils/
│   └── queue/
│       ├── QueueManager.ts            ← [جدید] فقط state transitions صف
│       ├── TaskExecutor.ts            ← [جدید] اجرای یک صفحه (atomic)
│       └── QueueCoordinator.ts        ← [جدید] حلقه پردازش + pause-check + sleep
│
├── repositories/                      ← Layer 5 (Dexie Wrappers)
│   ├── projectRepository.ts           ← [جدید]
│   ├── pageRepository.ts              ← [جدید]
│   ├── weightRepository.ts            ← [جدید]
│   ├── candidateRepository.ts        ← [جدید]
│   ├── resultRepository.ts            ← [جدید]
│   ├── queueRepository.ts             ← [جدید]
│   └── idfRepository.ts               ← [جدید]
│
├── workers/                           ← Layer 5
│   └── scoringWorker.ts               ← [جدید] entry برای Vite worker
│
├── utils/                             ← فقط ابزارهای generic
│   ├── safeJson.ts
│   ├── titleSimilarity.ts
│   ├── scorer.ts                      ← [حذف بعد از انتقال — شیم re-export موقت]
│   ├── idfCalculator.ts               ← [حذف بعد از انتقال — شیم re-export موقت]
│   ├── queueProcessor.ts              ← [ویرایش به شیم] فقط delegate به QueueCoordinator
│   ├── gemini.ts                      ← [ویرایش به شیم] re-export از services/api
│   ├── candidateStorage.ts            ← [ویرایش] از scoringService استفاده کند
│   └── csvParser.ts                   ← [ویرایش به شیم] re-export
│
├── constants/
│   ├── categories.ts
│   ├── theme.ts
│   └── timeNeighbors.ts
│
└── contexts/
    └── ToastContext.tsx

scorer.ts                              ← [ریشه] کپی مرجع کاربر (دست نخورده)
```

### فایل‌های ریشه پروژه که حذف می‌شوند (تکراری با `src/utils/`)
```
utils/candidateStorage.ts
utils/csvParser.ts
utils/gemini.ts
utils/idfCalculator.ts
utils/queueProcessor.ts
utils/safeJson.ts
utils/scorer.test.ts
utils/scorer.ts
utils/titleSimilarity.ts
```
این پوشه `/utils` ریشه به نظر از یک کپی قدیمی به‌جا مانده و در آخرین تسک حذف می‌شود.

### نقاط ویرایش اختصاصی R13

- `src/services/scoring/scoringService.ts` → **[ویرایش]** افزودن تابع `computeAllAdaptive(pages)` و ثابت `SCORING_FAST_TRACK_THRESHOLD = 1000`. توابع موجود (`computeAllInWorker`، `computeCandidatesInWorker`، `computeIDFInWorker`) **یک کاراکتر هم تغییر نمی‌کنند**.
- `src/utils/candidateStorage.ts` → **[ویرایش جزئی]** فقط یک‌خط: فراخوانی `computeAllAdaptive` به‌جای `computeAllInWorker`. منطق Dexie و `db.transaction` دست‌نخورده باقی می‌ماند.
- **هیچ فایل جدیدی ساخته نمی‌شود.** هیچ کتابخانه‌ای نصب نمی‌شود. هیچ تغییری در `scorer.ts`، `idfCalculator.ts`، یا `scoringWorker.ts` نیست.

---

## ۴. جریان داده جدید (Refactored Data Flow)

### اجرای صف AI (نمونه — مهم‌ترین جریان)

```
ProjectPages.tsx (UI)
    │ کلیک «اجرای تحلیل»
    ▼
analysisService.startProjectAnalysis(projectId, model)
    │
    ├─→ candidateService.computeAndStore(projectId)
    │       │
    │       └─→ scoringService.computeAllAdaptive(pages)   ← R13
    │               │
    │               ├─ if (pages.length <= 1000) → Fast-Track (sync, main thread)
    │               │
    │               └─ else → Heavy-Track (postMessage to Web Worker)
    │                           │
    │                           ▼
    │                     [scoringWorker.ts]
    │                       computeIDFMap + computeAllCandidates  (BLACK BOX)
    │                           ▼
    │                     { idfMap, candidatesMap }
    │               │
    │               (نتیجه واحد بدون توجه به مسیر)
    │               ▼
    │       db.transaction([idfCache, candidates])
    │         ├─ idfRepository.upsertInTx(...)
    │         ├─ candidateRepository.clearByProject(...)
    │         └─ candidateRepository.bulkAdd(records)
    │
    └─→ queueRepository.create(projectId, totalPages)
            │
            ▼
useAnalysisQueue (UI hook) → useEffect → QueueCoordinator.start(projectId)
            │
            ▼
QueueCoordinator (Layer 4)
    │ loop i = current_index..total:
    │   ┌─ QueueManager.isPaused() → break
    │   ├─ TaskExecutor.executePage(pageId)
    │   │     │
    │   │     ├─→ candidateRepository.getByPage(pageId)
    │   │     ├─→ promptBuilder.buildSinglePagePrompt(...)
    │   │     ├─→ geminiClient.call(prompt, model)  ← retry/backoff داخلی
    │   │     └─→ resultRepository.save(...)  ← transaction
    │   │
    │   ├─ QueueManager.advance(i+1)
    │   └─ sleep(2000)
    │ on error: QueueManager.markFailed(err)
    ▼
QueueManager.markCompleted()
```

### اجرای resume خودکار بعد از بسته شدن تب
```
App.tsx → useQueueAutoResume()
    │ on mount
    ▼
queueRepository.findInterrupted()  // status='processing' ولی update_at قدیمی
    │
    └─→ queueRepository.markPaused(queueId)
        (کاربر دستی resume می‌کند تا کنترل دست او باشد)
```

---

## ۵. اعتبارسنجی با Zod

دو نقطه ورود داده با Zod محافظت می‌شود:

### `services/io/csvParser.ts`
```ts
const RowSchema = z.object({
  'عنوان_H1': z.string().min(1),
  // ۱۸ ستون دسته‌بندی به صورت optional nullable string
  ...
});
```
اگر یک ردیف نامعتبر بود، با پیام خطای واضح skip می‌شود نه crash.

### `services/api/geminiSchema.ts`
```ts
const GeminiResponseSchema = z.object({
  selected_links: z.array(z.object({
    page_id: z.number(),
    title: z.string(),
    reason: z.string()
  }))
});
```
خروجی AI قبل از ذخیره در `results` validate می‌شود.

---

## ۶. مدیریت خطا در Gemini (Exponential Backoff)

`services/api/geminiClient.ts` به این شکل کار می‌کند:

```
attempt = 0
while attempt < 5:
  response = fetch(...)
  if response.ok: return parsed
  if status == 429 or 5xx:
    delay = min(60000, 2^attempt * 1000 + jitter)
    await sleep(delay)
    attempt++
  else:
    throw (non-retryable)
throw "تعداد تلاش‌ها به حداکثر رسید"
```

---

## ۷. Web Worker (Heavy-Track Engine)

### فایل `src/workers/scoringWorker.ts`

این فایل از R12 بدون تغییر باقی می‌ماند و **فقط در مسیر Heavy-Track** فراخوانی می‌شود.

```ts
import { computeAllCandidates } from '../core/scoring/scorer';
import { computeIDFMap } from '../core/scoring/idfCalculator';

self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'COMPUTE_ALL') {
    const idfMap = computeIDFMap(payload.pages);
    const candidatesMap = computeAllCandidates(payload.pages);
    const candidatesArray = Array.from(candidatesMap.entries())
      .map(([pageId, list]) => [pageId, list.slice(0, 50)]);
    self.postMessage({ type: 'DONE_ALL', payload: { idfMap, candidates: candidatesArray } });
  }
};
```

### فایل `src/services/scoring/scoringService.ts` (Heavy-Track caller)

```ts
import ScoringWorker from '../../workers/scoringWorker?worker';

export async function computeAllInWorker(pages) {
  // یک ورکر اسپاون، postMessage(COMPUTE_ALL)، دریافت DONE_ALL، terminate.
}
```

---

## ۷.۵. Adaptive Scoring Pipeline (R13) — **مفهوم کلیدی**

### چرا این لایه وجود دارد

بعد از پیاده‌سازی R12، روی پروژه‌های بزرگ (۵۰۰۰+ صفحه) پرفورمنس عالی شد. اما اندازه‌گیری روی پروژه‌های کوچک/متوسط (مثلاً ۷۰۰ صفحه) یک رگرسیون نشان داد:

- قبل از ریفکتور: کل محاسبه روی Main Thread حدود **۱ ثانیه**.
- بعد از R12: همان محاسبه چند ثانیه طول می‌کشد چون سربار ثابت **اسپاون ورکر + structured-clone + Vite worker bootstrap** برای دیتای کوچک، خود بزرگ‌تر از زمان واقعی محاسبه است.

**نتیجه‌گیری معماری:** Web Worker فقط زمانی سودده است که حجم کار از یک آستانه بحرانی بالاتر باشد. زیر آن آستانه، اجرای مستقیم روی Main Thread سریع‌تر و ساده‌تر است و چون کل عملیات زیر یک ثانیه طول می‌کشد، UI Freeze محسوس نیست.

### قانون تطبیقی (Threshold)

ثابت سراسری:

```ts
export const SCORING_FAST_TRACK_THRESHOLD = 1000;
```

دو مسیر در `scoringService.ts`:

#### مسیر A — Fast-Track (pages.length ≤ 1000)

- **هیچ ورکری اسپاون نمی‌شود.**
- `computeIDFMap(pages)` و `computeAllCandidates(pages)` مستقیماً و **به‌صورت همگام (sync)** روی Main Thread فراخوانی می‌شوند.
- خروجی `computeAllCandidates` که یک `Map` است، با همان قانون قبلی **به ۵۰ کاندیدای برتر برش داده می‌شود** (`list.slice(0, 50)`) تا قرارداد خروجی با Heavy-Track بایت‌به‌بایت یکسان باقی بماند.
- نتیجه به همان شکل `{ idfMap, candidatesMap }` به caller بازگردانده می‌شود.
- چون کل کار زیر ~۵۰۰ms است، هیچ نیازی به chunk-yielding یا `setTimeout(0)` نیست.

#### مسیر B — Heavy-Track (pages.length > 1000)

- دقیقاً همان مسیر R12: فراخوانی `computeAllInWorker(pages)` که داخل خود یک ورکر اسپاون می‌کند، `COMPUTE_ALL` می‌فرستد، `DONE_ALL` می‌گیرد و ترمینیت می‌کند.
- مسیر و بهینه‌سازی‌های R12 (حذف `categories: cat`، slice(50)، pre-warm worker) دست‌نخورده می‌مانند.

### قرارداد خروجی واحد

هر دو مسیر دقیقاً همین شکل را برمی‌گردانند:

```ts
{
  idfMap: IDFMap,
  candidatesMap: Map<number, CandidateWithTags[]>  // هر لیست حداکثر ۵۰ آیتم
}
```

این تضمین می‌کند که caller (`candidateStorage.ts`) هیچ branching بر اساس مسیر ندارد.

### نمودار تصمیم

```
            ┌──────────────────────────────┐
            │   scoringService.            │
            │   computeAllAdaptive(pages)  │
            └──────────────┬───────────────┘
                           │
                  pages.length <= 1000 ?
                           │
              ┌────────────┴────────────┐
             yes                        no
              │                         │
              ▼                         ▼
   ┌──────────────────────┐  ┌──────────────────────┐
   │ Fast-Track (sync)    │  │ Heavy-Track (worker) │
   │  computeIDFMap       │  │  computeAllInWorker  │
   │  computeAllCandidates│  │  (R12 path)          │
   │  slice(0,50)         │  │                      │
   └──────────┬───────────┘  └──────────┬───────────┘
              │                         │
              └─────────────┬───────────┘
                            ▼
                  { idfMap, candidatesMap }
                            │
                            ▼
              db.transaction (شامل upsertInTx + clear + bulkAdd)
```

### قواعد ثابت R13

- **آستانه ۱۰۰۰** به‌صورت ثابت export شده در `scoringService.ts` نگه داشته می‌شود. هیچ env-var یا setting کاربری برای آن نیست.
- **هیچ تغییری در `scorer.ts`، `idfCalculator.ts`، یا `scoringWorker.ts` انجام نمی‌شود.**
- **هیچ تغییری در ساختار transaction Dexie** نیست؛ همان `db.transaction('rw', [db.idfCache, db.candidates], ...)` که در R12 ساخته شد، در هر دو مسیر مصرف می‌شود.
- **هیچ duplication در منطق slice(0,50) قابل قبول نیست**، اما چون ورکر و Fast-Track دو محل اجرای مستقل هستند، هر یک slice خودش را اعمال می‌کند تا قرارداد خروجی واحد حفظ شود (این تنها تکرار مجاز است و دو خط است).

---

## ۸. نکات امنیتی (بدون تغییر)

- کلید Gemini API فقط در `localStorage` با کلید `LINKMESH_API_KEY`
- در حال حاضر یک proxy روی `/api/gemini` (server.ts) وجود دارد که کلید را از env می‌خواند — این پابرجاست
- در export، کلید در CSV نمی‌رود

---

## ضمیمه — اسکیمای کامل دیتابیس (مرجع)

اسکیمای جداول هیچ تغییری نمی‌کند. برای جزئیات کامل فیلدها به نسخه پیشین این سند (قبل از این به‌روزرسانی) در history Git مراجعه شود. خلاصه:

- **projects**: id, name, created_at, scoring_mode
- **pages**: id, project_id, title, categories (JSON)
- **weights**: id, project_id, category_name, weight_value
- **candidates**: id, project_id, source_page_id, candidate_list (JSON), computed_at
- **results**: id, project_id, source_page_id, source_title, recommended_links (JSON), is_manual_edit, generated_at
- **analysisQueue**: id, project_id, status, current_page_index, total_pages, selected_model, error_message, started_at, updated_at
- **idfCache**: id, project_id, idf_map (JSON), computed_at
