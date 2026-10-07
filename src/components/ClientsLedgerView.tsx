import React, { useState } from 'react';
import {
  Users,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Wrench,
  Clock,
  DollarSign,
  ChevronLeft,
} from 'lucide-react';
import { Client, Transaction } from '../types';
import {
  formatToman,
  formatTomanCompact,
  toJalaliDate,
  toPersianDigits,
  getDaysAgo,
} from '../utils/formatters';

interface ClientsLedgerViewProps {
  clients: Client[];
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onSettleDebt: (clientId: string, amount: number) => void;
}

export const ClientsLedgerView: React.FC<ClientsLedgerViewProps> = ({
  clients,
  onAddClient,
  onUpdateClient,
  onSettleDebt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'debtors' | 'due_service'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClientForSettlement, setSelectedClientForSettlement] = useState<Client | null>(
    null
  );
  const [settleAmount, setSettleAmount] = useState<number>(0);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientDevice, setNewClientDevice] = useState('دستگاه ۶ مرحله‌ای خانگی');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Filtering
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'debtors') {
      return c.totalDebt > 0;
    }
    if (filterMode === 'due_service') {
      const days = getDaysAgo(c.lastServiceDate);
      return days >= 150; // 5 months or more
    }
    return true;
  });

  const totalClientsDebt = clients.reduce((acc, c) => acc + (c.totalDebt || 0), 0);

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const newClient: Client = {
      id: `client-${Date.now()}`,
      name: newClientName.trim(),
      phone: newClientPhone.trim(),
      address: newClientAddress.trim(),
      deviceModel: newClientDevice,
      totalPaid: 0,
      totalDebt: 0,
      lastServiceDate: new Date().toISOString(),
      nextServiceDueDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
      notes: newClientNotes,
    };

    onAddClient(newClient);
    setShowAddModal(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
    setNewClientNotes('');
  };

  const handleConfirmSettle = () => {
    if (!selectedClientForSettlement || !settleAmount || settleAmount <= 0) return;
    onSettleDebt(selectedClientForSettlement.id, settleAmount);
    setSelectedClientForSettlement(null);
    setSettleAmount(0);
  };

  return (
    <div className="space-y-6">
      {/* Header and KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              دفتر حساب مشتریان و یادآور سرویس‌ها
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            پیگیری مطالبات نسیه مشتریان و موعد ۶ ماهه تعویض فیلترهای تصفیه آب
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-amber-950/40 border border-amber-800/60 text-right">
            <span className="text-[10px] text-amber-400 block font-bold">کل مطالبات وصول نشده:</span>
            <span className="font-bold text-amber-300 font-mono text-sm">
              {formatToman(totalClientsDebt)}
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-cyan-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت مشتری جدید</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="جستجوی نام، تلفن یا آدرس مشتری..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pr-9 pl-3 py-2 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-1 self-start md:self-auto w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-cyan-500 text-white'
                : 'text-slate-400 hover:text-white bg-slate-800/50'
            }`}
          >
            همه مشتریان ({toPersianDigits(clients.length)})
          </button>
          <button
            onClick={() => setFilterMode('debtors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'debtors'
                ? 'bg-amber-500 text-white'
                : 'text-amber-400 hover:text-white bg-slate-800/50'
            }`}
          >
            دارای بدهی / نسیه ({toPersianDigits(clients.filter((c) => c.totalDebt > 0).length)})
          </button>
          <button
            onClick={() => setFilterMode('due_service')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'due_service'
                ? 'bg-rose-500 text-white'
                : 'text-rose-400 hover:text-white bg-slate-800/50'
            }`}
          >
            موعد تعویض فیلتر (هشدار ۶ ماه)
          </button>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-500 text-sm">
            مشتری با این مشخصات یافت نشد.
          </div>
        ) : (
          filteredClients.map((client) => {
            const daysSinceLastService = getDaysAgo(client.lastServiceDate);
            const isDueOver = daysSinceLastService >= 180; // بیش از ۶ ماه
            const isDueSoon = daysSinceLastService >= 150 && daysSinceLastService < 180; // در آستانه ۶ ماه

            return (
              <div
                key={client.id}
                className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-black text-base text-white">{client.name}</h3>
                      <span className="text-xs text-cyan-400 flex items-center gap-1 mt-0.5">
                        <Wrench className="w-3.5 h-3.5" />
                        {client.deviceModel}
                      </span>
                    </div>

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
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 mt-3">
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <a
                          href={`tel:${client.phone}`}
                          className="text-cyan-400 hover:underline font-mono"
                        >
                          {client.phone}
                        </a>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="text-slate-400 leading-relaxed">{client.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Filter Replacement Status Indicator */}
                  <div
                    className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs ${
                      isDueOver
                        ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                        : isDueSoon
                        ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <div>
                        <span className="font-bold block">
                          {isDueOver && '⚠️ زمان تعویض ۳ فیلتر اول گذشته است!'}
                          {isDueSoon && '🔔 موعد تعویض فیلتر به زودی (کمتر از ۱ ماه)'}
                          {!isDueOver && !isDueSoon && 'فیلترها در وضعیت استاندارد'}
                        </span>
                        <span className="text-[11px] opacity-80">
                          آخرین سرویس: {toJalaliDate(client.lastServiceDate)} (
                          {toPersianDigits(daysSinceLastService)} روز پیش)
                        </span>
                      </div>
                    </div>
                  </div>

                  {client.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 mt-2.5">
                      یادداشت: {client.notes}
                    </p>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <span className="text-xs text-slate-500">
                    کل دریافتی قبلی: {formatTomanCompact(client.totalPaid)}
                  </span>

                  <div className="flex items-center gap-2">
                    {client.totalDebt > 0 && (
                      <button
                        onClick={() => {
                          setSelectedClientForSettlement(client);
                          setSettleAmount(client.totalDebt);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>تسویه بدهی</span>
                      </button>
                    )}
                    {client.phone && (
                      <a
                        href={`tel:${client.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold"
                      >
                        تماس
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>ثبت مشتری جدید تصفیه آب</span>
            </h3>

            <form onSubmit={handleCreateClient} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  نام مشتری / شرکت
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="مثلا: آقای مهندس حسینی"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">شماره تماس</label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="0912..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  مدل دستگاه تصفیه آب
                </label>
                <input
                  type="text"
                  value={newClientDevice}
                  onChange={(e) => setNewClientDevice(e.target.value)}
                  placeholder="مثلا: ۶ مرحله CCK تایوان با فیلتر مینرال"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">آدرس دقیق</label>
                <textarea
                  rows={2}
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="منطقه، خیابان، پلاک، طبقه..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  یادداشت فنی (TDS، فشار پمپ، سایز مخزن)
                </label>
                <input
                  type="text"
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  placeholder="مثلا: TDS ورودی ۴۸۰، خروجی ۳۵، مخزن ۴ گالن فلزی"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500"
                >
                  ذخیره مشتری
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {selectedClientForSettlement && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-white mb-2 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>تسویه بدهی {selectedClientForSettlement.name}</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              کل بدهی مانده این مشتری:{' '}
              <span className="text-amber-400 font-bold font-mono">
                {formatToman(selectedClientForSettlement.totalDebt)}
              </span>
            </p>

            <div className="mb-4">
              <label className="text-xs font-bold text-slate-300 block mb-1">
                مبلغ دریافتی (تومان)
              </label>
              <input
                type="number"
                value={settleAmount || ''}
                onChange={(e) => setSettleAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono font-bold text-base"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedClientForSettlement(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500"
              >
                ثبت دریافت وجه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
