
import React from 'react';
import { Button } from './ui/Button';
import { Plus, FileText } from 'lucide-react';

interface ProjectEmptyStateProps {
  onNew: () => void;
}

export const ProjectEmptyState: React.FC<ProjectEmptyStateProps> = ({ onNew }) => (
  <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center space-y-4">
    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-500">
      <FileText size={32} />
    </div>
    <h2 className="text-xl font-semibold text-gray-800">هنوز پروژه‌ای ندارید</h2>
    <p className="text-gray-500 max-w-sm mx-auto">برای شروع، یک فایل CSV از صفحات سایت خود را آپلود کنید تا تحلیل هوشمند آغاز شود.</p>
    <Button variant="outline" onClick={onNew} className="mt-4">
      <Plus size={18} />
      <span>ایجاد اولین پروژه</span>
    </Button>
  </div>
);
