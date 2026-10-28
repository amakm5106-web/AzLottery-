'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Header } from '@/components/Header';
import { MobileNav } from '@/components/MobileNav';
import { HomeView } from '@/components/HomeView';
import { GamesView } from '@/components/GamesView';
import { WinGoView } from '@/components/WinGoView';
import { WheelView } from '@/components/WheelView';
import { WalletView } from '@/components/WalletView';
import { TransactionsView } from '@/components/TransactionsView';
import { AdminView } from '@/components/AdminView';
import { AccountView } from '@/components/AccountView';
import { PromotionView } from '@/components/PromotionView';
import { LotteryVariantView } from '@/components/LotteryVariantView';
import { AdminAuthGate } from '@/components/AdminAuthGate';
import { LoginPromptModal } from '@/components/LoginPromptModal';

export default function AzLotteryApp() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [walletLandingTab, setWalletLandingTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginPromptReason, setLoginPromptReason] = useState<string>('');

  const {
    isLoaded,
    isUserLoggedIn,
    currentUser,
    users,
    transactions,
    requests,
    providers,
    gatewayWallets,
    waveAdminAccount,
    isAutoWithdrawEnabled,
    isAutoDepositCheckEnabled,
    wingoBets,
    wingoHistory,
    wheelHistory,
    resetBalanceToZero,
    createDepositWithCheck,
    createWithdrawalWithAutoDisburse,
    approveRequest,
    rejectRequest,
    spinWheel,
    placeWinGoBet,
    settleWinGoRound,
    placeVariantBet,
    settleVariantWin,
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
    switchUserRole,
  } = useAppStore();

  const handleNavigate = (tab: string, landing?: 'deposit' | 'withdraw') => {
    const protectedTabs = ['wingo', 'k3', '5d', 'trx', 'wheel', 'wallet', 'games'];
    if (!isUserLoggedIn && protectedTabs.includes(tab)) {
      setLoginPromptReason(
        tab === 'wallet'
          ? 'ငွေသွင်း/ငွေထုတ် ပြုလုပ်ရန် အကောင့်ဝင်ရောက်ရန် (သို့မဟုတ် စာရင်းသွင်းရန်) လိုအပ်ပါသည်'
          : 'ဂိမ်းများ ကစားရန် အကောင့်ဝင်ရောက်ရန် (သို့မဟုတ် စာရင်းသွင်းရန်) လိုအပ်ပါသည်'
      );
      setShowLoginPrompt(true);
      return;
    }
    if (landing) setWalletLandingTab(landing);
    setCurrentTab(tab);
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        const protectedTabs = ['wingo', 'k3', '5d', 'trx', 'wheel', 'wallet'];
        if (protectedTabs.includes(tab) && !isUserLoggedIn) {
          setShowLoginPrompt(true);
          setCurrentTab('home');
        } else {
          setCurrentTab(tab);
        }
      } else if (window.location.hash === '#admin') {
        setCurrentTab('admin');
      }
    }
  }, [isUserLoggedIn]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f7f8ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#4782ff] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[#4782ff] font-bold text-sm">ဖွင့်လှစ်နေပါသည်…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8ff] text-[#1e2637]">
      {/* The game view has its own compact header and navigation. */}
      {currentTab !== 'wingo' && currentTab !== 'k3' && currentTab !== '5d' && currentTab !== 'trx' && currentTab !== 'account' && (
        <Header
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          currentUser={currentUser}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${['wingo', 'k3', '5d', 'trx'].includes(currentTab) ? 'w-full px-0 sm:wrap py-0 sm:py-6' : currentTab === 'account' ? 'w-full px-0 py-0' : 'wrap py-8 sm:py-10'}`}>
        {currentTab === 'home' && (
          <HomeView
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'games' && (
          <GamesView
            currentUser={currentUser}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'wingo' && (
          <WinGoView
            currentUser={currentUser}
            wingoBets={wingoBets}
            wingoHistory={wingoHistory}
            onPlaceBet={placeWinGoBet}
            onSettleRound={settleWinGoRound}
            onNavigate={handleNavigate}
          />
        )}

        {(currentTab === 'k3' || currentTab === '5d' || currentTab === 'trx') && (
          <LotteryVariantView
            variant={currentTab}
            currentUser={currentUser}
            onPlaceBet={placeVariantBet}
            onSettleWin={settleVariantWin}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'wheel' && (
          <WheelView
            currentUser={currentUser}
            wheelHistory={wheelHistory}
            onSpin={spinWheel}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'account' && (
          <AccountView
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onWalletShortcut={(tab) => handleNavigate('wallet', tab)}
          />
        )}

        {currentTab === 'promotion' && <PromotionView onNavigate={handleNavigate} />}

        {currentTab === 'wallet' && (
          <WalletView
            currentUser={currentUser}
            initialTab={walletLandingTab}
            requests={requests}
            providers={providers}
            gatewayWallets={gatewayWallets}
            waveAdminAccount={waveAdminAccount}
            isAutoWithdrawEnabled={isAutoWithdrawEnabled}
            isAutoDepositCheckEnabled={isAutoDepositCheckEnabled}
            onResetBalanceToZero={resetBalanceToZero}
            onCreateDeposit={createDepositWithCheck}
            onCreateWithdrawal={createWithdrawalWithAutoDisburse}
          />
        )}

        {currentTab === 'transactions' && (
          <TransactionsView
            currentUser={currentUser}
            transactions={transactions}
          />
        )}

        {currentTab === 'admin' && (
          <AdminAuthGate onExit={() => setCurrentTab('home')}>
            <div className="bg-[#070d19] text-white p-4 sm:p-6 lg:p-8 rounded-2xl shadow-2xl mb-12 border border-white/10">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setCurrentTab('home')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  ← ပင်မစာမျက်နှာသို့
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    Role: <b className="text-amber-400">{currentUser.role}</b>
                  </span>
                  {currentUser.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => switchUserRole('admin')}
                      className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      Admin အဖြစ်ပြောင်းမည်
                    </button>
                  )}
                </div>
              </div>
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
            </div>
          </AdminAuthGate>
        )}
      </main>

      {/* Mobile Navigation Bar */}
      {!['wingo', 'k3', '5d', 'trx', 'admin'].includes(currentTab) && (
        <MobileNav
          currentTab={currentTab}
          setCurrentTab={handleNavigate}
          currentUser={currentUser}
        />
      )}

      {/* Guest Login/Signup Protection Modal */}
      <LoginPromptModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        reason={loginPromptReason}
      />

    </div>
  );
}
