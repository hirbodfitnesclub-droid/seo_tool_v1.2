import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { parsePage } from './src/core/scoring/scorer';

const csvData = fs.readFileSync('برچسب ها نهایی - Sheet1 (1).csv', 'utf8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

const pages = records.map((record: any, index: number) => ({
  id: index + 1,
  title: record['عنوان_H1'],
  categories: record
}));

const mothers = [];
for (const p of pages) {
  const parsed = parsePage(p, p.categories as any);
  if (parsed.isMotherPage) {
    mothers.push({ id: p.id, title: p.title, parsed });
  }
}

console.log("Total mother pages identified by scorer:", mothers.length);
console.log("First 15 mothers:");
mothers.slice(0, 15).forEach(m => {
  console.log(`  - [ID: ${m.id}] ${m.title}`);
});

// Let's also inspect column values of row 1 to see how categories look
console.log("\nDetails of Row 1:", JSON.stringify(pages[0].categories, null, 2));
