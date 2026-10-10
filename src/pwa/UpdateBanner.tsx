// Persian PWA update banner (presentational, no service-worker import so it
// stays unit-testable in Node). Shown when a newly deployed version is waiting.
import React from 'react';

interface UpdateBannerProps {
  visible: boolean;
  onUpdate: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ visible, onUpdate }) => {
  if (!visible) return null;
  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed bottom-20 md:bottom-6 inset-x-4 sm:inset-x-auto sm:left-6 z-50 max-w-md rounded-2xl border border-cyan-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur"
    >
      <p className="text-sm font-bold text-white">نسخه جدید آماده است</p>
      <p className="mt-1 text-xs text-slate-400">
        برای دریافت آخرین تغییرات، برنامه را به‌روزرسانی کنید.
      </p>
      <button
        type="button"
        onClick={onUpdate}
        className="mt-3 w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-extrabold text-white transition-all hover:bg-cyan-500 active:scale-95"
      >
        به‌روزرسانی
      </button>
    </div>
  );
};
