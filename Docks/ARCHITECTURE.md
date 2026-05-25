# ARCHITECTURE.md — لنگرگاه سیستمی (نسخه ریفکتور لایه‌ای)

> این سند معماری **هدف نهایی** فاز ۱.۵ ریفکتور را تعریف می‌کند. اسکیمای دیتابیس و الگوریتم scorer دست‌نخورده می‌ماند؛ ساختار فایل‌ها و جریان وابستگی‌ها بازسازی می‌شود.

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
- Layer 4 (Core) هیچ import از Dexie، React، یا `window` ندارد → قابل اجرا در Web Worker.
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
    │       └─→ scoringService.compute(pages)
    │               │ postMessage to Web Worker
    │               ▼
    │       [scoringWorker.ts]
    │               │ computeIDFMap + computeAllCandidates (BLACK BOX)
    │               ▼
    │       candidateRepository.saveBatch(records)
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

## ۷. Adaptive Scoring Pipeline (R13 — معماری تطبیقی)

### مسئله‌ای که این بخش حل می‌کند
بعد از R12 ثابت شد که برای پروژه‌های بزرگ (هزاران صفحه) Worker + IPC بهینه گلوگاه را برمی‌دارد. اما برای پروژه‌های کوچک و متوسط (مثلاً ۷۰۰ صفحه)، **هزینه راه‌اندازی Worker** (کامپایل ماژول در dev، structured-clone، transfer pages به ورکر، transfer نتیجه به main، ساخت Map از آرایه، تراکنش Dexie) چند ثانیه می‌شود — در حالی که اجرای همان منطق روی Main Thread فقط حدود ۱ ثانیه طول می‌کشد.

### تصمیم معماری
سیستم دو مسیر مجزا دارد و در runtime بر اساس **تعداد صفحات پروژه** یکی را انتخاب می‌کند.

```
                    computeAndStoreCandidates(projectId, pages, ...)
                                       │
                          pages.length <= THRESHOLD ?
                          ┌────────────┴────────────┐
                          ▼ YES                     ▼ NO
                  ┌──────────────────┐    ┌──────────────────┐
                  │   Fast-Track     │    │   Heavy-Track    │
                  │  (Main Thread)   │    │  (Web Worker)    │
                  └──────────────────┘    └──────────────────┘
```

### آستانه (Threshold)
- ثابت `SCORING_WORKER_THRESHOLD = 1000` در ابتدای `src/utils/candidateStorage.ts`.
- قاعده: `pages.length <= 1000` → Fast-Track، در غیر این صورت Heavy-Track.

### مسیر Fast-Track (`pages.length ≤ 1000`)
- **بدون Worker.** هیچ `new ScoringWorker()` فراخوانی نمی‌شود.
- مستقیماً از `core/scoring/idfCalculator.ts::computeIDFMap` و `core/scoring/scorer.ts::computeAllCandidates` روی Main Thread استفاده می‌شود (synchronous).
- چون این توابع Pure هستند و در R4 از وابستگی DOM/Dexie جدا شده‌اند، روی Main Thread بدون مشکل قابل اجرا هستند.
- نتیجه مستقیماً (بدون structured-clone، بدون postMessage، بدون رفت‌و‌برگشت Map↔Array) در همان `db.transaction` واحد ذخیره می‌شود.
- مزیت: حذف کامل سربار IPC (تخمین: کاهش از چند ثانیه به زیر ۱ ثانیه).
- ریسک قابل قبول: chunk کوتاه CPU روی Main Thread (حدود ۵۰۰ms تا ۱s برای ۷۰۰ صفحه). UI ممکن است یک لحظه micro-jank داشته باشد، اما این بسیار بهتر از انتظار چند ثانیه‌ای است.

### مسیر Heavy-Track (`pages.length > 1000`)
- دقیقاً همان جریان R12: `computeAllInWorker` از `services/scoring/scoringService.ts` صدا زده می‌شود.
- یک Worker اسپاون می‌شود، یک پیام `COMPUTE_ALL` می‌رود، یک پیام `DONE_ALL` برمی‌گردد، Worker terminate می‌شود.
- نتیجه در همان `db.transaction` واحد (idfCache + candidates) ذخیره می‌شود.
- مزیت: UI در پروژه‌های بزرگ freeze نمی‌شود.

### نکات مشترک هر دو مسیر
- خروجی نهایی Dexie (`idfCache` و `candidates`) **بایت-به-بایت یکسان** است؛ فقط مسیر اجرا فرق دارد.
- ساخت `pagesWithId` (parse کردن `categories` در صورت string بودن) یک‌بار قبل از شاخه if/else انجام می‌شود.
- تراکنش واحد Dexie و حذف فیلد `categories` از candidate (R12) در هر دو مسیر دست‌نخورده باقی می‌ماند.

### مرز انتخاب آستانه
- ۱۰۰۰ یک نقطه محافظه‌کارانه است. در ماشین‌های متوسط، Main Thread می‌تواند تا ~۲۰۰۰ صفحه را در زیر ۲ ثانیه پردازش کند بدون اینکه UI به‌طور محسوس freeze شود. اگر تست‌های واقعی نیاز به تنظیم نشان داد، فقط مقدار `SCORING_WORKER_THRESHOLD` تغییر می‌کند — هیچ تغییر معماری دیگری لازم نیست.

---

## ۸. Web Worker (Heavy-Track)

### فایل `src/workers/scoringWorker.ts`
```ts
import { computeAllCandidates } from '../core/scoring/scorer';
import { computeIDFMap } from '../core/scoring/idfCalculator';

self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'COMPUTE') {
    const candidates = computeAllCandidates(payload.pages);
    self.postMessage({ type: 'DONE', payload: serializeMap(candidates) });
  }
};
```

### فایل `src/services/scoring/scoringService.ts`
```ts
// import با ?worker سینتکس Vite
import ScoringWorker from '../../workers/scoringWorker?worker';

export async function computeCandidatesInWorker(pages) {
  return new Promise((resolve, reject) => {
    const w = new ScoringWorker();
    w.onmessage = (e) => { resolve(e.data.payload); w.terminate(); };
    w.onerror = reject;
    w.postMessage({ type: 'COMPUTE', payload: { pages } });
  });
}
```

---

## ۹. نکات امنیتی (بدون تغییر)

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
