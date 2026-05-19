
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { parseCSV, ParseResult } from '../utils/csvParser';
import { Button } from '../components/ui/Button';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

export default function NewProject() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setLoading(true);
      const result = await parseCSV(selectedFile);
      setParseResult(result);
      setLoading(false);
      if (result.errors.length === 0) {
        setStep(2);
      }
    }
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      alert('لطفاً نام پروژه را وارد کنید');
      return;
    }
    if (!parseResult || parseResult.rows.length === 0) return;

    setLoading(true);
    try {
      const projectId = await db.transaction('rw', [db.projects, db.pages], async () => {
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
        return id;
      });

      navigate(`/config/${projectId}`);
    } catch (err) {
      console.error(err);
      alert('خطا در ذخیره‌سازی پروژه');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => step === 2 ? setStep(1) : navigate('/')} className="rounded-full p-2">
          <ArrowRight size={20} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">ایجاد پروژه جدید</h1>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv" 
              onChange={handleFileChange} 
            />
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-500 group-hover:scale-110 transition-transform">
              <Upload size={32} />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mt-4">فایل CSV خود را انتخاب کنید</h2>
            <p className="text-gray-500 mt-2">فایل باید شامل ۱۸ ستون دسته‌بندی و ستون "عنوان_H1" باشد.</p>
          </div>

          {parseResult?.errors.map((error, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          ))}
        </div>
      )}

      {step === 2 && parseResult && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-300">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="text-green-500" />
              <span>فایل با موفقیت پارس شد</span>
            </h2>
            <p className="text-gray-500 mt-1">تعداد {parseResult.totalCount} صفحه شناسایی شد.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">نام پروژه</label>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="مثلاً: نهال‌گشت - آذر ۱۴۰۵"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">پیش‌نمایش صفحات (۵ ردیف اول)</label>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">عنوان صفحه</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parseResult.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">{row.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Button 
              className="w-full py-4 text-lg" 
              onClick={handleSaveProject}
              loading={loading}
              disabled={!projectName.trim()}
            >
              ذخیره و ادامه به تنظیمات
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
