import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useProject } from '../hooks/useProject';
import { buildSinglePagePrompt } from '../utils/queueProcessor';
import { callGemini } from '../utils/gemini';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { CandidateCard } from '../components/CandidateCard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Brain, Info, Save, Trash2, 
  ChevronUp, ChevronDown, ExternalLink, AlertCircle,
  CheckCircle, BarChart2, Globe, Tag, Sparkles
} from 'lucide-react';

export default function PageDetail() {
  const { projectId, pageId } = useParams<{ projectId: string, pageId: string }>();
  const navigate = useNavigate();
  const pId = parseInt(projectId || '0');
  const pgId = parseInt(pageId || '0');

  const { project, loading: projectLoading } = useProject(pId);
  const page = useLiveQuery(() => db.pages.get(pgId));
  const candidateRec = useLiveQuery(() => db.candidates.where('source_page_id').equals(pgId).first());
  const result = useLiveQuery(() => db.results.where('source_page_id').equals(pgId).first());

  const [selectedLinks, setSelectedLinks] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      setSelectedLinks(JSON.parse(result.recommended_links));
    }
  }, [result]);

  const candidateList = candidateRec ? JSON.parse(candidateRec.candidate_list) : [];
  const categories = page ? JSON.parse(page.categories) : {};

  const handleAIAnalysis = async () => {
    const apiKey = localStorage.getItem('LINKMESH_API_KEY');
    if (!apiKey) {
      setError('کلید API وارد نشده است. لطفاً در تنظیمات وارد کنید.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const prompt = buildSinglePagePrompt({ title: page!.title, categories }, candidateList);
      const response = await callGemini(prompt, apiKey);
      const newLinks = response.selected_links || [];
      
      await db.transaction('rw', [db.results], async () => {
        await db.results.where('source_page_id').equals(pgId).delete();
        await db.results.add({
          project_id: pId,
          source_page_id: pgId,
          source_title: page!.title,
          recommended_links: JSON.stringify(newLinks),
          is_manual_edit: false,
          generated_at: new Date().toISOString()
        });
      });
      setError('تحلیل هوشمند با موفقیت جایگزین شد (موفقیت)');
      setTimeout(() => setError(null), 3000);
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با هوش مصنوعی');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveManual = async () => {
    await db.transaction('rw', [db.results], async () => {
      await db.results.where('source_page_id').equals(pgId).delete();
      await db.results.add({
        project_id: pId,
        source_page_id: pgId,
        source_title: page!.title,
        recommended_links: JSON.stringify(selectedLinks),
        is_manual_edit: true,
        generated_at: new Date().toISOString()
      });
    });
    // نمایش نوتیفیکیشن یا بازخورد ملایم‌تر به جای alert
    setError('تغییرات با موفقیت ذخیره شد (پیام موفقیت)');
    setTimeout(() => setError(null), 3000);
  };

  const toggleCandidate = (candidate: any) => {
    const isAlreadySelected = selectedLinks.some(l => l.page_id === candidate.page_id);
    if (isAlreadySelected) {
      setSelectedLinks(selectedLinks.filter(l => l.page_id !== candidate.page_id));
    } else {
      setSelectedLinks([...selectedLinks, { 
        page_id: candidate.page_id, 
        title: candidate.title, 
        reason: 'انتخاب دستی کاربر' 
      }]);
    }
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...selectedLinks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newLinks.length) {
      [newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]];
      setSelectedLinks(newLinks);
    }
  };

  if (projectLoading || !page) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-[1400px] mx-auto pb-20 space-y-8 animate-in fade-in duration-700">
      
      {/* Dynamic Header */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-100/50 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <Link to={`/project/${pId}`} className="p-2.5 bg-gray-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group">
              <ArrowRight size={22} className="group-hover:-translate-x-1 transition-transform" />
            </Link>
            <Badge variant="blue" className="bg-blue-50 text-blue-600 border-blue-100 px-3 py-1">SEO Workstation</Badge>
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight tracking-tight">{page.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 font-medium">
             <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                <Globe size={14} className="text-emerald-500" />
                <span>{project?.name}</span>
             </div>
             <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                <Tag size={14} className="text-blue-500" />
                <span>تگ‌ها: {Object.keys(categories).length} مورد</span>
             </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <Button 
            onClick={handleAIAnalysis} 
            loading={analyzing} 
            className="flex-1 sm:flex-none py-4 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 rounded-2xl"
          >
            <Sparkles size={20} />
            <span>AI Magic Analysis</span>
          </Button>
          <Button 
            onClick={handleSaveManual} 
            variant="secondary"
            className="flex-1 sm:flex-none py-4 px-8 border-2 border-gray-100 hover:border-emerald-200 rounded-2xl"
          >
            <Save size={20} />
            <span>Commit Changes</span>
          </Button>
        </div>
      </motion.div>

      {error && (
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`p-4 rounded-2xl flex items-center gap-3 border ${error.includes('موفقیت') ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}
        >
          {error.includes('موفقیت') ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-bold">{error}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Editor Zone (8 Cols) */}
        <div className="lg:col-span-8 space-y-10">
          
          {/* Selected Links Bento */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center px-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-emerald-500 rounded-xl text-white">
                    <CheckCircle size={18} />
                 </div>
                 <h3 className="font-black text-gray-900 tracking-tight">لینک‌های نهایی (Selected)</h3>
              </div>
              <Badge className="rounded-full px-4">
                {selectedLinks.length} لینک فعال
              </Badge>
            </div>

            <div className="p-8 space-y-5">
              <AnimatePresence mode="popLayout">
                {selectedLinks.length > 0 ? (
                  selectedLinks.map((link, idx) => (
                    <motion.div 
                      key={link.page_id}
                      layout
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all flex gap-5 items-center relative"
                    >
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveLink(idx, 'up')} disabled={idx === 0} className="p-1.5 text-gray-300 hover:text-emerald-500 disabled:opacity-10"><ChevronUp size={18} /></button>
                        <button onClick={() => moveLink(idx, 'down')} disabled={idx === selectedLinks.length - 1} className="p-1.5 text-gray-300 hover:text-emerald-500 disabled:opacity-10"><ChevronDown size={18} /></button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-4">
                           <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 truncate flex items-center gap-2">
                                <ExternalLink size={14} className="text-blue-400" />
                                {link.title}
                              </h4>
                              <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider">ID: #{link.page_id}</p>
                           </div>
                           <button 
                              onClick={() => setSelectedLinks(selectedLinks.filter(l => l.page_id !== link.page_id))}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                           </button>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                           <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                              <Info size={14} />
                           </div>
                           <input 
                              type="text" 
                              placeholder="دلیل لینک‌سازی چیست؟ (مثلاً: رتبه بهتر در کلمه کلیدی X)"
                              value={link.reason}
                              onChange={(e) => {
                                const newLinks = [...selectedLinks];
                                newLinks[idx].reason = e.target.value;
                                setSelectedLinks(newLinks);
                              }}
                              className="w-full bg-transparent text-xs font-medium text-gray-600 outline-none placeholder:text-gray-300"
                           />
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-16 text-center"
                  >
                    <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-gray-200">
                      <Sparkles size={48} />
                    </div>
                    <h4 className="text-gray-400 font-bold">هنوز هیچ لینکی انتخاب نشده</h4>
                    <p className="text-gray-300 text-xs mt-2">از لیست پیشنهادات سمت راست یا AI استفاده کنید.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* Suggestions List */}
          <section className="space-y-6">
             <div className="flex items-center gap-4 px-4">
                <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-100">
                  <BarChart2 size={18} />
                </div>
                <div className="flex-1">
                   <h3 className="font-black text-gray-900 tracking-tight">کاندیداهای هوشمند (Smart Pool)</h3>
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Full Algorithmic Deep Context</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {candidateList.map((c: any, index: number) => (
                  <motion.div
                    key={c.page_id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CandidateCard 
                      candidate={c} 
                      isSelected={selectedLinks.some(l => l.page_id === c.page_id)}
                      onToggle={() => toggleCandidate(c)}
                    />
                  </motion.div>
                ))}
             </div>
          </section>
        </div>

        {/* Right Column: Metadata (4 Cols) */}
        <div className="lg:col-span-4 sticky top-8 space-y-8">
           <motion.section 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gray-900 rounded-[2rem] p-8 text-white shadow-2xl shadow-gray-200 relative overflow-hidden"
           >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full -mr-16 -mt-16 blur-3xl opacity-20" />
              
              <h3 className="text-lg font-black mb-8 flex items-center gap-3 relative z-10">
                <Globe size={20} className="text-emerald-400" />
                <span>Page Attributes</span>
              </h3>

              <div className="space-y-6 relative z-10">
                {Object.entries(categories).map(([key, value]) => {
                  if (value === null || value === '' || value === undefined) return null;
                  return (
                    <div key={key} className="space-y-2 group">
                      <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm font-medium leading-relaxed bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-colors">
                        {String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
           </motion.section>

           <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 flex gap-4">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-200">
                <Brain size={24} />
              </div>
              <div className="space-y-1">
                 <h4 className="font-bold text-emerald-900 text-sm">نکته SEO</h4>
                 <p className="text-[11px] text-emerald-700 leading-relaxed">
                    لینک‌سازی داخلی متعادل، اعتبار صفحه (Page Authority) را به درستی توزیع می‌کند. بر روی تگ‌های مرتبط تمرکز کنید.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
