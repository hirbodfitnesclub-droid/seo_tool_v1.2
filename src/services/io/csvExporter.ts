/**
 * @file csvExporter.ts
 * @description سرویس استخراج و دانلود گزارش سئو خروجی لینک‌های داخلی به فرمت استاندارد CSV
 */

interface ExporterResultRow {
  source_title: string;
  is_manual_edit: boolean;
  links: Array<{
    title: string;
    reason: string;
  }>;
}

/**
 * ایجاد و شروع فرآیند دانلود فایل نهایی CSV خروجی نتایج بر روی کلاینت مرورگر
 * @param projectName نام پروژه جهت نام‌گذاری فایل خروجی
 * @param results لیست پردازش‌شده نتایج به همراه لینک‌های تایید شده نهایی
 */
export function exportResultsToCSV(projectName: string, results: ExporterResultRow[]): void {
  if (results.length === 0) return;

  let csvContent = '\ufeff'; // افزونه BOM جهت تضمین نمایش صحیح یونیکد و حروف فارسی در اکسل
  csvContent += 'صفحه منبع,صفحه مقصد,دلیل انتخاب,وضعیت ویرایش\n';

  results.forEach(r => {
    r.links.forEach(l => {
      // فرار دادن کوتیشن مارک‌های دوبل برای به حداقل رساندن تداخل کاما درون فیلدهای فارسی
      const sourceEscaped = r.source_title.replace(/"/g, '""');
      const targetEscaped = l.title.replace(/"/g, '""');
      const reasonEscaped = l.reason.replace(/"/g, '""');
      const modeText = r.is_manual_edit ? 'دستی' : 'هوشمند';

      csvContent += `"${sourceEscaped}","${targetEscaped}","${reasonEscaped}","${modeText}"\n`;
    });
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LinkMesh_Results_${projectName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
