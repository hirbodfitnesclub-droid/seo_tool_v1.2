import React, { useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastContext, ToastItem } from '../../contexts/ToastContext';

export function ToastContainer() {
  const context = useContext(ToastContext);
  if (!context) return null;
  const { toasts, removeToast } = context;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void; key?: any }) {
  const { type, message } = toast;

  let styles = '';
  let Icon = Info;

  switch (type) {
    case 'success':
      styles = 'bg-green-50 border border-green-200 text-green-800 shadow-xs shadow-green-100/50';
      Icon = CheckCircle;
      break;
    case 'error':
      styles = 'bg-red-50 border border-red-200 text-red-800 shadow-xs shadow-red-100/50';
      Icon = AlertCircle;
      break;
    case 'warning':
      styles = 'bg-amber-50 border border-amber-200 text-amber-800 shadow-xs shadow-amber-100/50';
      Icon = AlertTriangle;
      break;
    case 'info':
    default:
      styles = 'bg-blue-50 border border-blue-200 text-blue-800 shadow-xs shadow-blue-100/50';
      Icon = Info;
      break;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      onClick={onDismiss}
      className={`flex items-start gap-3 p-4 rounded-xl border pointer-events-auto cursor-pointer select-none ${styles}`}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <span className="flex-1 text-sm font-medium leading-relaxed">{message}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="text-current opacity-60 hover:opacity-100 transition-opacity p-0.5 -mt-0.5 -me-0.5 rounded-md hover:bg-black/5"
        aria-label="بستن"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
