# CURRENT_TASK.md — پنجره اولویت و تمرکز اجرایی

> این سند بر اساس نقشه راه مرجع (`tasks.md`) ساخته شده و فقط برای محدود کردن تمرکز مدل کدنویس روی **تسک جاری ریفکتور** استفاده می‌شود.

---

## فاز جاری: فاز ۱.۵ — ریفکتور لایه‌ای

فاز ۱ (ساخت ویژگی‌ها، تسک‌های ۱..۱۱) کامل است. اکنون وارد فاز ریفکتور بدون تغییر رفتار شده‌ایم.

---

## تسک جاری: **R1 — لایه Infrastructure: ساخت Repository Pattern**

### درخت تمرکز (Focus Tree)

```
src/
├── db.ts                              ← فقط خواندن (مرجع schema)
├── repositories/                      ← [ایجاد] محل فایل‌های جدید این تسک
│   ├── projectRepository.ts
│   ├── pageRepository.ts
│   ├── weightRepository.ts
│   ├── candidateRepository.ts
│   ├── resultRepository.ts
│   ├── queueRepository.ts
│   └── idfRepository.ts
│
└── (فقط برای مرور الگوی فعلی دسترسی به db.*)
    ├── hooks/useAnalysisQueue.ts
    ├── utils/queueProcessor.ts
    └── utils/candidateStorage.ts
```

### خلاصه تسک

ساخت یک پوشه جدید `src/repositories/` با ۷ فایل که هر کدام wrapper async روی متدهای Dexie فراهم می‌کند. این تسک **فقط افزایش کد** است — هیچ فایل موجودی ویرایش نمی‌شود.

### چک‌لیست تکمیل

- [ ] پوشه `src/repositories/` ساخته شد
- [ ] ۷ فایل repository با signatureهای مشخص شده در `tasks.md` ایجاد شد
- [ ] هیچ‌کدام به React/lucide/کامپوننت import نمی‌کنند
- [ ] هر فایل با هدر کامنت فارسی هدف خود را توضیح می‌دهد
- [ ] `tsc --noEmit` بدون خطا

### قانون مطلق

> **حق نداری هیچ کدی رو حدس بزنی؛ همین الان با ابزار caling_tool فایل های کانتکست رو به صورت زنده فراخوانی کن و بخون و سپس کد این تسک رو بزن.**

### فایل‌های کانتکست برای این تسک

```
Docks/ARCHITECTURE.md
src/db.ts
src/hooks/useAnalysisQueue.ts
src/utils/queueProcessor.ts
src/utils/candidateStorage.ts
```

---

## تسک‌های بعدی (به ترتیب)

R2 → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10

برای جزئیات هر کدام به `Docks/tasks.md` مراجعه شود.

---

## رله کانتکست (Context Relay)

- **چه چیزی تکمیل شد:** کل فاز ۱ (۱۱ تسک). برنامه functional است و بدون خطا build می‌شود.
- **چه چیزی نباید لمس شود:**
  - الگوریتم `scorer.ts` (کپی مرجع در `/scorer.ts` ریشه پروژه)
  - اسکیمای دیتابیس (نسخه ۳ Dexie)
  - متن پرامپت Gemini
  - رفتار قابل مشاهده برای کاربر
- **هدف کلی این فاز:** جدا کردن لایه‌ها (UI / State / Service / Core / Infrastructure)، خروج پردازش‌های سنگین از Main Thread، و مقاوم‌سازی در برابر قطع شبکه و بسته شدن تب.
