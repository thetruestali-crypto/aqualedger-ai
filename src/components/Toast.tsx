// Persian toast stack (success/error/info). Auto-dismiss handled by the caller.
import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

export const ToastStack: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(92vw,420px)]">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold shadow-2xl text-right ${
            t.kind === 'success'
              ? 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
              : t.kind === 'error'
                ? 'bg-rose-950/95 border-rose-700 text-rose-200'
                : 'bg-slate-900/95 border-slate-700 text-slate-200'
          }`}
        >
          {t.kind === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : t.kind === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <Info className="w-5 h-5 shrink-0" />
          )}
          <span className="flex-1">{t.text}</span>
        </button>
      ))}
    </div>
  );
};
