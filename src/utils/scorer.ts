
export interface CandidateWithTags {
  page_id: number;
  title: string;
  score: number;
  matched_tags: string[]; // فیلد جدید
}

/**
 * محاسبه تگ‌های مشترک بین دو صفحه
 */
export function getMatchedTags(catA: any, catB: any): string[] {
  const matched: string[] = [];
  Object.keys(catA).forEach((field) => {
    if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
      matched.push(field);
    }
  });
  return matched;
}

export function computeScore(catA: any, catB: any, weights: Record<string, number>, mode: 'linear' | 'weighted'): number {
  let score = 0;
  
  for (const field in catA) {
    if (catA[field] !== null && catB[field] !== null && catA[field] === catB[field]) {
      if (mode === 'linear') {
        score += 1;
      } else {
        score += (weights[field] ?? 1);
      }
    }
  }
  
  return score;
}

export function findTopCandidates(sourcePage: any, allPages: any[], weights: Record<string, number>, mode: 'linear' | 'weighted'): CandidateWithTags[] {
  const sourceCat = JSON.parse(sourcePage.categories);
  
  return allPages
    .filter(p => p.id !== sourcePage.id)
    .map(p => {
      const pCat = JSON.parse(p.categories);
      return {
        page_id: p.id!,
        title: p.title,
        score: computeScore(sourceCat, pCat, weights, mode),
        matched_tags: getMatchedTags(sourceCat, pCat)
      };
    })
    .filter(c => c.score > 0) // Keep everything that has at least 1 match
    .sort((a, b) => b.score - a.score);
}

export function computeAllCandidates(pages: any[], weights: Record<string, number>, mode: 'linear' | 'weighted'): Map<number, CandidateWithTags[]> {
  const map = new Map<number, CandidateWithTags[]>();
  
  pages.forEach(p => {
    map.set(p.id!, findTopCandidates(p, pages, weights, mode));
  });
  
  return map;
}
