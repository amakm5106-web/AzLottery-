'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { User, PaymentRequest, ProviderConnection, GatewayWallet } from '@/lib/store';
import { extractReceiptInfo, type ParsedReceipt } from '@/lib/receiptParser';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Building,
  CreditCard,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';

interface WalletViewProps {
  currentUser: User;
  initialTab?: 'deposit' | 'withdraw';
  requests: PaymentRequest[];
  providers: ProviderConnection[];
  gatewayWallets: Record<string, GatewayWallet>;
  waveAdminAccount?: import('@/lib/store').WaveAdminAccount;
  isAutoWithdrawEnabled: boolean;
  isAutoDepositCheckEnabled: boolean;
  onResetBalanceToZero?: () => void;
  onCreateDeposit: (
    amountMMK: number,
    paymentMethod: string,
    accountNumber: string,
    accountName: string,
    txnInputOrSlipText: string,
    note?: string
  ) => { autoApproved: boolean; trxId: string; amount: number; message: string };
  onCreateWithdrawal: (
    amountMMK: number,
    paymentMethod: string,
    accountNumber: string,
    accountName: string,
    note?: string
  ) => { autoDisbursed: boolean; trxId?: string; disbursedFrom?: string; amount: number; message: string };
}

export const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  initialTab = 'deposit',
  requests,
  providers,
  waveAdminAccount,
  onCreateDeposit,
  onCreateWithdrawal,
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);
  const [selectedProvider, setSelectedProvider] = useState<string>('kbz');
  const [copied, setCopied] = useState<boolean>(false);

  // Deposit Form State
  const [depAmount, setDepAmount] = useState<number>(10000);
  const [depSenderPhone, setDepSenderPhone] = useState<string>(currentUser.login_identifier || '');
  const [depSenderName, setDepSenderName] = useState<string>('အကောင့်ပိုင်ရှင်');
  const [depTxnId, setDepTxnId] = useState<string>('');
  const [showSlipInput, setShowSlipInput] = useState<boolean>(false);
  const [depSlipText, setDepSlipText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<ParsedReceipt | null>(null);
  const [depResult, setDepResult] = useState<{ autoApproved: boolean; message: string; trxId: string; amount?: number } | null>(null);
  const [depError, setDepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Withdraw Form State
  const [wdAmount, setWdAmount] = useState<number>(10000);
  const [wdPhone, setWdPhone] = useState<string>(currentUser.login_identifier || '');
  const [wdName, setWdName] = useState<string>('');
  const [wdResult, setWdResult] = useState<{ autoDisbursed: boolean; message: string; trxId?: string } | null>(null);
  const [wdError, setWdError] = useState<string | null>(null);

  const currentProviderObj = providers.find((p) => p.code === selectedProvider) || providers[0] || {
    code: 'kbz',
    name: 'KBZPay (KPay)',
    receiver_phone: '09-987654321',
    receiver_name: 'AzLottery Official',
    status: 'active',
  };

  const handleCopyReceiver = () => {
    if (!currentProviderObj?.receiver_phone) return;
    navigator.clipboard.writeText(currentProviderObj.receiver_phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParseSlip = (text: string) => {
    setDepSlipText(text);
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }
    const info = extractReceiptInfo(text, depSenderPhone);
    setParsedPreview(info);
    if (info.trx_id && !depTxnId) {
      setDepTxnId(info.trx_id);
    }
    if (info.extracted_amount && info.extracted_amount >= 1000) {
      setDepAmount(info.extracted_amount);
    }
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDepError(null);
    setDepResult(null);

    const inputData = depTxnId.trim() || depSlipText.trim();

    if (!inputData) {
      setDepError('လုပ်ဆောင်ချက် အမှတ်စဉ် (TXN ID) ထည့်သွင်းပေးပါ။');
      return;
    }

    if (!depAmount || depAmount < 1000) {
      setDepError('အနည်းဆုံး ငွေသွင်းပမာဏသည် ၁,၀၀၀ MMK ဖြစ်ရပါမည်။');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = onCreateDeposit(
        depAmount,
        currentProviderObj.name,
        depSenderPhone,
        depSenderName || 'အကောင့်ပိုင်ရှင်',
        inputData
      );

      setDepResult({
        autoApproved: res.autoApproved,
        message: res.message,
        trxId: res.trxId,
        amount: depAmount,
      });
      setDepTxnId('');
      setDepSlipText('');
      setParsedPreview(null);
    } catch (err: any) {
      setDepError(err.message || 'ငွေသွင်းတောင်းဆိုမှု မအောင်မြင်ပါ။');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWdError(null);
    setWdResult(null);

    if (wdAmount < 1000) {
      setWdError('အနည်းဆုံး ငွေထုတ်ပမာဏသည် ၁,၀၀၀ MMK ဖြစ်ရပါမည်။');
      return;
    }

    if (currentUser.wallet_balance < wdAmount) {
      setWdError('ထုတ်ယူရန် MMK လက်ကျန်ငွေ မလုံလောက်ပါ။');
      return;
    }

    try {
      const res = onCreateWithdrawal(
        wdAmount,
        currentProviderObj.name,
        wdPhone,
        wdName || 'အကောင့်ပိုင်ရှင်'
      );
      setWdResult({
        autoDisbursed: res.autoDisbursed,
        message: res.message,
        trxId: res.trxId,
      });
    } catch (err: any) {
      setWdError(err.message || 'ငွေထုတ်တောင်းဆိုမှု မအောင်မြင်ပါ။');
    }
  };

  const myRequests = requests.filter((r) => r.user_id === currentUser.id);

  const quickAmounts = [3000, 5000, 10000, 20000, 50000, 100000, 200000];

  return (
    <div className="max-w-md mx-auto space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Sleek Top Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#0f172a] p-5 text-white shadow-xl border border-blue-400/20">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-blue-200 text-xs font-semibold mb-1">
              <Wallet className="w-3.5 h-3.5 text-blue-300" />
              <span>ရရှိနိုင်သော လက်ကျန်ငွေ</span>
            </div>
            <div className="text-3xl font-black font-mono tracking-tight text-white flex items-baseline gap-1.5">
              <span>{(currentUser?.wallet_balance ?? 0).toLocaleString()}</span>
              <span className="text-sm font-bold text-amber-300">MMK</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-emerald-300 border border-white/10 backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> စနစ် အဆင်သင့်
          </span>
        </div>

        {/* Tab Switcher Pills */}
        <div className="relative z-10 grid grid-cols-3 gap-2 mt-5 bg-black/25 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('deposit')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'deposit'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" /> ငွေသွင်း
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdraw')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'withdraw'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" /> ငွေထုတ်
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" /> မှတ်တမ်း
          </button>
        </div>
      </div>

      {/* ======================= DEPOSIT TAB ======================= */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          {/* Step 1: Select Payment Provider */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#4782ff]" /> ငွေလွှဲမည့် ပလက်ဖောင်း ရွေးချယ်ပါ
              </span>
              <span className="text-[11px] text-slate-400">1/3 အဆင့်</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.code;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(p.code);
                      setDepError(null);
                      setDepResult(null);
                    }}
                    className={`relative p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#4782ff] bg-blue-50/70 text-[#1e40af] font-bold shadow-xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#4782ff] text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      {p.code === 'kbz' ? (
                        <Image
                          src="/cklottery/png/kbz_icon-j2UvitJy.png"
                          alt="KBZPay"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : p.code === 'wave' ? (
                        <div className="w-8 h-8 rounded-full bg-[#FFE600] text-black font-black text-[9px] flex items-center justify-center shadow-xs border border-yellow-400">
                          WAVE
                        </div>
                      ) : p.code === 'aya' ? (
                        <div className="w-8 h-8 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center shadow-xs">
                          AYA
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-black text-[11px] flex items-center justify-center shadow-xs">
                          CB
                        </div>
                      )}
                    </div>
                    <span className="block text-xs font-bold leading-tight">{p.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Official Receiver Account Card (Admin-Configured) */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50/60 to-white p-4 border-2 border-blue-200/90 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5 truncate">
                <Building className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">ငွေလက်ခံမည့်အကောင့် ({currentProviderObj.name})</span>
              </span>
              <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full shrink-0">
                တရားဝင်
              </span>
            </div>

            <div className="bg-white rounded-xl p-3.5 border border-blue-100 flex items-center justify-between gap-3 shadow-xs">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">ငွေလက်ခံ ဖုန်းနံပါတ်:</span>
                <strong className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 block">
                  {currentProviderObj.receiver_phone || 'ဖုန်းနံပါတ်မရှိသေးပါ'}
                </strong>
                <span className="text-xs text-slate-600 font-bold mt-0.5 block">
                  အမည်: <span className="text-blue-800">{currentProviderObj.receiver_name}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyReceiver}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#4782ff] hover:bg-blue-600 text-white'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'ကူးပြီး' : 'နံပါတ်ကူးမည်'}</span>
              </button>
            </div>

            <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed bg-blue-100/60 p-2 rounded-lg flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>အထက်ပါဖုန်းနံပါတ်သို့ ငွေလွှဲပြီးပါက အောက်ပါဖောင်တွင် ငွေလွှဲအချက်အလက် ဖြည့်သွင်းပေးပါ။</span>
            </p>
          </div>

          {/* Step 3: Deposit Submission Form */}
          <form onSubmit={handleDepositSubmit} className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-200 space-y-4">
            {/* Amount Selection */}
            <div className="space-y-1.5">
              <label htmlFor="dep-amount" className="text-xs font-bold text-slate-800 block">
                ငွေသွင်းမည့် ပမာဏ (MMK)
              </label>
              <div className="relative">
                <input
                  id="dep-amount"
                  type="number"
                  min="1000"
                  max="10000000"
                  step="500"
                  value={depAmount || ''}
                  onChange={(e) => setDepAmount(Number(e.target.value))}
                  placeholder="၁,၀၀၀ MMK အနည်းဆုံး"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  MMK
                </span>
              </div>

              {/* Quick Amount Chips */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepAmount(amt)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold font-mono transition-all border cursor-pointer ${
                      depAmount === amt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {amt >= 100000 ? `${amt / 1000}K` : amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Wave Auto-Check Status Indicator */}
            {selectedProvider === 'wave' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300/80 text-xs text-amber-950 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${waveAdminAccount?.isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="font-bold">
                    {waveAdminAccount?.isLoggedIn
                      ? 'WavePay Auto-Check စနစ် ချိတ်ဆက်ထားသည်'
                      : 'WavePay အကောင့် ချိတ်ဆက်ထားခြင်း မရှိသေးပါ'}
                  </span>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${waveAdminAccount?.isLoggedIn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {waveAdminAccount?.isLoggedIn ? '⚡ Auto-Verified' : 'Manual'}
                </span>
              </div>
            )}

            {/* Sender Phone Number */}
            <div className="space-y-1">
              <label htmlFor="dep-sender" className="text-xs font-bold text-slate-800 block">
                ငွေလွှဲသူ ဖုန်းနံပါတ်
              </label>
              <input
                id="dep-sender"
                type="text"
                value={depSenderPhone}
                onChange={(e) => setDepSenderPhone(e.target.value)}
                placeholder="09..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {/* TXN ID */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="dep-txnid" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Transaction ID နောက်ဆုံး ၅ လုံး (သို့မဟုတ် အပြည့်အစုံ)</span>
                  {selectedProvider === 'wave' && (
                    <span className="text-[10px] bg-amber-400 text-black font-extrabold px-1.5 py-0.5 rounded">
                      နောက်ဆုံး ၅ လုံး
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setShowSlipInput(!showSlipInput)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>{showSlipInput ? 'စလစ်စာသား ဝှက်မည်' : 'စလစ်စာသား ထည့်ရန်'}</span>
                  {showSlipInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <input
                id="dep-txnid"
                type="text"
                value={depTxnId}
                onChange={(e) => setDepTxnId(e.target.value)}
                placeholder={selectedProvider === 'wave' ? 'ဥပမာ - 34567 (သို့မဟုတ် 98712334567)' : 'ဥပမာ - 020261024 သို့မဟုတ် 9876543210'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              {selectedProvider === 'wave' && (
                <p className="text-[11px] text-amber-900/90 font-medium pt-0.5">
                  💡 WavePay ပြေစာရှိ Transaction ID <strong>နောက်ဆုံး ၅ လုံး</strong> ကို ရိုက်ထည့်ပေးပါက စနစ်မှ Wave အကောင့်နှင့် တိုက်စစ်ပြီး ချက်ချင်း Auto စစ်ဆေးငွေဖြည့်ပေးပါမည်။
                </p>
              )}
            </div>

            {/* Collapsible Slip Text Area */}
            {showSlipInput && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in">
                <span className="text-[11px] font-bold text-slate-600 block">
                  ပြေစာ စာသား ကူးထည့်ရန် (Slip OCR Paste):
                </span>
                <textarea
                  rows={2}
                  value={depSlipText}
                  onChange={(e) => handleParseSlip(e.target.value)}
                  placeholder="ပြေစာ စာသား ကူးယူထည့်သွင်းပါက TXN ID နှင့် ငွေပမာဏကို အလိုအလျောက် ရယူပေးပါမည်…"
                  className="w-full p-2 rounded-lg border border-slate-200 text-xs font-mono bg-white text-slate-800 focus:outline-none"
                />
                {parsedPreview?.trx_id && (
                  <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> စလစ်စစ်ဆေးတွေ့ရှိ: TXN #{parsedPreview.trx_id}
                  </div>
                )}
              </div>
            )}

            {/* Error Feedback */}
            {depError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{depError}</span>
              </div>
            )}

            {/* Success Feedback (Auto or Manual Admin Fallback) */}
            {depResult && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-2 border ${
                  depResult.autoApproved
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {depResult.autoApproved ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-700">ငွေသွင်းမှု ချက်ချင်း အလိုအလျောက် အတည်ပြုပြီးပါပြီ!</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                      <span className="text-amber-800">Admin ထံသို့ စစ်ဆေးအတည်ပြုရန် ပေးပို့လိုက်ပါပြီ!</span>
                    </>
                  )}
                </div>
                <p className="text-slate-700 text-xs leading-relaxed">{depResult.message}</p>
                <div
                  className={`font-mono text-[11px] font-semibold pt-1 border-t flex justify-between ${
                    depResult.autoApproved
                      ? 'border-emerald-200 text-emerald-800'
                      : 'border-amber-200 text-amber-900'
                  }`}
                >
                  <span>TXN ID: #{depResult.trxId}</span>
                  <span>{depResult.amount?.toLocaleString()} MMK</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-blue-600 via-[#4782ff] to-indigo-600 hover:opacity-95 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>ငွေသွင်းလွှာ တင်မည်</span>
            </button>
          </form>
        </div>
      )}

      {/* ======================= WITHDRAW TAB ======================= */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-amber-500" /> ငွေထုတ်ယူမည့် ပလက်ဖောင်း ရွေးချယ်ပါ
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {providers.map((p) => {
                const isSelected = selectedProvider === p.code;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(p.code);
                      setWdError(null);
                      setWdResult(null);
                    }}
                    className={`relative p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold shadow-xs ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white'
                    }`}
                  >
                    <div className="relative w-8 h-8 flex items-center justify-center">
                      {p.code === 'kbz' ? (
                        <Image
                          src="/cklottery/png/kbz_icon-j2UvitJy.png"
                          alt="KBZPay"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : p.code === 'wave' ? (
                        <div className="w-8 h-8 rounded-full bg-[#FFE600] text-black font-black text-[9px] flex items-center justify-center shadow-xs border border-yellow-400">
                          WAVE
                        </div>
                      ) : p.code === 'aya' ? (
                        <div className="w-8 h-8 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center">
                          AYA
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-700 text-white font-black text-[11px] flex items-center justify-center">
                          CB
                        </div>
                      )}
                    </div>
                    <span className="block text-xs font-bold leading-tight">{p.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleWithdrawSubmit} className="bg-white rounded-2xl p-4.5 shadow-sm border border-slate-200 space-y-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <label htmlFor="wd-amount" className="text-xs font-bold text-slate-800 block">
                ထုတ်ယူမည့် ပမာဏ (MMK)
              </label>
              <div className="relative">
                <input
                  id="wd-amount"
                  type="number"
                  min="1000"
                  max={currentUser.wallet_balance || 1000000}
                  step="500"
                  value={wdAmount || ''}
                  onChange={(e) => setWdAmount(Number(e.target.value))}
                  placeholder="၁,၀၀၀ MMK အနည်းဆုံး"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  required
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  MMK
                </span>
              </div>

              {/* Quick Chips */}
              <div className="flex gap-2 pt-1">
                {[10000, 50000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setWdAmount(amt)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold font-mono bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {amt.toLocaleString()}
                  </button>
                ))}
                {currentUser.wallet_balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setWdAmount(currentUser.wallet_balance)}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 cursor-pointer"
                  >
                    အားလုံးထုတ်မည်
                  </button>
                )}
              </div>
            </div>

            {/* Receiver Phone */}
            <div className="space-y-1">
              <label htmlFor="wd-phone" className="text-xs font-bold text-slate-800 block">
                သင့် {currentProviderObj.name} ဖုန်းနံပါတ်
              </label>
              <input
                id="wd-phone"
                type="text"
                value={wdPhone}
                onChange={(e) => setWdPhone(e.target.value)}
                placeholder="09..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            {/* Receiver Name */}
            <div className="space-y-1">
              <label htmlFor="wd-name" className="text-xs font-bold text-slate-800 block">
                သင့် အကောင့်အမည်
              </label>
              <input
                id="wd-name"
                type="text"
                value={wdName}
                onChange={(e) => setWdName(e.target.value)}
                placeholder="ဥပမာ - မောင်မောင်"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                required
              />
            </div>

            {/* Error Feedback */}
            {wdError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{wdError}</span>
              </div>
            )}

            {/* Success Feedback */}
            {wdResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>ငွေထုတ်တောင်းဆိုမှု အောင်မြင်ပါသည်!</span>
                </div>
                <p className="text-slate-700">{wdResult.message}</p>
                {wdResult.trxId && (
                  <div className="font-mono text-[11px] text-emerald-700 font-semibold pt-1 border-t border-emerald-200">
                    TXN Reference: #{wdResult.trxId}
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:opacity-95 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>ငွေထုတ်ယူမည်</span>
            </button>
          </form>
        </div>
      )}

      {/* ======================= HISTORY TAB ======================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" /> ငွေသွင်း/ငွေထုတ် မှတ်တမ်း
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              စုစုပေါင်း ({myRequests.length})
            </span>
          </div>

          <div className="space-y-2">
            {myRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                ငွေသွင်း/ငွေထုတ် တောင်းဆိုမှုမှတ်တမ်း မရှိသေးပါ။
              </div>
            ) : (
              myRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      {req.kind === 'deposit' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          <ArrowDownCircle className="w-3 h-3" /> ငွေသွင်း
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                          <ArrowUpCircle className="w-3 h-3" /> ငွေထုတ်
                        </span>
                      )}
                      <span className="font-bold text-slate-800">{req.payment_method}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      TXN: {req.txn_id || '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">{req.created_at}</div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="font-mono font-bold text-sm text-slate-900">
                      {req.kind === 'deposit' ? '+' : '-'}{req.amount.toLocaleString()} MMK
                    </div>
                    <div>
                      {req.status === 'approved' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          အတည်ပြုပြီး
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          ပယ်ချခဲ့သည်
                        </span>
                      )}
                      {req.status === 'pending' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          စောင့်ဆိုင်းဆဲ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
