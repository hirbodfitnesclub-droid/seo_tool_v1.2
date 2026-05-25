import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { findTopCandidates } from './src/utils/scorer';

const csvData = fs.readFileSync('برچسب ها نهایی - Sheet1 (1).csv', 'utf8');
const records = parse(csvData, { columns: true, skip_empty_lines: true });

const pages = records.map((record: any, index: number) => ({
  id: index + 1,
  title: record['عنوان_H1'],
  categories: record
}));

const kish = pages.find((p: any) => p.title === 'تور کیش');
const trid = pages.find((p: any) => p.title === 'تور سه روزه کیش');

if (kish && trid) {
  const cands = findTopCandidates(kish, [trid]);
  console.log(JSON.stringify(cands[0], null, 2));
}
