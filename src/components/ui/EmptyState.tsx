import React, { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-2xl border border-gray-100 max-w-lg mx-auto">
      {/* Icon Area */}
      <div className="p-4 bg-gray-50 rounded-2xl text-gray-400 mb-4 inline-flex items-center justify-center">
        {React.isValidElement(icon) ? (
          React.cloneElement(icon as React.ReactElement<any>, { className: 'w-10 h-10 shrink-0' })
        ) : (
          icon
        )}
      </div>

      {/* Texts */}
      <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">{description}</p>

      {/* Optional CTA Action */}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}
