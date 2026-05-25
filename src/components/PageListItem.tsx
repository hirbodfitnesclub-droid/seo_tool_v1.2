/**
 * @file PageListItem.tsx
 * @description کامپوننت ردیف لیست صفحات مجهز به React.memo جهت ارتقاء پرفورمنس مرورگری و جلوگیری از رندرهای ناخواسته
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle, ChevronLeft } from 'lucide-react';
import { Spinner } from './ui/Spinner';
import { type Page } from '../db';

interface PageListItemProps {
  page: Page;
  projectId: number;
  hasResult: boolean;
  isCurrent: boolean;
}

export const PageListItem: React.FC<PageListItemProps> = React.memo(({
  page,
  projectId,
  hasResult,
  isCurrent
}) => {
  return (
    <Link 
      to={`/project/${projectId}/page/${page.id}`}
      className={`flex items-center justify-between p-4 hover:bg-gray-50/70 transition-colors group ${isCurrent ? 'bg-blue-50/30' : ''}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
          hasResult ? 'bg-green-50 border-green-100 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'
        }`}>
          {isCurrent ? <Spinner size="sm" /> : <FileText size={18} />}
        </div>
        <div className="truncate">
          <h4 className="font-bold text-gray-800 text-sm truncate">{page.title}</h4>
          <div className="flex gap-2 mt-1">
             {hasResult && (
               <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
                  <CheckCircle size={10} />
                  <span>تحلیل شده</span>
               </div>
             )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ChevronLeft className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" size={18} />
      </div>
    </Link>
  );
});

PageListItem.displayName = 'PageListItem';
