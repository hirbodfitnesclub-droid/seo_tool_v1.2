import { isValidSeasonalMatch, calculateBonuses, findTopCandidates, normalizeMonth, computeTemporalPenalty } from './scorer';

// تست ۱: فیلتر فصلی و نرمال‌سازی
console.log('--- تست فیلتر فصلی و نرمال‌سازی ---');

const sourceAban = { 'ماه_تقویمی_برگزاری': 'آبان', 'فصل_برگزاری': 'پاییز' };
const candidateAban = { 'ماه_تقویمی_برگزاری': 'آبان', 'فصل_برگزاری': 'پاییز' };
const candidateAzar = { 'ماه_تقویمی_برگزاری': 'آذر', 'فصل_برگزاری': 'پاییز' };
const candidateTir = { 'ماه_تقویمی_برگزاری': 'تیر', 'فصل_برگزاری': 'تابستان' };
const candidateNorooz = { 'ماه_تقویمی_برگزاری': 'نوروز', 'فصل_برگزاری': 'بهار' };

console.log('نرمال‌سازی نوروز (باید فروردین باشد):', normalizeMonth('نوروز'));
if (normalizeMonth('نوروز') !== 'فروردین') {
  console.error('❌ خطا: نرمال‌سازی نوروز شکست خورد!');
  process.exit(1);
}

const resAbanAban = isValidSeasonalMatch(sourceAban, candidateAban);
const resAbanAzar = isValidSeasonalMatch(sourceAban, candidateAzar);
const resAbanTir = isValidSeasonalMatch(sourceAban, candidateTir);
const resAbanNorooz = isValidSeasonalMatch(sourceAban, candidateNorooz);

console.log('آبان → آبان (باید true باشد):', resAbanAban); 
console.log('آبان → آذر (باید true باشد - ماه بعد):', resAbanAzar);  
console.log('آبان → تیر (باید true باشد - در منطق نرم جدید حذف نمی‌شود):', resAbanTir);   
console.log('آبان → نوروز (باید true باشد - در منطق نرم جدید حذف نمی‌شود):', resAbanNorooz); 

if (resAbanAban !== true || resAbanAzar !== true || resAbanTir !== true || resAbanNorooz !== true) {
  console.error('❌ خطا: تست فیلتر فصلی شکست خورد!');
  process.exit(1);
}

// تست ۲: بونوس مبدا/مقصد
console.log('\n--- تست بونوس‌ها ---');

const sourceWithOrigin = { 'شهر_یا_استان_مبدا': 'تهران', 'شهر_یا_جزیره_مقصد': 'کیش' };
const candidateSameOrigin = { 'شهر_یا_استان_مبدا': 'تهران', 'شهر_یا_جزیره_مقصد': 'قشم' };
const candidateSameDest = { 'شهر_یا_استان_مبدا': 'مشهد', 'شهر_یا_جزیره_مقصد': 'کیش' };

const bonusResult1 = calculateBonuses(sourceWithOrigin, candidateSameOrigin);
const bonusResult2 = calculateBonuses(sourceWithOrigin, candidateSameDest);

console.log('مبدا یکسان:', bonusResult1); 
console.log('مقصد یکسان:', bonusResult2);   

if (bonusResult1.originBonus < 10 || bonusResult1.destinationBonus !== 0) {
  console.error('❌ خطا: تست بونوس مبدا شکست خورد!');
  process.exit(1);
}

if (bonusResult2.originBonus !== 0 || bonusResult2.destinationBonus < 5) {
  console.error('❌ خطا: تست بونوس مقصد شکست خورد!');
  process.exit(1);
}

// تست ۳: تست جریمه زمانی (تابستان به نوروز)
console.log('\n--- تست جریمه زمانی (تابستان به نوروز) ---');
const summerCat = { 'فصل_برگزاری': 'تابستان' };
const noroozCat = { 'ماه_تقویمی_برگزاری': 'نوروز' }; // فصل مؤثر: بهار

const penaltySummerToNorooz = computeTemporalPenalty(summerCat, noroozCat);
console.log('جریمه تابستان به نوروز (باید جریمه فصلی گذشته یعنی ۱۸ ثبت شود):', penaltySummerToNorooz);
if (penaltySummerToNorooz !== 18) {
  console.error('❌ خطا: جریمه زمانی تابستان به نوروز اشتباه محاسبه شده است!');
  process.exit(1);
}

// تست ۴: تست findTopCandidates چندلایه با جریمه زمانی ملموس
console.log('\n--- تست امتیازدهی چندلایه findTopCandidates با جریمه فصلی گذشته ---');
const sourcePage = {
  id: 1,
  title: 'تور ترابزون تابستان',
  categories: JSON.stringify({
    'فصل_برگزاری': 'تابستان',
    'شهر_یا_جزیره_مقصد': 'ترابزون',
    'کشور_مقصد': 'ترکیه'
  })
};

const allPages = [
  {
    id: 2,
    title: 'تور ترابزون پاییز (فصل آینده با جریمه کم)',
    categories: JSON.stringify({
      'فصل_برگزاری': 'پاییز',
      'شهر_یا_جزیره_مقصد': 'ترابزون',
      'کشور_مقصد': 'ترکیه'
    })
  },
  {
    id: 3,
    title: 'تور ترابزون نوروز (فصل گذشته یعنی بهار با جریمه بسیار سنگین)',
    categories: JSON.stringify({
      'ماه_تقویمی_برگزاری': 'نوروز',
      'فصل_برگزاری': 'بهار',
      'شهر_یا_جزیره_مقصد': 'ترابزون',
      'کشور_مقصد': 'ترکیه'
    })
  }
];

const weights = {
  'فصل_برگزاری': 3,
  'شهر_یا_جزیره_مقصد': 5,
  'کشور_مقصد': 4
};

const results = findTopCandidates(sourcePage, allPages, weights, 'weighted');
console.log('ترتیب کاندیداها بعد از جریمه:', results);

const autumnCand = results.find(r => r.page_id === 2);
const noroozCand = results.find(r => r.page_id === 3);

if (!autumnCand || !noroozCand) {
  console.error('❌ خطا: کاندیداها یافت نشدند!');
  process.exit(1);
}

console.log('امتیاز پاییز (فصل آینده):', autumnCand.score);
console.log('امتیاز نوروز (فصل گذشته):', noroozCand.score);

if (autumnCand.score <= noroozCand.score) {
  console.error('❌ خطا: اولویت‌بندی فصل‌های گذشته باید خیلی کمتر از فصل‌های آینده باشد!');
  process.exit(1);
}

console.log('\n✅ تمام تست‌ها با موفقیت پاس شدند!');
