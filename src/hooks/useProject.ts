
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export function useProject(projectId?: string | number) {
  const id = typeof projectId === 'string' ? parseInt(projectId) : projectId;

  const project = useLiveQuery(() => id ? db.projects.get(id) : undefined, [id]);
  const pages = useLiveQuery(() => id ? db.pages.where('project_id').equals(id).toArray() : [], [id]) || [];
  const weights = useLiveQuery(() => id ? db.weights.where('project_id').equals(id).toArray() : [], [id]) || [];
  const results = useLiveQuery(() => id ? db.results.where('project_id').equals(id).toArray() : [], [id]) || [];

  const loading = project === undefined;

  return {
    project,
    pages,
    weights,
    results,
    loading,
    error: null, // Simple Dexie implementation usually doesn't throw async errors often
  };
}
