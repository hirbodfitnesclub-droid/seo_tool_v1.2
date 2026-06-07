import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { QuotaRow } from '../services/quota/quotaService';
import { QuotaSettings } from '../services/quota/quotaAllocationService';

/**
 * @file QuotaContext.tsx
 * @description مدیریت وضعیت سهمیه‌بندی سراسری (F3) و همگام‌سازی آن با localStorage.
 */

const KEY_GLOBAL = 'LINKMESH_QUOTA_GLOBAL_ENABLED';
const KEY_PER_PAGE = 'LINKMESH_QUOTA_PER_PAGE';
const KEY_TOTAL_LINKS = 'LINKMESH_QUOTA_TOTAL_LINKS';
const KEY_CSV = 'LINKMESH_QUOTA_CSV_ROWS';

function loadGlobalEnabled(): boolean {
  try {
    const val = localStorage.getItem(KEY_GLOBAL);
    if (val === null) return false; // پیش‌فرض غیرفعال است تا کاربر آگاهانه آن را فعال کند
    return val === 'true';
  } catch (e) {
    return false;
  }
}

function loadPerPageEnabled(): Record<number, boolean> {
  try {
    const val = localStorage.getItem(KEY_PER_PAGE);
    if (val === null) return {};
    return JSON.parse(val);
  } catch (e) {
    return {};
  }
}

function loadTotalInternalLinks(): number {
  try {
    const val = localStorage.getItem(KEY_TOTAL_LINKS);
    if (val === null) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  } catch (e) {
    return 0;
  }
}

function loadCsvRows(): QuotaRow[] {
  try {
    const val = localStorage.getItem(KEY_CSV);
    if (val === null) return [];
    return JSON.parse(val);
  } catch (e) {
    return [];
  }
}

interface QuotaState {
  globalEnabled: boolean;
  perPageEnabled: Record<number, boolean>;
  totalInternalLinks: number;
  rows: QuotaRow[];
}

export interface QuotaContextValue extends QuotaState {
  setGlobalEnabled: (v: boolean) => void;
  setPageEnabled: (pageId: number, v: boolean) => void;
  setTotalInternalLinks: (v: number) => void;
  setRows: (rows: QuotaRow[]) => void;
  isEnabledForPage: (pageId: number) => boolean;
  getSettings: () => QuotaSettings;
}

export const QuotaContext = createContext<QuotaContextValue | undefined>(undefined);

export function QuotaProvider({ children }: { children: ReactNode }) {
  // بارگذاری داده‌ها به صورت تنبل (Lazy Initialisation)
  const [globalEnabled, setGlobalEnabledState] = useState<boolean>(() => loadGlobalEnabled());
  const [perPageEnabled, setPerPageEnabledState] = useState<Record<number, boolean>>(() => loadPerPageEnabled());
  const [totalInternalLinks, setTotalInternalLinksState] = useState<number>(() => loadTotalInternalLinks());
  const [rows, setRowsState] = useState<QuotaRow[]>(() => loadCsvRows());

  // همگام‌سازی با localStorage در زمان تغییر
  useEffect(() => {
    localStorage.setItem(KEY_GLOBAL, String(globalEnabled));
  }, [globalEnabled]);

  useEffect(() => {
    localStorage.setItem(KEY_PER_PAGE, JSON.stringify(perPageEnabled));
  }, [perPageEnabled]);

  useEffect(() => {
    localStorage.setItem(KEY_TOTAL_LINKS, String(totalInternalLinks));
  }, [totalInternalLinks]);

  useEffect(() => {
    localStorage.setItem(KEY_CSV, JSON.stringify(rows));
  }, [rows]);

  const setGlobalEnabled = useCallback((v: boolean) => {
    setGlobalEnabledState(v);
  }, []);

  const setPageEnabled = useCallback((pageId: number, v: boolean) => {
    setPerPageEnabledState((prev) => ({
      ...prev,
      [pageId]: v,
    }));
  }, []);

  const setTotalInternalLinks = useCallback((v: number) => {
    setTotalInternalLinksState(v);
  }, []);

  const setRows = useCallback((newRows: QuotaRow[]) => {
    setRowsState(newRows);
  }, []);

  const isEnabledForPage = useCallback((pageId: number): boolean => {
    if (perPageEnabled[pageId] !== undefined) {
      return perPageEnabled[pageId];
    }
    return globalEnabled;
  }, [perPageEnabled, globalEnabled]);

  const getSettings = useCallback((): QuotaSettings => {
    return {
      totalInternalLinks,
      rows,
    };
  }, [totalInternalLinks, rows]);

  const contextValue = useMemo<QuotaContextValue>(() => ({
    globalEnabled,
    perPageEnabled,
    totalInternalLinks,
    rows,
    setGlobalEnabled,
    setPageEnabled,
    setTotalInternalLinks,
    setRows,
    isEnabledForPage,
    getSettings,
  }), [
    globalEnabled,
    perPageEnabled,
    totalInternalLinks,
    rows,
    setGlobalEnabled,
    setPageEnabled,
    setTotalInternalLinks,
    setRows,
    isEnabledForPage,
    getSettings,
  ]);

  return (
    <QuotaContext.Provider value={contextValue}>
      {children}
    </QuotaContext.Provider>
  );
}

export function useQuotaContext(): QuotaContextValue {
  const context = useContext(QuotaContext);
  if (context === undefined) {
    throw new Error('useQuotaContext باید داخل QuotaProvider استفاده شود');
  }
  return context;
}
