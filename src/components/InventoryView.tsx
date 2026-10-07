import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Edit2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { PartItem } from '../types';
import { formatToman, formatTomanCompact, toPersianDigits } from '../utils/formatters';

interface InventoryViewProps {
  parts: PartItem[];
  onAddPart: (part: PartItem) => void;
  onUpdatePart: (part: PartItem) => void;
  onDeletePart: (id: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  parts,
  onAddPart,
  onUpdatePart,
  onDeletePart,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('عدد');
  const [stock, setStock] = useState(5);
  const [purchasePrice, setPurchasePrice] = useState(200_000);
  const [sellPrice, setSellPrice] = useState(350_000);
  const [category, setCategory] = useState<PartItem['category']>('filter');
  const [lowStockThreshold, setLowStockThreshold] = useState(3);

  // Compute total inventory value and total estimated profit margin
  const totalStockItems = parts.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalPurchaseValue = parts.reduce((acc, p) => acc + p.purchasePrice * (p.stock || 0), 0);
  const totalPotentialProfit = parts.reduce(
    (acc, p) => acc + (p.sellPrice - p.purchasePrice) * (p.stock || 0),
    0
  );

  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingPart) {
      onUpdatePart({
        ...editingPart,
        name,
        code,
        unit,
        stock,
        purchasePrice,
        sellPrice,
        category,
        lowStockThreshold,
      });
      setEditingPart(null);
    } else {
      const newPart: PartItem = {
        id: `part-${Date.now()}`,
        name,
        code: code || `PRT-${Date.now().toString().slice(-4)}`,
        unit,
        stock,
        purchasePrice,
        sellPrice,
        category,
        lowStockThreshold,
      };
      onAddPart(newPart);
    }

    setShowAddModal(false);
    resetForm();
  };

  const startEdit = (part: PartItem) => {
    setEditingPart(part);
    setName(part.name);
    setCode(part.code);
    setUnit(part.unit);
    setStock(part.stock);
    setPurchasePrice(part.purchasePrice);
    setSellPrice(part.sellPrice);
    setCategory(part.category);
    setLowStockThreshold(part.lowStockThreshold ?? 3);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setName('');
    setCode('');
    setUnit('عدد');
    setStock(5);
    setPurchasePrice(200_000);
    setSellPrice(350_000);
    setCategory('filter');
    setLowStockThreshold(3);
    setEditingPart(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Wrench className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              انبارک قطعات یدکی و ماشین سرویس‌کار
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            مدیریت موجودی فیلترها، ممبران، پمپ، اتصالات و محاسبه حاشیه سود هر قطعه
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-cyan-600/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن قطعه جدید</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">تعداد کل اقلام موجود در خودرو/کیف:</span>
          <div className="text-2xl font-black text-white font-mono">
            {toPersianDigits(totalStockItems)} <span className="text-xs font-normal text-slate-400">قطعه</span>
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">ارزش سرمایه در گردش انبارک (خرید):</span>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {formatToman(totalPurchaseValue)}
          </div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <span className="text-xs text-emerald-400 block mb-1 font-bold">سود بالقوه در صورت فروش به مشتری:</span>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            +{formatToman(totalPotentialProfit)}
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-base">لیست قطعات و فیلترهای پرکاربرد تصفیه آب</h3>
          <span className="text-xs text-slate-400">
            {toPersianDigits(parts.length)} نوع قطعه تعریف شده
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">نام قطعه و مشخصات</th>
                <th className="py-3 px-3">کد</th>
                <th className="py-3 px-3">موجودی</th>
                <th className="py-3 px-3">قیمت خرید همکار</th>
                <th className="py-3 px-3">قیمت فاکتور مشتری</th>
                <th className="py-3 px-3">سود هر عدد</th>
                <th className="py-3 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {parts.map((part) => {
                const profitPerItem = part.sellPrice - part.purchasePrice;
                const profitPercent =
                  part.purchasePrice > 0
                    ? Math.round((profitPerItem / part.purchasePrice) * 100)
                    : 0;
                const threshold = part.lowStockThreshold ?? 3;
                const isLow = part.stock <= threshold;

                return (
                  <tr
                    key={part.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      isLow ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {part.name}
                        {isLow && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                            هشدار سفارش
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">واحد: {part.unit}</span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-400 text-xs">{part.code}</td>
                    <td className="py-3.5 px-3">
                      <span
                        className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs ${
                          isLow
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {toPersianDigits(part.stock)} {part.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-300">
                      {formatToman(part.purchasePrice)}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-cyan-300 font-bold">
                      {formatToman(part.sellPrice)}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-mono text-emerald-400 font-bold">
                        +{formatToman(profitPerItem)}
                      </div>
                      <span className="text-[10px] text-emerald-500">
                        {toPersianDigits(profitPercent)}٪ سود
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => startEdit(part)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          title="ویرایش قطعه"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePart(part.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="حذف قطعه"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <span>{editingPart ? 'ویرایش قطعه' : 'افزودن قطعه جدید به انبارک'}</span>
            </h3>

            <form onSubmit={handleSavePart} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">نام قطعه</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلا: فیلتر ممبران ۷۵ گالن Filmtec"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">کد قطعه</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="MB-75G"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">واحد سنجش</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="عدد / دست / متر"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">موجودی فعلی</label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">قیمت خرید (تومان)</label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">قیمت فروش (تومان)</label>
                  <input
                    type="number"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-400 block mb-1">حاشیه سود ناخالص پیش‌بینی شده:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  +{formatToman(sellPrice - purchasePrice)} به ازای هر {unit}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  حد هشدار موجودی (نقطه سفارش)
                </label>
                <input
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  وقتی موجودی به این عدد یا کمتر برسد، هشدار نمایش داده می‌شود.
                </span>
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
                  ذخیره قطعه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
