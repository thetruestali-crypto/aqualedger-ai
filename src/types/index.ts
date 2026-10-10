export type StreamType = 'company' | 'field';

export type TransactionType =
  | 'company_expense_out_of_pocket' // خرید از جیب برای شرکت -> طلب از رئیس افزایش می‌یابد
  | 'boss_advance_received'        // دریافت مساعده/علی‌الحساب از رئیس -> طلب از رئیس کاهش می‌یابد
  | 'salary_accrual'              // ثبت حقوق پایه ماهانه
  | 'salary_payout'               // واریز حقوق توسط شرکت
  | 'client_payment_received'     // دریافت پول نقدی یا کارت به کارت از مشتری
  | 'client_receivable'           // ثبت نسیه/طلب از مشتری
  | 'client_part_cost'            // هزینه خرید قطعه برای مشتری از جیب تکنسین
  | 'technician_tool_expense'     // خرید یا تعمیر ابزار کار شخصی
  | 'other';

export type PaymentMethod = 'cash' | 'card_to_card' | 'credit' | 'pos' | 'cheque';

export interface TransactionItem {
  itemName: string;
  quantity?: number;
  purchasePrice?: number;
  sellPrice?: number;
}

export interface TransactionParty {
  role: 'boss' | 'client' | 'self';
  name: string;
  phone?: string;
  address?: string;
}

export interface FinancialImpact {
  targetBalance: 'boss_balance' | 'client_receivable' | 'personal_cash';
  userBalanceChange: number; // مثبت: افزایش طلب تکنسین، منفی: کاهش طلب یا بدهکار شدن
  profitAmount?: number;     // سود شخصی حاصل از قطعه/دستمزد
}

export interface Transaction {
  id: string;
  date: string; // ISO string
  jalaliDate?: string;
  streamType: StreamType;
  transactionType: TransactionType;
  party: TransactionParty;
  totalAmount: number; // تومان
  paidAmount: number;  // تومان
  remainingDebt: number; // تومان
  financialImpact: FinancialImpact;
  paymentMethod: PaymentMethod;
  category: string;
  items?: TransactionItem[];     // قطعات فاکتور
  suggestNextServiceMonths?: number;
  description: string;
  conversationalSummary: string;
  source: 'ai_voice' | 'ai_text' | 'manual';
  /** Fully settled invoice (no remaining debt and no dispute). Defaults false for legacy rows. */
  settled: boolean;
}

export interface CompanySettings {
  companyName: string;
  bossName: string;
  bossPhone: string;
  /** Editable technician display name (shown in navbar, dashboard, invoices). */
  technicianName?: string;
  /** Editable company logo as data-URL (image/*). Optional; empty means default icon. */
  companyLogo?: string;
  monthlyBaseSalary: number; // تومان
  salaryPaymentDay: number;   // روز چندم هر ماه شمسی (مثلا ۲۵)
  overtimeHourlyRate: number; // نرخ هر ساعت اضافه کار
  insuranceDeduction: number; // کسر بیمه
  autoAccrueSalary: boolean;
  // FR-04 extensions (optional so previously stored settings keep working):
  overtimeHours?: number;     // ساعت اضافه‌کار دوره (پیش‌فرض ۰)
  absenceDays?: number;       // روز کسر کار دوره (پیش‌فرض ۰)
  absenceDailyRate?: number;  // نرخ کسر هر روز غیبت به تومان (پیش‌فرض ۰)
  commissionPct?: number;     // درصد پورسانت (پیش‌فرض ۰)
}

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

export interface PartItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  stock: number;
  purchasePrice: number; // قیمت خرید همکار (تومان)
  sellPrice: number;     // قیمت فروش به مشتری (تومان)
  category: 'filter' | 'membrane' | 'pump' | 'switch' | 'housing' | 'fitting' | 'tool';
  /** Alert threshold (inclusive). Defaults to 3 when absent. */
  lowStockThreshold?: number;
}

export interface AIAnalysisResult {
  success: boolean;
  streamType: StreamType;
  transactionType: TransactionType;
  party: TransactionParty;
  totalAmount: number;
  paidAmount: number;
  remainingDebt: number;
  financialImpact: FinancialImpact;
  paymentMethod: PaymentMethod;
  category: string;
  items?: TransactionItem[];
  suggestNextServiceMonths?: number;
  description: string;
  conversationalSummary: string;
  /** Model self-reported confidence (0..1). Fallback parser reports ~0.55. */
  confidence?: number;
  /** Human-readable warnings (e.g. suspicious amounts). Always shown in preview. */
  warnings?: string[];
}

export interface ServiceLogItem {
  partId?: string;
  name: string;
  qty: number;
  sellPrice: number; // به تومان (فاکتور به مشتری)
  buyPrice: number;  // به تومان (قیمت خرید انبار)
}

export interface ServiceLog {
  id: string;
  clientId: string;
  date: string; // ISO
  items: ServiceLogItem[];
  laborFee: number; // اجرت فنی، جدا از سود قطعه (FR-08)
  nextServiceDueDate: string; // ISO
  notes?: string;
}
