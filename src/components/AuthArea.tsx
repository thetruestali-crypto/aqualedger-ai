// Navbar auth corner (presentational, unit-tested with renderToString).
// Two states: logged-out shows an offline badge + a way back to login;
// logged-in shows the account (phone for SMS users, email for Google users)
// plus sign out. Rendered only when Supabase is configured — local dev
// without env keeps the old navbar.
import React from 'react';
import { LogIn, LogOut, WifiOff } from 'lucide-react';
import { formatIranianPhone } from '../lib/phone';

export type AuthAreaStatus = 'logged-in' | 'logged-out';

interface AuthAreaProps {
  status: AuthAreaStatus;
  email?: string | null;
  /** Phone number (E.164) of an SMS user; shown instead of the email. */
  phone?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const AuthArea: React.FC<AuthAreaProps> = ({
  status,
  email,
  phone,
  onSignIn,
  onSignOut,
}) => {
  if (status === 'logged-in') {
    const label = phone ? formatIranianPhone(phone) : email || 'حساب کاربری';
    return (
      <div className="flex items-center gap-1.5" dir="rtl">
        <span
          title={label}
          className="hidden sm:inline-block max-w-[140px] truncate text-[11px] font-bold text-emerald-300"
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          title="خروج از حساب"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-bold transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">خروج از حساب</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" dir="rtl">
      <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
        <WifiOff className="w-3.5 h-3.5" />
        حالت آفلاین
      </span>
      <button
        type="button"
        onClick={onSignIn}
        title="ورود به حساب کاربری"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-extrabold transition-all active:scale-95"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">ورود به حساب</span>
        <span className="sm:hidden">ورود</span>
      </button>
    </div>
  );
};
