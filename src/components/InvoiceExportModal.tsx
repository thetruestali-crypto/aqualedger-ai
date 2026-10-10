import React, { useState } from 'react';
import {
  FileText,
  X,
  Copy,
  Check,
  Share2,
  Building2,
  Users,
  Send,
} from 'lucide-react';
import { Transaction, CompanySettings, Client } from '../types';
import { FinancialSummary } from '../utils/financialEngine';
import { formatToman, formatTomanCompact, toJalaliDate, toPersianDigits } from '../utils/formatters';

interface InvoiceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: FinancialSummary;
  settings: CompanySettings;
  transactions: Transaction[];
  clients: Client[];
}

export const InvoiceExportModal: React.FC<InvoiceExportModalProps> = ({
  isOpen,
  onClose,
  summary,
  settings,
  transactions,
  clients,
}) => {
  const [activeTab, setActiveTab] = useState<'boss' | 'client'>('boss');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate boss statement text
  const companyTransactions = transactions.filter((t) => t.streamType === 'company');
  const outOfPocketList = companyTransactions.filter(
    (t) => t.transactionType === 'company_expense_out_of_pocket'
  );
  const advanceList = companyTransactions.filter(
    (t) => t.transactionType === 'boss_advance_received'
  );

  const generateBossReportText = () => {
    let text = `📄 صورت وضعیت و تراز تسویه حساب با شرکت\n`;
    text += `🏢 شرکت: ${settings.companyName}\n`;
    text += `👤 طرف حساب: ${settings.bossName} (${settings.companyName})\n`;
    if (settings.technicianName) {
      text += `🧑‍🔧 تکنسین: ${settings.technicianName}\n`;
    }
    text += `📅 تاریخ گزارش: ${toJalaliDate()}\n`;
    text += `───────────────────────\n`;
    text += `🔹 حقوق پایه تعلق‌گرفته: ${formatToman(summary.baseSalaryAccrued)}\n\n`;

    text += `🛒 خریدهای تنخواه از جیب برای شرکت:\n`;
    if (outOfPocketList.length === 0) {
      text += `(موردی ثبت نشده)\n`;
    } else {
      outOfPocketList.forEach((t, i) => {
        text += `${toPersianDigits(i + 1)}. ${t.description || t.category}: ${formatToman(t.totalAmount)} (${t.jalaliDate})\n`;
      });
      text += `جمع خریدهای جیبی: ${formatToman(summary.outOfPocketExpenses)}\n\n`;
    }

    text += `💵 مساعده‌ها و دریافتی‌ها از رئیس:\n`;
    if (advanceList.length === 0) {
      text += `(موردی دریافت نشده)\n`;
    } else {
      advanceList.forEach((t, i) => {
        text += `${toPersianDigits(i + 1)}. ${t.description || t.category}: ${formatToman(t.totalAmount)} (${t.jalaliDate})\n`;
      });
      text += `جمع کل دریافتی‌ها: ${formatToman(summary.advancesReceived)}\n\n`;
    }

    text += `───────────────────────\n`;
    text += `📊 وضعیت نهایی مانده حساب:\n`;
    if (summary.bossNetBalance > 0) {
      text += `✅ مبلغ قابل پرداخت به تکنسین (طلبکار): ${formatToman(summary.bossNetBalance)}\n`;
    } else if (summary.bossNetBalance < 0) {
      text += `⚠️ بدهی تکنسین به شرکت: ${formatToman(Math.abs(summary.bossNetBalance))}\n`;
    } else {
      text += `✅ حساب جاری کاملاً تسویه است (مانده صفر).\n`;
    }

    text += `\nارسال شده از سامانه حسابداری تکنسین تصفیه آب (AquaLedger AI)`;
    return text;
  };

  // Generate client invoice text
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];
  const clientTransactions = transactions.filter(
    (t) =>
      t.streamType === 'field' &&
      (t.party.name.includes(selectedClient?.name || '') ||
        selectedClient?.name.includes(t.party.name))
  );

  const generateClientInvoiceText = () => {
    if (!selectedClient) return '';
    let text = `🧾 فاکتور خدمات و سرویس تصفیه آب\n`;
    text += `🏢 ${settings.companyName}\n`;
    if (settings.technicianName) {
      text += `🧑‍🔧 تکنسین: ${settings.technicianName}\n`;
    }
    text += `👤 مشترک گرامی: ${selectedClient.name}\n`;
    text += `📍 آدرس: ${selectedClient.address || '-'}\n`;
    text += `⚙️ دستگاه: ${selectedClient.deviceModel}\n`;
    text += `📅 تاریخ فاکتور: ${toJalaliDate()}\n`;
    text += `───────────────────────\n`;

    if (clientTransactions.length === 0) {
      text += `شرح خدمات: سرویس دوره‌ای و تعویض فیلتر\n`;
    } else {
      text += `خدمات ثبت شده:\n`;
      clientTransactions.forEach((t, i) => {
        text += `${toPersianDigits(i + 1)}. ${t.description}: ${formatToman(t.totalAmount)}\n`;
      });
    }

    text += `───────────────────────\n`;
    text += `💰 مانده بدهی نسیه: ${formatToman(selectedClient.totalDebt)}\n`;
    text += `🔔 یادآوری سرویس بعدی: ۶ ماه آینده (جهت تعویض به موقع فیلترهای ۱ و ۲ و ۳ و حفظ سلامت ممبران)\n`;
    text += `با تشکر از اعتماد شما - خدمات فنی تصفیه آب`;
    return text;
  };

  const currentText = activeTab === 'boss' ? generateBossReportText() : generateClientInvoiceText();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base text-white">صدور صورت وضعیت و فاکتور تسویه</h3>
              <p className="text-xs text-slate-400">
                فرمت آماده جهت ارسال در واتساپ، ایتا، بله، تلگرام یا پیامک
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 mb-4 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('boss')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'boss'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>صورت وضعیت شرکت و رئیس ({settings.bossName})</span>
          </button>
          <button
            onClick={() => setActiveTab('client')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'client'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>فاکتور سرویس برای مشتری</span>
          </button>
        </div>

        {/* Client selector if on client tab */}
        {activeTab === 'client' && (
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">انتخاب مشتری:</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - بدهی: {formatTomanCompact(c.totalDebt)} ({c.deviceModel})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
          {currentText}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 mt-4">
          <span className="text-xs text-slate-400">
            {copied ? '✅ متن کپی شد!' : 'برای ارسال مستقیم روی کپی کلیک کنید.'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
            >
              بستن
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'کپی شد' : 'کپی متن صورتحساب'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
