// Rule-based Persian fallback parser. Runs on the SERVER when Gemini fails
// or no API key is configured. Pure logic (amounts via shared lib); the only
// IO is returning a plain object. Also usable offline on the client.
import { extractTomanAmounts, normalizePersianText } from '../src/lib/persianNumbers.js';

export interface FallbackAnalysis {
  success: boolean;
  streamType: 'company' | 'field';
  transactionType: string;
  party: { role: 'boss' | 'client' | 'self'; name: string; phone?: string; address?: string };
  totalAmount: number;
  paidAmount: number;
  remainingDebt: number;
  financialImpact: { targetBalance: string; userBalanceChange: number; profitAmount: number };
  paymentMethod: string;
  category: string;
  items: Array<{ itemName: string; quantity: number; sellPrice: number }>;
  suggestNextServiceMonths: number;
  description: string;
  conversationalSummary: string;
  confidence: number;
  warnings: string[];
}

const DEFAULT_AMOUNT = 500_000;

export function fallbackAnalyzeTransaction(text: string, context: { bossName?: string } = {}): FallbackAnalysis {
  const bossName = context.bossName || 'رئیس / شرکت';
  const normalized = normalizePersianText(text);

  const amounts = extractTomanAmounts(text);
  let amount = amounts.length > 0 ? amounts[0].value : 0;
  if (!amount) {
    // Last resort: any bare number (keeps old behavior for digit-only inputs).
    const anyNumber = normalized.match(/\d+/);
    if (anyNumber) {
      const val = parseInt(anyNumber[0], 10);
      amount = val < 1000 ? val * 1000 : val;
    } else {
      amount = DEFAULT_AMOUNT;
    }
  }

  const warnings: string[] = [];
  if (amounts.length === 0) warnings.push('مبلغ دقیق در متن پیدا نشد؛ مبلغ پیش‌فرض ثبت شد. لطفاً بررسی کنید.');

  const isOutOfPocket =
    normalized.includes('از جیب') ||
    normalized.includes('جیب خودم') ||
    normalized.includes('برای شرکت') ||
    normalized.includes('برای مغازه');

  const isAdvance =
    normalized.includes('مساعده') ||
    normalized.includes('از رئیس') ||
    normalized.includes('علی الحساب') ||
    normalized.includes('علی‌الحساب');

  const isSalaryPayout =
    normalized.includes('حقوق واریز') ||
    normalized.includes('حقوق پرداخت') ||
    normalized.includes('حقوق داد');

  const isToolExpense =
    normalized.includes('ابزار') ||
    normalized.includes('آچار') ||
    normalized.includes('کیف ابزار') ||
    normalized.includes('برای خودم');

  const isClient =
    normalized.includes('مشتری') ||
    normalized.includes('آقای') ||
    normalized.includes('خانم') ||
    normalized.includes('دکتر');

  let streamType: 'company' | 'field' = 'company';
  let transactionType = 'company_expense_out_of_pocket';
  let partyRole: 'boss' | 'client' | 'self' = 'boss';
  let partyName = bossName;
  let targetBalance = 'boss_balance';
  let userBalanceChange = amount;
  let category = 'خرید تنخواه';
  let paidAmount = amount;
  let remainingDebt = 0;
  let profit = 0;

  if (isSalaryPayout) {
    transactionType = 'salary_payout';
    userBalanceChange = -amount;
    category = 'واریز حقوق';
  } else if (isAdvance) {
    transactionType = 'boss_advance_received';
    userBalanceChange = -amount;
    category = 'مساعده دریافتی';
  } else if (isOutOfPocket) {
    transactionType = 'company_expense_out_of_pocket';
    userBalanceChange = amount;
    category = 'خرید تنخواه از جیب';
  } else if (isToolExpense) {
    streamType = 'field';
    transactionType = 'technician_tool_expense';
    partyRole = 'self';
    partyName = 'تکنسین (شخصی)';
    targetBalance = 'personal_cash';
    userBalanceChange = 0;
    category = 'ابزار شخصی';
  } else if (isClient) {
    streamType = 'field';
    partyRole = 'client';
    targetBalance = 'personal_cash';

    const nameMatch = text.match(/(آقای|خانم|دکتر|مهندس)\s+([^\s،,]+)/);
    partyName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : 'مشتری میدانی';

    // Partial payment: "۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ تومنش موند".
    // Keyword-anchored search handles bare numbers (no تومن marker) that the
    // amount extractor intentionally skips to avoid quantity confusion.
    const moneyWord = '(?:تومنش|تومانش|تومن|تومان)?';
    const paidHits = [
      ...normalized.matchAll(
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${moneyWord}\\s*(?:نقد|نقدی|داد|داده|گرفت|گرفته|پرداخت|کارت)(?!\\s*به\\s*کارت\\s*زد)`, 'g'),
      ),
    ];
    // "تمامش رو کارت به کارت زد" without a number right before کارت = paid in full.
    const paidInFull = /تمامش?\s+رو\s+کارت|تسویه\s+کامل|کامل\s+(?:پرداخت|داد|زد)/.test(normalized);
    const debtHits = [
      ...normalized.matchAll(
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${moneyWord}\\s*(?:موند|مانده|بدهکار|بدهکاری|نسیه|طلب)`, 'g'),
      ),
    ];
    const toToman = (raw: string): number => {
      const v = parseFloat(raw);
      return v < 1000 ? Math.round(v * 1000) : Math.round(v);
    };
    const paidKw = paidHits.length > 0 ? toToman(paidHits[paidHits.length - 1][1]) : 0;
    const debtKw = debtHits.length > 0 ? toToman(debtHits[debtHits.length - 1][1]) : 0;

    if (debtKw > 0 && debtKw < amount) {
      remainingDebt = debtKw;
      paidAmount = paidKw > 0 && paidKw < amount ? paidKw : Math.max(0, amount - debtKw);
      transactionType = 'client_receivable';
      targetBalance = 'client_receivable';
      userBalanceChange = remainingDebt;
    } else if (paidKw > 0 && paidKw < amount) {
      paidAmount = paidKw;
      remainingDebt = Math.max(0, amount - paidKw);
      transactionType = 'client_receivable';
      targetBalance = 'client_receivable';
      userBalanceChange = remainingDebt;
    } else if (amounts.length >= 2) {
      // Fully marked fallback: second amount smaller than total = partial payment.
      const second = amounts[1].value;
      if (second > 0 && second < amount) {
        paidAmount = second;
        remainingDebt = amount - second;
        transactionType = 'client_receivable';
        targetBalance = 'client_receivable';
        userBalanceChange = remainingDebt;
      } else {
        transactionType = 'client_payment_received';
        userBalanceChange = 0;
      }
    } else {
      transactionType = paidInFull || remainingDebt === 0 ? 'client_payment_received' : 'client_receivable';
      if (transactionType === 'client_payment_received') userBalanceChange = 0;
    }

    category = 'سرویس و تعویض فیلتر';
    profit = Math.round(paidAmount * 0.45);
  } else {
    warnings.push('طرف حساب مشخص نیست؛ به‌صورت شرکتی ثبت شد. در صورت نیاز اصلاح کنید.');
  }

  const items: FallbackAnalysis['items'] = [];
  if (normalized.includes('فیلتر') || normalized.includes('پک')) {
    items.push({ itemName: 'پک فیلتر ۱۲۳ تصفیه آب', quantity: 1, sellPrice: amount });
  } else if (normalized.includes('ممبران')) {
    items.push({ itemName: 'فیلتر ممبران ۷۵ گالن', quantity: 1, sellPrice: amount });
  } else if (normalized.includes('پمپ')) {
    items.push({ itemName: 'تعمیر یا تعویض پمپ', quantity: 1, sellPrice: amount });
  }

  return {
    success: true,
    streamType,
    transactionType,
    party: { role: partyRole, name: partyName },
    totalAmount: amount,
    paidAmount,
    remainingDebt,
    financialImpact: { targetBalance, userBalanceChange, profitAmount: profit },
    paymentMethod: 'card_to_card',
    category,
    items,
    suggestNextServiceMonths: normalized.includes('ممبران') ? 24 : 6,
    description: text,
    conversationalSummary:
      streamType === 'company'
        ? transactionType === 'salary_payout'
          ? `ثبت واریز حقوق ${amount.toLocaleString('fa-IR')} تومانی.`
          : transactionType === 'boss_advance_received'
            ? `ثبت دریافت ${amount.toLocaleString('fa-IR')} تومانی مساعده از رئیس (از طلب شما کسر گردید).`
            : `ثبت خرید ${amount.toLocaleString('fa-IR')} تومانی از جیب برای شرکت (به طلب شما از رئیس اضافه شد).`
        : `ثبت تراکنش ${amount.toLocaleString('fa-IR')} تومانی مشتری ${partyName}.`,
    confidence: 0.55,
    warnings,
  };
}
