import Dexie, { type Table } from 'dexie';

export interface Project {
  id?: number;
  name: string;
  created_at: string;
  scoring_mode: 'linear' | 'weighted';
  max_links: number;
}

export interface Page {
  id?: number;
  project_id: number;
  title: string;
  categories: string; // JSON.stringify شده
}

export interface Weight {
  id?: number;
  project_id: number;
  category_name: string;
  weight_value: number;
}

// جدول جدید کاندیداها
export interface CandidateRecord {
  id?: number;
  project_id: number;
  source_page_id: number;
  candidate_list: string; // JSON آرایه: [{ page_id, title, score, matched_tags }]
  computed_at: string;
}

// جدول جدید صف پردازش
export interface AnalysisQueue {
  id?: number;
  project_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  current_page_index: number;
  total_pages: number;
  error_message: string | null;
  selected_model?: string;
  started_at: string;
  updated_at: string;
}

export interface Result {
  id?: number;
  project_id: number;
  source_page_id: number;
  source_title: string;
  recommended_links: string; // JSON.stringify شده
  is_manual_edit: boolean; // فیلد جدید برای تشخیص ویرایش دستی
  generated_at: string;
}

// جدول کش IDF
export interface IDFCacheRecord {
  id?: number;
  project_id: number;
  idf_map: string; // JSON.stringify شده از IDFMap
  computed_at: string;
}

export class LinkMeshDB extends Dexie {
  projects!: Table<Project>;
  pages!: Table<Page>;
  weights!: Table<Weight>;
  candidates!: Table<CandidateRecord>; // اضافه شدن جدول کاندیداها
  results!: Table<Result>;
  analysisQueue!: Table<AnalysisQueue>; // اضافه شدن جدول صف پردازش
  idfCache!: Table<IDFCacheRecord>; // اضافه شد جدید برای کش IDF

  constructor() {
    super('LinkMeshDB');
    // ارتقا به نسخه ۳
    this.version(3).stores({
      projects: '++id, name, created_at',
      pages: '++id, project_id, title',
      weights: '++id, project_id, category_name',
      candidates: '++id, project_id, source_page_id',
      results: '++id, project_id, source_page_id',
      analysisQueue: '++id, project_id',
      idfCache: '++id, project_id' // اضافه شد
    });
  }
}

export const db = new LinkMeshDB();
