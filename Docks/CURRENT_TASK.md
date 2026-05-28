# CURRENT_TASK.md — تمرکز فعلی سیستم

## ۱. درخت تمرکز (Focus Tree)
```
src/
└── services/
    └── temporal/
        ├── temporalService.ts                  [در دست ویرایش — تسک F2.7]
        └── jalaliCalendar.ts                   [خواندنی فقط — منبع ریاضیات Jalali]
src/
└── constants/
    └── temporalSeasons.ts                      [خواندنی فقط — منبع رویدادهای built-in]
Docks/
├── ARCHITECTURE.md                             [بروز شده — Decision Tree جدید بخش ۱۰]
├── PROJECT.md                                  [بروز شده — anti-pattern Year-Wrap اضافه شد]
└── tasks.md                                    [بروز شده — تسک F2.7 افزوده شد]
```

## ۲. تسک فعلی: F2.7 — رفع باگ Year-Wrap + Devastating Penalty

### عنوان و هدف
**پیاده‌سازی منطق جریمه سنگین (×0.001) برای صفحات زمان‌دارِ منقضی یا بیش از حد دور، و رفع ریشه‌ای باگ چرخش سال در `temporalService.ts`.**

### شرح باگ بیزینسی (مرجع: درخواست کاربر — خرداد ۱۴۰۴)
در ۷ خرداد، فعال‌سازی Live Boost برای «تور کیش مهر» باعث می‌شود «تور کیش نوروز» در رتبه ۶ ظاهر شود. سیستم به مناسبت‌های آینده ضریب مثبت می‌دهد، اما رویدادهای منقضی یا خیلی دور (>۶۰ روز) را به اندازه کافی جریمه نمی‌کند.

### سه ریشه فنی (مستند در tasks.md → F2.7 → بخش «مسئله»)
۱. `projectEventToCurrentYear` پس از پایان رویداد امسال آن را به سال بعد می‌فرستد → کاندیدا از مسیر جریمه فرار می‌کند.
۲. `detectOutOfSeason` فقط چهار نام فصل را می‌گردد، پس کلمه «نوروز» جریمه نمی‌گیرد.
۳. هیچ تشخیص صریحی برای «زمان‌دار بودن کاندیدا» وجود ندارد.

### تغییرات لازم (خلاصه — جزئیات کامل در `Docks/tasks.md` → F2.7)
- **حذف:** `projectEventToCurrentYear`، `classifyEventTiming` (هر دو معیوب).
- **افزودن:** `evaluateEventTiming(event, today)` با ریاضیات Year-Aware.
- **افزودن:** `isCandidateSeasonal(keywords, events)` به‌عنوان گیت‌وی جریمه سنگین.
- **افزودن برچسب:** `'expired'` و `'too-far'` با `multiplier: 0.001`.
- **بازنویسی حلقه `applyTemporalBoost`:** قانون «Devastating Wins» — اگر حداقل یک match منجر به ×0.001 شود، همان برنده است.
- **سهمیه‌بندی:** ×0.001 هرگز در quota نیاید (به‌طور خودکار به‌خاطر boostedScore بسیار پایین در انتهای لیست قرار می‌گیرد).

### خط قرمز
- ⛔ `scorer.ts` لمس نشود.
- ⛔ `db.ts` لمس نشود.
- ⛔ امضای `applyTemporalBoost` تغییر نکند (backward compatibility).
- ⛔ هیچ کتابخانه جدید نصب نشود.

## ۳. وضعیت تسک‌های قبلی فاز F2

- F2.5 / F2.6 / تسک اصلاح CSV / تسک Quota — همه ✅ کامل شده‌اند.

## ۴. رله کانتکست (Context Relay)

### آنچه کدنویس باید بداند:
- فایل `temporalService.ts` فعلی شامل دو تابع معیوب است که باید حذف شوند، نه ویرایش.
- فایل `jalaliCalendar.ts` کامل و درست است — توابع `jalaliDaysBetween` و `isJalaliInRange` آماده استفاده هستند.
- مصرف‌کنندگان فعلی `applyTemporalBoost` (در `analysisService.ts` و `PageDetail.tsx`) امضای تابع را همان‌طور پاس می‌دهند؛ نباید نیاز به تغییر در آن‌ها باشد.
- پس از پیاده‌سازی، تست دستی با تاریخ موک: `today = { year: 1404, month: 3, day: 7 }` و کاندیدای «تور کیش نوروز» باید `temporalLabel === 'too-far'` و `temporalMultiplier === 0.001` تولید کند.
