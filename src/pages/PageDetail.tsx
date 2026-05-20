import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useProject } from '../hooks/useProject';
import { buildSinglePagePrompt } from '../utils/gemini';
import { callGemini } from '../utils/gemini';
import { safeJsonParse } from '../utils/safeJson';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { CandidateCard } from '../components/CandidateCard';
import Breadcrumb from '../components/Breadcrumb';
import { useToast } from '../hooks/useToast';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, Brain, Info, Save, X, 
  ChevronUp, ChevronDown, ExternalLink,
  CheckCircle, BarChart2, Globe, Tag, Sparkles
} from 'lucide-react';

export default function PageDetail() {
  const { projectId, pageId } = useParams<{ projectId: string, pageId: string }>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const pId = parseInt(projectId || '0');
  const pgId = parseInt(pageId || '0');

  const { project, loading: projectLoading } = useProject(pId);
  const page = useLiveQuery(() => db.pages.get(pgId));
  const candidateRec = useLiveQuery(() => db.candidates.where('source_page_id').equals(pgId).first());
  const result = useLiveQuery(() => db.results.where('source_page_id').equals(pgId).first());
  const { showToast } = useToast();

  const [selectedLinks, setSelectedLinks] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [isUnsaved, setIsUnsaved] = useState(false);
  
  // وضعیت نمایش تمامی کاندیداها (بیش از ۳۰ مورد)
  const [showAllCandidates, setShowAllCandidates] = useState(false);

  // لود اولیه لینک‌های نهایی
  useEffect(() => {
    if (result) {
      setSelectedLinks(safeJsonParse(result.recommended_links, []));
      setIsUnsaved(false);
    }
  }, [result]);

  // بررسی تغییرات ذخیره‌نشده برای هشدار خروج از صفحه
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUnsaved]);

  const candidateList = candidateRec ? safeJsonParse(candidateRec.candidate_list, []) : [];
  const categories = page ? safeJsonParse(page.categories, {}) : {};

  // نمایش ۳۰ کاندیدای برتر در حالت پیش‌فرض و نمایش بقیه با دکمه مشاهده بیشتر
  const displayedCandidates = showAllCandidates ? candidateList : candidateList.slice(0, 30);

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const prompt = buildSinglePagePrompt({ title: page!.title, categories: page!.categories }, candidateList);
      const response = await callGemini(prompt, 'gemini-3.1-flash-lite');
      const newLinks = response.selected_links || [];
      
      setSelectedLinks(newLinks);
      setIsUnsaved(true);
      showToast({ type: 'success', message: 'تحلیل هوشمند جدید با موفقیت اعمال شد. برای ثبت نهایی دکمه ثبت تغییرات را بزنید.' });
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', message: err.message || 'خطا در ارتباط با هوش مصنوعی' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveManual = async () => {
    try {
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
      setIsUnsaved(false);
      showToast({ type: 'success', message: 'تغییرات شما با موفقیت در بانک پیشرفته نتایج ثبت شد.' });
    } catch (err: any) {
      console.error(err);
      showToast({ type: 'error', message: 'خطا در ذخیره‌سازی تغییرات دستی.' });
    }
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
    setIsUnsaved(true);
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...selectedLinks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newLinks.length) {
      [newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]];
      setSelectedLinks(newLinks);
      setIsUnsaved(true);
    }
  };

  if (projectLoading || !page) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Breadcrumbs */}
      <Breadcrumb items={[
        { label: project?.name || 'پروژه', href: `/project/${pId}` },
        { label: page.title }
      ]} />
      
      {/* هدر داینامیک با هویت برند آبی لینک‌مش */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-40" />
        
        <div className="relative z-10 space-y-3.5 max-w-2xl">
          <div className="flex items-center gap-3">
            <Link to={`/project/${pId}`} className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all group shrink-0">
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Badge variant="blue" className="px-3 py-1 bg-blue-50 text-blue-700 border-blue-100">SEO Workstation</Badge>
            {isUnsaved && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-100 animate-pulse">
                * تغییرات ذخیره نشده
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight tracking-tight">{page.title}</h1>
          <div className="flex flex-wrap items-center gap-3.5 text-xs text-gray-500 font-medium">
             <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                <Globe size={13} className="text-blue-500" />
                <span>{project?.name}</span>
             </div>
             <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                <Tag size={13} className="text-blue-500" />
                <span>تگ‌ها: {Object.keys(categories).length} مورد</span>
             </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
          <Button 
            onClick={handleAIAnalysis} 
            loading={analyzing} 
            className="flex-1 sm:flex-none py-2.5 px-6 bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl text-sm transition-all"
          >
            <Sparkles size={16} />
            <span>تحلیل جادویی AI</span>
          </Button>
          <Button 
            onClick={handleSaveManual} 
            variant="secondary"
            className="flex-1 sm:flex-none py-2.5 px-6 border border-gray-100 hover:border-blue-200 rounded-xl text-sm font-bold bg-white text-gray-700 transition-all"
          >
            <Save size={16} />
            <span>ثبت تغییرات</span>
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ستون لودر و ادیتور */}
        <div className="lg:col-span-8 space-y-6">
          {/* بخش لینک‌های نهایی انتخاب شده */}
          <motion.section 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden"
          >
            <div className="p-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center px-6">
              <div className="flex items-center gap-2.5">
                 <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                    <CheckCircle size={15} />
                 </div>
                 <h3 className="font-bold text-gray-900 tracking-tight text-sm">لینک‌های نهایی (Selected)</h3>
              </div>
              <Badge variant="blue" className="rounded-full px-3">
                {selectedLinks.length} لینک فعال
              </Badge>
            </div>

            <div className="p-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {selectedLinks.length > 0 ? (
                  selectedLinks.map((link, idx) => (
                    <motion.div 
                      key={link.page_id}
                      layout
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 20, opacity: 0 }}
                      className="group p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-xs transition-all flex gap-4 items-center relative"
                    >
                      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => moveLink(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-300 hover:text-blue-600 disabled:opacity-10 cursor-pointer"><ChevronUp size={16} /></button>
                        <button onClick={() => moveLink(idx, 'down')} disabled={idx === selectedLinks.length - 1} className="p-1 text-gray-300 hover:text-blue-600 disabled:opacity-10 cursor-pointer"><ChevronDown size={16} /></button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-4">
                           <div className="min-w-0">
                              <h4 className="font-bold text-gray-900 truncate flex items-center gap-2 text-sm">
                                 {/* شماره اولویت‌بندی خروجی با اعداد انگلیسی */}
                                 <span className="font-extrabold text-xs text-blue-600 bg-blue-50 w-5 h-5 rounded-md flex items-center justify-center shrink-0">
                                   {idx + 1}
                                 </span>
                                 <ExternalLink size={13} className="text-blue-400 shrink-0" />
                                 <span className="truncate">{link.title}</span>
                              </h4>
                              <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wider mr-7">ID: #{link.page_id}</p>
                           </div>
                           <button 
                              onClick={() => {
                                setSelectedLinks(selectedLinks.filter(l => l.page_id !== link.page_id));
                                setIsUnsaved(true);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-yellow-50 hover:text-gray-700 transition-colors cursor-pointer shrink-0"
                              title="حذف از لیست نهایی"
                            >
                              <X size={15} />
                           </button>
                        </div>
                        <div className="mt-3 flex items-center gap-2 mr-7">
                           <div className="p-1.5 bg-gray-50 rounded-lg text-gray-500 shrink-0">
                              <Info size={13} />
                           </div>
                           <input 
                              type="text" 
                              placeholder="دلیل لینک‌سازی چیست؟ (مثلاً: رتبه بهتر در کلمه کلیدی X)"
                              value={link.reason}
                              onChange={(e) => {
                                const newLinks = [...selectedLinks];
                                newLinks[idx].reason = e.target.value;
                                setSelectedLinks(newLinks);
                                setIsUnsaved(true);
                              }}
                              className="w-full bg-transparent text-xs font-semibold text-gray-600 outline-hidden placeholder:text-gray-300 border-none p-0 focus:ring-0"
                           />
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-12 text-center"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <Sparkles size={28} />
                    </div>
                    <h4 className="text-gray-400 font-bold text-sm">هنوز هیچ لینکی انتخاب نشده</h4>
                    <p className="text-gray-300 text-xs mt-1">از لیست پیشنهادات پایین یا دکمه هوش مصنوعی استفاده کنید.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* کاندیداهای هوشمند الگوریتمی */}
          <section className="space-y-4">
             <div className="flex items-center gap-3 px-2">
                <div className="p-1.5 bg-blue-500 rounded-lg text-white shadow-xs">
                  <BarChart2 size={16} />
                </div>
                <div className="flex-1">
                   <h3 className="font-bold text-gray-900 tracking-tight text-sm">کاندیداهای هوشمند (Smart Pool)</h3>
                   <p className="text-[10px] text-gray-400 font-bold capitalize mt-0.5">جدول پیشنهادی الگوریتمی</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedCandidates.map((c: any, index: number) => (
                  <motion.div
                    key={c.page_id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.02 }}
                  >
                    {/* ارسال اختیاری مقدار index برای رتبه‌دهی ترتیبی مطمئن */}
                    <CandidateCard 
                      candidate={c} 
                      isSelected={selectedLinks.some(l => l.page_id === c.page_id)}
                      onToggle={() => toggleCandidate(c)}
                      index={index}
                    />
                  </motion.div>
                ))}
             </div>

             {/* دکمه مشاهده بیشتر منطقی و استاندارد */}
             {candidateList.length > 30 && !showAllCandidates && (
               <div className="flex justify-center pt-6">
                 <Button
                   onClick={() => setShowAllCandidates(true)}
                   variant="secondary"
                   className="py-2.5 px-8 border border-blue-100 hover:border-blue-200 rounded-xl text-xs font-bold bg-white text-blue-600 hover:bg-blue-50/50 shadow-xs transition-all flex items-center gap-1.5"
                 >
                   <span>مشاهده بیشتر ({candidateList.length - 30} مورد دیگر)</span>
                 </Button>
               </div>
             )}
          </section>
        </div>

        {/* ستون سمت راست: متادیتا */}
        <div className="lg:col-span-4 space-y-6">
           <motion.section 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white rounded-2xl p-6 text-gray-800 border border-gray-100 shadow-xs relative overflow-hidden"
           >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
              
              <h3 className="text-sm font-bold pb-4 border-b border-gray-50 mb-4 flex items-center gap-2 relative z-10 text-gray-900">
                <Globe size={16} className="text-blue-500" />
                <span>ویژگی‌های محتوایی صفحه</span>
              </h3>

              <div className="space-y-4 relative z-10" dir="rtl">
                {Object.entries(categories).map(([key, value]) => {
                  if (value === null || value === '' || value === undefined) return null;
                  return (
                    <div key={key} className="space-y-1.5 group">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-blue-500 transition-colors">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs font-semibold leading-relaxed bg-gray-50 border border-gray-100/50 p-3 rounded-xl hover:bg-gray-100/50 transition-colors">
                        {String(value)}
                      </div>
                    </div>
                  );
                })}
              </div>
           </motion.section>

           <div className="bg-blue-50/40 p-5 rounded-2xl border border-blue-100/60 flex gap-3">
              <div className="p-2 bg-blue-500 rounded-xl text-white shadow-xs shrink-0 self-start">
                <Brain size={18} />
              </div>
              <div className="space-y-1">
                 <h4 className="font-bold text-blue-950 text-xs">نکته طلایی سئو</h4>
                 <p className="text-[11px] text-blue-700 leading-relaxed font-semibold">
                    لینک‌سازی داخلی متعادل، اعتبار صفحه (Page Authority) را به درستی توزیع می‌کند. بر روی تگ‌های مرتبط تمرکز کنید.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
