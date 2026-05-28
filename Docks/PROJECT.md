# PROJECT.md — LinkMesh (ابزار لینک‌سازی داخلی هوشمند)

---

## هدف بیزینس

ابزاری برای تیم‌های SEO که به‌صورت خودکار لینک‌های داخلی بهینه را بر اساس شباهت معنایی و دسته‌بندی صفحات پیشنهاد می‌دهد. فاز اول برای سایت نهال‌گشت (فروش تور مسافرتی) ساخته می‌شود؛ معماری به‌گونه‌ای طراحی شده که در فازهای بعدی به ابزاری عمومی برای هر سایتی قابل تبدیل باشد.

---

## پرسونای هدف

کارشناس SEO یا مدیر محتوا که با CSV کار می‌کند، کدنویسی بلد نیست، و نیاز دارد خروجی خود را به‌سرعت export کند.

---

## فاز فعلی: **فاز ۲ — توسعه ویژگی‌ها (Feature Expansion)**

> فاز ۱ (ساخت ویژگی‌ها) و فاز ۱.۵ (ریفکتور لایه‌ای) ۱۰۰٪ کامل هستند. اکنون وارد **فاز ۲ — توسعه ویژگی‌های جدید روی پایه معماری لایه‌ای** می‌شویم. اولین فیچر: **Inlink Analytics (گراف معکوس لینک‌سازی)**.

### فیچر F1 (تکمیل‌شده): Inlink Analytics
سیستم تا الان **مبدأ-محور** بود (صفحه A به چه صفحاتی لینک می‌دهد). در فاز ۲ بُعد **مقصد-محور** اضافه می‌شود: «این صفحه از چه صفحاتی لینک ورودی می‌گیرد؟» با چالش این که هیچ ایندکس Dexie روی `target_page_id` داخل JSONها وجود ندارد و **خط قرمز مطلق** این است که اسکیمای دیتابیس (Dexie v3) لمس نشود.

### فیچر F2 (در حال توسعه): Live / Temporal Boost — هوشمندسازی فصلی-زمانی
یک **لایه دوم پردازشی** (Middleware in-memory) که زمان فعلی به تقویم شمسی را درک می‌کند و امتیاز خام کاندیداها/نتایج را **هنگام نمایش** با ضریب فصلی-مناسبتی بازنویسی می‌کند، **بدون لمس Dexie یا scorer**:
- **ضریب 4x** برای کاندیداهایی که با مناسبت در «پیش‌واز» (۳۰ تا ۶۰ روز آینده) match می‌کنند.
- **ضریب 3x** برای مناسبت/فصل/ماه جاری.
- **جریمه 0.1x** برای کاندیداهای فصل/ماه گذشته یا نامرتبط.
- فعال‌سازی گلوبال در `Config.tsx`، Quick Toggle در `PageDetail.tsx`.
- منبع مناسبت‌ها: CSV قابل آپلود توسط کاربر + ماه‌ها/فصل‌های شمسی built-in.
- استخراج تاریخ شمسی فقط با `Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn')`.

### قانون مطلق این فاز
**اسکیمای Dexie و الگوریتم `scorer.ts` تحت هیچ شرایطی تغییر نمی‌کنند.** هیچ migration جدید، هیچ ایندکس جدید، هیچ جدول جدید. تمام جست‌وجوهای جدید با ساخت ساختار داده in-memory روی داده‌های موجود انجام می‌شوند.

---

## پشته تکنولوژی (Tech Stack)

| لایه | ابزار |
|---|---|
| فریم‌ورک UI | React 18 + Vite |
| زبان | TypeScript |
| استایل | Tailwind CSS v3 |
| فونت | Vazirmatn (Google Fonts) |
| دیتابیس | Dexie.js v4 (wrapper روی IndexedDB مرورگر) |
| پارس CSV | Papa Parse v5 |
| اعتبارسنجی | **Zod** (افزوده در فاز ریفکتور برای ورودی CSV و پاسخ Gemini) |
| پردازش سنگین | **Web Worker** (افزوده در فاز ریفکتور برای scorer/idf) |
| هوش مصنوعی | Gemini API — `gemini-3.1-flash-lite` / `gemini-3-flash-preview` / `gemini-2.5-flash-lite` |
| مدیریت state | React useState + useContext (بدون کتابخانه خارجی) |
| روتینگ | React Router v6 |
| آیکون‌ها | Lucide React |
| انیمیشن | motion/react |

---

## نبایدهای سخت‌گیرانه (Anti-Patterns)

این لیست مطلق است. مدل کدنویس تحت هیچ شرایطی از این موارد استفاده نمی‌کند:

| ممنوع | دلیل / جایگزین |
|---|---|
| **تغییر منطق scorer.ts** | الگوریتم نهال‌گشت است؛ فقط ممکن است جابه‌جا شود نه ویرایش |
| **دسترسی مستقیم به `db.*` از داخل کامپوننت/هوک UI** | فقط از طریق `src/repositories/*` |
| **اجرای computeAllCandidates روی Main Thread** | از طریق Web Worker اجرا شود |
| **منطق بیزینسی داخل کامپوننت React** | کامپوننت‌ها Dumb باشند؛ منطق در `src/services/*` |
| Firebase، Supabase، هر backend خارجی | پروژه کاملاً client-side است |
| `sql.js`، `@sqlite.org/sqlite-wasm` | Dexie کافی است |
| Redux، Zustand، MobX | فقط useState/useContext |
| Styled-components، CSS Modules، inline style | فقط Tailwind |
| ذخیره API Key در Dexie یا state | فقط `localStorage` با کلید `LINKMESH_API_KEY` |
| ارسال همه صفحات یکجا به Gemini | پردازش صفحه‌به‌صفحه با صف |
| محدودیت تعداد لینک (max_links) | AI تمام لینک‌های مرتبط را انتخاب می‌کند |
| `axios` | fetch native |
| `moment.js` / `date-fns` | `new Date().toISOString()` |
| کامنت‌گذاری انگلیسی در کد | تمام کامنت‌ها فارسی |
| **کتابخانه drag-and-drop** | پیاده‌سازی دستی با بالا/پایین |
| **هر کتابخانه concurrency** (p-queue, bullmq...) | QueueCoordinator دستی نوشته می‌شود |
| **افزودن جدول/ایندکس جدید به `db.ts`** (Dexie v3) | خط قرمز مطلق فاز ۲. کوئری‌های جدید با Reverse Index in-memory حل می‌شوند |
| **اسکن کامل Dexie هنگام باز شدن مودال** | باعث UI Freeze می‌شود. Reverse Index باید lazy و chunked در پس‌زمینه ساخته شود |
| **محاسبه Reverse Graph در Web Worker** | طبق درس R13، سربار IPC از خود کار بزرگ‌تر است. Main Thread با chunking کافی است |
| **استفاده از useLiveQuery برای Reverse Index** | Reverse Index مشتق از داده است، نه داده اولیه. کش module-level با invalidation دستی |
| **استفاده از Zustand / MobX / Redux برای state فیچر Temporal Boost** | Anti-Pattern مطلق پروژه. فقط Context + localStorage |
| **moment-jalaali / jalaali-js / date-fns-jalali / dayjs-jalaali** | کتابخانه سنگین/غیرضروری. فقط `Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn').formatToParts(new Date())` |
| **ذخیره فهرست مناسبت‌ها در Dexie** | داده تنظیمات است نه داده تحلیلی. خط قرمز فاز ۲ هیچ جدول/ایندکس جدید. → `localStorage` با کلید `LINKMESH_OCCASIONS_v1::{projectId}` |
| **Overwrite کردن `score` در رکوردهای `candidates` یا `results` Dexie توسط Temporal Boost** | داده خام باید دست‌نخورده بماند. Boost فقط in-memory و قبل از render اعمال می‌شود |
| **اعمال Temporal Boost داخل scorer.ts یا Web Worker** | scorer بلک‌باکس است. Boost یک Service مجزا (Layer 3) است که بعد از اتمام scoring، روی نتیجه اعمال می‌شود |
| **خواندن زمان از سرور یا API خارجی** | فیچر کاملاً client-side. زمان فقط از `new Date()` در مرورگر کاربر |

---

## محدودیت‌های فازبندی

### فاز ۱ — ساخت ویژگی‌ها (تکمیل شده ✅)
تمام ۱۱ تسک قبلی tasks.md پیاده‌سازی شد.

### فاز ۱.۵ — ریفکتور لایه‌ای (در حال انجام)
- جدا کردن لایه‌ها: UI / State / Coordinator / Algorithm / Infrastructure
- خروج پردازش‌های سنگین از Main Thread با Web Worker
- ساخت Repository Pattern روی Dexie
- مقاوم‌سازی Gemini در برابر 429 با Exponential Backoff
- مقاوم‌سازی Queue در برابر بسته شدن تب (Auto-Resume)
- اعتبارسنجی ورودی CSV با Zod
- شکستن `useAnalysisQueue` خداگونه به هوک‌های هدفمند

### فاز ۲ — توسعه ویژگی‌ها (در حال انجام)
- **F1 — Inlink Analytics (گراف معکوس):** نمایش لینک‌های ورودی به یک صفحه با منطق Hybrid (results به‌عنوان منبع طلایی، candidates به‌عنوان fallback) و Reverse Index in-memory برای جلوگیری از UI Freeze. ✅ تکمیل‌شده.
- **F2 — Live / Temporal Boost:** ضریب‌دهی in-memory بر اساس تقویم شمسی فعلی، مناسبت‌های CSV، و فصل/ماه built-in. صرفاً Middleware روی خروجی scoring قبل از sort. کاملاً اختیاری و تاگل‌پذیر.

### فاز ۳ (آینده — اکنون لمس نشود)
- کراولر خودکار
- چند کاربر / چند workspace
- ذخیره‌سازی ابری

---

## قوانین UI/UX

- تمام متن‌های UI فارسی
- جهت صفحه RTL (`dir="rtl"`)
- هیچ متن انگلیسی به کاربر نمایش داده نمی‌شود (به جز نام "LinkMesh")
- طراحی تمیز و حرفه‌ای با رنگ اصلی emerald/blue
