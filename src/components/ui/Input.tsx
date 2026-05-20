import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string; // Explicitly declared
  id?: string; // Explicitly declared
  disabled?: boolean; // Explicitly declared
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  disabled,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="w-full flex flex-col items-start gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <input
        id={inputId}
        disabled={disabled}
        className={`w-full px-4 py-3 rounded-xl border bg-white text-gray-900 border-gray-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-hidden transition-all ${
          error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''
        } ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200' : ''} ${className}`}
        {...props}
      />

      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-gray-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
