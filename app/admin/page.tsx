'use client';

import React from 'react';
import Link from 'next/link';
import { AdminView } from '@/components/AdminView';
import { AdminAuthGate } from '@/components/AdminAuthGate';
import { useAppStore } from '@/lib/store';
import { Home, ShieldCheck, UserCheck } from 'lucide-react';

export default function AdminPage() {
  const {
    isLoaded,
    currentUser,
    users,
    requests,
    providers,
    gatewayWallets,
    waveAdminAccount,
    isAutoWithdrawEnabled,
    isAutoDepositCheckEnabled,
    switchUserRole,
    approveRequest,
    rejectRequest,
    updateProvider,
    toggleAutoWithdraw,
    toggleAutoDepositCheck,
    requestWaveOtp,
    loginWaveWithRealApi,
    connectWaveWithToken,
    syncWaveHistory,
    loginWaveAccount,
    logoutWaveAccount,
    addWaveIncomingTransaction,
    removeWaveTransaction,
  } = useAppStore();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#070d19] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-amber-400 font-bold text-sm">Admin Panel ဖွင့်လှစ်နေပါသည်…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d19] text-white">
      {/* Admin Dedicated Topbar */}
      <header className="border-b border-white/10 bg-[#0d1627] sticky top-0 z-40 px-3 sm:px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-colors"
            >
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">ပင်မစာမျက်နှာ</span>
            </Link>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs sm:text-sm font-black tracking-tight text-white truncate">Admin Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">
              အကောင့်: <b className="text-amber-400">{currentUser.login_identifier}</b> ({currentUser.role})
            </span>
            {currentUser.role !== 'admin' && (
              <button
                type="button"
                onClick={() => switchUserRole('admin')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" /> Admin ပြောင်းရန်
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Admin View Content Protected by Password xsite@123 */}
      <main className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-8">
        <AdminAuthGate onExit={() => window.location.assign('/')}>
          <AdminView
            currentUser={currentUser.role === 'admin' ? currentUser : { ...currentUser, role: 'admin' }}
            users={users}
            requests={requests}
            providers={providers}
            gatewayWallets={gatewayWallets}
            waveAdminAccount={waveAdminAccount}
            isAutoWithdrawEnabled={isAutoWithdrawEnabled}
            isAutoDepositCheckEnabled={isAutoDepositCheckEnabled}
            onApproveRequest={approveRequest}
            onRejectRequest={rejectRequest}
            onUpdateProvider={updateProvider}
            onToggleAutoWithdraw={toggleAutoWithdraw}
            onToggleAutoDepositCheck={toggleAutoDepositCheck}
            onRequestWaveOtp={requestWaveOtp}
            onLoginWaveWithRealApi={loginWaveWithRealApi}
            onConnectWaveWithToken={connectWaveWithToken}
            onSyncWaveHistory={syncWaveHistory}
            onLoginWaveAccount={loginWaveAccount}
            onLogoutWaveAccount={logoutWaveAccount}
            onAddWaveTransaction={addWaveIncomingTransaction}
            onRemoveWaveTransaction={removeWaveTransaction}
          />
        </AdminAuthGate>
      </main>
    </div>
  );
}
