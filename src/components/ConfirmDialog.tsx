import React, { useState, useEffect } from 'react';
import Modal from './ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'warning' | 'normal';
  requireTyping?: string;
}

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'تایید',
  cancelText = 'انصراف',
  confirmType = 'normal',
  requireTyping,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');

  // ریست کردن ورودی موقع باز شدن مودال
  useEffect(() => {
    if (isOpen) {
      setTypedValue('');
    }
  }, [isOpen]);

  const isConfirmDisabled = requireTyping ? typedValue !== requireTyping : false;

  let btnColorClass = 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
  if (confirmType === 'danger') {
    btnColorClass = 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
  } else if (confirmType === 'warning') {
    btnColorClass = 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500';
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="space-y-4">
        {/* Message and Icon */}
        <div className="flex gap-3">
          {confirmType !== 'normal' && (
            <div className={`p-2 rounded-lg shrink-0 h-fit ${confirmType === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-500'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <p className="text-sm text-gray-600 leading-relaxed flex-1">{message}</p>
        </div>

        {/* Require Typing Field */}
        {requireTyping && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-600">
              لطفاً برای تایید، کلمه <span className="font-mono text-red-600 dir-ltr inline-block">"{requireTyping}"</span> را تایپ کنید:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requireTyping}
              className="w-full px-4 py-2 text-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-hidden transition-all text-center font-mono"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl text-white transition-all focus:ring-4 focus:outline-hidden cursor-pointer flex justify-center items-center ${btnColorClass} ${isConfirmDisabled ? 'opacity-40 cursor-not-allowed hover:bg-current' : ''}`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all focus:ring-4 focus:ring-gray-100 focus:outline-hidden cursor-pointer text-center"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
