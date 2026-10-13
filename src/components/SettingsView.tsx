import React, { useEffect, useState, useRef } from 'react';
import {
  Sliders,
  Building2,
  User,
  ImagePlus,
  Trash2,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  PencilLine,
} from 'lucide-react';
import { CompanySettings } from '../types';
import { formatToman, toPersianDigits } from '../utils/formatters';
import { computeBaseSalaryAccrued } from '../domain/financialEngine';
import { useInstallPrompt } from '../pwa/install';
import { useAuth } from '../state/auth';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  onResetDemo: () => void;
  onExportBackup: () => { fileName: string; json: string };
  onImportBackup: (raw: unknown) => { ok: boolean; errors: string[] };
}

/** Parse user-typed Toman: accepts Persian/Arabic/Latin digits + separators. Returns int >= 0. */
function parseTomanInput(raw: string): number {
  if (!raw) return 0;
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let s = raw.trim();
  s = s.replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)));
  s = s.replace(/[٬،,\s]/g, '');
  // Keep only digits
  s = s.replace(/[^\d]/g, '');
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/** Format int for the input box (Latin digits with commas so editing stays easy). */
function formatInputNumber(n: number): string {
  if (!n) return '';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const MAX_LOGO_BYTES = 1_500_000; // ~1.5MB

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetDemo,
  onExportBackup,
  onImportBackup,
}) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [salaryText, setSalaryText] = useState<string>(formatInputNumber(settings.monthlyBaseSalary));
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  // A logged-in owner resets to a CLEAN account database, never demo seed.
  const { session } = useAuth();
  const isAccountReset = !!session;

  // Sync when async boot hydrates settings (initial useState would otherwise stay empty).
  useEffect(() => {
    setFormData(settings);
    setSalaryText(formatInputNumber(settings.monthlyBaseSalary));
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: CompanySettings = {
      ...formData,
      companyName: formData.companyName?.trim() || 'شرکت من',
      technicianName: (formData.technicianName ?? '').trim(),
      bossName: formData.bossName?.trim() || 'رئیس',
      bossPhone: (formData.bossPhone ?? '').trim(),
      monthlyBaseSalary: Math.max(0, Math.round(Number(formData.monthlyBaseSalary) || 0)),
    };
    setFormData(cleaned);
    setSalaryText(formatInputNumber(cleaned.monthlyBaseSalary));
    onSaveSettings(cleaned);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSalaryChange = (raw: string) => {
    setSalaryText(raw);
    const parsed = parseTomanInput(raw);
    setFormData((prev) => ({ ...prev, monthlyBaseSalary: parsed }));
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (!file.type.startsWith('image/')) {
      setLogoError('فقط فایل عکس (PNG/JPG) انتخاب کنید.');
      if (logoRef.current) logoRef.current.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('حجم لوگو باید کمتر از حدود ۱.۵ مگابایت باشد. یک عکس کوچک‌تر انتخاب کنید.');
      if (logoRef.current) logoRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        setLogoError('فایل انتخاب‌شده عکس معتبر نیست.');
        return;
      }
      setFormData((prev) => ({ ...prev, companyLogo: dataUrl }));
    };
    reader.onerror = () => setLogoError('خواندن فایل لوگو ناموفق بود.');
    reader.readAsDataURL(file);
    if (logoRef.current) logoRef.current.value = '';
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, companyLogo: '' }));
    setLogoError(null);
  };

  const handleExportBackup = () => {
    const { fileName, json } = onExportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(String(reader.result));
        if (
          !window.confirm(
            'بازگردانی پشتیبان جایگزین تمام داده‌های فعلی می‌شود. ادامه می‌دهید؟',
          )
        ) {
          return;
        }
        const result = onImportBackup(raw);
        if (result.ok) {
          setImportStatus({ ok: true, message: 'پشتیبان با موفقیت بازگردانی شد.' });
        } else {
          setImportStatus({
            ok: false,
            message: `فایل پشتیبان معتبر نیست: ${result.errors.slice(0, 3).join('؛ ')}`,
          });
        }
      } catch {
        setImportStatus({ ok: false, message: 'فایل انتخاب‌شده JSON معتبر نیست.' });
      } finally {
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
        {/* Section 0: Editable company profile (NEW) */}
        <div>
          <h3 className="text-sm font-bold text-cyan-300 mb-3 flex items-center gap-2">
            <PencilLine className="w-4 h-4" />
            ویرایش پروفایل شرکت و تکنسین (نام، لوگو، حقوق ثابت)
          </h3>

          {/* Logo picker + preview */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {formData.companyLogo ? (
                <img
                  src={formData.companyLogo}
                  alt="لوگوی شرکت"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-slate-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">
                {formData.companyName || 'نام شرکت'} | {formData.technicianName || 'نام تکنسین'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                لوگو، نام شرکت و نام تکنسین در بالای برنامه، داشبورد و صورت‌حساب‌ها نمایش داده می‌شود.
                لوگو فقط روی همین دستگاه ذخیره می‌شود.
              </p>
              {logoError && (
                <p className="text-[11px] text-rose-300 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {logoError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                <ImagePlus className="w-4 h-4" />
                <span>{formData.companyLogo ? 'تغییر لوگو' : 'انتخاب لوگو'}</span>
              </button>
              {formData.companyLogo ? (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف</span>
                </button>
              ) : null}
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFile}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نام شرکت / مغازه (قابل ویرایش)
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="مثلا: تصفیه آب زلال گستر"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                نام تکنسین (قابل ویرایش)
              </label>
              <input
                type="text"
                value={formData.technicianName ?? ''}
                onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
                placeholder="مثلا: علی محمدی"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 1: Company & Boss Info */}
        <div className="pt-4 border-t border-slate-800">
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
            <div className="md:col-span-2 p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/50">
              <label className="text-xs font-bold text-cyan-200 block mb-1.5">
                حقوق ثابت پایه ماهانه (تومان) — قابل نوشتن و تغییر
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={salaryText}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="مثلا: 24,000,000"
                className="w-full bg-slate-950 border border-cyan-700 rounded-xl p-3 text-white font-mono font-bold text-lg text-center tracking-wide"
              />
              <span className="text-xs text-cyan-300 mt-1 block text-center">
                {formatToman(formData.monthlyBaseSalary)} ({toPersianDigits(formatInputNumber(formData.monthlyBaseSalary))} تومان)
              </span>
              <p className="text-[11px] text-slate-400 mt-1 text-center">
                ارقام فارسی/عربی هم قبول است؛ جداکننده هزار خودکار است. این مبلغ در تراز شرکت لحاظ می‌شود.
              </p>
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

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                ساعت اضافه‌کار این دوره
              </label>
              <input
                type="number"
                min="0"
                value={formData.overtimeHours ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, overtimeHours: Math.max(0, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                مبلغ اضافه‌کار: {formatToman((formData.overtimeHours ?? 0) * formData.overtimeHourlyRate)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                روز کسر کار / غیبت این دوره
              </label>
              <input
                type="number"
                min="0"
                value={formData.absenceDays ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, absenceDays: Math.max(0, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                نرخ کسر هر روز غیبت (تومان)
              </label>
              <input
                type="number"
                min="0"
                value={formData.absenceDailyRate ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, absenceDailyRate: Math.max(0, Number(e.target.value)) })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-sm"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                مبلغ کسر کار: {formatToman((formData.absenceDays ?? 0) * (formData.absenceDailyRate ?? 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Calculation preview */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <span className="text-slate-400 font-bold block mb-1">
            خالص حقوق پایه منظور شده در تراز شرکت (پایه − بیمه + اضافه‌کار − کسر کار):
          </span>
          <span className="text-base font-black text-emerald-400 font-mono">
            {formatToman(computeBaseSalaryAccrued(formData))}
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
              <span>پشتیبان‌گیری کامل (دانلود JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>بازگردانی پشتیبان</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => {
                const msg = isAccountReset
                  ? 'همه داده‌های این حساب (تراکنش‌ها، مشتریان، انبار و تنظیمات) پاک و از نو شروع می‌شود. ادامه می‌دهید؟'
                  : 'آیا از بازنشانی داده‌های نمونه تصفیه آب اطمینان دارید؟';
                if (window.confirm(msg)) {
                  onResetDemo();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isAccountReset ? 'پاک‌سازی کامل داده‌های حساب' : 'بازنشانی به دیتای اولیه'}</span>
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

        {importStatus && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold ${
              importStatus.ok
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/50 border-rose-800 text-rose-300'
            }`}
          >
            {importStatus.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
        )}

        {/* PWA install */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-slate-200 font-bold block mb-1">نصب برنامه روی گوشی</span>
            <span className="text-slate-500 text-[11px] leading-relaxed block">
              {isInstalled
                ? 'برنامه نصب شده و آفلاین هم کار می‌کند.'
                : 'با نصب، آیکون AquaLedger به صفحه اصلی اضافه می‌شود و بدون اینترنت باز می‌شود.'}
            </span>
          </div>
          {isInstalled ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              نصب شده
            </span>
          ) : canInstall ? (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0"
            >
              نصب برنامه
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 shrink-0">
              از منوی مرورگر گزینه «Add to Home screen» را بزنید.
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
