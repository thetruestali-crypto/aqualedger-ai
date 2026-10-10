// Canonical demo seed data (single source of truth for all stores).
// Money unit: integer Toman. Dates are generated relative to first import.
import type { Transaction, CompanySettings, Client, PartItem, ServiceLog } from '../types';
import { toJalaliDate } from '../lib/format';

export const defaultSettings: CompanySettings = {
  companyName: 'تصفیه آب زلال گستر البرز',
  bossName: 'مهندس جلالی',
  bossPhone: '09121234567',
  technicianName: 'تکنسین ارشد',
  companyLogo: '',
  monthlyBaseSalary: 24_000_000, // ۲۴ میلیون تومان در ماه
  salaryPaymentDay: 25,          // بیست و پنجم هر ماه شمسی
  overtimeHourlyRate: 140_000,   // ۱۴۰ هزار تومان هر ساعت
  insuranceDeduction: 1_200_000, // یک میلیون و دویست هزار تومان بیمه
  autoAccrueSalary: true,
};

export const defaultParts: PartItem[] = [
  {
    id: 'part-1',
    name: 'پک ۳ تایی فیلتر ۱، ۲ و ۳ (الیافی و کربن)',
    code: 'FL-123',
    unit: 'پک ۳ عددی',
    stock: 14,
    purchasePrice: 220_000,
    sellPrice: 380_000,
    category: 'filter',
  },
  {
    id: 'part-2',
    name: 'فیلتر ممبران ۷۵ گالن Filmtec اورجینال',
    code: 'MB-75G',
    unit: 'عدد',
    stock: 6,
    purchasePrice: 650_000,
    sellPrice: 950_000,
    category: 'membrane',
  },
  {
    id: 'part-3',
    name: 'ست فیلتر ۵ و ۶ (پست کربن و مینرال تایوان)',
    code: 'FL-56',
    unit: 'ست ۲ عددی',
    stock: 9,
    purchasePrice: 280_000,
    sellPrice: 460_000,
    category: 'filter',
  },
  {
    id: 'part-4',
    name: 'پمپ تصفیه آب ۲۴ ولت هیدون (Headon Taiwan)',
    code: 'PMP-24V',
    unit: 'عدد',
    stock: 3,
    purchasePrice: 1_200_000,
    sellPrice: 1_750_000,
    category: 'pump',
  },
  {
    id: 'part-5',
    name: 'سوئیچ های‌پرشر تایوانی (فشار بالا)',
    code: 'SW-HP',
    unit: 'عدد',
    stock: 8,
    purchasePrice: 95_000,
    sellPrice: 165_000,
    category: 'switch',
  },
  {
    id: 'part-6',
    name: 'سوئیچ لوپرشر (قطع کن فشار کم)',
    code: 'SW-LP',
    unit: 'عدد',
    stock: 10,
    purchasePrice: 85_000,
    sellPrice: 150_000,
    category: 'switch',
  },
  {
    id: 'part-7',
    name: 'شیر برداشت اهرمی تمام استیل سنگین',
    code: 'TAP-LEV',
    unit: 'دستگاه',
    stock: 5,
    purchasePrice: 380_000,
    sellPrice: 580_000,
    category: 'housing',
  },
  {
    id: 'part-8',
    name: 'شیر برقی ۱/۴ اینچ تایوان ۲۴ ولت',
    code: 'VLV-EL',
    unit: 'عدد',
    stock: 7,
    purchasePrice: 140_000,
    sellPrice: 240_000,
    category: 'fitting',
  },
];

// 6 months in future for next service
const now = new Date();
const addMonths = (d: Date, m: number) => {
  const result = new Date(d);
  result.setMonth(result.getMonth() + m);
  return result.toISOString();
};
const subDays = (d: Date, days: number) => {
  const result = new Date(d);
  result.setDate(result.getDate() - days);
  return result.toISOString();
};

export const defaultClients: Client[] = [
  {
    id: 'client-1',
    name: 'آقای دکتر احمدی',
    phone: '09123456789',
    address: 'خیابان شریعتی، بالاتر از پل رومی، پلاک ۴۲، واحد ۳',
    deviceModel: 'دستگاه ۶ مرحله‌ای سافت‌واتر تایوان',
    totalPaid: 1_850_000,
    totalDebt: 0,
    lastServiceDate: subDays(now, 160), // تقریبا ۵ ماه پیش -> موعد سرویس نزدیک است
    nextServiceDueDate: addMonths(new Date(subDays(now, 160)), 6),
    notes: 'مخزن ۴ گالن دارد، گیج فشار روی ۸۰ psi تنظیم شد. مشتری بسیار خوش‌حساب.',
  },
  {
    id: 'client-2',
    name: 'خانم مهندس عباسی',
    phone: '09198765432',
    address: 'سعادت‌آباد، میدان کاج، خ بهزاد، مجتمع نیلوفر',
    deviceModel: 'دستگاه ۷ مرحله CCK با فیلتر قلیایی',
    totalPaid: 950_000,
    totalDebt: 250_000, // طلبکار هستیم
    lastServiceDate: subDays(now, 20),
    nextServiceDueDate: addMonths(new Date(subDays(now, 20)), 6),
    notes: '۲۵۰ تومن بابت ممبران بدهکار ماند، قرار شد هفته آینده کارت به کارت کند.',
  },
  {
    id: 'client-3',
    name: 'آقای کاظمی (کافه‌رستوران نارنج)',
    phone: '09351238899',
    address: 'ولنجک، خ سیزدهم، پلاک ۱۸',
    deviceModel: 'سیستم نیمه‌صنعتی ۴۰۰ گالن اسپرسو',
    totalPaid: 4_200_000,
    totalDebt: 600_000,
    lastServiceDate: subDays(now, 75),
    nextServiceDueDate: addMonths(new Date(subDays(now, 75)), 3), // سیستم صنعتی هر ۳ ماه
    notes: 'تعویض هوزینگ جامبو و فیلترهای پیش‌تصفیه انجام شد.',
  },
  {
    id: 'client-4',
    name: 'حاج آقا رضایی',
    phone: '09127771122',
    address: 'ستارخان، خ پاتریس لومومبا، کوچه ترابی',
    deviceModel: 'تصفیه آب خانگی آکواکلیر',
    totalPaid: 620_000,
    totalDebt: 0,
    lastServiceDate: subDays(now, 195), // بیش از ۶ ماه پیش -> موعد گذشته
    nextServiceDueDate: addMonths(new Date(subDays(now, 195)), 6),
    notes: 'زمان تعویض ۳ فیلتر اول گذشته است، نیاز به تماس برای هماهنگی.',
  },
];

export const defaultTransactions: Transaction[] = [
  {
    id: 'tx-seed-1',
    date: subDays(now, 1),
    jalaliDate: toJalaliDate(subDays(now, 1)),
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: {
      role: 'boss',
      name: 'مهندس جلالی (شرکت)',
      phone: '09121234567',
    },
    totalAmount: 680_000,
    paidAmount: 680_000,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: 680_000, // طلبکارتر شدن از شرکت
    },
    paymentMethod: 'card_to_card',
    category: 'خرید تنخواه',
    items: [
      { itemName: 'خرید ۲ عدد گیج روغنی و اتصالات فیتینگی مغازه از جیب', quantity: 2, purchasePrice: 340_000 },
    ],
    description: 'خرید ۲ عدد گیج روغنی و اتصالات فیتینگی برای مغازه از کارت شخصی تکنسین',
    conversationalSummary: 'خرید ۶۸۰ هزار تومان قطعات تنخواه از جیب برای شرکت ثبت شد (به طلب شما از رئیس اضافه شد).',
    source: 'ai_text',
    settled: true,
  },
  {
    id: 'tx-seed-2',
    date: subDays(now, 3),
    jalaliDate: toJalaliDate(subDays(now, 3)),
    streamType: 'company',
    transactionType: 'boss_advance_received',
    party: {
      role: 'boss',
      name: 'مهندس جلالی (رئیس)',
      phone: '09121234567',
    },
    totalAmount: 4_000_000,
    paidAmount: 4_000_000,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: -4_000_000, // کاهش طلب یا بدهکار شدن
    },
    paymentMethod: 'card_to_card',
    category: 'مساعده',
    description: 'دریافت مساعده علی‌الحساب ۴ میلیون تومانی از مهندس جلالی به حساب سامان',
    conversationalSummary: 'دریافت ۴ میلیون تومان مساعده از رئیس ثبت شد (از طلب شما کسر گردید).',
    source: 'ai_text',
    settled: true,
  },
  {
    id: 'tx-seed-3',
    date: subDays(now, 2),
    jalaliDate: toJalaliDate(subDays(now, 2)),
    streamType: 'field',
    transactionType: 'client_payment_received',
    party: {
      role: 'client',
      name: 'آقای کاظمی (کافه نارنج)',
      phone: '09351238899',
    },
    totalAmount: 950_000,
    paidAmount: 950_000,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'personal_cash',
      userBalanceChange: 0,
      profitAmount: 550_000, // سود خالص دستمزد + حاشیه قطعه
    },
    paymentMethod: 'card_to_card',
    category: 'تعویض فیلتر',
    items: [
      { itemName: 'فیلتر الیافی جامبو ۲۰ اینچ', quantity: 2, purchasePrice: 200_000, sellPrice: 380_000 },
      { itemName: 'دستمزد تعویض و هواگیری سیستم', quantity: 1, sellPrice: 570_000 },
    ],
    suggestNextServiceMonths: 3,
    description: 'سرویس دوره‌ای سیستم کافه نارنج، تعویض فیلترهای جامبو و تست TDS',
    conversationalSummary: 'دریافت ۹۵۰ هزار تومان از آقای کاظمی با ۵۵۰ هزار تومان سود خالص ثبت شد.',
    source: 'ai_voice',
    settled: true,
  },
  {
    id: 'tx-seed-4',
    date: subDays(now, 4),
    jalaliDate: toJalaliDate(subDays(now, 4)),
    streamType: 'field',
    transactionType: 'client_receivable',
    party: {
      role: 'client',
      name: 'خانم عباسی',
      phone: '09198765432',
    },
    totalAmount: 1_200_000,
    paidAmount: 950_000,
    remainingDebt: 250_000, // ۲۵۰ تومن طلبکاریم
    financialImpact: {
      targetBalance: 'client_receivable',
      userBalanceChange: 250_000,
      profitAmount: 450_000,
    },
    paymentMethod: 'credit',
    category: 'تعمیر پمپ و اتصالات',
    items: [
      { itemName: 'تعویض ممبران ۷۵ گالن Filmtec', quantity: 1, purchasePrice: 650_000, sellPrice: 950_000 },
      { itemName: 'دستمزد و ایاب ذهاب', quantity: 1, sellPrice: 250_000 },
    ],
    suggestNextServiceMonths: 6,
    description: 'تعویض فیلتر ممبران خانم عباسی؛ ۹۵۰ پرداخت شد و ۲۵۰ تومان نسیه ماند.',
    conversationalSummary: 'سرویس ۱,۲۰۰,۰۰۰ تومانی ثبت شد؛ ۲۵۰ هزار تومان به طلب شما از مشتریان اضافه شد.',
    source: 'ai_text',
    settled: false,
  },
  {
    id: 'tx-seed-5',
    date: subDays(now, 6),
    jalaliDate: toJalaliDate(subDays(now, 6)),
    streamType: 'company',
    transactionType: 'company_expense_out_of_pocket',
    party: {
      role: 'boss',
      name: 'مهندس جلالی (شرکت)',
      phone: '09121234567',
    },
    totalAmount: 520_000,
    paidAmount: 520_000,
    remainingDebt: 0,
    financialImpact: {
      targetBalance: 'boss_balance',
      userBalanceChange: 520_000,
    },
    paymentMethod: 'card_to_card',
    category: 'خرید تنخواه',
    items: [
      { itemName: 'خرید ۳ حلقه شلنگ تصفیه تایوانی و ۵ عدد زانو ممبران برای شرکت', quantity: 1, purchasePrice: 520_000 },
    ],
    description: 'خرید شلنگ و اتصالات برای انبار مرکزی شرکت از جیب تکنسین',
    conversationalSummary: '۵۲۰ هزار تومان خرید ملزومات شرکت از جیب ثبت شد.',
    source: 'manual',
    settled: true,
  },
];

/** No demo service logs yet: history is derived from seeded clients/transactions. */
export const defaultServiceLogs: ServiceLog[] = [];
