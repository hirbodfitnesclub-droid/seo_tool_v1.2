import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-500 py-3 select-none" aria-label="Breadcrumb">
      {/* Home icon as starting point */}
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-blue-600 transition-colors py-1 px-1.5 rounded-md hover:bg-gray-100"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            <ChevronLeft className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            {isLast || !item.href ? (
              <span className="font-semibold text-gray-800 px-1.5 truncate max-w-xs md:max-w-md">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="hover:text-blue-600 transition-colors py-1 px-1.5 rounded-md hover:bg-gray-100 truncate max-w-xs md:max-w-md"
              >
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
