import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Building2,
  Users,
  Wrench,
  Sliders,
  Droplets,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { formatTomanCompact } from '../utils/formatters';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  bossNetBalance: number;
  bossStatus: 'creditor' | 'debtor' | 'settled';
  onOpenQuickEntry: () => void;
  onOpenHelp: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  bossNetBalance,
  bossStatus,
  onOpenQuickEntry,
  onOpenHelp,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'داشبورد مالی', icon: LayoutDashboard },
    { id: 'quick-entry', label: 'ورودی صوتی و هوشمند', icon: Sparkles, highlight: true },
    { id: 'company', label: 'دفتر حساب رئیس و شرکت', icon: Building2 },
    { id: 'clients', label: 'مشتریان و یادآور سرویس', icon: Users },
    { id: 'inventory', label: 'انبارک قطعات تصفیه', icon: Wrench },
    { id: 'settings', label: 'قرارداد و حقوق', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top row: Brand & Status & Quick Action */}
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-xl">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  Aqua<span className="text-cyan-400">Ledger</span> AI
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                  تکنسین تصفیه آب
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                حسابدار هوشمند دوشغله (حقوق شرکتی + خدمات میدانی)
              </p>
            </div>
          </div>

          {/* Center-Right: Quick Boss Balance Indicator */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              onClick={() => setActiveTab('company')}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                bossStatus === 'creditor'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/40'
                  : bossStatus === 'debtor'
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/40'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
              title="کلیک برای مشاهده جزئیات حساب شرکت"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  bossStatus === 'creditor'
                    ? 'bg-emerald-400 animate-ping'
                    : bossStatus === 'debtor'
                    ? 'bg-rose-400'
                    : 'bg-slate-400'
                }`}
              />
              <span className="text-slate-400">وضعیت با رئیس:</span>
              <span className="font-bold">
                {bossStatus === 'creditor' && `طلبکار (${formatTomanCompact(bossNetBalance)})`}
                {bossStatus === 'debtor' && `بدهکار (${formatTomanCompact(Math.abs(bossNetBalance))})`}
                {bossStatus === 'settled' && 'تسویه کامل'}
              </span>
            </div>

            {/* Quick entry button */}
            <button
              onClick={onOpenQuickEntry}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-cyan-600/30 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden xs:inline">ثبت هوشمند</span>
              <span className="xs:hidden">ثبت</span>
            </button>

            {/* Guide/Help button */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="راهنمای کار با سیستم"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-800/60 -mx-3 px-3 sm:mx-0 sm:px-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.highlight && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse hidden sm:inline-block" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
