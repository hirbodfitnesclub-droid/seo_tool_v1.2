import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { parseCSV, ParseResult } from '../utils/csvParser';
import { Button } from '../components/ui/Button';
import { CATEGORIES } from '../constants/categories';
import { computeAndStoreCandidates } from '../utils/candidateStorage';
import { useToast } from '../hooks/useToast';
import Breadcrumb from '../components/Breadcrumb';
import { Spinner } from '../components/ui/Spinner';
import { Upload, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  
  const [file, setFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dragActive, setDragActive] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processSelectedFile(selectedFile);
    }
  };

  const processSelectedFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      showToast({ type: 'error', message: 'فرمت فایل ارسالی حتماً باید CSV باشد.' });
      return;
    }
    setFile(selectedFile);
    setLoading(true);
    try {
      const result = await parseCSV(selectedFile);
      setParseResult(result);
      if (result.errors.length === 0) {
        setStep(2);
        showToast({ type: 'success', message: 'فایل CSV با موفقیت پارس و تحلیل اولیه شد.' });
      } else {
        showToast({ type: 'error', message: 'فایل ارسالی دارای خطاهایی در ساختار یا هدرها است.' });
      }
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: 'پارس فایل با خطا مواجه شد.' });
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      showToast({ type: 'error', message: 'لطفاً نام پروژه را وارد کنید.' });
      return;
    }
    if (!parseResult || parseResult.rows.length === 0) return;

    setLoading(true);
    try {
      const projectId = await db.transaction('rw', [db.projects, db.pages, db.weights], async () => {
        const id = await db.projects.add({
          name: projectName,
          created_at: new Date().toISOString(),
          scoring_mode: 'linear',
          max_links: 10
        });

        const pagesWithId = parseResult.rows.map(row => ({
          ...row,
          project_id: id
        }));

        await db.pages.bulkAdd(pagesWithId);

        // ذخیره وزن‌های پیش‌فرض پروژه
        const weightsToSave = CATEGORIES.map(cat => ({
          project_id: id,
          category_name: cat.name,
          weight_value: cat.defaultWeight
        }));
        await db.weights.bulkAdd(weightsToSave);

        return id;
      });

      // اجرای فوری تحلیل الگوریتمی در زمان ساخت پروژه
      showToast({ type: 'info', message: 'در حال اجرای فوری تحلیل الگوریتمی کاندیداها...' });
      
      const newPages = await db.pages.where('project_id').equals(projectId).toArray();
      const defaultWeightsMap: Record<string, number> = {};
      CATEGORIES.forEach(cat => {
        defaultWeightsMap[cat.name] = cat.defaultWeight;
      });

      await computeAndStoreCandidates(projectId, newPages, defaultWeightsMap, 'linear');

      showToast({ type: 'success', message: 'پروژه جدید و تحلیل الگوریتمی کاندیداها با موفقیت ایجاد و پردازش شد.' });
      navigate(`/config/${projectId}`);
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: 'خطا در ذخیره‌سازی و تحلیل اولیه پروژه.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <Breadcrumb items={[
        { label: 'پروژه‌های من', href: '/' },
        { label: 'پروژه جدید' }
      ]} />

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => step === 2 ? setStep(1) : navigate('/')} className="rounded-xl p-2.5 bg-white border border-gray-150">
          <ArrowRight size={18} className="text-gray-500" />
        </Button>
        <h1 className="text-2xl font-black text-gray-900">ایجاد پروژه جدید</h1>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all group ${
              dragActive ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/20'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileChange} 
            />
            <div className="bg-blue-50 w-14 h-14 rounded-full flex items-center justify-center mx-auto text-blue-500 group-hover:scale-105 transition-transform">
              <Upload size={24} />
            </div>
            <h2 className="text-base font-bold text-gray-800 mt-4">فایل CSV خود را اینجا رها کنید یا کلیک کنید</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">فایل باید دارای ساختار هجده ستونی دسته‌بندی و فیلد «عنوان_H1» باشد.</p>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          )}

          {parseResult?.errors.map((error, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          ))}
        </div>
      )}

      {step === 2 && parseResult && (
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-gray-50 bg-gray-50/30">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle className="text-green-500 shrink-0" size={18} />
              <span>فایل با موفقیت پارس شد</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">تعداد {parseResult.totalCount} صفحه در فایل شناسایی شد.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">نام پروژه</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="مثلاً: نهال‌گشت - آذر ۱۴۰۵"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-hidden transition-all text-sm font-semibold"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">پیش‌نمایش صفحات (۵ صفحه اول)</label>
              <div className="overflow-hidden border border-gray-100 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-650">
                    <tr>
                      <th className="px-4 py-2.5 font-bold">عنوان صفحه (H1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parseResult.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-705 font-medium">{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Button 
              className="w-full py-3 text-sm font-bold bg-blue-600 hover:bg-blue-700 shadow-sm" 
              onClick={handleSaveProject}
              loading={loading}
              disabled={!projectName.trim()}
            >
              <span>ذخیره و ادامه به تنظیمات پروژه</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
