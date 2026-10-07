# AquaLedger AI — سیستم اختصاصی حسابداری هوشمند تکنسین‌های تصفیه آب ایران

## ۱. مقدمه و معرفی پروژه

**AquaLedger AI** یک سیستم مدیریت مالی هوشمند و اختصاصی برای تکنسین‌های تصفیه آب در ایران است که نیازهای منحصر به فرد این قشر شغلی را پوشش می‌دهد. تکنسین‌های تصفیه آب معمولاً در دو جریان درآمدی فعالیت می‌کنند:

- **جریان شرکتی (صبح‌ها):** کار با حقوق ثابت در شرکت یا مغازه، خرید قطعات از جیب برای شرکت، دریافت مساعده و علی‌الحساب از رئیس، و واریز حقوق.
- **جریان میدانی (عصرها و تعطیلات):** سرویس‌کاری آزاد مشتریان، نصب و تعویض فیلتر، تعمیر پمپ، فروش قطعه و دریافت پول نقدی یا نسیه.

این پروژه با هدف **حذف دفترهای کاغذی، محاسبه خودکار طلب و بدهی، و استفاده از هوش مصنوعی برای ورودی صوتی و متنی** طراحی شده است. کاربر می‌تواند به زبان عامیانه فارسی بگوید چه تراکنشی انجام داده و سیستم به طور خودکار مبلغ، طرف حساب، نوع سند و اثر مالی را استخراج می‌کند.

---

## ۲. معماری و تکنولوژی‌های استفاده شده

### Frontend
| تکنولوژی | نسخه | نقش |
|-----------|-------|------|
| **React** | ۱۹.۰.۱ | کتابخانه رابط کاربری |
| **TypeScript** | ۷.۰.۲ | تایپ استاتیک و امنیت کد |
| **Vite** | ۸.۳.۰ | باندلر و سرور توسعه |
| **Tailwind CSS** | ۴.۳.۳ | استایل‌دهی واکنش‌گرا |
| **lucide-react** | ۰.۵۴۶.۰ | آیکون‌های vectorial |
| **motion** | ۱۲.۲۳.۲۴ | انیمیشن‌های روان |

### Backend
| تکنولوژی | نسخه | نقش |
|-----------|-------|------|
| **Express** | ۴.۲۱.۲ | سرور HTTP |
| **@google/genai** | ۲.۴.۰ | کلاینت SDK گوگل برای Gemini |
| **dotenv** | ۱۷.۲.۳ | مدیریت متغیرهای محیطی |
| **tsx** | ۴.۲۱.۰ | اجرای TypeScript در Node بدون کامپایل |

### ساختار hybrid سرور-کلاینت
پروژه از یک **سرور هیبریدی Express** استفاده می‌کند:
- در حالت توسعه (`development`): Vite به صورت middleware روی Express اجرا می‌شود و Hot Module Replacement (HMR) فعال است.
- در حالت تولید (`production`): Express فایل‌های استاتیک باندل شده را از دایرکتوری `dist` سرو می‌کند.

این رویکرد باعث ساده شدن دپلوی و عدم نیاز به دو سرور جدا می‌شود.

---

## ۳. ساختار پروژه و فایل‌ها

```
aqualedger-ai---دستیار-هوشمند-مالی-تکنسین/
├── server.ts                    # سرور Express + Gemini AI + Vite integration
├── package.json                 # وابستگی‌ها و اسکریپت‌های npm
├── tsconfig.json                # تنظیمات TypeScript
├── vite.config.ts               # تنظیمات Vite
├── index.html                   # نقطه ورود HTML
├── .env.example                 # نمونه متغیرهای محیطی
├── .gitignore
└── src/
    ├── main.tsx                 # ریشه React
    ├── App.tsx                  # کامپوننت اصلی و مدیریت State
    ├── index.css                # استایل‌های سراسری Tailwind
    ├── types/
    │   └── index.ts             # تمام تایپ‌های TypeScript
    ├── components/
    │   ├── Navbar.tsx           # نوار ناوبری و وضعیت سریع رئیس
    │   ├── DashboardView.tsx    # داشبورد مالی و کارت‌های KPI
    │   ├── SmartQuickEntry.tsx  # ورودی هوشمند (متن + صدا)
    │   ├── CompanyLedgerView.tsx # دفتر حساب شرکت و رئیس
    │   ├── ClientsLedgerView.tsx # دفتر مشتریان و یادآورها
    │   ├── InventoryView.tsx    # انبارک قطعات و محاسبه حاشیه سود
    │   ├── SettingsView.tsx     # تنظیمات قرارداد و حقوق
    │   ├── InvoiceExportModal.tsx # صدور صورت وضعیت برای پیام‌رسان‌ها
    │   └── UserGuideModal.tsx   # راهنما و قوانین محاسباتی
    └── utils/
        ├── storage.ts           # لایه localStorage و داده‌های پیش‌فرض
        ├── financialEngine.ts   # موتور محاسباتی مالی
        ├── formatters.ts        # فرمت‌کننده‌های تومان، شمسی و فارسی
```

### توضیح فایل‌های کلیدی

- **`server.ts`**: تنها endpoint منطقی Backend (`/api/analyze-transaction`) که به Gemini برای استخراج ساختار JSON از متن فارسی عامیانه تماس می‌گیرد. همچنین Health Check و سرو Vite را مدیریت می‌کند.
- **`App.tsx`**:.setState مرکزی و مدیریت ارتباط بین کامپوننت‌ها. تمام عملیات CRUD (ایجاد، به‌روزرسانی، حذف) تراکنش، مشتری، قطعه و تنظیمات از اینجریان می‌گذرد.
- **`types/index.ts`**: شمای کامل داده‌ها شامل `Transaction`، `Client`، `PartItem`، `CompanySettings` و `AIAnalysisResult`.
- **`financialEngine.ts`**: تابع `computeFinancialSummary` که همه محاسبات مالی (تراز رئیس، سود میدانی، حقوق، مطالبات) را انجام می‌دهد.
- **`storage.ts`**: لایه پایداری بر پایه `localStorage` با داده‌های نمونه (demo) قابل بازیابی.

---

## ۴. ویژگی‌های اصلی سیستم

### ۴.۱ ورودی هوشمند صوتی و متنی
کامپوننت `SmartQuickEntry` از **Web Speech API** (با پشتیبانی از `SpeechRecognition` و `webkitSpeechRecognition`) برای ورودی صوتی فارسی استفاده می‌کند. کاربر همچنین می‌تواند متن را تایپ کند. پس از ارسال، متن به سرور ارسال و توسط Gemini تحلیل می‌شود.

### ۴.۲ تفکیک دو جریان مالی (شرکتی/رئیس و میدانی/مشتری)
هر تراکنش به یکی از دو جریان تعلق دارد:
- **`company`**: شامل خرید از جیب برای شرکت (طلب از رئیس)، دریافت مساعده/علی‌الحساب، واریز حقوق.
- **`field`**: شامل دریافت پول از مشتری، ثبت نسیه/طلب، هزینه قطعه برای مشتری، و ابزار شخصی.

این تفکیک باعث می‌شود تکنسین بتواند به طور جداگانهowed
- **شرکت/رئیس**: چه میزان طلب دارد یا بدهکار است.
- **مشتریان میدانی**: چه سودی از خدماتشان کرده و چه مطالباتی دارد.

### ۴.۳ محاسبات مالی پیچیده
موتور مالی (`financialEngine.ts`) محاسبات زیر را به طور لحظه‌ای انجام می‌دهد:
- **حقوق پایه**: `monthlyBaseSalary - insuranceDeduction`
- **خریدهای جیبی (Out-of-Pocket)**: به عنوان طلب از رئیس اضافه می‌شود.
- **مساعده دریافتی (Advance)**: از طلب تکنسین کسر می‌شود.
- **واریز حقوق (Salary Payout)**: مانده شرکت را کاهش می‌دهد.
- **سود میدانی**: `paidAmount - partsCost` یا اگر Gemini مقدار `profitAmount` را برگردانده، از همان استفاده می‌شود.
- **تراز نهایی با رئیس**:
  ```
  bossNetBalance = (حقوق پایه + خریدهای جیبی) - (مساعده‌ها + واریز حقوق)
  ```
  بر اساس این مقدار وضعیت `creditor` (طلبکار)، `debtor` (بدهکار) یا `settled` (تسویه کامل) تعیین می‌شود.

### ۴.۴ مدیریت مشتریان و یادآور سرویس ۶ ماهه
هر مشتری شامل نام، تلفن، آدرس، مدل دستگاه، تاریخ آخرین سرویس و تاریخ سررسید بعدی است. سیستم به طور خودکار:
- مشتریان جدید را هنگام ثبت تراکنش میدانی ایجاد می‌کند.
- یادآور برای تعویض فیلتر ۶ ماهه نمایش می‌دهد (در داشبورد و لیست مشتریان).
- امکان تسویه بدهی مشتری و ثبت سند دریافت وجه را فراهم می‌کند.

### ۴.۵ انبارک قطعات و محاسبه حاشیه سود
کامپوننت `InvoiceExportModal` شامل انبارک کامل قطعات تصفیه آب است. برای هر قطعه:
- قیمت خرید همکار و قیمت فروش به مشتری ثبت می‌شود.
- حاشیه سود هر عدد و درصد سود ناخالص محاسبه و نمایش داده می‌شود.
- موجودی کل، ارزش سرمایه در گردش و سود بالقوه کل در کارت‌های KPI محاسبه می‌شود.

### ۴.۶ صورت وضعیت تسویه قابل ارسال در پیام‌رسان‌ها
ماژول `InvoiceExportModal` دو نوع صورت وضعیت تولید می‌کند:
- **صورت وضعیت شرکت و رئیس**: خلاصه حقوق، خریدهای جیبی، مساعده‌ها و مانده نهایی.
- **فاکتور سرویس مشتری**: شرح خدمات، مانده بدهی و یادآور سرویس بعدی.

این متن‌ها با فرمت مناسب برای کپی و ارسال در واتساپ، ایتا، بله، تلگرام یا پیامک آماده هستند.

---

## ۵. اسکیمای داده و تایپ‌ها

تمام تایپ‌ها در `src/types/index.ts` تعریف شده‌اند:

```typescript
// جریان تراکنش
export type StreamType = 'company' | 'field';

// انواع تراکنش
export type TransactionType =
  | 'company_expense_out_of_pocket' // خرید از جیب برای شرکت
  | 'boss_advance_received'         // دریافت مساعده از رئیس
  | 'salary_accrual'               // ثبت حقوق پایه (منطق داخلی)
  | 'salary_payout'                // واریز حقوق
  | 'client_payment_received'      // دریافت پول از مشتری
  | 'client_receivable'            // ثبت نسیه/طلب از مشتری
  | 'client_part_cost'             // هزینه قطعه برای مشتری از جیب
  | 'technician_tool_expense'      // خرید ابزار شخصی
  | 'other';

// روش پرداخت
export type PaymentMethod = 'cash' | 'card_to_card' | 'credit' | 'pos' | 'cheque';

// تراکنش اصلی
export interface Transaction {
  id: string;
  date: string;                  // ISO date
  jalaliDate?: string;           // تاریخ شمسی
  streamType: StreamType;
  transactionType: TransactionType;
  party: TransactionParty;
  totalAmount: number;           // تومان
  paidAmount: number;            // تومان
  remainingDebt: number;         // تومان
  financialImpact: FinancialImpact;
  paymentMethod: PaymentMethod;
  category: string;
  items?: TransactionItem[];     // قطعات فاکتور
  suggestNextServiceMonths?: number;
  description: string;
  conversationalSummary: string;
  source: 'ai_voice' | 'ai_text' | 'manual';
}

// تنظیمات شرکت و قرارداد
export interface CompanySettings {
  companyName: string;
  bossName: string;
  bossPhone: string;
  monthlyBaseSalary: number;     // تومان
  salaryPaymentDay: number;      // روز شمسی (مثلا ۲۵)
  overtimeHourlyRate: number;    // تومان بر ساعت
  insuranceDeduction: number;    // کسر بیمه
  autoAccrueSalary: boolean;
}

// مشتری
export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  deviceModel: string;
  totalPaid: number;
  totalDebt: number;
  lastServiceDate: string;
  nextServiceDueDate: string;
  notes?: string;
}

// قطعه انبارک
export interface PartItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  stock: number;
  purchasePrice: number;         // قیمت خرید (تومان)
  sellPrice: number;             // قیمت فاکتور (تومان)
  category: 'filter' | 'membrane' | 'pump' | 'switch' | 'housing' | 'fitting' | 'tool';
}
```

---

## ۶. منطق محاسباتی مالی

موتور محاسباتی در `src/utils/financialEngine.ts` قرار دارد. تابع اصلی `computeFinancialSummary` یک حلقه روی تمام تراکنش‌ها انجام می‌دهد و خروجی `FinancialSummary` تولید می‌کند:

```typescript
export interface FinancialSummary {
  // جریان شرکتی
  outOfPocketExpenses: number;   // خریدهای جیبی (طلبکار)
  advancesReceived: number;      // مساعده دریافتی
  baseSalaryAccrued: number;     // حقوق پایه (پس از بیمه)
  salaryPayouts: number;         // حقوق پرداخت شده
  bossNetBalance: number;        // تراز نهایی با رئیس
  bossStatus: 'creditor' | 'debtor' | 'settled';

  // جریان میدانی
  fieldTotalVolume: number;      // ارزش کل فاکتورها
  fieldCashCollected: number;    // کل دریافتی
  fieldPartsCost: number;        // هزینه قطعات مصرفی
  fieldNetProfit: number;        // سود خالص میدانی
  clientsTotalDebt: number;      // کل بدهی مشتریان

  // کلی
  totalPersonalNetIncome: number; // حقوق + سود میدانی
  activeTransactionsCount: number;
}
```

### فرمول‌های کلیدی

**حقوق پایه خالص:**
```typescript
baseSalaryAccrued = Math.max(0, settings.monthlyBaseSalary - settings.insuranceDeduction)
```

**تراز با رئیس:**
```typescript
bossNetBalance = (baseSalaryAccrued + outOfPocketExpenses) - (advancesReceived + salaryPayouts)
```
- اگر `bossNetBalance > 500`: وضعیت `creditor` (شما طلبکارید)
- اگر `bossNetBalance < -500`: وضعیت `debtor` (شما بدهکارید)
- در غیر این صورت: `settled`

**سود میدانی:**
```typescript
// اگر Gemini سود را برگردانده:
if (tx.financialImpact.profitAmount > 0) {
  fieldNetProfit += tx.financialImpact.profitAmount;
} else {
  // محاسبه جایگزین: دریافتی - هزینه قطعات
  fieldNetProfit += Math.max(0, tx.paidAmount - calculatedPartCost);
}
```

**درآمد خالص شخصی:**
```typescript
totalPersonalNetIncome = baseSalaryAccrued + fieldNetProfit
```

---

## ۷. Endpointهای API

### `POST /api/analyze-transaction`
تحلیل متن فارسی عامیانه و استخراج ساختار تراکنش مالی.

**Request:**
```json
{
  "text": "از جیب ۵۸۰ تومن دادم پک فیلتر ۱۲۳ برای شرکت خریدم",
  "context": {
    "bossName": "مهندس جلالی",
    "companyName": "تصفیه آب زلال گستر"
  }
}
```

**Response Schema (AIAnalysisResult):**
```json
{
  "success": true,
  "streamType": "company",
  "transactionType": "company_expense_out_of_pocket",
  "party": {
    "role": "boss",
    "name": "مهندس جلالی",
    "phone": "09121234567",
    "address": ""
  },
  "totalAmount": 580000,
  "paidAmount": 580000,
  "remainingDebt": 0,
  "financialImpact": {
    "targetBalance": "boss_balance",
    "userBalanceChange": 580000,
    "profitAmount": 0
  },
  "paymentMethod": "card_to_card",
  "category": "خرید تنخواه",
  "items": [
    { "itemName": "پک فیلتر ۱۲۳ تصفیه آب", "quantity": 1, "sellPrice": 580000 }
  ],
  "suggestNextServiceMonths": 6,
  "description": "خرید ۵۸۰ هزار تومانی از جیب برای شرکت",
  "conversationalSummary": "ثبت خرید ۵۸۰,۰۰۰ تومانی از جیب برای شرکت..."
}
```

### `GET /api/health`
بررسی سلامت سرور.

---

## ۸. تکنیک‌های بهینه‌سازی و طراحی

### ۸.۱ Fallback Parser هوشمند
در صورت عدم دسترسی به Gemini (خطای شبکه، Quota exhausted و ...)، سرور از یک **Parsar قانون‌باز** (Rule-based) استفاده می‌کند:
- تبدیل ارقام فارسی به انگلیسی (۰-۹ → 0-9)
- استخراج مبلغ از عبارت‌هایی مثل «۵۵۰ تومن»، «۲ میلیون»، «۳۸۰ هزار»
- تشخیص نوع تراکنش با کلیدواژه‌ها (از جیب، مساعده، مشتری، آقای، خانم)
- ساخت خروجی سازگار با `AIAnalysisResult`

این مکانیزم باعث افزایش **Resilience** سیستم می‌شود.

### ۸.۲ پایداری با localStorage
تمام داده‌ها در مرورگر کاربر ذخیره می‌شوند و نیاز به دیتابیس جداگانه ندارد. لایه `storage.ts` یک API ساده ارائه می‌دهد:
```typescript
loadTransactions(), saveTransactions(), loadSettings(), saveSettings(),
loadClients(), saveClients(), loadParts(), saveParts(), resetToDemoData()
```

### ۸.۳ Persian Localization جامع
- اعداد فارسی با `toPersianDigits()`
- فرمت‌های تومان با `formatToman()` و `formatTomanCompact()` (هزار، میلیون، میلیارد)
- تاریخ‌های شمسی با `toJalaliDate()` و `toJalaliDateTime()`
- زمان نسبی با `getRelativeTimeString()`

### ۸.۴ تعاملات کاربری روان
- استفاده از `motion` برای انیمیشن‌های ورود مودال‌ها (`zoom-in-95`, `fade-in`)
- بازخوردهای بصری فوری: دکمه‌های `active:scale-95`، گرادینت‌های شفاف و بلور (`backdrop-blur`)
- نمونه‌های آماده (Sample Prompts) برای ورودی سریع

### ۸.۵ محاسبه لحظه‌ای
در `App.tsx` در هر رندر، `computeFinancialSummary(transactions, settings, clients)` فراخوانی می‌شود. با تغییر هر تراکنش، کل داشبورد، کارت‌های KPI و دفتر شرکت به طور خودکار به‌روز می‌شود.

---

## ۹. نکات امنیتی و پیکربندی

### ۹.۱ کلید Gemini
- کلید API Gemini در فایل `.env` (که در `.gitignore` قرار دارد) نگهداری می‌شود.
- در فایل `.env.example` فقط یک نمونه وجود دارد و هیچ کلید واقعی Commit نمی‌شود.
- در `server.ts` کلید به صورت `process.env.GEMINI_API_KEY` خوانده می‌شود.

### ۹.۲ تنظیمات سرور
- سرور روی پورت `3000` (قابل تغییر با `PORT`) و اینترفیس `0.0.0.0` اجرا می‌شود.
- در توسعه Vite proxy می‌شود و در تولید فایل‌های استاتیک سرو می‌شوند.

### ۹.۳ تایپ‌سکریپت سخت‌گیرانه
- `tsconfig.json` شامل `noEmit: true`، `strict` (ضمناً)، `isolatedModules` و `skipLibCheck` است.
- اسکریپت `lint: "tsc --noEmit"` برای بررسی تایپ بدون تولید خروجی تعریف شده.

### ۹.۴ پشتیبان‌گیری
در `SettingsView` امکان **دانلود JSON پشتیبان** (`handleExportBackup`) وجود دارد. همچنین `resetToDemoData()` برای بازنشانی سریع به داده‌های نمونه تعبیه شده است.

---

## ۱۰. جمع‌بندی و ارزیابی نهایی

AquaLedger AI یک پروژه **بسیار هدفمند و تخصصی** است که نیازهای واقعی تکنسین‌های تصفیه آب ایران را به خوبی درک کرده و با ابزارهای مدرن وب پیاده‌سازی کرده است.

### نقاط قوت
✅ **تمرکز بر نیچ خاص:** تمام منطق و اصطلاحات برای دنیای واقعی تصفیه آب طراحی شده (پک فیلتر ۱۲۳، ممبران ۷۵ گالن، تعویض ۳ مرحله اول، ایاب و ذهاب و ...).
✅ **ورودی هوشمند:** استفاده از Gemini برای تبدیل زبان عامیانه به سند حسابداری، که کارایی بالایی در استخراج خودکار اطلاعات مالی دارد.
✅ **معماری ساده و مستقل:** نیاز به دیتابیس ندارد، با localStorage کار می‌کند و با یک فرمان `npm run dev` اجرا می‌شود.
✅ **تجربه کاربری عالی:** رابط کاربری تیره، واکنش‌گرا، با انیمیشن‌های روان و فرمت‌های ایرانی.
✅ **قابلیت اطمینان:** Fallback parser تضمین می‌کند حتی در صورت قطعی Gemini، سیستم از کار نیفتد.
✅ **خروجی قابل استفاده:** صورت وضعیت آماده برای ارسال در پیام‌رسان‌ها نیاز به نرم‌افزار جداگانه ندارد.

### نقاط قابل بهبود
⚠️ **مقیاس‌پذیری داده:** localStorage برای کاربران حرفه‌ای محدود است. اگر داده‌ها زیاد شوند، نیاز به IndexedDB یا API backend با دیتابیس خواهد بود.
⚠️ **احراز هویت:** در حال حاضر هیچ mechanusersم doesn't وجود ندارد و هر کسی با دسترسی به مرورگر داده‌ها را می‌بیند.
⚠️ **تست‌نویسی:** پروژه فاقد تست‌های واحد (unit test) یا یکپارچگی (integration test) است.
⚠️ **دسترسی صدا:** Web Speech API فقط در مرورگرهای خاص (Chrome، Safari) و با HTTPS فعال کار می‌کند.

### نتیجه‌گیری
این پروژه برای **تکنسین‌های کوچک تا متوسط** که می‌خواهند هزینه‌های خود، قراردادهای شرکتی و سرویس‌های میدانی را به صورت یکجا مدیریت کنند، راه‌حلی کامل و قابل استقرار است. توسعه آن به زبان TypeScript، React 19 و Tailwind v4، پایه‌ای محکم برای افزودن ویژگی‌های آتی (چت‌بات پیشرفته، گزارش PDF، همگام‌سازی ابری و ...) فراهم کرده است.
