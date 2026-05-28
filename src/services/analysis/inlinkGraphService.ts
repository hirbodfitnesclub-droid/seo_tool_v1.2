/**
 * @file inlinkGraphService.ts
 * @description سرویس مدیریت گراف معکوس (Inlink Analytics) به صورت همزمان در حافظه (In-Memory).
 * این سرویس دایرکتوری لینک‌های ورودی به صفحات را با استفاده از نتایج تایید شده یا کاندیداهای ذخیره شده می‌سازد.
 */

import * as pageRepository from '../../repositories/pageRepository';
import * as candidateRepository from '../../repositories/candidateRepository';
import * as resultRepository from '../../repositories/resultRepository';
import { safeJsonParse } from '../../utils/safeJson';
import { type Page, type Result, type CandidateRecord } from '../../db';

export type InlinkOrigin = 'result' | 'candidate';

export interface InlinkSourceEntry {
  sourcePageId: number;
  sourceTitle: string;
  rank: number;          // ۱-based ترتیب لینک در صفحه مبدأ
  score?: number;        // فقط در مسیر candidate
  matchedTags?: string[];// فقط در مسیر candidate
  origin: InlinkOrigin;
}

export type InlinkIndex = Map<number, InlinkSourceEntry[]>;

interface CacheEntry {
  index: InlinkIndex;
  signature: string;
  builtAt: number;
  buildPromise?: Promise<InlinkIndex>; // برای جلوگیری از build همزمان دوبار
}

const cache = new Map<number, CacheEntry>();

/**
 * محاسبه فرمول امضا (Signature) برای اعتبارسنجی کش پروژه
 */
async function computeSignature(projectId: number): Promise<string> {
  const results = await resultRepository.listByProject(projectId);
  const candidatesCount = await candidateRepository.countByProject(projectId);
  const latestGeneratedAt = await resultRepository.getLatestGeneratedAt(projectId);
  
  return `${results.length}:${candidatesCount}:${latestGeneratedAt || ''}`;
}

/**
 * دریافت یا ساخت گراف معکوس پروژه به همراه پیاده‌سازی Lazy و Chunked برای جلوگیری از قفل شدن UI
 */
export async function getOrBuildIndex(projectId: number): Promise<InlinkIndex> {
  const signature = await computeSignature(projectId);
  const existing = cache.get(projectId);
  
  // اگر کش معتبر باشد، آن را برگردان
  if (existing && existing.signature === signature) {
    if (existing.buildPromise) {
      return existing.buildPromise;
    }
    return existing.index;
  }
  
  // ثبت یا دریافت promise در حال ساخت
  if (existing && existing.buildPromise) {
    return existing.buildPromise;
  }
  
  const buildPromise = buildIndex(projectId);
  
  cache.set(projectId, {
    index: new Map(),
    signature,
    builtAt: Date.now(),
    buildPromise
  });
  
  try {
    const index = await buildPromise;
    cache.set(projectId, {
      index,
      signature,
      builtAt: Date.now()
    });
    return index;
  } catch (error) {
    cache.delete(projectId);
    throw error;
  }
}

/**
 * ساختن واقعی گراف معکوس به صورت پیمایش تک‌تک کلیدها با تخصیص زمان استراحت به حلقه رویداد (Event Loop)
 */
async function buildIndex(projectId: number): Promise<InlinkIndex> {
  const pages = await pageRepository.listByProject(projectId);
  const results = await resultRepository.listByProject(projectId);
  const candidates = await candidateRepository.listByProject(projectId);
  
  const pagesMap = new Map<number, string>();
  for (const page of pages) {
    if (page.id !== undefined) {
      pagesMap.set(page.id, page.title);
    }
  }
  
  const resultsBySourceId = new Map<number, Result>();
  for (const res of results) {
    resultsBySourceId.set(res.source_page_id, res);
  }
  
  const candidatesBySourceId = new Map<number, CandidateRecord>();
  for (const cand of candidates) {
    candidatesBySourceId.set(cand.source_page_id, cand);
  }
  
  const index: InlinkIndex = new Map<number, InlinkSourceEntry[]>();
  
  const CHUNK_SIZE = 100;
  for (let i = 0; i < pages.length; i++) {
    const sourceId = pages[i].id!;
    const sourceTitle = pages[i].title;
    
    // ۱. بررسی اولویت با results (نتایج تایید شده طلایی)
    if (resultsBySourceId.has(sourceId)) {
      const res = resultsBySourceId.get(sourceId)!;
      const recommendedLinks = safeJsonParse<any[]>(res.recommended_links, []);
      
      recommendedLinks.forEach((link, idx) => {
        const targetId = typeof link.page_id === 'number' ? link.page_id : Number(link.page_id);
        if (isNaN(targetId) || targetId === sourceId) return;
        
        if (!index.has(targetId)) {
          index.set(targetId, []);
        }
        
        index.get(targetId)!.push({
          sourcePageId: sourceId,
          sourceTitle,
          rank: idx + 1,
          origin: 'result'
        });
      });
    }
    // ۲. فالبک به کاندیدهای خام در صورت نبود نتایج نهایی
    else if (candidatesBySourceId.has(sourceId)) {
      const candRec = candidatesBySourceId.get(sourceId)!;
      const candidateList = safeJsonParse<any[]>(candRec.candidate_list, []);
      
      candidateList.forEach((link, idx) => {
        const targetId = typeof link.page_id === 'number' ? link.page_id : Number(link.page_id);
        if (isNaN(targetId) || targetId === sourceId) return;
        
        if (!index.has(targetId)) {
          index.set(targetId, []);
        }
        
        index.get(targetId)!.push({
          sourcePageId: sourceId,
          sourceTitle,
          rank: idx + 1,
          score: link.score,
          matchedTags: link.matched_tags || link.matchedTags || [],
          origin: 'candidate'
        });
      });
    }
    
    // استراحت برای آزادسازی Event Loop
    if (i % CHUNK_SIZE === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
  
  return index;
}

/**
 * دریافت لیست صفحات لینک‌دهنده برای یک صفحه مقصد خاص
 */
export async function getInlinksFor(projectId: number, targetPageId: number): Promise<InlinkSourceEntry[]> {
  const index = await getOrBuildIndex(projectId);
  const entries = index.get(targetPageId) || [];
  
  // مرتب‌سازی نتایج:
  // ۱. ابتدا origin دیتای تایید شده ('result')
  // ۲. سپس امتیاز (score) به صورت نزولی (اگر وجود نداشت در انتهای لیست قرار بگیرد)
  // ۳. پس از آن رتبه (rank) به صورت صعودی
  return [...entries].sort((a, b) => {
    if (a.origin !== b.origin) {
      return a.origin === 'result' ? -1 : 1;
    }
    
    if (a.origin === 'candidate' && b.origin === 'candidate') {
      const scoreA = a.score !== undefined ? a.score : -Infinity;
      const scoreB = b.score !== undefined ? b.score : -Infinity;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }
    
    return a.rank - b.rank;
  });
}

/**
 * باطل کردن دیسک کش و اطلاعات مربوط به یک پروژه در صورت تغییر اطلاعات
 */
export function invalidateProject(projectId: number): void {
  cache.delete(projectId);
}
