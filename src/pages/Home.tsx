
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Plus } from 'lucide-react';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectEmptyState } from '../components/ProjectEmptyState';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Home() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.orderBy('created_at').reverse().toArray());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Batch query to calculate count of pages for each project to improve performance
  const pageCounts = useLiveQuery(async () => {
    const counts = new Map<number, number>();
    if (!projects) return counts;
    for (const p of projects) {
      if (p.id) {
        counts.set(p.id, await db.pages.where('project_id').equals(p.id).count());
      }
    }
    return counts;
  }, [projects]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await db.transaction('rw', [db.projects, db.pages, db.weights, db.results, db.candidates, db.analysisQueue], async () => {
      await db.projects.delete(deleteId);
      await db.pages.where('project_id').equals(deleteId).delete();
      await db.weights.where('project_id').equals(deleteId).delete();
      await db.results.where('project_id').equals(deleteId).delete();
      await db.candidates.where('project_id').equals(deleteId).delete();
      await db.analysisQueue.where('project_id').equals(deleteId).delete();
    });
    setDeleteId(null);
  };

  if (projects === undefined) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">پروژه‌های من</h1>
          <p className="text-gray-500 mt-1">مدیریت و تحلیل لینک‌سازی داخلی سایت‌ها</p>
        </div>
        <Button onClick={() => navigate('/new')}>
          <Plus size={20} />
          <span>پروژه جدید</span>
        </Button>
      </div>

      {projects.length === 0 ? (
        <ProjectEmptyState onNew={() => navigate('/new')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              pageCount={pageCounts?.get(project.id!) ?? 0}
              onDelete={() => project.id && setDeleteId(project.id)} 
              onConfig={() => navigate(`/config/${project.id}`)}
              onResult={() => navigate(`/results/${project.id}`)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="حذف پروژه"
        message="آیا از حذف این پروژه و تمامی صفحه‌ها، تنظیمات و نتایج تحلیل آن اطمینان دارید؟ این عمل غیرقابل بازگشت است."
        confirmText="بله، حذف شود"
        cancelText="انصراف"
        confirmType="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
