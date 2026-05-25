import { findTopCandidates } from './src/utils/scorer';

const mockPages = [
  { id: 1, title: 'تور کیش', categories: { 'شهر_یا_جزیره_مقصد': 'کیش', 'نوع_تور': 'داخلی' } },
  { id: 2, title: 'تور کیش از مشهد', categories: { 'شهر_یا_جزیره_مقصد': 'کیش', 'نوع_تور': 'داخلی', 'شهر_یا_استان_مبدا': 'مشهد' } },
  { id: 3, title: 'تور کیش هتل شایگان', categories: { 'شهر_یا_جزیره_مقصد': 'کیش', 'نوع_تور': 'داخلی', 'نام_دقیق_هتل': 'شایگان' } },
  { id: 4, title: 'تور قشم', categories: { 'شهر_یا_جزیره_مقصد': 'قشم', 'نوع_تور': 'داخلی' } },
];

const candidates = findTopCandidates(mockPages[0] as any, [mockPages[1] as any, mockPages[2] as any, mockPages[3] as any]);

console.log(JSON.stringify(candidates, null, 2));
