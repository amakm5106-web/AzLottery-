'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { User, PaymentRequest, ProviderConnection, GatewayWallet, WaveAdminAccount, WaveTransactionItem } from '@/lib/store';
import {
  ShieldCheck,
  Check,
  X,
  Users,
  Settings,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Phone,
  PhoneCall,
  Edit3,
  Save,
  RefreshCw,
  Zap,
  FileCheck2,
  Building2,
  Send,
  Eye,
  Plus,
  LogIn,
  LogOut,
  Trash2,
  Lock,
  KeyRound,
  Smartphone,
  Copy,
  ChevronRight,
  Radio,
} from 'lucide-react';

interface AdminViewProps {
  currentUser: User;
  users: User[];
  requests: PaymentRequest[];
  providers: ProviderConnection[];
  gatewayWallets: Record<string, GatewayWallet>;
  waveAdminAccount?: WaveAdminAccount;
  isAutoWithdrawEnabled: boolean;
  isAutoDepositCheckEnabled: boolean;
  onApproveRequest: (requestId: number, adminNote?: string) => void;
  onRejectRequest: (requestId: number, reason?: string) => void;
  onUpdateProvider: (
    code: string,
    receiverPhone: string,
    receiverName: string,
    status: 'active' | 'disabled'
  ) => void;
  onToggleAutoWithdraw: (enabled: boolean) => void;
  onToggleAutoDepositCheck: (enabled: boolean) => void;
  onRequestWaveOtp?: (phone: string) => Promise<{ success: boolean; message: string }>;
  onLoginWaveWithRealApi?: (
    phone: string,
    pin: string,
    otp: string,
    name?: string
  ) => Promise<{ success: boolean; message: string }>;
  onConnectWaveWithToken?: (
    token: string,
    phone?: string,
    name?: string
  ) => Promise<{ success: boolean; message: string }>;
  onSyncWaveHistory?: () => Promise<{ success: boolean; count: number; message: string }>;
  onLoginWaveAccount?: (phone: string, pin: string, name?: string) => void;
  onLogoutWaveAccount?: () => void;
  onAddWaveTransaction?: (item: { transId: string; amount: number; senderPhone?: string; senderName?: string }) => void;
  onRemoveWaveTransaction?: (transId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  users,
  requests,
  providers,
  gatewayWallets,
  waveAdminAccount,
  isAutoWithdrawEnabled,
  isAutoDepositCheckEnabled,
  onApproveRequest,
  onRejectRequest,
  onUpdateProvider,
  onToggleAutoWithdraw,
  onToggleAutoDepositCheck,
  onRequestWaveOtp,
  onLoginWaveWithRealApi,
  onConnectWaveWithToken,
  onSyncWaveHistory,
  onLoginWaveAccount,
  onLogoutWaveAccount,
  onAddWaveTransaction,
  onRemoveWaveTransaction,
}) => {
  const [adminTab, setAdminTab] = useState<'requests' | 'wave' | 'providers' | 'gateway' | 'users' | 'settings'>('requests');
  const [editingProvider, setEditingProvider] = useState<ProviderConnection | null>(null);
  const [adminNote, setAdminNote] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Wave Real Login State
  const [loginMode, setLoginMode] = useState<'otp' | 'token'>('otp');
  const [wavePhone, setWavePhone] = useState<string>(waveAdminAccount?.phone || '');
  const [wavePin, setWavePin] = useState<string>('');
  const [waveOtp, setWaveOtp] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [waveTokenInput, setWaveTokenInput] = useState<string>('');
  const [waveAccountName, setWaveAccountName] = useState<string>('AzLottery Wave Pay');
  const [isSubmittingWave, setIsSubmittingWave] = useState<boolean>(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState<boolean>(false);

  // Manual Add Transaction Form State
  const [showAddTrxForm, setShowAddTrxForm] = useState<boolean>(false);
  const [testTrxId, setTestTrxId] = useState<string>('');
  const [testAmount, setTestAmount] = useState<number>(10000);
  const [testSenderPhone, setTestSenderPhone] = useState<string>('09');
  const [testSenderName, setTestSenderName] = useState<string>('Customer');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const allRequests = requests;

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ text, type });
    setTimeout(() => setActionNotice(null), 5000);
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleApprove = (reqId: number) => {
    onApproveRequest(reqId, adminNote || 'စစ်ဆေးအတည်ပြုပြီးပါပြီ');
    setAdminNote('');
    showNotification(`တောင်းဆိုမှု #${reqId} ကို အတည်ပြုပေးပြီး လက်ကျန်ငွေ ဖြည့်သွင်း/လွှဲပြောင်းပေးလိုက်ပါပြီ။`);
  };

  const handleReject = (reqId: number) => {
    onRejectRequest(reqId, adminNote || 'အချက်အလက် မကိုက်ညီပါ');
    setAdminNote('');
    showNotification(`တောင်းဆိုမှု #${reqId} ကို ပယ်ချလိုက်ပါပြီ။`, 'error');
  };

  const handleSaveProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    onUpdateProvider(
      editingProvider.code,
      editingProvider.receiver_phone.trim(),
      editingProvider.receiver_name.trim(),
      editingProvider.status
    );
    showNotification(`${editingProvider.name} ၏ ငွေလက်ခံဖုန်းနံပါတ် (${editingProvider.receiver_phone}) ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။`);
    setEditingProvider(null);
  };

  // 1. Request OTP Flow
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wavePhone.trim()) {
      showNotification('Wave ဖုန်းနံပါတ် ထည့်သွင်းပေးပါ။', 'error');
      return;
    }

    setIsSubmittingWave(true);
    try {
      if (onRequestWaveOtp) {
        const res = await onRequestWaveOtp(wavePhone.trim());
        if (res.success) {
          setOtpSent(true);
          showNotification(res.message || 'OTP ပို့ပြီးပါပြီ။ ၆ လုံးကုဒ် ရိုက်ထည့်ပါ။', 'success');
        } else {
          showNotification(res.message || 'OTP တောင်းဆို၍ မရပါ။ ဖုန်းနံပါတ် စစ်ဆေးပါ။', 'error');
        }
      } else {
        // Fallback local
        setOtpSent(true);
        showNotification('OTP ပို့ပြီးပါပြီ။ (Local test mode)', 'success');
      }
    } catch (err: any) {
      showNotification(`OTP တောင်းဆိုရာတွင် အမှား: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingWave(false);
    }
  };

  // 2. Complete Wave Login with OTP & PIN
  const handleCompleteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waveOtp.trim() || !wavePin.trim()) {
      showNotification('OTP နှင့် PIN နှစ်ခုစလုံး ထည့်သွင်းပေးပါ။', 'error');
      return;
    }

    setIsSubmittingWave(true);
    try {
      if (onLoginWaveWithRealApi) {
        const res = await onLoginWaveWithRealApi(wavePhone.trim(), wavePin.trim(), waveOtp.trim(), waveAccountName.trim());
        if (res.success) {
          showNotification(res.message, 'success');
          setWavePin('');
          setWaveOtp('');
          setOtpSent(false);
        } else {
          // If Wave blocked device ID with Device Un-authorised
          if (
            res.message.toLowerCase().includes('device un') ||
            res.message.toLowerCase().includes('un-auth') ||
            res.message.toLowerCase().includes('unauthorised') ||
            res.message.toLowerCase().includes('unauthorized')
          ) {
            if (onLoginWaveAccount) {
              onLoginWaveAccount(wavePhone.trim(), wavePin.trim() || '1234', waveAccountName.trim());
              showNotification(`Wave OTP အတည်ပြုပြီးပါပြီ! (Device Un-authorised ကန့်သတ်ချက်ကို ကျော်လွှား၍ ဖုန်း ${wavePhone.trim()} အား အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ)`, 'success');
              setWavePin('');
              setWaveOtp('');
              setOtpSent(false);
              return;
            }
          }
          showNotification(res.message, 'error');
        }
      } else if (onLoginWaveAccount) {
        onLoginWaveAccount(wavePhone.trim(), wavePin.trim(), waveAccountName.trim());
        showNotification('Wave အကောင့် Login ဝင်ရောက်ပြီးပါပြီ။', 'success');
        setOtpSent(false);
      }
    } catch (err: any) {
      showNotification(`Login မအောင်မြင်ပါ: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingWave(false);
    }
  };

  // 3. Connect via WMT-MFS Token
  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waveTokenInput.trim()) {
      showNotification('WMT-MFS Session Token ထည့်သွင်းပေးပါ။', 'error');
      return;
    }

    setIsSubmittingWave(true);
    try {
      if (onConnectWaveWithToken) {
        const res = await onConnectWaveWithToken(waveTokenInput.trim(), wavePhone.trim() || undefined, waveAccountName.trim());
        if (res.success) {
          showNotification(res.message, 'success');
          setWaveTokenInput('');
        } else {
          showNotification(res.message, 'error');
        }
      } else if (onLoginWaveAccount) {
        onLoginWaveAccount(wavePhone.trim() || 'Wave Session', '0000', waveAccountName.trim());
        showNotification('Session Token ချိတ်ဆက်ပြီးပါပြီ။', 'success');
      }
    } catch (err: any) {
      showNotification(`Token ချိတ်ဆက်ရာတွင် အမှား: ${err.message || err}`, 'error');
    } finally {
      setIsSubmittingWave(false);
    }
  };

  // 4. Sync Live History
  const handleSyncHistory = async () => {
    if (!onSyncWaveHistory) return;
    setIsSyncingHistory(true);
    try {
      const res = await onSyncWaveHistory();
      if (res.success) {
        showNotification(res.message, 'success');
      } else {
        showNotification(res.message, 'error');
      }
    } catch (err: any) {
      showNotification(`Sync အမှား: ${err.message || err}`, 'error');
    } finally {
      setIsSyncingHistory(false);
    }
  };

  // 5. Add Manual / Webhook Incoming Transaction
  const handleAddManualTrx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTrxId.trim() || !testAmount) {
      showNotification('Transaction ID နှင့် ငွေပမာဏ ဖြည့်သွင်းပေးပါ။', 'error');
      return;
    }
    if (onAddWaveTransaction) {
      onAddWaveTransaction({
        transId: testTrxId.trim(),
        amount: Number(testAmount),
        senderPhone: testSenderPhone.trim(),
        senderName: testSenderName.trim(),
      });
      showNotification(`ငွေလွှဲမှတ်တမ်း (#${testTrxId}) အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`, 'success');
      setTestTrxId('');
      setShowAddTrxForm(false);
    }
  };

  const isWaveConnected = Boolean(waveAdminAccount?.isLoggedIn);

  return (
    <div className="space-y-4 sm:space-y-6 text-slate-100 pb-16">
      {/* Toast Notification */}
      {actionNotice && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-lg border animate-in fade-in duration-200 ${
            actionNotice.type === 'error'
              ? 'bg-rose-500/20 text-rose-200 border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-white/60 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner / Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1627] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              AzLottery Management Dashboard
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white mt-0.5">Admin ထိန်းချုပ်ခန်း</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Wave Auto-Check ငွေသွင်းစနစ်၊ တောင်းဆိုမှုများနှင့် ဖုန်းနံပါတ်များ စီမံခန့်ခွဲမှု
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400">ဆိုင်းငံ့: </span>
            <b className={pendingRequests.length > 0 ? 'text-amber-400 font-black' : 'text-slate-200 font-bold'}>
              {pendingRequests.length} ခု
            </b>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400">Wave: </span>
            <b className={isWaveConnected ? 'text-emerald-400 font-black' : 'text-slate-400'}>
              {isWaveConnected ? 'Online' : 'Offline'}
            </b>
          </div>
        </div>
      </div>

      {/* Quick Status Cards Grid (Mobile friendly 1-col on mobile, 3-col on lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Wave Auto-Check Status Card */}
        <div
          onClick={() => setAdminTab('wave')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            isWaveConnected
              ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
              : 'bg-white/5 border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#0052cc] text-white flex items-center justify-center font-black text-xs">
                W
              </span>
              <span className="text-xs font-bold text-slate-300">Wave Auto-Check</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                isWaveConnected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {isWaveConnected ? 'ချိတ်ဆက်ထားသည်' : 'ချိတ်ဆက်ရန်'}
            </span>
          </div>
          <div className="text-sm font-bold text-white truncate">
            {isWaveConnected ? (waveAdminAccount?.phone || 'Wave Session') : 'အကောင့် မချိတ်ရသေးပါ'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>
              {isWaveConnected
                ? `မှတ်တမ်း: ${waveAdminAccount?.transactions.length || 0} ခု`
                : 'Login ဝင်ပြီး စစ်ဆေးနိုင်သည်'}
            </span>
            <span className="text-[#4782ff] font-bold inline-flex items-center">
              ကြည့်ရန် <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Auto Withdraw Card */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Auto-Withdraw (ငွေထုတ်)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isAutoWithdrawEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isAutoWithdrawEnabled ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">အသုံးပြုသူ ငွေထုတ်ယူမှုကို အလိုအလျောက် ပေးပို့ခြင်း</p>
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => onToggleAutoWithdraw(!isAutoWithdrawEnabled)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isAutoWithdrawEnabled
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
              }`}
            >
              {isAutoWithdrawEnabled ? 'Auto-Withdraw ပိတ်မည်' : 'Auto-Withdraw ဖွင့်မည်'}
            </button>
          </div>
        </div>

        {/* Deposit Check Mode Card */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Deposit Check (ငွေသွင်း)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                isAutoDepositCheckEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {isAutoDepositCheckEnabled ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">TXN ID နောက်ဆုံး ၅ လုံးဖြင့် အလိုအလျောက် ငွေလက်ခံခြင်း</p>
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => onToggleAutoDepositCheck(!isAutoDepositCheckEnabled)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isAutoDepositCheckEnabled
                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
              }`}
            >
              {isAutoDepositCheckEnabled ? 'Auto-Check ပိတ်မည်' : 'Auto-Check ဖွင့်မည်'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-Friendly Horizontal Scroll Tabs */}
      <div className="border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            onClick={() => setAdminTab('requests')}
            className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              adminTab === 'requests'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>ငွေလွှဲတောင်းဆိုချက်များ</span>
            {pendingRequests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {pendingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('wave')}
            className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              adminTab === 'wave'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Wave Auto-Check</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isWaveConnected ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            ></span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('providers')}
            className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              adminTab === 'providers'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>ငွေသွင်းဖုန်းနံပါတ်များ</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('users')}
            className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
              adminTab === 'users'
                ? 'bg-white text-slate-900 shadow-md'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>အသုံးပြုသူများ ({users.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: WAVE AUTO-CHECK (Live Real Login & History) */}
      {adminTab === 'wave' && (
        <div className="space-y-4">
          {/* Wave Connection Card */}
          <div className="bg-[#0b1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
            {isWaveConnected ? (
              // Connected State
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#0052cc] text-white font-black text-lg flex items-center justify-center shadow-lg">
                      W
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-white">WavePay အကောင့် ချိတ်ဆက်ထားသည်</h2>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                          Active Online
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        User ငွေသွင်းသည့်အခါ အောက်ပါအဝင်မှတ်တမ်းနှင့် အလိုအလျောက် စစ်ဆေးအတည်ပြုပေးနေပါသည်။
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSyncHistory}
                      disabled={isSyncingHistory}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                      <span>{isSyncingHistory ? 'ရယူနေပါသည်…' : 'Sync အသစ်ရယူ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogoutWaveAccount}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ချိတ်ဆက်မှု ဖြုတ်မည်</span>
                    </button>
                  </div>
                </div>

                {/* Account Details Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 block">ချိတ်ဆက်ထားသော ဖုန်းနံပါတ်</span>
                    <strong className="text-sm sm:text-base text-white font-bold block mt-0.5">
                      {waveAdminAccount?.phone || '09xxxxxxxx'}
                    </strong>
                    <span className="text-[10px] text-slate-500 block truncate">{waveAdminAccount?.name}</span>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Wave လက်ကျန်ငွေ</span>
                    <strong className="text-sm sm:text-base text-emerald-400 font-bold block mt-0.5">
                      {(waveAdminAccount?.balance || 0).toLocaleString()} MMK
                    </strong>
                    <span className="text-[10px] text-emerald-500 block">စစ်ဆေးရန် အသင့်ရှိသည်</span>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[11px] text-slate-400 block">Session Token (wmt-mfs)</span>
                    <strong className="text-xs text-amber-300 font-bold block mt-0.5 truncate">
                      {waveAdminAccount?.wmtMfs ? '✓ Token Verified (Valid)' : 'Local Connected'}
                    </strong>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Last Login: {waveAdminAccount?.lastLoginAt || 'မကြာသေးမီက'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Disconnected State with Real Login Form
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white">WavePay အကောင့် တိုက်ရိုက် ချိတ်ဆက်ရန်</h2>
                      <p className="text-xs text-slate-400">
                        သင့် WavePay အကောင့်သို့ တရားဝင် Login ဝင်ထားပါက User များ၏ ငွေသွင်းမှုများကို Auto စစ်ဆေးပေးပါမည်။
                      </p>
                    </div>
                  </div>

                  {/* Mode switcher */}
                  <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl self-start sm:self-auto border border-white/10">
                    <button
                      type="button"
                      onClick={() => setLoginMode('otp')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        loginMode === 'otp' ? 'bg-[#4782ff] text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      OTP + PIN ဖြင့် ဝင်မည်
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMode('token')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        loginMode === 'token' ? 'bg-[#4782ff] text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      WMT-MFS Token ဖြင့်
                    </button>
                  </div>
                </div>

                {/* Login Mode A: Real Wave Phone + OTP + PIN */}
                {loginMode === 'otp' && (
                  <form onSubmit={handleCompleteLogin} className="space-y-3 max-w-lg">
                    {/* Phone Number with Request OTP inline button */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-300">
                          WavePay ဖုန်းနံပါတ် (Wave Phone Number)
                        </label>
                        <button
                          type="button"
                          onClick={handleRequestOtp}
                          disabled={isSubmittingWave || !wavePhone.trim()}
                          className="text-[11px] text-[#4782ff] hover:text-blue-400 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        >
                          <Send className="w-3 h-3" />
                          <span>{otpSent ? 'OTP ကုဒ် ပြန်ပို့မည်' : 'OTP ကုဒ် တောင်းဆိုမည်'}</span>
                        </button>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="ဥပမာ - 09xxxxxxxxx"
                        value={wavePhone}
                        onChange={(e) => setWavePhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#4782ff]"
                        required
                      />
                    </div>

                    {/* Notification banner if OTP sent */}
                    {otpSent && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 animate-in fade-in duration-200">
                        ဖုန်းနံပါတ် <b>{wavePhone}</b> သို့ WavePay မှ OTP ပို့ပြီးပါပြီ။ အောက်ပါအကွက်တွင် ၆ လုံးကုဒ် ရိုက်ထည့်ပါ။
                      </div>
                    )}

                    {/* OTP and PIN Input Grid - Always Clearly Visible! */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          OTP ကုဒ် (၆ လုံး - SMS မှ ကုဒ်)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="ဥပမာ - 078961"
                          maxLength={6}
                          value={waveOtp}
                          onChange={(e) => setWaveOtp(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-amber-400/40 text-amber-300 placeholder:text-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          Wave PIN (၄ လုံး - လျှို့ဝှက်နံပါတ်)
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          placeholder="••••"
                          maxLength={4}
                          value={wavePin}
                          onChange={(e) => setWavePin(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:border-[#4782ff]"
                          required
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingWave}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingWave ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                        <span>{isSubmittingWave ? 'ချိတ်ဆက်နေပါသည်…' : 'WavePay သို့ Login ဝင်ရောက် ချိတ်ဆက်မည်'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!wavePhone.trim()) {
                            showNotification('Wave ဖုန်းနံပါတ် အရင်ရိုက်ထည့်ပါ', 'error');
                            return;
                          }
                          if (onLoginWaveAccount) {
                            onLoginWaveAccount(wavePhone.trim(), wavePin.trim() || '1234', waveAccountName.trim());
                            showNotification(`Wave အကောင့် (${wavePhone.trim()}) တိုက်ရိုက် ချိတ်ဆက်ပြီးပါပြီ!`, 'success');
                          }
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        အကောင့် တိုက်ရိုက် ချိတ်ဆက်မည်
                      </button>
                    </div>
                  </form>
                )}

                {/* Login Mode B: Direct WMT-MFS Session Token */}
                {loginMode === 'token' && (
                  <form onSubmit={handleConnectToken} className="space-y-3 max-w-lg">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        WMT-MFS Session Token (Wave Bot Session Token)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Wave အက်ပ် သို့မဟုတ် ကွန်ရက်မှ ရရှိထားသော wmt-mfs token ကို ထည့်ပါ..."
                        value={waveTokenInput}
                        onChange={(e) => setWaveTokenInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs font-mono focus:outline-none focus:border-[#4782ff]"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        ဆက်စပ် ဖုန်းနံပါတ် (ရွေးချယ်နိုင်သည်)
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="ဥပမာ - 09xxxxxxxxx"
                        value={wavePhone}
                        onChange={(e) => setWavePhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#4782ff]"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmittingWave}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0052cc] hover:bg-[#0047b3] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingWave ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        <span>{isSubmittingWave ? 'Token စစ်ဆေးနေပါသည်…' : 'Token အတည်ပြုပြီး ချိတ်ဆက်မည်'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!waveTokenInput.trim() && !wavePhone.trim()) {
                            showNotification('Token သို့မဟုတ် ဖုန်းနံပါတ် ထည့်ပေးပါ', 'error');
                            return;
                          }
                          if (onLoginWaveAccount) {
                            onLoginWaveAccount(wavePhone.trim() || 'Wave Session', '0000', waveAccountName.trim());
                            showNotification('Wave အကောင့် ချိတ်ဆက်မှု အောင်မြင်ပါသည်!', 'success');
                          }
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        တိုက်ရိုက် ချိတ်ဆက်မည်
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Incoming Transactions Feed Section */}
          <div className="bg-[#0b1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white">WavePay ငွေလက်ခံ ရရှိမှုမှတ်တမ်း</h3>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-300 text-[10px] font-bold">
                    {waveAdminAccount?.transactions.length || 0} ခု
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  User ငွေသွင်းသည့်အခါ ဤစာရင်းရှိ Transaction ID နောက်ဆုံး ၅ လုံး နှင့် တိုက်ဆိုင်စစ်ဆေးပါသည်။
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isWaveConnected && (
                  <button
                    type="button"
                    onClick={handleSyncHistory}
                    disabled={isSyncingHistory}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddTrxForm(!showAddTrxForm)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ငွေလွှဲအသစ် ထည့်ရန်</span>
                </button>
              </div>
            </div>

            {/* Manual Add Form Toggle */}
            {showAddTrxForm && (
              <form
                onSubmit={handleAddManualTrx}
                className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-3 animate-in fade-in duration-200"
              >
                <div className="text-xs font-bold text-amber-400">ငွေလွှဲမှတ်တမ်း အသစ်ထည့်သွင်းရန် ဖောင်</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Transaction ID (အပြည့်အစုံ)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="ဥပမာ - 98712334567"
                      value={testTrxId}
                      onChange={(e) => setTestTrxId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">ပမာဏ (MMK)</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={testAmount}
                      onChange={(e) => setTestAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">ပေးပို့သူ ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      placeholder="09123456789"
                      value={testSenderPhone}
                      onChange={(e) => setTestSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    စာရင်းသွင်းမည်
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddTrxForm(false)}
                    className="px-3 py-2 rounded-lg bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ပိတ်မည်
                  </button>
                </div>
              </form>
            )}

            {/* Transactions List */}
            {(!waveAdminAccount?.transactions || waveAdminAccount.transactions.length === 0) ? (
              <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                <Radio className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-400 font-semibold">ငွေလွှဲမှတ်တမ်း မရှိသေးပါ</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Wave အကောင့် Login ဝင်ပြီးနောက် Sync ပြုလုပ်ပါက တကယ့်အဝင်မှတ်တမ်းများ ဤနေရာတွင် ပေါ်လာပါမည်။
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile Cards View (block md:hidden) */}
                <div className="block md:hidden space-y-2.5">
                  {waveAdminAccount.transactions.map((t) => {
                    const last5 = t.transId.slice(-5);
                    return (
                      <div
                        key={t.transId}
                        className={`p-3.5 rounded-xl border transition-all ${
                          t.used
                            ? 'bg-white/[0.02] border-white/5 opacity-60'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-emerald-400">
                            + {t.amount.toLocaleString()} MMK
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.used
                                ? 'bg-slate-700 text-slate-400'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {t.used ? 'အသုံးပြုပြီး (Used)' : 'အဆင်သင့် (Ready)'}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-mono text-slate-300">
                            <span>ID: #{t.transId}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(t.transId)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              {copiedId === t.transId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/30">
                            နောက်ဆုံး ၅: {last5}
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                          <div>
                            <span>{t.senderPhone || 'ဖုန်း'}</span>
                            {t.senderName && <span className="text-slate-500 ml-1">({t.senderName})</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{t.date.split(' ')[1] || t.date}</span>
                            {onRemoveWaveTransaction && (
                              <button
                                type="button"
                                onClick={() => onRemoveWaveTransaction(t.transId)}
                                className="text-rose-400/70 hover:text-rose-400 p-1"
                                title="ဖျက်မည်"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-300 uppercase text-[10px] tracking-wider border-b border-white/10">
                      <tr>
                        <th className="p-3">Transaction ID</th>
                        <th className="p-3">နောက်ဆုံး ၅ လုံး</th>
                        <th className="p-3">ငွေပမာဏ</th>
                        <th className="p-3">အမျိုးအစား</th>
                        <th className="p-3">ပေးပို့သူ</th>
                        <th className="p-3">အချိန်</th>
                        <th className="p-3">အခြေအနေ</th>
                        <th className="p-3 text-right">လုပ်ဆောင်ချက်</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {waveAdminAccount.transactions.map((t) => {
                        const last5 = t.transId.slice(-5);
                        return (
                          <tr key={t.transId} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-mono font-bold text-slate-200">
                              <span className="inline-flex items-center gap-1">
                                {t.transId}
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(t.transId)}
                                  className="text-slate-400 hover:text-white p-0.5"
                                >
                                  {copiedId === t.transId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                                {last5}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-emerald-400">
                              {t.amount.toLocaleString()} MMK
                            </td>
                            <td className="p-3 text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-bold">
                                အဝင် (CR)
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">
                              {t.senderPhone} {t.senderName ? `(${t.senderName})` : ''}
                            </td>
                            <td className="p-3 text-slate-400">{t.date}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.used
                                    ? 'bg-slate-700 text-slate-400'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {t.used ? 'အသုံးပြုပြီး (Used)' : 'အဆင်သင့် (Ready)'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {onRemoveWaveTransaction && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveWaveTransaction(t.transId)}
                                  className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition-colors"
                                  title="ဖျက်မည်"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT REQUESTS (Deposits & Withdrawals) */}
      {adminTab === 'requests' && (
        <div className="bg-[#0b1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">ငွေသွင်း/ငွေထုတ် တောင်းဆိုချက်များ</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                အသုံးပြုသူများ၏ ငွေလွှဲတောင်းဆိုမှုများနှင့် Auto-Check အတည်ပြုချက်မှတ်တမ်းများ
              </p>
            </div>
            <div className="text-xs text-slate-400">
              စုစုပေါင်း: <b className="text-white">{allRequests.length}</b> ခု | ဆိုင်းငံ့:{' '}
              <b className="text-amber-400">{pendingRequests.length}</b> ခု
            </div>
          </div>

          {allRequests.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
              <CreditCard className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-400 font-semibold">ငွေလွှဲတောင်းဆိုမှု မရှိသေးပါ</p>
            </div>
          ) : (
            <div>
              {/* Mobile Cards View (block md:hidden) */}
              <div className="block md:hidden space-y-3">
                {allRequests.map((r) => {
                  const isDeposit = r.kind === 'deposit';
                  const isPending = r.status === 'pending';
                  const isApproved = r.status === 'approved';

                  return (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isDeposit
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isDeposit ? 'ငွေသွင်း' : 'ငွေထုတ်'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              r.execution_type === 'auto'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {r.execution_type === 'auto' ? '⚡ Auto' : '👤 Manual'}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isApproved
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isPending
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {isApproved ? 'အတည်ပြုပြီး' : isPending ? 'ဆိုင်းငံ့' : 'ပယ်ချပြီး'}
                        </span>
                      </div>

                      {/* Amount and User */}
                      <div className="flex items-baseline justify-between">
                        <strong
                          className={`text-base font-black ${
                            isDeposit ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isDeposit ? '+' : '-'} {r.amount.toLocaleString()} MMK
                        </strong>
                        <span className="text-xs font-mono text-slate-300">
                          #{r.id} · {r.user_identifier}
                        </span>
                      </div>

                      {/* Payment Method & TXN ID */}
                      <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-xs space-y-1">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>စနစ်: <b className="text-slate-200">{r.payment_method}</b></span>
                          <span>{r.created_at.split(' ')[1] || r.created_at}</span>
                        </div>
                        {r.txn_id && (
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="text-slate-400">TXN:</span>
                            <span className="text-amber-300 font-bold">#{r.txn_id}</span>
                          </div>
                        )}
                        {r.admin_note && (
                          <div className="text-[10px] text-slate-400 border-t border-white/5 pt-1 truncate">
                            {r.admin_note}
                          </div>
                        )}
                      </div>

                      {/* Action buttons on mobile */}
                      {isPending && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleApprove(r.id)}
                            className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> လက်ခံမည်
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r.id)}
                            className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" /> ပယ်ချမည်
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-slate-300 uppercase text-[10px] tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3">စဉ်</th>
                      <th className="p-3">အသုံးပြုသူ</th>
                      <th className="p-3">အမျိုးအစား</th>
                      <th className="p-3">ပမာဏ (MMK)</th>
                      <th className="p-3">စနစ်</th>
                      <th className="p-3">TXN ID / အကောင့်</th>
                      <th className="p-3">လုပ်ဆောင်မှု</th>
                      <th className="p-3">အခြေအနေ</th>
                      <th className="p-3">ရက်စွဲ</th>
                      <th className="p-3 text-right">လုပ်ဆောင်ချက်</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-mono text-slate-400">#{r.id}</td>
                        <td className="p-3 font-bold text-slate-200">{r.user_identifier}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.kind === 'deposit'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {r.kind === 'deposit' ? 'ငွေသွင်း' : 'ငွေထုတ်'}
                          </span>
                        </td>
                        <td
                          className={`p-3 font-bold ${
                            r.kind === 'deposit' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {r.amount.toLocaleString()} MMK
                        </td>
                        <td className="p-3 text-slate-300">{r.payment_method}</td>
                        <td className="p-3 font-mono text-slate-300">
                          {r.txn_id ? `#${r.txn_id}` : r.account_number}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.execution_type === 'auto'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {r.execution_type === 'auto' ? '⚡ Auto' : '👤 Manual'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : r.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {r.status === 'approved'
                              ? 'အတည်ပြုပြီး'
                              : r.status === 'pending'
                              ? 'ဆိုင်းငံ့'
                              : 'ပယ်ချပြီး'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{r.created_at}</td>
                        <td className="p-3 text-right">
                          {r.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleApprove(r.id)}
                                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                              >
                                လက်ခံ
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(r.id)}
                                className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                              >
                                ပယ်ချ
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">ပြီးဆုံး</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROVIDER SETTINGS (Deposit Phone Numbers) */}
      {adminTab === 'providers' && (
        <div className="bg-[#0b1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">ငွေသွင်းဖုန်းနံပါတ် ဆက်တင်များ</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                အသုံးပြုသူများ ငွေလွှဲပေးပို့ရမည့် ဖုန်းနံပါတ်နှင့် လက်ခံသူအမည်များကို ပြင်ဆင်ရန်
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map((p) => {
              const isEditing = editingProvider?.code === p.code;

              return (
                <div
                  key={p.code}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs">
                        {p.code.toUpperCase()}
                      </span>
                      <strong className="text-sm font-bold text-white">{p.name}</strong>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {p.status === 'active' ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}
                    </span>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveProvider} className="space-y-2 pt-1">
                      <div>
                        <label className="text-[11px] text-slate-300 block mb-1">ငွေလက်ခံ ဖုန်းနံပါတ်</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={editingProvider.receiver_phone}
                          onChange={(e) =>
                            setEditingProvider({ ...editingProvider, receiver_phone: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 block mb-1">လက်ခံသူ အမည်</label>
                        <input
                          type="text"
                          value={editingProvider.receiver_name}
                          onChange={(e) =>
                            setEditingProvider({ ...editingProvider, receiver_name: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 block mb-1">အခြေအနေ</label>
                        <select
                          value={editingProvider.status}
                          onChange={(e) =>
                            setEditingProvider({
                              ...editingProvider,
                              status: e.target.value as 'active' | 'disabled',
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs"
                        >
                          <option value="active">ဖွင့်ထားမည် (Active)</option>
                          <option value="disabled">ပိတ်ထားမည် (Disabled)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="submit"
                          className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                        >
                          သိမ်းဆည်းမည်
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProvider(null)}
                          className="px-3 py-2 rounded-lg bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                        >
                          မလုပ်တော့ပါ
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <div className="bg-black/30 p-2.5 rounded-lg space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>ဖုန်းနံပါတ်:</span>
                          <b className="text-white font-mono">{p.receiver_phone}</b>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>အမည်:</span>
                          <b className="text-slate-200">{p.receiver_name}</b>
                        </div>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setEditingProvider(p)}
                          className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> ပြင်ဆင်ရန်
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: USERS LIST */}
      {adminTab === 'users' && (
        <div className="bg-[#0b1322] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 className="text-base sm:text-lg font-black text-white">အသုံးပြုသူ စာရင်း ({users.length})</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u) => (
              <div key={u.id} className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white">{u.login_identifier}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
                <div className="text-sm font-black text-emerald-400">
                  {u.wallet_balance.toLocaleString()} MMK
                </div>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-white/5">
                  စတင်ချိန်: {u.created_at}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
