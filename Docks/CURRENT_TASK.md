# CURRENT_TASK.md — پنجره اولویت و تمرکز اجرایی

> این سند بر اساس نقشه راه مرجع (`tasks.md`) ساخته شده و وضعیت تمرکز اجرایی فعلی را نشان می‌دهد.

---

## فاز جاری: **فاز ۲ — توسعه ویژگی‌ها (Feature Expansion)**

فاز ۱ و ۱.۵ تمام شدند. اکنون وارد فاز ۲ می‌شویم که اولین فیچر آن **Inlink Analytics (گراف معکوس لینک‌سازی)** است. چالش اصلی: پیدا کردن لینک‌های ورودی به یک صفحه بدون اسکیمای Dexie یا بدون UI Freeze. راه‌حل: **Reverse Index in-memory** با کش per-project + signature-based invalidation. جزئیات معماری در بخش ۹ `ARCHITECTURE.md` آمده.

---

## تسک جاری: **F1.1 — زیرساخت Reverse Index Service**

### وضعیت: **Not Started**

### هدف
ساخت سرویس `inlinkGraphService` که یک Reverse Index in-memory از گراف لینک‌سازی پروژه می‌سازد و آن را با کش module-level + signature-based invalidation مدیریت می‌کند. این تسک هیچ UI تولید نمی‌کند؛ فقط زیرساخت داده است.

### قانون کلیدی (سخت‌گیرانه)
```
برای هر source_page_id در پروژه:
  if (resultRepository.getByPage(sourceId) exists):
    منبع = result.recommended_links  → origin='result'
  else:
    منبع = candidate.candidate_list   → origin='candidate'
  
  for each link.page_id in منبع:
    inlinkIndex.get(link.page_id).push({ sourcePageId, rank, score, ... })
```

**کلید:** هر صفحه مبدأ فقط از یک منبع خوانده می‌شود (هرگز هر دو). این منطق درخواست کاربر را دقیقاً پیاده می‌کند.

---

## محل تغییر

**فقط یک فایل ویرایش می‌شود:**
- `src/utils/candidateStorage.ts`

**فایل‌های دیگری که فقط خوانده می‌شوند (برای فهم contract، نه ویرایش):**
- `src/core/scoring/idfCalculator.ts` — تابع `computeIDFMap(pages)` و تایپ `IDFMap`، `PageLike`
- `src/core/scoring/scorer.ts` — تابع `computeAllCandidates(pages)` و تایپ `CandidateWithTags`
- `src/services/scoring/scoringService.ts` — تابع `computeAllInWorker(pages)` (مسیر Heavy فعلی)
- `src/repositories/idfRepository.ts` — متد `upsertInTx`
- `src/repositories/candidateRepository.ts` — متدهای `clearByProject`, `bulkAdd`

**هیچ فایل دیگری در این تسک ویرایش نمی‌شود. هیچ فایل جدیدی ساخته نمی‌شود.**

---

## راهنمای پیاده‌سازی فنی (گام‌به‌گام)

### گام ۱ — افزودن import های Core
در بالای `src/utils/candidateStorage.ts`، علاوه بر import های موجود، این دو را اضافه کن (مسیرها را با ساختار فعلی پروژه تطبیق بده — هر دو فایل قبلاً در `src/core/scoring/` موجودند):
```ts
import { computeIDFMap } from '../core/scoring/idfCalculator';
import { computeAllCandidates, type CandidateWithTags } from '../core/scoring/scorer';
```
> توجه: `computeAllInWorker` همچنان import باقی می‌ماند چون در شاخه Heavy استفاده می‌شود.

### گام ۲ — تعریف ثابت آستانه
بلافاصله بعد از import ها، این ثابت را در سطح ماژول تعریف کن:
```ts
// آستانه انتخاب موتور پردازش: زیر این مقدار، اجرای مستقیم روی Main Thread (Fast-Track)
const SCORING_WORKER_THRESHOLD = 1000;
```

### گام ۳ — بازنویسی بدنه `computeAndStoreCandidates`
ساختار جدید تابع باید **دقیقاً** این جریان را داشته باشد:

```ts
export async function computeAndStoreCandidates(
  projectId: number,
  pages: Page[],
  _weights: Record<string, number>,
  _mode: 'linear' | 'weighted'
): Promise<void> {

  // ۱. آماده‌سازی pages با categories پارس‌شده — یک‌بار، مشترک بین دو مسیر
  const pagesWithId = pages.map(p => ({
    id: p.id!,
    title: p.title,
    categories: typeof p.categories === 'string' ? JSON.parse(p.categories) : p.categories
  }));

  // ۲. انتخاب مسیر بر اساس تعداد صفحات
  let idfMap;
  let candidatesMap: Map<number, CandidateWithTags[]>;

  if (pagesWithId.length <= SCORING_WORKER_THRESHOLD) {
    // ── Fast-Track: اجرای مستقیم روی Main Thread، بدون Worker ──
    idfMap = computeIDFMap(pagesWithId);
    candidatesMap = computeAllCandidates(pagesWithId);
  } else {
    // ── Heavy-Track: ارسال به Web Worker (همان مسیر R12) ──
    const result = await computeAllInWorker(pagesWithId);
    idfMap = result.idfMap;
    candidatesMap = result.candidatesMap;
  }

  // ۳. آماده‌سازی رکوردها (مشترک)
  const now = new Date().toISOString();
  const records = Array.from(candidatesMap.entries()).map(([pageId, list]) => ({
    project_id: projectId,
    source_page_id: pageId,
    candidate_list: JSON.stringify(list),
    computed_at: now
  }));

  // ۴. ذخیره در یک تراکنش واحد — بدون تغییر نسبت به R12
  await db.transaction('rw', [db.idfCache, db.candidates], async () => {
    await idfRepository.upsertInTx(projectId, JSON.stringify(idfMap));
    await candidateRepository.clearByProject(projectId);
    await candidateRepository.bulkAdd(records);
  });
}
```

### گام ۴ — تأیید signature و سایر export ها
- signature تابع `computeAndStoreCandidates` نباید تغییر کند.
- تابع `getCachedIDF` در همان فایل دست‌نخورده باقی می‌ماند.
- import `computeAllInWorker` نباید حذف شود (هنوز در Heavy-Track استفاده می‌شود).

---

## محدودیت‌های اختصاصی این تسک (سخت‌گیرانه)

- ✅ فقط `src/utils/candidateStorage.ts` ویرایش می‌شود.
- ✅ خروجی Dexie (`idfCache.idf_map` و `candidates.candidate_list`) باید **بایت-به-بایت یکسان** با حالت R12 باقی بماند، صرف‌نظر از مسیر اجرا. توابع core همان توابعی هستند که قبلاً در ورکر صدا زده می‌شدند.
- ✅ هیچ تغییری در `scorer.ts`، `idfCalculator.ts`، `scoringService.ts`، یا `scoringWorker.ts` انجام نشود.
- ✅ مقدار آستانه (`SCORING_WORKER_THRESHOLD = 1000`) صرفاً یک ثابت محلی بالای فایل است — وارد config یا env نشود.
- ✅ هیچ console.log اضافه نشود مگر یک خط `console.log('[v0] scoring path', pagesWithId.length, pagesWithId.length <= SCORING_WORKER_THRESHOLD ? 'fast' : 'heavy')` برای debug که بعد از تأیید کاربر حذف خواهد شد.
- ⛔ هیچ try/catch اضافه گرد scoring اضافه نکن — اگر در Fast-Track exception رخ داد، باید بالا برود (همان رفتار قبلی).
- ⛔ هیچ تغییر در ترتیب آرگومان‌های `computeIDFMap` یا `computeAllCandidates`. این توابع pure هستند و pages را همان شکلی که computeAllInWorker می‌گیرد می‌گیرند.
- ⛔ async/await اضافه روی توابع sync core نگذار. آن‌ها sync هستند و باید sync صدا زده شوند.
- ⛔ هیچ پیش‌بارگذاری/pre-warm Worker در main.tsx تغییر نکند. در پروژه‌های کوچک Worker اصلاً ساخته نمی‌شود ولی pre-warm فعلی مشکلی ایجاد نمی‌کند (idle import).

---

## معیار پذیرش

1. آپلود CSV با ~۷۰۰ صفحه → ورود به صفحه پروژه د�� زیر ۱.۵ ثانیه.
2. کلیک «بررسی الگوریتم» روی همان پروژه → اتمام در زیر ۱.۵ ثانیه.
3. پروژه با > ۱۰۰۰ صفحه همچنان از Worker استفاده می‌کند و UI freeze نمی‌شود.
4. خروجی `candidates` و `idfCache` در Dexie برای یک پروژه ثابت بین Fast-Track و Heavy-Track یکسان است (با تغییر آستانه به مقادیر متفاوت و مقایسه تست شود).
5. `tsc --noEmit` بدون خطا.

---

## رله کانتکست (Context Relay)

- **چرا این تسک لازم شد:** R12 سربار IPC را برای پروژه‌های بزرگ کم کرد، ولی برای پروژه‌های کوچک/متوسط، هزینه ثابت ساخت Worker (~۲–۴ ثانیه در dev mode Vite) خودش گلوگاه شد.
- **چرا Fast-Track امن است:** توابع core در R4 از وابستگی DOM/Dexie/React جدا شدند. اجرای آن‌ها روی Main Thread برای ≤۱۰۰۰ صفحه چند صد میلی‌ثانیه طول می‌کشد، که بسیار کمتر از سربار راه‌اندازی Worker است.
- **قانون مطلق:** الگوریتم scorer و خروجی عددی آن یک کاراکتر هم تغییر نمی‌کند. این تسک فقط یک شاخه `if/else` اضافه می‌کند.

`CONTEXT_FILES: ["Docks/ARCHITECTURE.md", "src/utils/candidateStorage.ts", "src/services/scoring/scoringService.ts", "src/core/scoring/scorer.ts", "src/core/scoring/idfCalculator.ts", "src/repositories/idfRepository.ts", "src/repositories/candidateRepository.ts"]`

> **یادآوری:** حق نداری هیچ کدی رو حدس بزنی؛ همین الان فایل‌های کانتکست را با ابزار خواندن باز کن و بخوان، سپس کد این تسک را بزن.
