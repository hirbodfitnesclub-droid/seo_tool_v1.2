import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import { useDebounce } from '../hooks/useDebounce';
import { safeJsonParse } from '../utils/safeJson';
import { exportResultsToCSV } from '../services/io/csvExporter';
import { 
  BarChart2, Search, Download, ChevronDown, ChevronUp, 
  LayoutDashboard, CheckCircle, ArrowRight, FileText
} from 'lucide-react';

export default function Results() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, results, loading } = useProject(projectId);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const parsedResults = useMemo(() => {
    if (!results) return [];
    return results.map(r => ({
      ...r,
      links: safeJsonParse<any[]>(r.recommended_links, [])
    }));
  }, [results]);

  const filteredResults = useMemo(() => {
    return parsedResults.filter(r => 
      r.source_title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [parsedResults, debouncedSearchTerm]);

  const stats = useMemo(() => {
    if (parsedResults.length === 0) return null;
    let totalLinks = 0;
    parsedResults.forEach(r => {
      totalLinks += r.links.length;
    });
    return {
      count: parsedResults.length,
      avgLinks: (totalLinks / parsedResults.length).toFixed(1),
      lastDate: new Date(parsedResults[0].generated_at).toLocaleDateString('fa-IR')
    };
  }, [parsedResults]);

  const downloadCSV = () => {
    exportResultsToCSV(project?.name || 'project', parsedResults);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (!results || results.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 space-y-6">
        <Breadcrumb items={[
          { label: project?.name || 'پروژه', href: `/project/${projectId}` },
          { label: 'نتایج نهایی' }
        ]} />
        <div className="max-w-md mx-auto py-16 text-center space-y-6 bg-white rounded-2xl border border-gray-100 p-8 shadow-xs">
          <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-blue-500">
            <BarChart2 size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900">هنوز تحلیلی انجام نشده است</h2>
            <p className="text-gray-500 text-xs">برای شروع ساخت لینک‌های سئو هوشمند، ابتدا باید تحلیل هوش مصنوعی را در صفحه مدیریت پروژه اجرا کنید.</p>
          </div>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/project/${projectId}`)} className="text-xs font-bold py-2">
              برگشت به مدیریت صفحات
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: project?.name || 'پروژه', href: `/project/${projectId}` },
        { label: 'نتایج نهایی' }
      ]} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
           <Link to={`/project/${projectId}`} className="bg-white p-2 rounded-full border border-gray-100 hover:bg-gray-50 shrink-0">
             <ArrowRight size={18} className="text-gray-400" />
           </Link>
           <div>
             <h1 className="text-2xl font-black text-gray-900">نتایج نهایی لینک‌سازی</h1>
             <p className="text-xs text-gray-500 mt-1">پروژه فعال: {project?.name}</p>
           </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="primary" onClick={downloadCSV} className="flex-1 md:flex-none text-xs font-bold shrink-0">
            <Download size={16} />
            <span>خروجی CSV</span>
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="px-3 text-xs shrink-0 bg-white border-gray-200">
            <LayoutDashboard size={16} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-gray-900">{stats.count}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">صفحات تحلیل شده</div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-50 text-yellow-500 rounded-xl flex items-center justify-center shrink-0">
              <BarChart2 size={20} />
            </div>
            <div>
              <div className="text-xl font-black text-gray-900">{stats.avgLinks}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">میانگین لینک پیشنهادی</div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <div className="text-base font-black text-gray-900">{stats.lastDate}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">آخرین بروزرسانی</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table & Card container */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input 
              type="text" 
              placeholder="جستجوی صفحه منبع..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-gray-200 outline-hidden focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">صفحه منبع</th>
                <th className="px-6 py-4 text-center">تعداد لینک</th>
                <th className="px-6 py-4 text-center">وضعیت</th>
                <th className="px-6 py-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.map((res) => {
                const { links } = res;
                const isExpanded = expandedRow === res.id;

                return (
                  <React.Fragment key={res.id}>
                    <tr className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/10' : ''}`} onClick={() => setExpandedRow(isExpanded ? null : res.id!)}>
                      <td className="px-6 py-4 font-bold text-gray-800 text-sm">{res.source_title}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={links.length > 0 ? 'blue' : 'gray'}>{links.length} لینک</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={res.is_manual_edit ? 'blue' : 'gray'}>
                          {res.is_manual_edit ? 'دستی' : 'هوشمند'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-left">
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400 inline" /> : <ChevronDown size={16} className="text-gray-400 inline" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={4} className="px-6 py-6 transition-all duration-300">
                          <div className="space-y-4 animate-in slide-in-from-top-2">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {links.map((link: any, idx: number) => (
                                 <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-inner space-y-1">
                                   <div className="font-bold text-gray-900 text-xs">{link.title}</div>
                                   <div className="text-xs text-gray-500 leading-relaxed italic">« {link.reason} »</div>
                                 </div>
                                ))}
                             </div>
                             <div className="flex justify-end pt-2">
                               <Link to={`/project/${projectId}/page/${res.source_page_id}`} className="text-blue-600 text-xs font-bold hover:underline">ویرایش جزئیات این صفحه ←</Link>
                             </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid Layout */}
        <div className="block md:hidden divide-y divide-gray-100">
          {filteredResults.map((res) => {
            const { links } = res;
            const isExpanded = expandedRow === res.id;

            return (
              <div key={res.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3" onClick={() => setExpandedRow(isExpanded ? null : res.id!)}>
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm truncate">{res.source_title}</h4>
                    <div className="flex gap-1.5 items-center">
                      <Badge variant={links.length > 0 ? 'blue' : 'gray'} className="text-[10px] px-1.5 py-0.5">{links.length} لینک</Badge>
                      <Badge variant={res.is_manual_edit ? 'blue' : 'gray'} className="text-[10px] px-1.5 py-0.5">{res.is_manual_edit ? 'دستی' : 'هوشمند'}</Badge>
                    </div>
                  </div>
                  <button className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg text-gray-400 cursor-pointer shrink-0">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 space-y-3 animate-in fade-in duration-200">
                    <div className="space-y-2">
                      {links.map((link: any, idx: number) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-150 space-y-1">
                          <div className="font-bold text-gray-800 text-xs">{link.title}</div>
                          <div className="text-[10px] text-gray-500 leading-relaxed italic mt-0.5 mt-0.5">« {link.reason} »</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Link to={`/project/${projectId}/page/${res.source_page_id}`} className="text-blue-600 text-[11px] font-bold hover:underline">ویرایش جزئیات این صفحه ←</Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredResults.length === 0 && (
          <div className="py-12">
            <EmptyState 
              icon={<Search className="w-10 h-10 text-gray-300" />} 
              title="نتیجه‌ای یافت نشد" 
              description="هیچ فایل یا نتیجه تحلیلی با عنوان وارد شده پیدا نشد. لطفاً عبارت دیگری را امتحان کنید." 
            />
          </div>
        )}
      </div>
    </div>
  );
}
