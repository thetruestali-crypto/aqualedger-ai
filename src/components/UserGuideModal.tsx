import React from 'react';
import { HelpCircle, X, CheckCircle2, Droplets, Mic, Building2, Users, Wrench } from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto text-slate-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Droplets className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base text-white">راهنمای هوشمند کار با AquaLedger AI</h3>
              <p className="text-xs text-slate-400">
                قوانین محاسباتی و نحوه استفاده از گفتار عامیانه تکنسین
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

        <div className="space-y-4 text-xs sm:text-sm leading-relaxed">
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
            <h4 className="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
              <Mic className="w-4 h-4" />
              نحوه صحبت با دستیار (ورودی صوتی و متنی)
            </h4>
            <p className="text-slate-300">
              نیازی به نوشتن حسابداری سنتی نیست! بعد از اتمام هر سرویس یا خرید، دکمه میکروفن را بزنید و عامیانه تعریف کنید. هوش مصنوعی جمینای تمام اعداد (تومان، هزار تومن، میلیون) و نوع عملیات را اتوماتیک تبدیل و تفکیک می‌کند.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <h5 className="font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                قوانین شرکت و رئیس
              </h5>
              <ul className="space-y-1 text-slate-300 text-xs">
                <li>• <strong>«از جیب دادم برای شرکت»</strong>: به حساب طلبکاری شما از رئیس اضافه می‌شود.</li>
                <li>• <strong>«از رئیس گرفتم»</strong> یا <strong>«مساعده گرفتم»</strong>: از طلب شما کسر یا بدهکار می‌شوید.</li>
                <li>• <strong>حقوق ماهانه</strong>: بر اساس روز پرداخت در قرارداد تجمیع می‌شود.</li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <h5 className="font-bold text-cyan-400 mb-1.5 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                قوانین مشتریان میدانی
              </h5>
              <ul className="space-y-1 text-slate-300 text-xs">
                <li>• <strong>«مشتری نقد یا کارت زد»</strong>: درآمد نقد جیب شما ثبت می‌شود.</li>
                <li>• <strong>«پولش موند بعدا بده»</strong>: ثبت به عنوان «طلب از مشتری».</li>
                <li>• <strong>«خرید قطعه برای مشتری»</strong>: محاسبه خودکار حاشیه سود (فروش منهای خرید).</li>
              </ul>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h5 className="font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              اصطلاحات تخصصی شناخته شده توسط سیستم:
            </h5>
            <p className="text-xs text-slate-300 leading-relaxed">
              پک فیلتر ۱۲۳، ممبران ۵۰ و ۷۵ گالن، فیلتر الیافی و کربن، پست کربن، مینرال، سوئیچ هایپرشر (فشار بالا)، سوئیچ لوپرشر (فشار پایین)، شیر برقی، چهارراهی، پمپ ۲۴ ولت و کلگی، گیج روغنی، شیر برداشت اهرمی، مخزن تحت فشار، هوزینگ، شلنگ و فیتینگ، تست TDS، ایاب و ذهاب.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h5 className="font-bold text-blue-400 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              یادآور ۶ ماهه تعویض فیلتر
            </h5>
            <p className="text-xs text-slate-300">
              هر سرویسی که برای مشتری ثبت می‌کنید، به صورت هوشمند تاریخ سرویس بعدی (۶ ماه برای فیلترهای اولیه یا ۲۴ ماه برای ممبران) را مشخص کرده و در بخش مشتریان هشدار موعد تعویض را نمایش می‌دهد.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
