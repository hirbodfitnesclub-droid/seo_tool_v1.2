import React, { createContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextProps {
  toasts: ToastItem[];
  showToast: (params: { type: ToastType; message: string; duration?: number }) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(({ type, message, duration = 3000 }: { type: ToastType; message: string; duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prev) => {
      const nextToasts = [...prev, { id, type, message, duration }];
      // نگه داشتن حداکثر ۳ Toast فعال همزمان
      if (nextToasts.length > 3) {
        return nextToasts.slice(nextToasts.length - 3);
      }
      return nextToasts;
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}
