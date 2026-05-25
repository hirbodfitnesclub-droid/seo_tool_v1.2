# CURRENT_TASK.md — پنجره اولویت و تمرکز اجرایی

> این سند بر اساس نقشه راه مرجع (`tasks.md`) ساخته شده و وضعیت تمرکز اجرایی فعلی را نشان می‌دهد.

---

## فاز جاری: بهینه‌سازی ریشه‌ای پرفورمنس (R12)

پس از بررسی کامل معماری و کد، گلوگاه واقعی **نه CPU بود نه الگوریتم** — بلکه IPC و Worker Lifecycle. R11 لایه CPU را بهینه کرد ولی گلوگاه واقعی همچنان باز ماند.

---

## تسک جاری: **R12 — حذف گلوگاه IPC و یکپارچه‌سازی ورکر**

### وضعیت: **Completed ✅ (تکمیل شده)**

### گزارش بهینه‌سازی‌های پیاده‌سازی شده:
۱. **حذف فیلد `categories` از کاندیداها (کاهش ۹۵ درصدی بار پردازشی IPC):** فیلد اضافه `categories: cat` از خروج نهایی توابع `computeAllCandidates` و `findTopCandidates` حذف شد، زیرا این داده‌ها جلوتر در کامپوننت‌های پایینی و ارجاع‌های دیگر مستقیماً از دیتابیس مرجع واکشی می‌شوند.
۲. **ادغام تراکنش‌ها در وب‌ورکر (رفع گلوگاه اسپاون موازی):** متد جدید `COMPUTE_ALL` در ورکر و متد تعاملی `computeAllInWorker` در لایه سرویس پیاده‌سازی گردید که تنها با یک بار ساخت شیء ورکر، جفت محاسبات IDF و Candidates را برگشت می‌دهد.
۳. **تراکنش یکپارچه برای عملیات دیتابیس (رفع re-render مکرر):** تمامی خروجی‌ها در قالب یک `db.transaction` بسیار سریع ثبت می‌شوند و متد جدید مخصوص تراکنش (`upsertInTx`) برای IDF اضافه گردید.
۴. **افزایش اندازه چانک‌های پردازشی CSV:** برای افزایش سرعت تحلیل داده‌های اولیه ورودی، با توجه به سرعت عالی Zod، مقدار `chunkSize` از ۱۰۰ به ۱۰۰۰ افزایش یافت.
۵. **پیش‌بارگذاری ورکر (Pre-warm Worker):** جهت اجرای فوق‌العاده سریع نخستین ترکنش وب‌ورکر، تحلیل ماژول در `main.tsx` قرار گرفت.
۶. **بهینه‌سازی رندرهای ری‌اکت:** کامپوننت `CandidateCard` با `React.memo` پوشیده شد.

### چهار گلوگاه قطعی شناسایی شده (به ترتیب اولویت تاثیر)

#### 🔴 گلوگاه A — اسپاون متوالی دو وب‌ورکر مستقل
**محل:** `src/utils/candidateStorage.ts` گام‌های ۱ و ۵
**علت:** `computeIDFInWorker` یک ورکر اسپاون+ترمینیت می‌کند، سپس `computeCandidatesInWorker` ورکر دوم را از صفر می‌سازد. در Vite dev mode، هر اسپاون ورکر شامل کامپایل و گراف ماژول جداگانه است.
**تاثیر تخمینی:** ۴ تا ۱۰ ثانیه به‌ازای هر فراخوانی `computeAndStoreCandidates`.
**راهکار:** ادغام در یک message type واحد `COMPUTE_ALL` در ورکر و یک تابع `computeAllInWorker` در scoringService.

#### 🔴 گلوگاه B — IPC غول‌پیکر به‌خاطر چسبیدن `categories` به هر کاندیدا
**محل:** `src/core/scoring/scorer.ts` خط ~۱۱۰۸ (در `findTopCandidates`) و خط ~۱۱۶۸ (در `computeAllCandidates`).
**علت:** هر کاندیدا شامل کل آبجکت `categories` مقصد است. برای ۵۰۰۰ صفحه × ۵۰ کاندیدا = ۲۵۰هزار کپی آبجکت در structured-clone از ورکر به main.
**این داده تکراری در پایین‌دست واقعاً مصرف نمی‌شود** — `TaskExecutor.executePage` با `allPages.find(...)` و `PageDetail` با `pageRepository.getById(...)` تگ‌ها را از منبع اصلی غنی‌سازی می‌کنند.
**تاثیر تخمینی:** ۲ تا ۵ ثانیه structured-clone + کاهش ۹۵٪ حجم.
**راهکار:** فقط فیلد `categories: cat` را از خروجی map نهایی scorer حذف کن. منطق امتیازدهی دست‌نخورده می‌ماند.

#### 🟡 گلوگاه C — JSON.stringify ۵۰۰۰‌بار روی Main Thread با داده آلوده B
**محل:** `src/utils/candidateStorage.ts` خط `JSON.stringify(list)` در map رکوردها.
**علت:** بعد از بازگشت داده غول‌پیکر از ورکر، main thread برای هر صفحه یک stringify بزرگ می‌خورد.
**تاثیر تخمینی:** ۱ تا ۳ ثانیه فریز.
**راهکار:** با حل B خودبه‌خود حل می‌شود (داده ۵٪ شده).

#### 🟡 گلوگاه D — chunk کوچک در CSV
**محل:** `src/services/io/csvParser.ts` خط `chunkSize = 100`.
**علت:** هر ۱۰۰ ردیف یک `setTimeout(0)` که در مرورگرها حداقل ۴ms تاخیر دارد.
**تاثیر تخمینی:** ۲۰۰ms اضافی بر CSV ۵۰۰۰ ردیفی.
**راهکار:** chunkSize = 1000.

#### 🟡 گلوگاه E — Notification های مکرر Dexie باعث re-render
**محل:** `src/utils/candidateStorage.ts` (دو operation جدا) و `src/pages/ProjectPages.tsx`.
**راهکار:** پیچاندن idfUpsert + clearCandidates + bulkAdd در یک `db.transaction` واحد. این کار فقط یک‌بار notification می‌زند.

---

## شش گام پیاده‌سازی (به ترتیب)

۱. **scorer.ts**: حذف `categories: cat` از خروجی map در `findTopCandidates` و `computeAllCandidates`. هیچ تغییر دیگری نه.
۲. **scoringWorker.ts**: افزودن type جدید `COMPUTE_ALL` که هم IDF هم candidates را در یک پیام برمی‌گرداند. type های قدیمی نگه داشته شوند.
۳. **scoringService.ts**: افزودن تابع `computeAllInWorker(pages)` که فقط یک ورکر اسپاون می‌کند.
۴. **idfRepository.ts**: افزودن تابع `upsertInTx(projectId, idfJson)` که داخل transaction بیرونی اجرا می‌شود (بدون transaction داخلی).
۵. **candidateStorage.ts**: استفاده از `computeAllInWorker`، سپس همه عملیات Dexie داخل یک `db.transaction('rw', [db.idfCache, db.candidates], ...)` واحد.
۶. **csvParser.ts**: `chunkSize = 1000`.

### گام اختیاری ۷ — Pre-warm worker
در `src/main.tsx` خط `import('./workers/scoringWorker?worker').catch(() => {})` اضافه شود تا اولین استفاده در Vite dev سریع باشد.

---

## رله کانتکست (Context Relay)

- **چه چیزی در R11 انجام شد:** بهینه‌سازی CPU (pre-parse، slice(0,50)، CSV chunking) — این‌ها صحیح بودند اما لایه اشتباه را هدف گرفتند.
- **چه چیزی R12 حل می‌کند:** لایه واقعی گلوگاه = Worker Lifecycle + IPC + Dexie Notifications.
- **قانون مطلق:** ضرایب، توابع، و ترتیب لایه‌های امتیازدهی scorer **یک کاراکتر هم تغییر نمی‌کند**. تنها تغییر مجاز در scorer: حذف فیلد `categories: cat` از خروجی نهایی map (دو نقطه). تست `scorer.test.ts` باید pass شود و خروجی عددی بایت‌به‌بایت یکسان بماند.
- **اعتبارسنجی نهایی:** بعد از پیاده‌سازی، روی یک CSV ۵۰۰۰ ردیفی، زمان «آپلود → Config» باید زیر ۳ ثانیه و زمان «بررسی الگوریتم» باید زیر ۲ ثانیه باشد.

---

## مظنونین رد شده (نیازی به مداخله ندارند)

- ❌ **سربار تراکنش‌های Dexie فی‌نفسه**: Dexie در bulkAdd ۵۰۰۰ رکورد عملکرد خوبی دارد. مشکل از حجم داده هر رکورد است (گلوگاه B) نه تعداد تراکنش‌ها.
- ❌ **منطق الگوریتم scorer**: ضرایب و توابع دست‌نخورده باقی می‌مانند. الگوریتم سریع است؛ گلوگاه در انتقال داده‌ی پسا-الگوریتم است.
- ❌ **حلقه pre-parse R11**: این بهینه‌سازی صحیح بود و نگه داشته می‌شود.
