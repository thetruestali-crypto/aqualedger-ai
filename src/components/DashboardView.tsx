import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Wallet,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Transaction, CompanySettings, Client, PartItem } from '../types';
import { FinancialSummary } from '../utils/financialEngine';
import type { ReminderLists } from '../domain/reminders';
import {
  formatToman,
  formatTomanCompact,
  toJalaliDate,
  getRelativeTimeString,
  toPersianDigits,
} from '../utils/formatters';

interface DashboardViewProps {
  summary: FinancialSummary;
  transactions: Transaction[];
  settings: CompanySettings;
  clients: Client[];
  reminders: ReminderLists;
  lowStock: PartItem[];
  onOpenQuickEntry: () => void;
  onNavigateTab: (tab: string) => void;
  onExportSettlement: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  transactions,
  settings,
  clients,
  reminders,
  lowStock,
  onOpenQuickEntry,
  onNavigateTab,
  onExportSettlement,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'company' | 'field'>('all');

  // Filtered transactions
  const displayedTransactions = transactions.filter((t) => {
    if (filterType === 'all') return true;
    return t.streamType === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Top Welcome and Status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
            <span>داشبورد مالی و تراز تکنسین</span>
            <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
              امروز: {toJalaliDate()}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            شرکت: <span className="text-cyan-400 font-bold">{settings.companyName}</span> | طرف حساب
            شرکتی: <span className="text-cyan-400 font-bold">{settings.bossName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenQuickEntry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>ثبت هوشمند تراکنش</span>
          </button>
          <button
            onClick={onExportSettlement}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium text-xs sm:text-sm transition-all"
            title="صدور صورت وضعیت جهت ارسال در پیام‌رسان‌ها به رئیس یا مشتری"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>صورتحساب تسویه</span>
          </button>
        </div>
      </div>

      {/* 3 Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Boss Balance (Status with Boss) */}
        <div
          onClick={() => onNavigateTab('company')}
          className={`cursor-pointer rounded-2xl p-5 border relative overflow-hidden transition-all hover:scale-[1.01] shadow-xl ${
            summary.bossStatus === 'creditor'
              ? 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border-emerald-700/60 shadow-emerald-950/30'
              : summary.bossStatus === 'debtor'
              ? 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-950 border-rose-700/60 shadow-rose-950/30'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700 shadow-slate-950/30'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-400" />
              وضعیت با رئیس و شرکت
            </span>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                summary.bossStatus === 'creditor'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : summary.bossStatus === 'debtor'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {summary.bossStatus === 'creditor' && 'شما طلبکارید'}
              {summary.bossStatus === 'debtor' && 'شما بدهکارید'}
              {summary.bossStatus === 'settled' && 'تسویه کامل'}
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {formatToman(Math.abs(summary.bossNetBalance))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary.bossStatus === 'creditor'
                ? `مبلغی که شرکت (${settings.bossName}) باید به شما بپردازد`
                : summary.bossStatus === 'debtor'
                ? 'مساعده مازاد دریافتی که باید در فیش آینده مستهلک شود'
                : 'حساب جاری با رئیس کاملاً صفر است'}
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>خریدهای جیبی: {formatTomanCompact(summary.outOfPocketExpenses)}</span>
            <span className="text-cyan-400 font-semibold flex items-center gap-1">
              جزئیات دفتر <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Total Personal Net Income (Salary + Field Profits) */}
        <div
          onClick={() => onNavigateTab('dashboard')}
          className="rounded-2xl p-5 bg-gradient-to-br from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-700/50 shadow-xl shadow-cyan-950/20 relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-cyan-400" />
              درآمد خالص شخصی ماه جاری
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              حقوق + سود خدمات
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {formatToman(summary.totalPersonalNetIncome)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              مجموع ارزش ایجاد شده برای زندگی شخصی در این ماه
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>حقوق پایه: {formatTomanCompact(summary.baseSalaryAccrued)}</span>
            <span className="text-emerald-400 font-semibold">
              سود میدانی: {formatTomanCompact(summary.fieldNetProfit)}
            </span>
          </div>
        </div>

        {/* Card 3: Outstanding Receivables from Clients */}
        <div
          onClick={() => onNavigateTab('clients')}
          className="cursor-pointer rounded-2xl p-5 bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-950 border border-amber-700/50 shadow-xl shadow-amber-950/20 relative overflow-hidden transition-all hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-400" />
              مطالبات وصول‌نشده مشتریان
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              نسیه و طلب بازار
            </span>
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono tracking-tight">
              {formatToman(summary.clientsTotalDebt)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              مبلغ باقی‌مانده فاکتورهای نصب و تعویض فیلتر مشتریان
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>دریافتی نقد: {formatTomanCompact(summary.fieldCashCollected)}</span>
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              لیست مشتریان <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Reminder Alerts for Water Filter Replacement (FR-09) */}
      {reminders.overdue.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-rose-200">
                موعد سرویس گذشته ({toPersianDigits(reminders.overdue.length)} مشتری)
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">
                {reminders.overdue
                  .slice(0, 3)
                  .map((r) => r.client.name)
                  .join('، ')}
                {reminders.overdue.length > 3 && ' و دیگران'} — تماس برای هماهنگی سرویس!
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('clients')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs whitespace-nowrap transition-colors"
          >
            مشاهده مشتریان
          </button>
        </div>
      )}
      {reminders.dueSoon.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-200">
                یادآور دوره‌ای: سرویس نزدیک است ({toPersianDigits(reminders.dueSoon.length)} مشتری)
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {reminders.dueSoon
                  .slice(0, 3)
                  .map((r) => r.client.name)
                  .join('، ')}
                {reminders.dueSoon.length > 3 && ' و دیگران'} — موعد تعویض فیلتر نزدیک است.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('clients')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs whitespace-nowrap transition-colors"
          >
            مشاهده مشتریان
          </button>
        </div>
      )}

      {/* Low-stock alert (FR-07) */}
      {lowStock.length > 0 && (
        <div className="p-4 rounded-2xl bg-violet-950/30 border border-violet-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400 shrink-0">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-violet-200">
                هشدار موجودی انبار ({toPersianDigits(lowStock.length)} قلم)
              </h4>
              <p className="text-xs text-violet-300/80 mt-0.5">
                {lowStock
                  .slice(0, 3)
                  .map((p) => `${p.name} (${toPersianDigits(p.stock)} ${p.unit})`)
                  .join('، ')}
                {lowStock.length > 3 && ' و دیگران'} — زمان شارژ انبار است.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('inventory')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs whitespace-nowrap transition-colors"
          >
            مشاهده انبار
          </button>
        </div>
      )}

      {/* Two Streams Comparison Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stream 1: Company (صبح تا ظهر) */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">
                  جریان شرکتی (مدیریت خدمات - صبح‌ها)
                </h3>
                <p className="text-[11px] text-slate-400">حقوق ثابت + تنخواه و خریدهای جیبی مغازه</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('company')}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              دفتر حساب <ChevronLeft className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-slate-300">حقوق پایه قرارداد (پس از کسر بیمه)</span>
              <span className="font-bold text-white font-mono">
                {formatToman(summary.baseSalaryAccrued)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-emerald-300">خریدهای شخصی از جیب برای شرکت (طلب شما)</span>
              <span className="font-bold text-emerald-400 font-mono">
                +{formatToman(summary.outOfPocketExpenses)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-rose-300">مساعده‌ها و دریافتی‌ها از رئیس</span>
              <span className="font-bold text-rose-400 font-mono">
                -{formatToman(summary.advancesReceived)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs font-bold">
              <span className="text-cyan-200">مانده تراز با رئیس ({settings.bossName})</span>
              <span className="font-mono text-cyan-300 text-sm">
                {summary.bossNetBalance >= 0 ? '+' : '-'}
                {formatToman(Math.abs(summary.bossNetBalance))}
              </span>
            </div>
          </div>
        </div>

        {/* Stream 2: Field (عصرها و تعطیلات) */}
        <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">
                  جریان میدانی (سرویس‌کاری آزاد - عصرها)
                </h3>
                <p className="text-[11px] text-slate-400">نصب، تعویض فیلتر، فروش قطعه و پورسانت</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('clients')}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              مشتریان <ChevronLeft className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-slate-300">ارزش کل خدمات و فاکتورها</span>
              <span className="font-bold text-white font-mono">
                {formatToman(summary.fieldTotalVolume)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-slate-400">هزینه خرید قطعات از جیب (قیمت خرید همکار)</span>
              <span className="font-bold text-slate-400 font-mono">
                -{formatToman(summary.fieldPartsCost)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-amber-300">مطالبات وصول‌نشده (نسیه مشتریان)</span>
              <span className="font-bold text-amber-400 font-mono">
                {formatToman(summary.clientsTotalDebt)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs font-bold">
              <span className="text-emerald-200">سود خالص جیب تکنسین از خدمات میدانی</span>
              <span className="font-mono text-emerald-300 text-sm">
                +{formatToman(summary.fieldNetProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions List with Filter */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base">گردش حساب و آخرین تراکنش‌ها</h3>
            <p className="text-xs text-slate-400">
              نمایش اسناد ثبت شده به صورت خودکار با تفکیک شرکتی و میدانی
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                filterType === 'all'
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              همه ({toPersianDigits(transactions.length)})
            </button>
            <button
              onClick={() => setFilterType('company')}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                filterType === 'company'
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              شرکت و رئیس
            </button>
            <button
              onClick={() => setFilterType('field')}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                filterType === 'field'
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              مشتریان میدانی
            </button>
          </div>
        </div>

        {displayedTransactions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            هیچ تراکنشی در این دسته‌بندی یافت نشد.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {displayedTransactions.map((tx) => {
              const isCompany = tx.streamType === 'company';
              const isOutOfPocket = tx.transactionType === 'company_expense_out_of_pocket';
              const isAdvance = tx.transactionType === 'boss_advance_received';

              return (
                <div
                  key={tx.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isCompany
                          ? isOutOfPocket
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {isCompany ? (
                        isOutOfPocket ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{tx.party.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                            isCompany
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {tx.category || (isCompany ? 'شرکت' : 'مشتری')}
                        </span>
                        {tx.source === 'ai_voice' && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                            ورودی صوتی
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                        {tx.conversationalSummary || tx.description}
                      </p>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        {getRelativeTimeString(tx.date)} | {tx.jalaliDate}
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-left self-end sm:self-center shrink-0">
                    <div className="text-sm font-black font-mono text-white">
                      {formatToman(tx.totalAmount)}
                    </div>
                    {isCompany ? (
                      <span
                        className={`text-[11px] font-bold ${
                          isOutOfPocket ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isOutOfPocket ? '+ طلب از رئیس' : '- کسر از طلب'}
                      </span>
                    ) : tx.remainingDebt > 0 ? (
                      <span className="text-[11px] text-amber-400 font-bold">
                        مانده طلب: {formatToman(tx.remainingDebt)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400">تسویه کامل</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
