import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useProject } from '../hooks/useProject';
import { useAnalysisQueue } from '../hooks/useAnalysisQueue';
import { processQueue } from '../utils/queueProcessor';
import { computeAndStoreCandidates } from '../utils/candidateStorage';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { QueueProgress } from '../components/QueueProgress';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Brain, BarChart2, Settings, ChevronLeft, 
  FileText, CheckCircle, Zap, ArrowRight 
} from 'lucide-react';

export default function ProjectPages() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = parseInt(projectId || '0');
  
  const { project, pages, weights, loading } = useProject(id);
  const { queue, startQueue, pauseQueue, resumeQueue, resetQueue } = useAnalysisQueue(id);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scoringStatus, setScoringStatus] = useState<string | null>(null);

  const candidatesCount = useLiveQuery(() => db.candidates.where('project_id').equals(id).count());
  
  const [showSetup, setShowSetup] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [analysisMode, setAnalysisMode] = useState<'all' | 'pending'>('pending');

  // بررسی خودکار کاندیداها (امتیازدهی الگوریتمی) در بدو ورود
  useEffect(() => {
    const autoScore = async () => {
      if (candidatesCount === 0 && pages && pages.length > 0 && weights) {
        try {
          setScoringStatus('درحال امتیازدهی الگوریتمی اولیه...');
          const weightMap: Record<string, number> = {};
          weights.forEach(w => weightMap[w.category_name] = w.weight_value);
          await computeAndStoreCandidates(id, pages, weightMap, project?.scoring_mode || 'linear');
          setScoringStatus(null);
        } catch (err) {
          console.error('Auto-scoring failed:', err);
          setScoringStatus('خطا در امتیازدهی خودکار');
        }
      }
    };
    if (!loading && project) {
      autoScore();
    }
  }, [candidatesCount, pages, weights, id, loading, project]);

  // کال کردن پروسسور زمانی که وضعیت صف تغییر می‌کند
  useEffect(() => {
    if (queue?.status === 'processing' || queue?.status === 'pending') {
      setIsProcessing(true);
      processQueue(id)
        .catch(console.error)
        .finally(() => setIsProcessing(false));
    } else {
      setIsProcessing(false);
    }
  }, [queue?.status, id]);

  const results = useLiveQuery(() => db.results.where('project_id').equals(id).toArray());

  const stats = useMemo(() => {
    if (!pages || !results) return null;
    return {
      total: pages.length,
      analyzed: results.length,
      pending: pages.length - results.length,
      candidates: candidatesCount || 0,
      percentage: Math.round((results.length / pages.length) * 100) || 0
    };
  }, [pages, results, candidatesCount]);

  const filteredPages = useMemo(() => {
    if (!pages) return [];
    return pages.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [pages, searchTerm]);

  const handleRunAnalysis = async () => {
    if (!pages || !project) return;
    
    try {
      setShowSetup(false);
      setIsProcessing(true);
      
      // ۱. اگر حالت "تمام صفحات" انتخاب شده، نتایج قبلی را پاک کرده و ایندکس را صفر می‌کنیم
      if (analysisMode === 'all') {
        await db.results.where('project_id').equals(id).delete();
        await db.analysisQueue.where('project_id').equals(id).modify({ current_page_index: 0 });
      }

      setScoringStatus('درحال آماده‌سازی دیتابیس کاندیداها...');
      
      const weightMap: Record<string, number> = {};
      weights.forEach(w => weightMap[w.category_name] = w.weight_value);
      
      await computeAndStoreCandidates(id, pages, weightMap, project.scoring_mode);
      
      setScoringStatus(null);
      
      // ۲. ذخیره مدل انتخابی در صف و شروع
      const existingQueue = await db.analysisQueue.where('project_id').equals(id).first();
      if (existingQueue) {
        await db.analysisQueue.update(existingQueue.id!, { 
          selected_model: selectedModel,
          status: 'pending',
          current_page_index: analysisMode === 'all' ? 0 : existingQueue.current_page_index
        });
      } else {
        await db.analysisQueue.add({
          project_id: id,
          status: 'pending',
          current_page_index: 0,
          total_pages: pages.length,
          selected_model: selectedModel,
          error_message: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      setIsProcessing(false); // processQueue effect will handle the rest
    } catch (err) {
      console.error(err);
      setScoringStatus('خطا در آماده‌سازی عملیات');
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!project) return <div className="text-center py-20">پروژه یافت نشد.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                      <Brain size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">تنظیمات تحلیل هوشمند</h2>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">AI Logic Configuration</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSetup(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                     <Zap size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Model Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-gray-700 flex items-center gap-2">
                      <Settings size={16} className="text-blue-500" />
                      انتخاب موتور هوش مصنوعی (LLM)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', desc: 'بسیار سریع و اقتصادی (پیشنهادی)', color: 'blue' },
                        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'تعادل بین سرعت و قدرت تحلیل', color: 'emerald' },
                        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'نسخه سبک کلاسیک', color: 'slate' }
                      ].map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={`flex items-center justify-between p-4 rounded-3xl border-2 transition-all ${selectedModel === model.id ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 bg-gray-50/30 hover:border-gray-200'}`}
                        >
                          <div className="text-right">
                             <div className="font-bold text-gray-900">{model.name}</div>
                             <div className="text-[10px] text-gray-500 font-medium">{model.desc}</div>
                          </div>
                          {selectedModel === model.id && <div className="w-4 h-4 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-black text-gray-700 flex items-center gap-2">
                       <BarChart2 size={16} className="text-emerald-500" />
                       دامنه پردازش صفحات
                    </label>
                    <div className="flex gap-4 p-2 bg-gray-50 rounded-[1.5rem] border border-gray-100">
                      <button 
                        onClick={() => setAnalysisMode('pending')}
                        className={`flex-1 py-3 px-4 rounded-xl text-center text-sm font-bold transition-all ${analysisMode === 'pending' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                         فقط صفحات بررسی نشده
                      </button>
                      <button 
                        onClick={() => setAnalysisMode('all')}
                        className={`flex-1 py-3 px-4 rounded-xl text-center text-sm font-bold transition-all ${analysisMode === 'all' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                         بررسی مجدد تمام صفحات (Reset)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button onClick={handleRunAnalysis} className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg shadow-xl shadow-blue-100">
                    <Zap size={20} />
                    <span>تایید و شروع تحلیل هوشمند</span>
                  </Button>
                  <Button variant="secondary" onClick={() => setShowSetup(false)} className="h-14 w-14 rounded-2xl">
                    <ChevronLeft size={24} />
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="bg-white p-2 rounded-full border border-gray-100 hover:bg-gray-50">
            <ArrowRight size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500">داشبورد مانیتورینگ پروژه و کنترل هوش مصنوعی</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Link to={`/config/${id}`}>
            <Button variant="secondary">
              <Settings size={18} />
              <span>تنظیمات پروژه</span>
            </Button>
          </Link>
          <Button onClick={() => setShowSetup(true)} disabled={isProcessing} className="bg-gray-900 hover:bg-black text-white shadow-xl shadow-gray-200">
            <Brain size={18} className="text-blue-400" />
            <span>تنظیم و اجرای هوش مصنوعی</span>
          </Button>
          <Link to={`/results/${id}`}>
            <Button variant="outline" className="border-gray-200">
              <BarChart2 size={18} className="text-emerald-500" />
              <span>نتایج نهایی</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                  <FileText size={18} />
                </div>
                <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Content</div>
              </div>
              <div className="text-3xl font-black text-gray-900">{stats.total}</div>
              <div className="text-[10px] text-gray-400 mt-2 font-bold uppercase">صفحات فعال در پروژه</div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500">
                  <CheckCircle size={18} />
                </div>
                <div className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">AI Analyzed</div>
              </div>
              <div className="text-3xl font-black text-gray-900">{stats.analyzed}</div>
              <div className="text-[10px] text-emerald-600 mt-2 font-bold uppercase">لینک‌سازی هوشمند شده</div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                  <BarChart2 size={18} />
                </div>
                <div className="text-blue-500 text-[10px] font-black uppercase tracking-widest">Pool Size</div>
              </div>
              <div className="text-3xl font-black text-gray-900">{stats.candidates}</div>
              <div className="text-[10px] text-blue-600 mt-2 font-bold uppercase">کاندیداهای پردازش شده</div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-50 bg-emerald-50/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500 rounded-xl text-white">
                  <Zap size={18} />
                </div>
                <div className="text-emerald-900 text-[10px] font-black uppercase tracking-widest">SEO Health</div>
              </div>
              <div className="text-3xl font-black text-emerald-600">{stats.percentage}%</div>
              <div className="text-[10px] text-emerald-600 mt-2 font-bold uppercase">درصد پیشرفت پروژه</div>
            </motion.div>
          </div>

          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${stats.percentage}%` }}
              className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>
      )}

      {/* Auto-Scoring & Queue Feedback */}
      <AnimatePresence>
        {scoringStatus && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-emerald-600 text-white rounded-3xl flex items-center justify-between shadow-lg shadow-emerald-100">
              <div className="flex items-center gap-4">
                <Spinner size="sm" className="text-white" />
                <div>
                  <p className="text-sm font-bold">{scoringStatus}</p>
                  <p className="text-[10px] opacity-70 font-medium">سیستم در حال آماده‌سازی هوشمند دیتابیس تورهاست...</p>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-transparent">Real-time Processor</Badge>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue Progress section */}
      {queue && (
        <QueueProgress 
          current={queue.current_page_index}
          total={queue.total_pages}
          status={queue.status}
          error={queue.error_message}
          onPause={pauseQueue}
          onResume={resumeQueue}
          onRetry={() => setShowSetup(true)}
        />
      )}

      {/* Search and Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="جستجوی عنوان صفحه..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {filteredPages.map((page, index) => {
            const hasResult = results?.some(r => r.source_page_id === page.id);
            const isCurrent = queue?.status === 'processing' && queue.current_page_index === index;

            return (
              <Link 
                key={page.id} 
                to={`/project/${id}/page/${page.id}`}
                className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group ${isCurrent ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${hasResult ? 'bg-green-50 border-green-100 text-green-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                    {isCurrent ? <Spinner size="sm" /> : <FileText size={20} />}
                  </div>
                  <div className="truncate">
                    <h4 className="font-medium text-gray-900 truncate">{page.title}</h4>
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
                  <ChevronLeft className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
                </div>
              </Link>
            );
          })}
          {filteredPages.length === 0 && (
            <div className="py-20 text-center text-gray-400">صفحه‌ای یافت نشد.</div>
          )}
        </div>
      </div>
    </div>
  );
}
