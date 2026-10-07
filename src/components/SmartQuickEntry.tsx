import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Wrench,
  DollarSign,
  Calendar,
  Layers,
  HelpCircle,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import { Transaction, AIAnalysisResult, CompanySettings } from '../types';
import { formatToman, formatTomanCompact, toJalaliDate, toPersianDigits } from '../utils/formatters';

interface SmartQuickEntryProps {
  onSaveTransaction: (tx: Transaction) => void;
  settings: CompanySettings;
}

export const SmartQuickEntry: React.FC<SmartQuickEntryProps> = ({
  onSaveTransaction,
  settings,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [manualMode, setManualMode] = useState(false);

  // Editable fields on analysis preview
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editPaid, setEditPaid] = useState<number>(0);
  const [editPartyName, setEditPartyName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');

  const recognitionRef = useRef<any>(null);

  // Ready-to-use sample phrases typical for Persian water technicians
  const samplePrompts = [
    {
      title: 'خرید قطعه از جیب برای شرکت (طلب از رئیس)',
      text: 'از جیب خودم ۵۸۰ تومن دادم پک فیلتر ۱۲۳ و اتصالات خریدم برای شرکت مهندس جلالی',
      badge: 'شرکتی (طلبکار)',
      badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    },
    {
      title: 'دریافت مساعده از رئیس',
      text: '۲ میلیون تومن مساعده علی‌الحساب نقدی از رئیس گرفتم',
      badge: 'شرکتی (کاهش طلب)',
      badgeColor: 'bg-amber-950 text-amber-300 border-amber-800',
    },
    {
      title: 'تعویض فیلتر و سرویس مشتری با بدهی مانده',
      text: 'تعویض ۳ فیلتر اول برای آقای صابری انجام شد؛ ۴۵۰ تومن شد که ۳۵۰ نقد داد و ۱۰۰ تومنش موند',
      badge: 'میدانی (طلب از مشتری)',
      badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-800',
    },
    {
      title: 'خرید ممبران با سود و تسویه کامل مشتری',
      text: 'خرید ممبران فیلمتک برای خانم موسوی ۷۰۰ تومن که فاکتور کردم ۱ میلیون و تمامش رو کارت به کارت زد',
      badge: 'میدانی (سود ۳۰۰ تومن)',
      badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-800',
    },
    {
      title: 'تعمیر پمپ و رفع نشتی مشتری',
      text: 'تعمیر هد پمپ و رفع نشتی شلنگ منزل آقای دکتر حسینی ۳۸۰ هزار تومن دستمزد و ایاب ذهاب نقد دریافت شد',
      badge: 'میدانی (دستمزد خالص)',
      badgeColor: 'bg-blue-950 text-blue-300 border-blue-800',
    },
    {
      title: 'خرید آچار و ابزار شخصی',
      text: '۱۸۰ تومن دادم آچار هوزینگ فلزی و گیج تست فشار برای کیف ابزار خودم خریدم',
      badge: 'ابزار شخصی',
      badgeColor: 'bg-purple-950 text-purple-300 border-purple-800',
    },
  ];

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognizer = new SpeechRecognition();
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.lang = 'fa-IR';

    recognizer.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognizer.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setInputText(currentTranscript);
    };

    recognizer.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('دسترسی به میکروفن مسدود است. لطفاً در مرورگر اجازه دسترسی به میکروفن را بدهید.');
      } else {
        setError('خطا در دریافت صدا. لطفاً دوباره امتحان کرده یا متن را بنویسید.');
      }
    };

    recognizer.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognizer;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported) {
      setError('مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند. لطفاً متن را تایپ کنید.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setError(null);
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error('Speech recognition start failed:', err);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setError('لطفاً ابتدا متنی را بنویسید یا صدایتان را ضبط کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/analyze-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          context: {
            bossName: settings.bossName,
            companyName: settings.companyName,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'خطا در ارتباط با دستیار هوشمند.');
      }

      const data: AIAnalysisResult = await response.json();
      setAnalysisResult(data);
      setEditAmount(data.totalAmount || 0);
      setEditPaid(data.paidAmount || 0);
      setEditPartyName(data.party?.name || '');
      setEditCategory(data.category || '');
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'خطا در پردازش اطلاعات توسط هوش مصنوعی. لطفاً مجدداً امتحان کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAndSave = () => {
    if (!analysisResult) return;

    const remaining = Math.max(0, editAmount - editPaid);

    // Compute updated financial impact based on user edits
    let userBalanceChange = analysisResult.financialImpact?.userBalanceChange || 0;
    if (analysisResult.streamType === 'company') {
      if (analysisResult.transactionType === 'company_expense_out_of_pocket') {
        userBalanceChange = editAmount; // طلبکار شدن کاربر به اندازه خرج کرده
      } else if (analysisResult.transactionType === 'boss_advance_received') {
        userBalanceChange = -editAmount; // کسر طلب کاربر به اندازه دریافتی
      }
    } else {
      if (remaining > 0) {
        userBalanceChange = remaining; // طلب از مشتری
      }
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      date: new Date().toISOString(),
      jalaliDate: toJalaliDate(),
      streamType: analysisResult.streamType,
      transactionType: analysisResult.transactionType,
      party: {
        role: analysisResult.party.role,
        name: editPartyName || analysisResult.party.name,
        phone: analysisResult.party.phone,
        address: analysisResult.party.address,
      },
      totalAmount: editAmount,
      paidAmount: editPaid,
      remainingDebt: remaining,
      financialImpact: {
        targetBalance: analysisResult.financialImpact?.targetBalance || 'boss_balance',
        userBalanceChange,
        profitAmount: analysisResult.financialImpact?.profitAmount,
      },
      paymentMethod: analysisResult.paymentMethod || 'cash',
      category: editCategory || analysisResult.category,
      items: analysisResult.items,
      suggestNextServiceMonths: analysisResult.suggestNextServiceMonths,
      description: analysisResult.description,
      conversationalSummary: analysisResult.conversationalSummary,
      source: isListening ? 'ai_voice' : 'ai_text',
      settled: remaining === 0,
    };

    onSaveTransaction(newTx);

    // Reset form
    setInputText('');
    setAnalysisResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-blue-950/60 p-5 rounded-2xl border border-cyan-800/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                ثبت هوشمند با زبان عامیانه و گفتار
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
              به راحتی بگویید یا بنویسید چه اتفاقی افتاده؛ هوش مصنوعی مبالغ تومانی را تشخیص داده،
              بین «رئیس و شرکت» و «مشتری بیرونی» تفکیک می‌کند و حساب طلبکاری شما را فوراً به روز می‌نماید.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 text-cyan-300 border border-slate-700">
              مدل: Gemini 3.8 Flash
            </span>
          </div>
        </div>
      </div>

      {/* Main Input Box */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl relative">
        <div className="space-y-4">
          <div className="relative">
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="مثال: از جیب خودم ۵۵۰ تومن دادم پک فیلتر ۱۲۳ برای شرکت خریدم ... یا ... تعویض فیلتر آقای احمدی ۴۰۰ تومن شد که نقد داد..."
              className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-xl p-4 text-slate-100 placeholder:text-slate-500 text-sm sm:text-base leading-relaxed resize-none transition-all"
            />

            {inputText && (
              <button
                onClick={() => setInputText('')}
                className="absolute top-3 left-3 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-2 py-1 rounded"
              >
                پاک کردن
              </button>
            )}
          </div>

          {/* Action Row: Mic button & Process button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all border ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="شروع ضبط صدا با میکروفن"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4 text-white animate-spin" />
                    <span>در حال شنیدن صدای شما... (کلیک برای توقف)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-cyan-400" />
                    <span>ورودی صوتی (فارسی)</span>
                  </>
                )}
              </button>

              {isListening && (
                <span className="flex items-center gap-1.5 text-xs text-rose-400 font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  میکروفن فعال است
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg shadow-cyan-600/30 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال تحلیل هوشمند...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>تحلیل و استخراج تراکنش</span>
                </>
              )}
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Fast Samples Chips */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            نمونه‌های پرتکرار تصفیه آب (کلیک کنید تا پر شود):
          </span>
          <span className="text-[11px] text-slate-500">گفتار روزمره کارگاهی</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {samplePrompts.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(sample.text);
                setAnalysisResult(null);
              }}
              className="text-right p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-700/60 transition-all group flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300">
                  {sample.title}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${sample.badgeColor}`}
                >
                  {sample.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                «{sample.text}»
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* AI Analysis Preview Card (when parsed) */}
      {analysisResult && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border-2 border-cyan-500/50 p-5 sm:p-6 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-base text-white">نتیجه تحلیل سند مالی</h3>
                <p className="text-xs text-slate-400">
                  مشاهده و در صورت نیاز اصلاح مقادیر قبل از ثبت نهایی
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black border ${
                  analysisResult.streamType === 'company'
                    ? 'bg-blue-950 text-blue-300 border-blue-700'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                }`}
              >
                {analysisResult.streamType === 'company' ? 'جریان شرکتی (رئیس)' : 'جریان میدانی (مشتری)'}
              </span>
            </div>
          </div>

          {/* Conversational summary highlight */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 mb-5">
            <p className="text-sm font-semibold text-cyan-200 leading-relaxed">
              💡 {analysisResult.conversationalSummary}
            </p>
          </div>

          {/* Editable Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {/* Total Amount */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                مبلغ کل (تومان)
              </label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg p-2 text-white font-mono font-bold text-base"
              />
              <span className="text-[11px] text-cyan-400 mt-1 block">
                {formatToman(editAmount)}
              </span>
            </div>

            {/* Paid Amount */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                مبلغ پرداخت/تسویه شده
              </label>
              <input
                type="number"
                value={editPaid}
                onChange={(e) => setEditPaid(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg p-2 text-white font-mono font-bold text-base"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {editAmount - editPaid > 0 ? (
                  <span className="text-amber-400 font-bold">
                    مانده نسیه: {formatToman(editAmount - editPaid)}
                  </span>
                ) : (
                  <span className="text-emerald-400">تسویه کامل</span>
                )}
              </span>
            </div>

            {/* Party Name */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                طرف حساب
              </label>
              <input
                type="text"
                value={editPartyName}
                onChange={(e) => setEditPartyName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg p-2 text-white font-bold text-sm"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                نقش: {analysisResult.party.role === 'boss' ? 'رئیس / شرکت' : 'مشتری بیرونی'}
              </span>
            </div>

            {/* Category */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                دسته‌بندی خدمات/قطعات
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg p-2 text-white font-bold text-sm"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                روش پرداخت: {analysisResult.paymentMethod || 'نقدی'}
              </span>
            </div>
          </div>

          {/* Identified Parts / Items if any */}
          {analysisResult.items && analysisResult.items.length > 0 && (
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 mb-5">
              <span className="text-xs font-bold text-slate-300 block mb-2">
                قطعات و اقلام شناسایی شده:
              </span>
              <div className="flex flex-wrap gap-2">
                {analysisResult.items.map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-200 border border-slate-700"
                  >
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{item.itemName}</span>
                    {item.quantity && (
                      <span className="text-cyan-400 font-bold">
                        ({toPersianDigits(item.quantity)} عدد)
                      </span>
                    )}
                    {item.sellPrice && (
                      <span className="text-emerald-400 text-[11px]">
                        [{formatTomanCompact(item.sellPrice)}]
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation & Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              توضیحات رسمی: <span className="text-slate-300">{analysisResult.description}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnalysisResult(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تایید و ثبت نهایی در دفتر حساب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
