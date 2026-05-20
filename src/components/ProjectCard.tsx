
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db, Project } from '../db';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Calendar, FileText, BarChart2, Settings, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  pageCount: number;
  onDelete: () => void;
  onConfig: () => void;
  onResult: () => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, pageCount, onDelete, onConfig, onResult }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-bold text-lg text-gray-900 truncate max-w-[70%]">{project.name}</h3>
        <Badge variant={project.scoring_mode === 'weighted' ? 'blue' : 'gray'}>
          {project.scoring_mode === 'weighted' ? 'امتیازدهی ضریب‌دار' : 'امتیازدهی خطی'}
        </Badge>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar size={14} />
          <span>{new Date(project.created_at).toLocaleDateString('fa-IR')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText size={14} />
          <span>{pageCount ?? '...'} صفحه</span>
        </div>
      </div>

      <div className="flex gap-2 items-center pt-4 border-t border-gray-50">
        <Button variant="primary" className="flex-1 text-sm py-1.5" onClick={() => navigate(`/project/${project.id}`)}>
          <FileText size={16} />
          <span>مشاهده صفحات</span>
        </Button>
        <Button variant="secondary" className="px-3 py-1.5 shrink-0" onClick={onResult} title="خروجی نهایی">
          <BarChart2 size={16} />
        </Button>
        <Button variant="secondary" className="px-3 py-1.5 shrink-0" onClick={onConfig} title="تنظیمات">
          <Settings size={16} />
        </Button>
        <button 
          onClick={onDelete} 
          className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-55 border border-transparent hover:border-red-100 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0" 
          title="حذف"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
