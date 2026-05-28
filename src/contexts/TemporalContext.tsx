import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { TemporalEvent } from '../services/temporal/temporalService';
import { BUILT_IN_TEMPORAL_EVENTS } from '../constants/temporalSeasons';

/**
 * مسئولیت: مدیریت وضعیت افزایش امتیاز زمانی (Temporal Boost) در سطح بالای برنامه،
 * همگام‌سازی آن با localStorage و ارائه توابع مدیریت به سایر کامپوننت‌ها.
 */

const KEY_GLOBAL = 'LINKMESH_TEMPORAL_GLOBAL_ENABLED';
const KEY_PER_PAGE = 'LINKMESH_TEMPORAL_PER_PAGE';
const KEY_CSV = 'LINKMESH_TEMPORAL_CSV_EVENTS';

function loadGlobalEnabled(): boolean {
  try {
    const val = localStorage.getItem(KEY_GLOBAL);
    if (val === null) return true; // پیش‌فرض طبق معماری و تسک جاری true است
    return val === 'true';
  } catch (e) {
    return true;
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

function loadCsvEvents(): TemporalEvent[] {
  try {
    const val = localStorage.getItem(KEY_CSV);
    if (val === null) return [];
    return JSON.parse(val);
  } catch (e) {
    return [];
  }
}

interface TemporalState {
  globalEnabled: boolean;
  perPageEnabled: Record<number, boolean>;
  csvEvents: TemporalEvent[];
  builtInEvents: TemporalEvent[];
}

export interface TemporalContextValue extends TemporalState {
  setGlobalEnabled: (v: boolean) => void;
  setPageEnabled: (pageId: number, v: boolean) => void;
  setCsvEvents: (events: TemporalEvent[]) => void;
  isEnabledForPage: (pageId: number) => boolean;
  getAllActiveEvents: () => TemporalEvent[];
}

export const TemporalContext = createContext<TemporalContextValue | undefined>(undefined);

export function TemporalProvider({ children }: { children: ReactNode }) {
  // بارگذاری داده‌ها به‌صورت تنبل (Lazy Initialisation) برای بهینه‌سازی پرفورمنس
  const [globalEnabled, setGlobalEnabledState] = useState<boolean>(() => loadGlobalEnabled());
  const [perPageEnabled, setPerPageEnabledState] = useState<Record<number, boolean>>(() => loadPerPageEnabled());
  const [csvEvents, setCsvEventsState] = useState<TemporalEvent[]>(() => loadCsvEvents());
  const builtInEvents = BUILT_IN_TEMPORAL_EVENTS;

  // همگام‌سازی وضعیت‌ها با localStorage در زمان تغییر
  useEffect(() => {
    localStorage.setItem(KEY_GLOBAL, String(globalEnabled));
  }, [globalEnabled]);

  useEffect(() => {
    localStorage.setItem(KEY_PER_PAGE, JSON.stringify(perPageEnabled));
  }, [perPageEnabled]);

  useEffect(() => {
    localStorage.setItem(KEY_CSV, JSON.stringify(csvEvents));
  }, [csvEvents]);

  const setGlobalEnabled = useCallback((v: boolean) => {
    setGlobalEnabledState(v);
  }, []);

  const setPageEnabled = useCallback((pageId: number, v: boolean) => {
    setPerPageEnabledState((prev) => ({
      ...prev,
      [pageId]: v,
    }));
  }, []);

  const setCsvEvents = useCallback((events: TemporalEvent[]) => {
    setCsvEventsState(events);
  }, []);

  const isEnabledForPage = useCallback((pageId: number): boolean => {
    if (perPageEnabled[pageId] !== undefined) {
      return perPageEnabled[pageId];
    }
    return globalEnabled;
  }, [perPageEnabled, globalEnabled]);

  const getAllActiveEvents = useCallback((): TemporalEvent[] => {
    return [...builtInEvents, ...csvEvents];
  }, [builtInEvents, csvEvents]);

  // مموایز کردن مقدار کانتکست جهت بهینه‌سازی پرفورمنس کامپوننت‌های مصرف‌کننده
  const contextValue = useMemo<TemporalContextValue>(() => ({
    globalEnabled,
    perPageEnabled,
    csvEvents,
    builtInEvents,
    setGlobalEnabled,
    setPageEnabled,
    setCsvEvents,
    isEnabledForPage,
    getAllActiveEvents,
  }), [
    globalEnabled,
    perPageEnabled,
    csvEvents,
    builtInEvents,
    setGlobalEnabled,
    setPageEnabled,
    setCsvEvents,
    isEnabledForPage,
    getAllActiveEvents,
  ]);

  return (
    <TemporalContext.Provider value={contextValue}>
      {children}
    </TemporalContext.Provider>
  );
}

export function useTemporalContext(): TemporalContextValue {
  const context = useContext(TemporalContext);
  if (context === undefined) {
    throw new Error('useTemporalContext باید داخل TemporalProvider استفاده شود');
  }
  return context;
}
