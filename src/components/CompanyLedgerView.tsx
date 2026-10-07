import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  PlusCircle,
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Copy,
  Share2,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { Transaction, CompanySettings } from '../types';
import { FinancialSummary } from '../utils/financialEngine';
import {
  formatToman,
  formatTomanCompact,
  toJalaliDate,
  toPersianDigits,
} from '../utils/formatters';

interface CompanyLedgerViewProps {
  summary: FinancialSummary;
  transactions: Transaction[];
  settings: CompanySettings;
  onAddTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onExportSettlement: () => void;
}

export const CompanyLedgerView: React.FC<CompanyLedgerViewProps> = ({
  summary,
  transactions,
  settings,
  onAddTransaction,
  onDeleteTransaction,
  onExportSettlement,
}) => {
  const [showQuickModal, setShowQuickModal] = useState<
    'none' | 'advance' | 'out_of_pocket' | 'payout'
  >('none');
  const [quickAmount, setQuickAmount] = useState<number>(0);
  const [quickDesc, setQuickDesc] = useState<string>('');

  // Filter company stream transactions only
  const companyTransactions = transactions.filter((t) => t.streamType === 'company');

  // Handle manual fast company transaction
  const handleCreateFastTransaction = (type: 'advance' | 'out_of_pocket' | 'payout') => {
    if (!quickAmount || quickAmount <= 0) return;

    let transactionType: any = 'company_expense_out_of_pocket';
    let category = 'خرید تنخواه';
    let balanceChange = quickAmount;

    if (type === 'advance') {
      transactionType = 'boss_advance_received';
      category = 'مساعده';
      balanceChange = -quickAmount;
    } else if (type === 'payout') {
      transactionType = 'salary_payout';
      category = 'واریز حقوق';
      balanceChange = -quickAmount;
    }

    const newTx: Transaction = {
      id: `tx-comp-${Date.now()}`,
      date: new Date().toISOString(),
      jalaliDate: toJalaliDate(),
      streamType: 'company',
      transactionType,
      party: {
        role: 'boss',
        name: settings.bossName,
        phone: settings.bossPhone,
      },
      totalAmount: quickAmount,
      paidAmount: quickAmount,
      remainingDebt: 0,
      financialImpact: {
        targetBalance: 'boss_balance',
        userBalanceChange: balanceChange,
      },
      paymentMethod: 'card_to_card',
      category,
      description: quickDesc || (type === 'advance' ? 'دریافت مساعده از رئیس' : 'خرید از جیب برای شرکت'),
      conversationalSummary:
        type === 'advance'
          ? `دریافت ${formatToman(quickAmount)} مساعده از ${settings.bossName} ثبت شد.`
          : `خرید ${formatToman(quickAmount)} از جیب برای شرکت ثبت شد.`,
      source: 'manual',
      settled: true,
    };

    onAddTransaction(newTx);
    setQuickAmount(0);
    setQuickDesc('');
    setShowQuickModal('none');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Building2 className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              دفتر حساب رئیس و شرکت ({settings.bossName})
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            شرکت: {settings.companyName} | روز سررسید پرداخت حقوق: {toPersianDigits(settings.salaryPaymentDay)} هر ماه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowQuickModal('out_of_pocket')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>ثبت خرید از جیب</span>
          </button>
          <button
            onClick={() => setShowQuickModal('advance')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all"
          >
            <DollarSign className="w-4 h-4" />
            <span>ثبت دریافت مساعده</span>
          </button>
          <button
            onClick={onExportSettlement}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-xs transition-all"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>صورت وضعیت تسویه</span>
          </button>
        </div>
      </div>

      {/* Main Ledger Equation Balance Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-700/80 shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            وضعیت مانده حساب نهایی شما با شرکت
          </span>
          <div
            className={`text-3xl sm:text-4xl font-black font-mono my-2 ${
              summary.bossStatus === 'creditor'
                ? 'text-emerald-400'
                : summary.bossStatus === 'debtor'
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            {formatToman(Math.abs(summary.bossNetBalance))}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-black border ${
              summary.bossStatus === 'creditor'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : summary.bossStatus === 'debtor'
                ? 'bg-rose-950 text-rose-300 border-rose-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {summary.bossStatus === 'creditor' && `شما از ${settings.bossName} طلبکارید`}
            {summary.bossStatus === 'debtor' && `شما به ${settings.bossName} بدهکارید`}
            {summary.bossStatus === 'settled' && 'حساب کاملا تسویه و صفر است'}
          </span>
        </div>

        {/* The Exact Mathematical Equation Box */}
        <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
          <div className="text-slate-400 font-bold mb-3 flex items-center justify-between">
            <span>فرمول دقیق محاسبه وضعیت شرکت:</span>
            <span className="text-[11px] text-cyan-400">
              (حقوق پایه + خریدهای جیبی) - (مساعده‌ها + واریزی‌ها)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">حقوق پایه تعلق‌گرفته:</span>
              <span className="font-bold text-white font-mono text-sm">
                +{formatToman(summary.baseSalaryAccrued)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60">
              <span className="text-emerald-300 block text-[11px] mb-1">خریدهای جیبی برای مغازه:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                +{formatToman(summary.outOfPocketExpenses)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60">
              <span className="text-rose-300 block text-[11px] mb-1">مساعده‌های دریافتی:</span>
              <span className="font-bold text-rose-400 font-mono text-sm">
                -{formatToman(summary.advancesReceived)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">واریزهای حقوق رسمی:</span>
              <span className="font-bold text-slate-300 font-mono text-sm">
                -{formatToman(summary.salaryPayouts)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table for Company Stream */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base">ریز فاکتورها و اسناد شرکت</h3>
            <p className="text-xs text-slate-400">
              تمام خریدهای تنخواه از جیب، مساعده‌ها و علی‌الحساب‌ها
            </p>
          </div>
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-300">
            {toPersianDigits(companyTransactions.length)} سند
          </span>
        </div>

        {companyTransactions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            هنوز تراکنش شرکتی ثبت نشده است. با دکمه‌های بالا یا ورودی صوتی ثبت کنید.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {companyTransactions.map((tx) => {
              const isOutOfPocket = tx.transactionType === 'company_expense_out_of_pocket';
              const isAdvance = tx.transactionType === 'boss_advance_received';

              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/20 px-2 rounded-xl transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isOutOfPocket
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {isOutOfPocket ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{tx.category}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            isOutOfPocket
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border-rose-800'
                          }`}
                        >
                          {isOutOfPocket ? 'خرید از جیب (طلبکار)' : 'مساعده (کاهش طلب)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        {tx.description}
                      </p>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {tx.jalaliDate} | پرداخت: {tx.paymentMethod === 'card_to_card' ? 'کارت به کارت' : 'نقدی'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-left">
                      <div className="text-base font-black font-mono text-white">
                        {formatToman(tx.totalAmount)}
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          isOutOfPocket ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isOutOfPocket ? '+ اضافه به طلب' : '- کسر از طلب'}
                      </span>
                    </div>

                    <button
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="حذف این سند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Add Modal */}
      {showQuickModal !== 'none' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
              {showQuickModal === 'out_of_pocket' ? (
                <>
                  <PlusCircle className="w-5 h-5 text-emerald-400" />
                  <span>ثبت خرید از جیب برای شرکت (طلب از رئیس)</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 text-rose-400" />
                  <span>ثبت دریافت مساعده از رئیس</span>
                </>
              )}
            </h3>

            <div className="space-y-4 my-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  مبلغ به تومان
                </label>
                <input
                  type="number"
                  autoFocus
                  value={quickAmount || ''}
                  onChange={(e) => setQuickAmount(Number(e.target.value))}
                  placeholder="مثلا: ۵۵۰۰۰۰"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold text-lg"
                />
                {quickAmount > 0 && (
                  <span className="text-xs text-cyan-400 mt-1 block">
                    {formatToman(quickAmount)}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  شرح قطعه یا توضیح
                </label>
                <input
                  type="text"
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  placeholder={
                    showQuickModal === 'out_of_pocket'
                      ? 'مثلا: خرید پک فیلتر و فیتینگ مغازه'
                      : 'مثلا: مساعده کارت به کارت به حساب سامان'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowQuickModal('none')}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
              >
                انصراف
              </button>
              <button
                onClick={() => handleCreateFastTransaction(showQuickModal as any)}
                disabled={!quickAmount || quickAmount <= 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
              >
                ثبت سند
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
