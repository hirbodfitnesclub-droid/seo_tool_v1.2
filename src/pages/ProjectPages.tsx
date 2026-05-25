import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProject } from '../hooks/useProject';
import { useAnalysisQueue } from '../hooks/useAnalysisQueue';
import { useQueueStatus } from '../hooks/useQueueStatus';
import { runQueue as processQueue } from '../core/queue/QueueCoordinator';
import * as analysisService from '../services/analysis/analysisService';
import * as candidateRepository from '../repositories/candidateRepository';
import * as resultRepository from '../repositories/resultRepository';
import { PageListItem } from '../components/PageListItem';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { QueueProgress } from '../components/QueueProgress';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../hooks/useToast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Brain, BarChart2, Settings, ChevronLeft, 
  FileText, CheckCircle, ArrowRight 
} from 'lucide-react';

export default function ProjectPages() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = parseInt(projectId || '0');
  
  const { project, pages, weights, loading } = useProject(id);
  const { queue, startQueue, pauseQueue, resumeQueue } = useAnalysisQueue(id);
  const queueStatus = useQueueStatus(id);
  const { showToast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [scoringStatus, setScoringStatus] = useState<string | null>(null);
  const processingRef = useRef(false);

  const candidatesCount = useLiveQuery(() => candidateRepository.countByProject(id), [id]);
  
  const [showSetup, setShowSetup] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [analysisMode, setAnalysisMode] = useState<'all' | 'pending'>('pending');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // اجرای پروسسور صف با حل Race Condition بر پایه استعلام بهینه وضعیت تغییرات صف
  useEffect(() => {
    if ((queueStatus === 'processing' || queueStatus === 'pending') && !processingRef.current) {
      processingRef.current = true;
      setIsProcessing(true);
      processQueue(id)
        .catch((err) => {
          console.error(err);
          showToast({ type: 'error', message: err.message || 'خطا در اجرای تحلیل هوشمند رخ داد' });
        })
        .finally(() => {
          processingRef.current = false;
          setIsProcessing(false);
        });
    } else if (queueStatus !== 'processing' && queueStatus !== 'pending') {
      setIsProcessing(false);
    }
  }, [queueStatus, id, showToast]);

  const results = useLiveQuery(() => resultRepository.listByProject(id), [id]);

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
    return pages.filter(p => p.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
  }, [pages, debouncedSearchTerm]);

  // صفحه جاری بر اساس آیتم‌های فیلتر شده
  const totalPages = Math.ceil(filteredPages.length / itemsPerPage);

  const paginatedPages = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPages.slice(start, start + itemsPerPage);
  }, [filteredPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // متد دستی محاسبه کاندیداها
  const handleComputeCandidates = async () => {
    try {
      setScoringStatus('درحال امتیازدهی الگوریتمی کاندیداها...');
      await analysisService.recomputeCandidates(id);
      setScoringStatus(null);
      showToast({ type: 'success', message: 'امتیازدهی کاندیداها با موفقیت انجام شد.' });
    } catch (err: any) {
      console.error(err);
      setScoringStatus(null);
      showToast({ type: 'error', message: 'خطا در محاسبه امتیازدهی کاندیداها.' });
    }
  };

  const handleRunAnalysis = async () => {
    try {
      setShowSetup(false);
      setIsProcessing(true);
      setScoringStatus('درحال آماده‌سازی دیتابیس کاندیداها...');
      
      await analysisService.startProjectAnalysis(id, selectedModel, analysisMode);
      
      setScoringStatus(null);
      setIsProcessing(false);
    } catch (err: any) {
      console.error(err);
      setScoringStatus(null);
      showToast({ type: 'error', message: err.message || 'خطا در ثبت و شروع تحلیل صف' });
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!project) return <div className="text-center py-20">پروژه یافت نشد.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Breadcrumbs */}
      <Breadcrumb items={[{ label: project.name }]} />

      {/* Model Selection & Parameters Modal */}
      <Modal isOpen={showSetup} onClose={() => setShowSetup(false)} title="تنظیمات تحلیل هوشمند" size="md">
        <div className="space-y-6">
          {/* Model Selection Radio Group */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 block">
              انتخاب موتور هوش مصنوعی (LLM)
            </label>
            <div className="flex flex-col gap-2.5">
              {[
                { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', desc: 'بسیار سریع و اقتصادی (پیشنهادی)' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'تعادل بین سرعت و قدرت تحلیل' },
                { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', desc: 'نسخه سبک کلاسیک' }
              ].map((model) => (
                <label
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    selectedModel === model.id ? 'border-blue-600 bg-blue-50/50' : 'border-gray-100 bg-gray-50/30 hover:border-gray-200'
                  }`}
                >
                  <div className="text-right">
                    <div className="font-bold text-gray-900 text-sm">{model.name}</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">{model.desc}</div>
                  </div>
                  <input
                    type="radio"
                    name="model-select"
                    checked={selectedModel === model.id}
                    onChange={() => setSelectedModel(model.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-2 border-gray-300"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Scope selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 block">
              دامنه پردازش صفحات
            </label>
            <div className="flex flex-col sm:flex-row gap-3 p-1.5 bg-gray-50 rounded-xl border border-gray-100">
              <button 
                onClick={() => setAnalysisMode('pending')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                  analysisMode === 'pending' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                فقط صفحات بررسی نشده
              </button>
              <button 
                onClick={() => setAnalysisMode('all')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                  analysisMode === 'all' ? 'bg-white text-red-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                بررسی مجدد تمام صفحات (Reset)
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button onClick={handleRunAnalysis} className="flex-1 py-3 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md">
              <Brain size={18} />
              <span>تایید و شروع تحلیل هوشمند</span>
            </Button>
            <Button variant="secondary" onClick={() => setShowSetup(false)} className="px-5 text-sm">
              بستن
            </Button>
          </div>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">داشبورد مانیتورینگ پروژه و کنترل هوش مصنوعی</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Link to={`/config/${id}`}>
            <Button variant="secondary" className="px-3.5 py-2 text-sm">
              <Settings size={16} />
              <span>تنظیمات پروژه</span>
            </Button>
          </Link>
          <Button onClick={() => setShowSetup(true)} disabled={isProcessing} className="bg-gray-900 hover:bg-black text-white shadow-md px-3.5 py-2 text-sm cursor-pointer">
            <Brain size={16} className="text-blue-400" />
            <span>تنظیم و اجرای هوش مصنوعی</span>
          </Button>
          <Link to={`/results/${id}`}>
            <Button variant="outline" className="border-gray-200 px-3.5 py-2 text-sm">
              <BarChart2 size={16} className="text-green-600" />
              <span>نتایج نهایی</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-gray-400" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">کل محتوا</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{stats.total}</div>
              <div className="text-[10px] text-gray-400 mt-1.5 font-bold uppercase">صفحه فعال در پروژه</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">تحلیل هوش مصنوعی</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{stats.analyzed}</div>
              <div className="text-[10px] text-green-600 mt-1.5 font-bold uppercase">لینک‌سازی هوشمند شده</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 size={16} className="text-blue-500" />
                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">کاندیداها</span>
              </div>
              <div className="text-2xl font-black text-gray-900">{stats.candidates}</div>
              <div className="text-[10px] text-blue-600 mt-1.5 font-bold uppercase">کاندیداهای پردازش شده</div>
            </div>

            <div className="bg-green-50/20 p-5 rounded-2xl border border-green-100 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-[10px] text-green-950 font-bold uppercase tracking-wider">پیشرفت سئو</span>
              </div>
              <div className="text-2xl font-black text-green-700">{stats.percentage}%</div>
              <div className="text-[10px] text-green-600 mt-1.5 font-bold uppercase">درصد پیشرفت پروژه</div>
            </div>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Manual autoScore notice if candidatesCount is 0 */}
      {stats !== null && stats.candidates === 0 && (
        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-350">
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900 text-sm">امتیازدهی کاندیداها انجام نشده است</h4>
            <p className="text-xs text-amber-700 leading-relaxed">برای پیدا شدن کاندیداهای لینک‌سازی هوشمند، نیاز است که سیستم ابتدا امتیازدهی الگوریتمی صفحه‌ها را شبیه‌سازی کند.</p>
          </div>
          <Button onClick={handleComputeCandidates} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs py-2 px-4 shadow-sm cursor-pointer font-bold">
            محاسبه امتیاز کاندیداها
          </Button>
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
            <div className="p-5 bg-blue-600 text-white rounded-2xl flex items-center justify-between shadow-md">
              <div className="flex items-center gap-4">
                <Spinner size="sm" className="text-white shrink-0" />
                <div>
                  <p className="text-sm font-bold">{scoringStatus}</p>
                  <p className="text-xs opacity-85 mt-0.5">سیستم در حال آماده‌سازی هوشمند دیتابیس کاندیداهاست...</p>
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-transparent">سیستمی</Badge>
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
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input 
              type="text" 
              placeholder="جستجوی عنوان صفحه..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-gray-200 outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {paginatedPages.map((page, index) => {
            const hasResult = !!results?.some(r => r.source_page_id === page.id);
            const globalIndex = (currentPage - 1) * itemsPerPage + index;
            const isCurrent = queue?.status === 'processing' && queue.current_page_index === globalIndex;

            return (
              <PageListItem 
                key={page.id} 
                page={page}
                projectId={id}
                hasResult={hasResult}
                isCurrent={isCurrent}
              />
            );
          })}
          {filteredPages.length === 0 && (
            <div className="py-12">
              <EmptyState 
                icon={<Search className="w-10 h-10 text-gray-300" />} 
                title="صفحه‌ای یافت نشد" 
                description="هیچ صفحه‌ای با عنوان جستجو شده در این پروژه پیدا نشد. لطفاً عبارت دیگری را امتحان کنید." 
              />
            </div>
          )}
        </div>

        {/* CSS Sliding pagination selector */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
            <span className="text-xs text-gray-500 font-medium">
              نمایش {((currentPage - 1) * itemsPerPage) + 1} تا {Math.min(currentPage * itemsPerPage, filteredPages.length)} از {filteredPages.length} صفحه
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                قبلی
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                if (totalPages > 6 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={page} className="text-gray-400 text-xs px-1">...</span>;
                  }
                  return null;
                }
                const isCurrent = page === currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${isCurrent ? 'bg-blue-600 text-white shadow-xs' : 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                بعدی
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
