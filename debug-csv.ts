import fs from 'fs';
import { parse } from 'csv-parse/sync';

const csvData = fs.readFileSync('برچسب ها نهایی - Sheet1 (1).csv', 'utf8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

console.log("Total records:", records.length);
if (records.length > 0) {
  console.log("Headers:", Object.keys(records[0]));
}

console.log("\nSome sample rows:");
records.slice(0, 15).forEach((r: any, i: number) => {
  console.log(`${i+1}. H1: ${r['عنوان_H1']} | City: ${r['شهر_یا_جزیره_مقصد']} | Country: ${r['کشور_مقصد']} | Origin: ${r['شهر_یا_استان_مبدا']} | Occasion: ${r['رویداد_یا_مناسبت_خاص']} | Holiday: ${r['تعطیلات_خاص_تقویمی']}`);
});
