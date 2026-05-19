
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useProject } from '../hooks/useProject';
import { CATEGORIES } from '../constants/categories';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Settings, Key, Sliders, Zap, Save, LayoutDashboard, Info } from 'lucide-react';

export default function Config() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, weights: dbWeights, loading } = useProject(projectId);

  const [scoringMode, setScoringMode] = useState<'linear' | 'weighted'>('linear');
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [maxLinks, setMaxLinks] = useState(10);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setScoringMode(project.scoring_mode);
      setMaxLinks(project.max_links);
    }
  }, [project]);

  useEffect(() => {
    if (!dbWeights) return;
    const initialWeights: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      const dbWeight = dbWeights.find(w => w.category_name === cat.name);
      initialWeights[cat.name] = dbWeight ? dbWeight.weight_value : cat.defaultWeight;
    });
    setLocalWeights(initialWeights);
  }, [dbWeights]);

  useEffect(() => {
    const storedKey = localStorage.getItem('LINKMESH_API_KEY') || '';
    setApiKey(storedKey);
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('LINKMESH_API_KEY', val);
  };

  const handleWeightChange = (name: string, val: number) => {
    setLocalWeights(prev => ({ ...prev, [name]: val }));
  };

  const handleStartAnalysis = async () => {
    if (!apiKey) {
      alert('لطفاً کلید API Gemini را وارد کنید');
      return;
    }
    if (!projectId) return;

    setSaving(true);
    try {
      const id = parseInt(projectId);
      await db.projects.update(id, { scoring_mode: scoringMode, max_links: maxLinks });

      const weightsToSave = Object.entries(localWeights).map(([name, val]) => ({
        project_id: id,
        category_name: name,
        weight_value: Number(val)
      }));

      // Find existing weights to get their IDs for bulkPut if needed, 
      // but easier to just delete and bulkAdd or use a key path.
      // Since our schema for weights is ++id, project_id, category_name, 
      // we should probably have a compound index or just clear and re-add.
      await db.weights.where('project_id').equals(id).delete();
      await db.weights.bulkAdd(weightsToSave);

      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !project) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="text-blue-600" />
          <span>تنظیمات تحلیل: {project.name}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Scoring Mode */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <span>روش امتیازدهی شباهت</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setScoringMode('linear')}
                className={`p-4 rounded-xl border-2 transition-all text-right ${scoringMode === 'linear' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className={`font-bold ${scoringMode === 'linear' ? 'text-blue-700' : 'text-gray-700'}`}>خطی</div>
                <div className="text-xs text-gray-500 mt-1">هر تطابق ۱ امتیاز مثبت دارد. ساده و سریع.</div>
              </button>
              <button 
                onClick={() => setScoringMode('weighted')}
                className={`p-4 rounded-xl border-2 transition-all text-right ${scoringMode === 'weighted' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <div className={`font-bold ${scoringMode === 'weighted' ? 'text-blue-700' : 'text-gray-700'}`}>ضریب‌دار</div>
                <div className="text-xs text-gray-500 mt-1">تطابق در فیلدهای مهم (مثل شهر مقصد) امتیاز بیشتری دارد.</div>
              </button>
            </div>
          </section>

          {/* Weights List */}
          {scoringMode === 'weighted' && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sliders size={18} className="text-blue-500" />
                <span>وزن فیلدها (۱ تا ۵)</span>
              </h2>
              <div className="space-y-4">
                {CATEGORIES.map(cat => (
                  <div key={cat.name} className="flex items-center gap-4 group">
                    <span className="text-sm text-gray-700 w-32 shrink-0">{cat.name.replace(/_/g, ' ')}</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      value={localWeights[cat.name] || cat.defaultWeight}
                      onChange={(e) => handleWeightChange(cat.name, parseInt(e.target.value))}
                      className="flex-1 accent-blue-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-sm font-bold text-blue-600 border border-gray-100">
                      {localWeights[cat.name] || cat.defaultWeight}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* API Key */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Key size={18} className="text-green-500" />
              <span>کلید API Gemini</span>
            </h2>
            <input 
              type="password" 
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="کلید را اینجا وارد کنید..."
              className="w-full px-4 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400">کلید شما فقط در مروگر خودتان ذخیره می‌شود.</p>
          </section>

          {/* Max Links */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Zap size={18} className="text-blue-500" />
              <span>تعداد لینک پیشنهادی</span>
            </h2>
            <select 
              value={maxLinks}
              onChange={(e) => setMaxLinks(parseInt(e.target.value))}
              className="w-full px-4 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>۵ لینک</option>
              <option value={10}>۱۰ لینک</option>
              <option value={15}>۱۵ لینک</option>
            </select>
          </section>

          <Button 
            className="w-full py-4 rounded-2xl shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700" 
            onClick={handleStartAnalysis}
            loading={saving}
          >
            <LayoutDashboard size={20} />
            <span>ذخیره و ورود به میز کار پروژه</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
