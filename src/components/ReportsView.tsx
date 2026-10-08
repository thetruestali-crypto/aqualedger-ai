// Reports & P&L (FR-11): daily/weekly/monthly cash flow, part-profit vs labor
// split (FR-08), and net. All math in domain/reports; this view only renders.
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Wrench,
  Package,
  Wallet,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { Transaction } from '../types';
import { buildReport, REPORT_PERIODS, type ReportPeriod } from '../domain/reports';
import { formatToman, formatTomanCompact, toPersianDigits } from '../utils/formatters';

interface ReportsViewProps {
  transactions: Transaction[];
}

const AXIS_TICK = { fill: '#94a3b8', fontSize: 11 };

export const ReportsView: React.FC<ReportsViewProps> = ({ transactions }) => {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const count = REPORT_PERIODS.find((p) => p.id === period)?.count ?? 6;
  const report = useMemo(
    () => buildReport(transactions, period, new Date().toISOString(), count),
    [transactions, period, count],
  );

  const cashData = report.buckets.map((b) => ({
    name: b.label,
    ورودی_شرکت: b.companyIn,
    ورودی_میدانی: b.fieldIn,
    خروجی‌ها: b.companyOut + b.partsCost + b.toolExpense,
    خالص: b.net,
  }));
  const splitData = report.buckets.map((b) => ({
    name: b.label,
    سود_قطعه: b.partProfit,
    اجرت: b.labor,
  }));

  const kpis = [
    { label: 'درآمد میدانی (وصول‌شده)', value: report.fieldIn, cls: 'text-emerald-300', icon: Wallet },
    { label: 'سود قطعه', value: report.partProfit, cls: 'text-cyan-300', icon: Package },
    { label: 'اجرت و دستمزد', value: report.labor, cls: 'text-violet-300', icon: Wrench },
    { label: 'خالص دوره', value: report.net, cls: report.net >= 0 ? 'text-emerald-300' : 'text-rose-300', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header + period switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">گزارش سود و زیان</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            خالص = (ورودی شرکت + ورودی میدانی) − (خرید جیبی + هزینه قطعه + ابزار)
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p.id ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {p.id === 'day' ? 'روزانه' : p.id === 'week' ? 'هفتگی' : 'ماهانه'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {k.label}
              </span>
              <div className={`text-lg sm:text-xl font-black font-mono mt-1 ${k.cls}`}>
                {formatToman(k.value)}
              </div>
            </div>
          );
        })}
      </div>

      {report.txCount === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm bg-slate-900/60 rounded-2xl border border-slate-800">
          در این بازه تراکنشی ثبت نشده است.
        </div>
      ) : (
        <>
          {/* Cash-flow chart */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
            <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              جریان نقدی دوره
            </h3>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={AXIS_TICK} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => formatTomanCompact(v)} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => [formatToman(Number(v)), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ورودی_شرکت" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ورودی_میدانی" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="خروجی‌ها" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="خالص" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Part profit vs labor */}
          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
            <h3 className="font-bold text-white text-sm mb-1">تفکیک سود قطعه از اجرت</h3>
            <div className="h-52" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={splitData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={AXIS_TICK} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => formatTomanCompact(v)} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => [formatToman(Number(v)), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="سود_قطعه" stackId="a" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="اجرت" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bucket table */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">دوره</th>
                    <th className="py-2.5 px-3">ورودی میدانی</th>
                    <th className="py-2.5 px-3">سود قطعه</th>
                    <th className="py-2.5 px-3">اجرت</th>
                    <th className="py-2.5 px-3">خالص</th>
                    <th className="py-2.5 px-3">اسناد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {report.buckets.map((b) => (
                    <tr key={b.key} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{b.label}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-300">{formatTomanCompact(b.fieldIn)}</td>
                      <td className="py-2.5 px-3 font-mono text-cyan-300">{formatTomanCompact(b.partProfit)}</td>
                      <td className="py-2.5 px-3 font-mono text-violet-300">{formatTomanCompact(b.labor)}</td>
                      <td className={`py-2.5 px-3 font-mono font-bold ${b.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {formatTomanCompact(b.net)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{toPersianDigits(b.txCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
