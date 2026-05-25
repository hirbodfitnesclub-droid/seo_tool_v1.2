/**
 * @file geminiSchema.ts
 * @description طرحواره‌های (Schemas/Zod) اعتبارسنجی منطقی پاسخ‌های دریافتی از هوش مصنوعی Gemini
 * این طرحواره‌ها جهت افزایش پایداری و اطمینان از خروجی‌های معتبر و عاری از اختلال به کار گرفته می‌شوند.
 */

import { z } from 'zod';

/**
 * طرحواره اعتبار‌سنجی خروجی انتخاب فعالانه لینک‌ها توسط هوش مصنوعی
 */
export const GeminiSelectedLinksSchema = z.object({
  user_intent: z.string().optional(),
  selected_links: z.array(z.object({
    page_id: z.number(),
    title: z.string(),
    reason: z.string()
  }))
});

export type GeminiSelectedLinks = z.infer<typeof GeminiSelectedLinksSchema>;
