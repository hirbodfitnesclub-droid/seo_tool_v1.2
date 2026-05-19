
import React from 'react';

export const Badge: React.FC<{ children: React.ReactNode, variant?: 'blue' | 'gray' | 'green' }> = ({ children, variant = 'blue' }) => {
  const variants = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-100'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
};
