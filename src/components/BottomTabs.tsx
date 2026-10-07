// Mobile-first bottom tab bar (primary navigation on small screens) with a
// prominent raised quick-entry (mic) button in the center.
import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  Sliders,
  Mic,
} from 'lucide-react';

interface BottomTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomTabs: React.FC<BottomTabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'company', label: 'شرکت', icon: Building2 },
    { id: '__quick__', label: 'ثبت', icon: Mic, fab: true },
    { id: 'clients', label: 'مشتریان', icon: Users },
    { id: 'inventory', label: 'انبار', icon: Wrench },
    { id: 'settings', label: 'تنظیمات', icon: Sliders },
  ];

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-6 items-end px-1 pt-1">
        {tabs.map((tab) => {
          if (tab.fab) {
            const Icon = tab.icon;
            return (
              <div key={tab.id} className="flex flex-col items-center -mt-6 pb-1">
                <button
                  onClick={() => setActiveTab('quick-entry')}
                  aria-label="ثبت هوشمند صوتی"
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 border-4 border-slate-950 ${
                    activeTab === 'quick-entry'
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-cyan-500/40'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-600/40'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </button>
                <span
                  className={`text-[10px] font-bold mt-0.5 ${
                    activeTab === 'quick-entry' ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            );
          }
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors ${
                isActive ? 'text-cyan-300' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              <span
                className={`h-1 w-8 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-transparent'}`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
