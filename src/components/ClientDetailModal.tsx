// Client پرونده: profile edit, per-invoice debt/settle cards (FR-05),
// breakdown history + parts used (FR-06).
import React, { useState } from 'react';
import {
  X,
  Phone,
  MapPin,
  Wrench,
  CheckCircle2,
  DollarSign,
  FileText,
  Package,
  Save,
} from 'lucide-react';
import type { Client, Transaction, ServiceLog } from '../types';
import {
  formatToman,
  formatTomanCompact,
  toJalaliDate,
  toPersianDigits,
} from '../utils/formatters';

interface ClientDetailModalProps {
  client: Client;
  invoices: Transaction[];
  history: Transaction[];
  serviceLogs: ServiceLog[];
  onClose: () => void;
  onUpdateClient: (client: Client) => void;
  onSettleInvoice: (txId: string, amount: number) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  invoices,
  history,
  serviceLogs,
  onClose,
  onUpdateClient,
  onSettleInvoice,
}) => {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(client.phone);
  const [address, setAddress] = useState(client.address);
  const [deviceModel, setDeviceModel] = useState(client.deviceModel);
  const [notes, setNotes] = useState(client.notes ?? '');
  const [settleAmounts, setSettleAmounts] = useState<Record<string, number>>({});

  const handleSaveProfile = () => {
    onUpdateClient({ ...client, phone: phone.trim(), address: address.trim(), deviceModel, notes });
    setEditing(false);
  };

  const handleSettle = (tx: Transaction) => {
    const amount = settleAmounts[tx.id] ?? tx.remainingDebt;
    if (!amount || amount <= 0) return;
    onSettleInvoice(tx.id, Math.min(amount, tx.remainingDebt));
    setSettleAmounts((prev) => ({ ...prev, [tx.id]: 0 }));
  };

  // Parts used: from service logs first, plus transaction items as fallback.
  const partsUsed = new Map<string, { qty: number; spent: number }>();
  for (const log of serviceLogs) {
    for (const item of log.items) {
      const cur = partsUsed.get(item.name) ?? { qty: 0, spent: 0 };
      partsUsed.set(item.name, {
        qty: cur.qty + item.qty,
        spent: cur.spent + item.sellPrice * item.qty,
      });
    }
  }
  if (partsUsed.size === 0) {
    for (const tx of history) {
      for (const item of tx.items ?? []) {
        const cur = partsUsed.get(item.itemName) ?? { qty: 0, spent: 0 };
        partsUsed.set(item.itemName, {
          qty: cur.qty + (item.quantity ?? 1),
          spent: cur.spent + (item.sellPrice ?? 0) * (item.quantity ?? 1),
        });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur p-4 border-b border-slate-800 flex items-start justify-between gap-2">
          <div>
            <h3 className="font-black text-base text-white">{client.name}</h3>
            <span className="text-xs text-cyan-400 flex items-center gap-1 mt-0.5">
              <Wrench className="w-3.5 h-3.5" />
              {client.deviceModel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {client.totalDebt > 0 ? (
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                بدهکار: {formatTomanCompact(client.totalDebt)}
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                تسویه کامل
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Profile / contact */}
          <section className="bg-slate-950/60 rounded-xl border border-slate-800 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">پرونده و تماس</span>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-cyan-400 hover:underline font-bold"
                >
                  ویرایش
                </button>
              ) : (
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-cyan-600 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  ذخیره
                </button>
              )}
            </div>
            {!editing ? (
              <div className="space-y-1.5 text-xs text-slate-300">
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <a href={`tel:${client.phone}`} className="text-cyan-400 font-mono">
                      {client.phone}
                    </a>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="text-slate-400">{client.address}</span>
                  </div>
                )}
                {client.notes && <p className="text-[11px] text-slate-400">یادداشت: {client.notes}</p>}
                <p className="text-[11px] text-slate-500">
                  آخرین سرویس: {toJalaliDate(client.lastServiceDate)} | سررسید بعدی:{' '}
                  {toJalaliDate(client.nextServiceDueDate)}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="شماره تماس"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono"
                />
                <input
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="مدل دستگاه"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="آدرس"
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white resize-none"
                />
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="یادداشت فنی"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white"
                />
              </div>
            )}
          </section>

          {/* Open invoices */}
          <section>
            <span className="text-xs font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              فاکتورهای باز ({toPersianDigits(invoices.length)})
            </span>
            {invoices.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                فاکتور تسویه‌نشده‌ای نیست.
              </p>
            ) : (
              <div className="space-y-2.5">
                {invoices.map((tx) => {
                  const progress =
                    tx.totalAmount > 0 ? Math.round((tx.paidAmount / tx.totalAmount) * 100) : 100;
                  return (
                    <div
                      key={tx.id}
                      className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-white">{tx.category}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {toJalaliDate(tx.date)} | کل: {formatTomanCompact(tx.totalAmount)} |
                            پرداخت‌شده: {formatTomanCompact(tx.paidAmount)}
                          </p>
                        </div>
                        <span className="text-xs font-black text-amber-300 font-mono shrink-0">
                          مانده: {formatToman(tx.remainingDebt)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-emerald-400"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min={0}
                          max={tx.remainingDebt}
                          value={settleAmounts[tx.id] ?? tx.remainingDebt}
                          onChange={(e) =>
                            setSettleAmounts((prev) => ({ ...prev, [tx.id]: Number(e.target.value) }))
                          }
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                          placeholder="مبلغ تسویه جزئی"
                        />
                        <button
                          onClick={() => handleSettle(tx)}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          تسویه
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Parts used */}
          {partsUsed.size > 0 && (
            <section>
              <span className="text-xs font-bold text-slate-300 block mb-2 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-cyan-400" />
                قطعات مصرف‌شده ({toPersianDigits(partsUsed.size)} قلم)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[...partsUsed.entries()].map(([name, v]) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-200 border border-slate-700"
                  >
                    <span>{name}</span>
                    <span className="text-cyan-400 font-bold">×{toPersianDigits(v.qty)}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* History */}
          <section>
            <span className="text-xs font-bold text-slate-300 block mb-2">
              تاریخچه خرابی‌ها و سرویس‌ها ({toPersianDigits(history.length)})
            </span>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">تاریخچه‌ای ثبت نشده است.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {history.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="text-slate-200 font-bold">{tx.category}</p>
                      <p className="text-[11px] text-slate-500">{toJalaliDate(tx.date)}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-mono font-bold text-white">{formatTomanCompact(tx.totalAmount)}</p>
                      {tx.remainingDebt > 0 ? (
                        <p className="text-[11px] text-amber-400 font-bold">
                          مانده {formatTomanCompact(tx.remainingDebt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-400">تسویه شده</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
