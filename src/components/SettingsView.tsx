import React, { useState } from 'react';
import {
  Sliders,
  Building2,
  Calendar,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  DollarSign,
  Shield,
} from 'lucide-react';
import { CompanySettings } from '../types';
import { formatToman, toPersianDigits } from '../utils/formatters';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  onResetDemo: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetDemo,
}) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const data = {
      settings: formData,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AquaLedger_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
            <Sliders className="w-6 h-6" />
          </span>
          <div>
            <h2 className="text-lg font-black text-white">
              تنظیمات موتور حقوق، قرارداد و شرکت
            </h2>
            <p className="text-xs text-slate-400">
              پیکربندی ارقام قرارداد صبح‌ها با شرکت و رئیس جهت محاسبه خودکار تراز جاری
            </p>
          </div>
        </div>

        {savedSuccess && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            تنظیمات با موفقیت ذخیره شد
          </span>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
        {/* Section 1: Company & Boss Info */}
        <div>
          <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            اطلاعات شرکت و مدیریت خدمات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نام شرکت / مغازه
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نام رئیس / مدیر فنی
              </label>
              <input
                type="text"
                value={formData.bossName}
                onChange={(e) => setFormData({ ...formData, bossName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                شماره تماس رئیس (جهت ارسال پیامک/واتساپ)
              </label>
              <input
                type="tel"
                value={formData.bossPhone}
                onChange={(e) => setFormData({ ...formData, bossPhone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Salary Engine */}
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            فرمول حقوق ثابت، موعد و کسورات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                حقوق ثابت پایه ماهانه (تومان)
              </label>
              <input
                type="number"
                value={formData.monthlyBaseSalary}
                onChange={(e) =>
                  setFormData({ ...formData, monthlyBaseSalary: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold text-base"
              />
              <span className="text-xs text-cyan-400 mt-1 block">
                {formatToman(formData.monthlyBaseSalary)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                روز پرداخت حقوق (چندم ماه شمسی)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.salaryPaymentDay}
                onChange={(e) =>
                  setFormData({ ...formData, salaryPaymentDay: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold text-base"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                سررسید دریافت حقوق: {toPersianDigits(formData.salaryPaymentDay)} هر ماه
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                کسورات ماهانه بیمه یا بازنشستگی (تومان)
              </label>
              <input
                type="number"
                value={formData.insuranceDeduction}
                onChange={(e) =>
                  setFormData({ ...formData, insuranceDeduction: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                کسر از پایه: {formatToman(formData.insuranceDeduction)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نرخ هر ساعت اضافه کاری (تومان)
              </label>
              <input
                type="number"
                value={formData.overtimeHourlyRate}
                onChange={(e) =>
                  setFormData({ ...formData, overtimeHourlyRate: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                نرخ اضافه کار: {formatToman(formData.overtimeHourlyRate)} در ساعت
              </span>
            </div>
          </div>
        </div>

        {/* Calculation preview */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <span className="text-slate-400 font-bold block mb-1">
            خالص حقوق پایه منظور شده در تراز شرکت:
          </span>
          <span className="text-base font-black text-emerald-400 font-mono">
            {formatToman(formData.monthlyBaseSalary - formData.insuranceDeduction)}
          </span>
          <p className="text-slate-500 text-[11px] mt-1">
            این مبلغ به همراه تمام خریدهای جیبی شما در دفتر حساب به عنوان طلب از شرکت ثبت می‌شود.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>پشتیبان‌گیری (دانلود JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('آیا از بازنشانی داده‌های نمونه تصفیه آب اطمینان دارید؟')) {
                  onResetDemo();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              <span>بازنشانی به دیتای اولیه</span>
            </button>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-600/30 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تغییرات قرارداد</span>
          </button>
        </div>
      </form>
    </div>
  );
};
