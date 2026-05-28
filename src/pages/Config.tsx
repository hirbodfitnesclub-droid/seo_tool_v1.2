import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useProject } from '../hooks/useProject';
import { CATEGORIES } from '../constants/categories';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import Breadcrumb from '../components/Breadcrumb';
import { useToast } from '../hooks/useToast';
import { Settings, Sliders, Zap, LayoutDashboard, Calendar, Upload, Download, Trash2 } from 'lucide-react';
import { useTemporalContext } from '../contexts/TemporalContext';
import { triggerDownloadTemplate, parseCsvFile } from '../services/temporal/temporalCsvService';

export default function Config() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, weights: dbWeights, loading } = useProject(projectId);
  const { showToast } = useToast();
  const temporal = useTemporalContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scoringMode, setScoringMode] = useState<'linear' | 'weighted'>('linear');
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const [maxLinks, setMaxLinks] = useState(10);
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

  const handleWeightChange = (name: string, val: number) => {
    setLocalWeights(prev => ({ ...prev, [name]: val }));
  };

  const handleStartAnalysis = async () => {
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

      await db.weights.where('project_id').equals(id).delete();
      await db.weights.bulkAdd(weightsToSave);

      // پاک کردن کاندیداهای قبلی به جهت راه‌اندازی محاسبه خودکار مجدد سیستم با ضرایب جدید
      await db.candidates.where('project_id').equals(id).delete();

      // ریست کردن صف پردازش هوش مصنوعی در صورت وجود پردازش قبلی ناتمام
      await db.analysisQueue.where('project_id').equals(id).delete();

      showToast({ type: 'success', message: 'تنظیمات پروژه با موفقیت به روزرسانی شد.' });
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: 'خطا در ثبت اطلاعات تنظیمات.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !project) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <Breadcrumb items={[
        { label: project.name, href: `/project/${projectId}` },
        { label: 'تنظیمات پروژه' }
      ]} />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <Settings className="text-blue-600" size={24} />
          <span>تنظیمات تحلیل: {project.name}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Scoring Mode */}
          <section className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2 text-gray-800">
              <Zap size={16} className="text-amber-500" />
              <span>روش امتیازدهی شباهت صفحات</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => setScoringMode('linear')}
                className={`p-4 rounded-xl border-2 transition-all text-right cursor-pointer ${
                  scoringMode === 'linear' ? 'border-blue-600 bg-blue-50/20' : 'border-gray-100 hover:border-gray-200 bg-gray-50/20'
                }`}
              >
                <div className={`font-bold text-sm ${scoringMode === 'linear' ? 'text-blue-700' : 'text-gray-700'}`}>خطی (Linear)</div>
                <div className="text-xs text-gray-550 mt-1.5 leading-relaxed">هر تطابق عینا ۱ امتیاز مثبت دارد. مناسب پروژه‌های نرمال و سریع.</div>
              </button>
              <button 
                onClick={() => setScoringMode('weighted')}
                className={`p-4 rounded-xl border-2 transition-all text-right cursor-pointer ${
                  scoringMode === 'weighted' ? 'border-blue-600 bg-blue-50/20' : 'border-gray-100 hover:border-gray-200 bg-gray-50/20'
                }`}
              >
                <div className={`font-bold text-sm ${scoringMode === 'weighted' ? 'text-blue-700' : 'text-gray-700'}`}>ضریب‌دار (Weighted)</div>
                <div className="text-xs text-gray-550 mt-1.5 leading-relaxed">تطابق در فیلدهای خاص و حساس (مانند شهر مقصد) امتیاز و شانس ضربدر دارد.</div>
              </button>
            </div>
          </section>

          {/* Weights List */}
          {scoringMode === 'weighted' && (
            <section className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
              <h2 className="text-base font-bold flex items-center gap-2 text-gray-800">
                <Sliders size={16} className="text-blue-500" />
                <span>تنظیم وزن فیلدها (۱ درصد کم اهمیت‌ترین تا ۵ حساس‌ترین)</span>
              </h2>
              <div className="space-y-4 pt-2">
                {CATEGORIES.map(cat => (
                  <div key={cat.name} className="flex items-center gap-4 group">
                    <span className="text-xs font-bold text-gray-700 w-32 shrink-0">{cat.name.replace(/_/g, ' ')}</span>
                    <input 
                      type="range" 
                      min="1" 
                      max="5" 
                      value={localWeights[cat.name] || cat.defaultWeight}
                      onChange={(e) => handleWeightChange(cat.name, parseInt(e.target.value))}
                      className="flex-1 accent-blue-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg text-xs font-bold text-blue-600 border border-gray-100">
                      {localWeights[cat.name] || cat.defaultWeight}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {/* Max Links */}
          <section className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2 text-gray-800">
              <Zap size={16} className="text-blue-500" />
              <span>محدودیت تعداد لینک پیشنهادی نهایی</span>
            </h2>
            <select 
              value={maxLinks}
              onChange={(e) => setMaxLinks(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 text-xs font-bold rounded-xl border border-gray-200 outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
            >
              <option value={5}>حداکثر ۵ لینک</option>
              <option value={10}>حداکثر ۱۰ لینک</option>
              <option value={15}>حداکثر ۱۵ لینک</option>
            </select>
          </section>

          {/* هوشمندسازی فصلی-زمانی (Live Boost) */}
          <section className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold flex items-center gap-2 text-gray-800">
                <Calendar size={16} className="text-blue-500" />
                <span>هوشمندسازی فصلی-زمانی (Live Boost)</span>
              </h2>
              {/* دکمه تغییر وضعیت (Toggle Button) سوییچ سراسری */}
              <button 
                type="button"
                onClick={() => temporal.setGlobalEnabled(!temporal.globalEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-hidden ${temporal.globalEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 ${temporal.globalEnabled ? 'right-0.5' : 'right-5'} w-5 h-5 bg-white rounded-full shadow transition-all duration-200`} />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              با فعال‌سازی این گزینه، صفحاتی که با مناسبت‌های مناسب فصلی/جاری/آینده منطبق یا همراستا هستند، امتیاز اولویت (Boost) دریافت خواهند کرد و در صدر قرار می‌گیرند.
            </p>

            <div className="bg-blue-50/30 rounded-xl p-3 text-xs text-blue-800 border border-blue-100/30 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                <span>مناسبت‌های سیستمی پیش‌فرض: ۶ مورد</span>
              </div>
              <p className="text-gray-500 text-[10px] leading-relaxed pr-3">
                شامل فصل‌های چهارگانه شمسی (بهار، تابستان، پاییز، زمستان)، جشنواره خرید نوروزی و شب یلدا به‌طور داخلی پیاده‌سازی شده و معتبر هستند.
              </p>
            </div>

            {/* دانلود تمپلیت و آپلود فایل CSV مناسبت‌ها */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={triggerDownloadTemplate}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/60 text-gray-700 text-xs font-bold transition-all cursor-pointer focus:outline-hidden"
              >
                <Download size={14} className="text-gray-500" />
                <span>دانلود تمپلیت</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 text-blue-700 text-xs font-bold transition-all cursor-pointer focus:outline-hidden"
              >
                <Upload size={14} />
                <span>آپلود فایل CSV</span>
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { events, errors } = await parseCsvFile(file);
                    if (errors.length > 0) {
                      showToast({ 
                        type: 'error', 
                        message: `خطا در ${errors.length} ردیف اطلاعات. لطفاً فرمت فایل را با تمپلیت دانلود شده بازبینی کنید.` 
                      });
                    }
                    if (events.length > 0) {
                      temporal.setCsvEvents(events);
                      showToast({ 
                        type: 'success', 
                        message: `${events.length} مناسبت اختصاصی فصلی-زمانی با موفقیت بارگذاری شد.` 
                      });
                    }
                  } catch (err) {
                    console.error(err);
                    showToast({ type: 'error', message: 'خطا در خواندن و پارس فایل CSV.' });
                  } finally {
                    e.target.value = ''; // ریست مقدار جهت امکان آپلود مجدد فایل یکسان
                  }
                }} 
                accept=".csv" 
                className="hidden" 
              />
            </div>

            {/* جدول پیش‌نمایش رویدادها */}
            {temporal.csvEvents.length > 0 && (
              <div className="space-y-2 pt-2 animate-in fade-in duration-300">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-700">مناسبت‌های بارگذاری شده ({temporal.csvEvents.length})</span>
                  <button
                    onClick={() => {
                      temporal.setCsvEvents([]);
                      showToast({ type: 'success', message: 'تمام مناسبت‌های اختصاصی حذف شدند.' });
                    }}
                    className="flex items-center gap-1 text-[10px] text-rose-600 hover:text-rose-700 font-bold transition-all cursor-pointer focus:outline-hidden"
                  >
                    <Trash2 size={12} />
                    <span>حذف همه</span>
                  </button>
                </div>

                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-right text-[10px] border-collapse">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 font-bold">عنوان وبازه زمان</th>
                        <th className="p-2 font-bold">کلمات کلیدی</th>
                        <th className="p-2 text-center font-bold w-10">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {temporal.csvEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-gray-50/50 transition-all">
                          <td className="p-2">
                            <div className="font-bold text-gray-850 truncate max-w-[120px]" title={ev.name}>{ev.name}</div>
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              {`${ev.startDate.year}/${String(ev.startDate.month).padStart(2, '0')}/${String(ev.startDate.day).padStart(2, '0')} الی ${ev.endDate.year}/${String(ev.endDate.month).padStart(2, '0')}/${String(ev.endDate.day).padStart(2, '0')}`}
                            </div>
                          </td>
                          <td className="p-2 text-gray-500 max-w-[110px]">
                            <div className="flex flex-wrap gap-0.5 max-h-12 overflow-hidden" title={ev.keywords.join('، ')}>
                              {ev.keywords.map((kw, idx) => (
                                <span key={idx} className="inline-block bg-gray-100 text-gray-600 px-1 py-0.5 rounded text-[9px]">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => {
                                temporal.setCsvEvents(temporal.csvEvents.filter(x => x.id !== ev.id));
                                showToast({ type: 'success', message: `مناسبت «${ev.name}» حذف شد.` });
                              }}
                              className="text-gray-400 hover:text-rose-600 p-1 rounded-sm transition-all cursor-pointer"
                              title="حذف این مورد"
                            >
                              <Trash2 size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <Button 
            className="w-full py-3.5 rounded-xl shadow-xs bg-emerald-600 hover:bg-emerald-700 font-bold text-sm cursor-pointer" 
            onClick={handleStartAnalysis}
            loading={saving}
          >
            <LayoutDashboard size={18} />
            <span>ذخیره و ورود به میز کار پروژه</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
