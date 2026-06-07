import { applyTemporalBoost, sortByBoostedScore, TemporalEvent } from '../temporal/temporalService';
import { JalaliDate } from '../temporal/jalaliCalendar';
import { applyQuotaLens, sortByFinalScore, FinalCandidate, QuotaAllocation } from '../quota/quotaService';

/**
 * @file lensPipeline.ts
 * @description پایپ‌لاین ترکیبی تک‌مرجع برای ادغام عینک زمانی (Temporal Boost) و عینک سهمیه (Quota Lens).
 */

export function buildFinalCandidateList(params: {
  candidates: any[];
  sourcePageId: number;
  temporal?: {
    events: TemporalEvent[];
    today?: JalaliDate;
    targetMetadata?: Map<number, { title: string; categoryValues: string[] }>;
  };
  quota?: {
    allocation: QuotaAllocation;
  };
}): FinalCandidate[] {
  const { candidates, sourcePageId, temporal, quota } = params;

  // حالت ۱: اگر هیچ‌کدام فعال نباشند
  if (!temporal && !quota) {
    const listWithScore = candidates.map((c) => ({
      ...c,
      finalScore: typeof c.score === 'number' ? c.score : 0,
      quotaLabel: 'unmanaged' as const,
    }));

    return [...listWithScore].sort((a, b) => {
      const scoreA = typeof a.finalScore === 'number' ? a.finalScore : 0;
      const scoreB = typeof b.finalScore === 'number' ? b.finalScore : 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (a.page_id || 0) - (b.page_id || 0);
    });
  }

  // حالت ۲: اگر فقط لایه زمانی فعال باشد (حفظ سازگاری عقب‌رو فاز ۲)
  if (temporal && !quota) {
    const boosted = applyTemporalBoost(candidates, temporal);
    const mapped = boosted.map((c) => ({
      ...c,
      finalScore: typeof c.boostedScore === 'number' ? c.boostedScore : (typeof c.score === 'number' ? c.score : 0),
      quotaLabel: 'unmanaged' as const,
    }));

    return [...mapped].sort((a, b) => {
      const scoreA = typeof a.finalScore === 'number' ? a.finalScore : 0;
      const scoreB = typeof b.finalScore === 'number' ? b.finalScore : 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (a.page_id || 0) - (b.page_id || 0);
    });
  }

  // حالت ۳: اگر لایه سهمیه فعال باشد (به تنهایی یا همراه با لایه زمانی)
  let currentList = [...candidates];

  // اعمال رتبه‌بندی زمانی در صورت وجود
  if (temporal) {
    currentList = applyTemporalBoost(currentList, temporal);
  }

  // اعمال لنز فیلترینگ و ضریب‌دهی سهمیه‌بندی
  const listWithQuota = applyQuotaLens(currentList, sourcePageId, quota.allocation);

  // محاسبه امتیاز نهایی ترکیبی (finalScore)
  const finalList = listWithQuota.map((c: any) => {
    const baseScore = typeof c.score === 'number' ? c.score : 0;
    const tMult = typeof c.temporalMultiplier === 'number' ? c.temporalMultiplier : 1;
    const iWeight = typeof c.impressionWeight === 'number' ? c.impressionWeight : 1;
    const finalScore = baseScore * tMult * iWeight;

    return {
      ...c,
      finalScore,
    };
  });

  // مرتب‌سازی نهایی، تعیین امتیاز نهایی و دیکتاتوری کامل پایپ‌لاین
  return [...finalList].sort((a, b) => {
    const scoreA = typeof a.finalScore === 'number' ? a.finalScore : 0;
    const scoreB = typeof b.finalScore === 'number' ? b.finalScore : 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return (a.page_id || 0) - (b.page_id || 0);
  });
}
