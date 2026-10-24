// Confirmation dialog for AI tool calls that require user approval (money/inventory mutations).
import React, { useCallback } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { executeAiTool } from '../lib/aiTools';

interface AiToolConfirmDialogProps {
  open: boolean;
  toolCall: { name: string; arguments: Record<string, unknown> };
  summary: string;
  context?: { bossName?: string; companyName?: string; typicalAmount?: number };
  storeSnapshot?: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (result: unknown) => void;
}

export function AiToolConfirmDialog({
  open,
  toolCall,
  summary,
  context,
  storeSnapshot,
  onClose,
  onSuccess,
}: AiToolConfirmDialogProps): React.ReactElement | null {
  const handleConfirm = useCallback(async () => {
    const result = await executeAiTool(toolCall, true, context, storeSnapshot);
    if (result.status === 'ok') {
      onSuccess(result);
    }
    onClose();
  }, [toolCall, context, storeSnapshot, onSuccess, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-lg">تایید عملیات</h3>
            <p className="text-slate-400 text-sm mt-1">
              قبل از ثبت نهایی، لطفاً مشخصات را بررسی کنید.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-6">
          <p className="text-slate-200 text-sm leading-relaxed">{summary}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-all"
          >
            لغو
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            تایید و ثبت
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
          aria-label="بستن"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
