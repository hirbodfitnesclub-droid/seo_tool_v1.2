
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { 
  BarChart2, Search, Download, ChevronDown, ChevronUp, 
  LayoutDashboard, CheckCircle, Info, ArrowRight, FileText
} from 'lucide-react';

export default function Results() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, results, loading } = useProject(projectId);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filteredResults = useMemo(() => {
    if (!results) return [];
    return results.filter(r => 
      r.source_title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [results, searchTerm]);

  const stats = useMemo(() => {
    if (!results || results.length === 0) return null;
    let totalLinks = 0;
    results.forEach(r => {
      const links = JSON.parse(r.recommended_links);
      totalLinks += links.length;
    });
    return {
      count: results.length,
      avgLinks: (totalLinks / results.length).toFixed(1),
      lastDate: new Date(results[0].generated_at).toLocaleDateString('fa-IR')
    };
  }, [results]);

  const downloadCSV = () => {
    if (!results) return;
    
    let csvContent = "\ufeff"; // BOM for UTF-8 Support
    csvContent += "صفحه منبع,صفحه مقصد,دلیل انتخاب,وضعیت ویرایش\n";
    
    results.forEach(r => {
      const links = JSON.parse(r.recommended_links);
      links.forEach((l: any) => {
        csvContent += `"${r.source_title}","${l.title}","${l.reason}","${r.is_manual_edit ? 'دستی' : 'هوشمند'}"\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LinkMesh_Results_${project?.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (!results || results.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-6">
        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-blue-500">
          <BarChart2 size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900">هنوز تحلیلی انجام نشده است</h2>
        <p className="text-gray-500">برای شروع لینکسازی هوشمند، ابتدا باید تحلیل را اجرا کنید.</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/project/${projectId}`)}>برگشت به لیست صفحات</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
           <Link to={`/project/${projectId}`} className="bg-white p-2 rounded-full border border-gray-100 hover:bg-gray-50">
             <ArrowRight size={20} className="text-gray-400" />
           </Link>
           <div>
             <h1 className="text-2xl font-bold text-gray-900">نتایج نهایی لینک‌سازی</h1>
             <p className="text-gray-500 mt-1">پروژه: {project?.name}</p>
           </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="primary" onClick={downloadCSV} className="flex-1 md:flex-none">
            <Download size={18} />
            <span>خروجی CSV</span>
          </Button>
          <Button variant="outline" onClick={() => navigate('/')} className="px-3">
            <LayoutDashboard size={18} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.count}</div>
              <div className="text-xs text-gray-500 font-medium">صفحات تحلیل شده</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <BarChart2 size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.avgLinks}</div>
              <div className="text-xs text-gray-500 font-medium">میانگین لینک پیشنهادی</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">{stats.lastDate}</div>
              <div className="text-xs text-gray-500 font-medium">آخرین بروزرسانی</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="جستجوی صفحه منبع..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">صفحه منبع</th>
                <th className="px-6 py-4 text-center">تعداد لینک</th>
                <th className="px-6 py-4 text-center">وضعیت</th>
                <th className="px-6 py-4 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.map((result) => {
                const links = JSON.parse(result.recommended_links);
                const isExpanded = expandedRow === result.id;

                return (
                  <React.Fragment key={result.id}>
                    <tr className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/10' : ''}`} onClick={() => setExpandedRow(isExpanded ? null : result.id!)}>
                      <td className="px-6 py-4 font-medium text-gray-900">{result.source_title}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={links.length > 0 ? 'blue' : 'gray'}>{links.length} لینک</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={result.is_manual_edit ? 'blue' : 'gray'}>
                          {result.is_manual_edit ? 'دستی' : 'هوشمند'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-left">
                        {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={4} className="px-6 py-6 transition-all duration-300">
                          <div className="space-y-4 animate-in slide-in-from-top-2">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {links.map((link: any, idx: number) => (
                                 <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-1">
                                   <div className="font-bold text-gray-900 text-sm">{link.title}</div>
                                   <div className="text-xs text-gray-500 leading-relaxed italic">« {link.reason} »</div>
                                 </div>
                               ))}
                             </div>
                             <div className="flex justify-end pt-2">
                               <Link to={`/project/${projectId}/page/${result.source_page_id}`} className="text-blue-600 text-xs font-bold hover:underline">ویرایش جزئیات این صفحه ←</Link>
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
      </div>
    </div>
  );
}
