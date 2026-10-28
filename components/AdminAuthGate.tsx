'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, KeyRound, AlertCircle } from 'lucide-react';

interface AdminAuthGateProps {
  children: React.ReactNode;
  onExit?: () => void;
}

const ADMIN_PASSWORD = 'xsite@123';

export const AdminAuthGate: React.FC<AdminAuthGateProps> = ({ children, onExit }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('az_admin_auth');
      if (stored === 'true') {
        setIsAuthenticated(true);
      }
    } catch {
      /* ignore */
    } finally {
      setIsCheckingSession(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.trim() === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('az_admin_auth', 'true');
      } catch {
        /* ignore */
      }
    } else {
      setError('Admin စကားဝှက် မှားယွင်းနေပါသည်။ (Password: xsite@123)');
    }
  };

  const handleLockAdmin = () => {
    setIsAuthenticated(false);
    setPassword('');
    try {
      sessionStorage.removeItem('az_admin_auth');
    } catch {
      /* ignore */
    }
    if (onExit) onExit();
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-[#070d19] text-white">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-amber-300 font-bold">စစ်ဆေးနေပါသည်…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#0b1322] border border-amber-500/30 rounded-2xl p-6 sm:p-7 shadow-2xl text-white">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center mb-3 shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
              AzLottery Security Gate
            </span>
            <h2 className="text-xl font-black text-white mt-1">Admin Panel သို့ ဝင်ရန်</h2>
            <p className="text-xs text-slate-400 mt-1">
              စီမံခန့်ခွဲသူ စကားဝှက် ရိုက်ထည့်၍ Login ဝင်ရောက်ပါ
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span>Admin Password (စကားဝှက်)</span>
                <span className="text-[11px] text-amber-400 font-mono">xsite@123</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="စကားဝှက် ရိုက်ထည့်ပါ"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 font-mono"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>ဝင်ရောက်မည် (Login)</span>
            </button>

            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ပင်မစာမျက်နှာသို့ ပြန်သွားမည်</span>
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Admin Top Utility Lock Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/10 text-xs mb-4 rounded-xl">
        <div className="flex items-center gap-2 text-amber-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-bold">Admin Authenticated</span>
        </div>
        <button
          type="button"
          onClick={handleLockAdmin}
          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold cursor-pointer transition-colors"
        >
          Admin မှ ထွက်မည် (Lock)
        </button>
      </div>
      {children}
    </div>
  );
};
