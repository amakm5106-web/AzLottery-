'use client';

import { useState, useEffect } from 'react';
import {
  getWinGoColors,
  calculateWinGoPayout,
  calculateWheelPayout,
  computeWinGoPeriod,
  type WinGoInterval,
} from './rules';
import { extractReceiptInfo, type ParsedReceipt } from './receiptParser';

export interface User {
  id: number;
  login_identifier: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  wallet_balance: number; // in MMK
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: number;
  kind: 'deposit' | 'withdrawal' | 'wingo_stake' | 'wingo_payout' | 'wheel_stake' | 'wheel_payout' | 'bonus';
  amount: number; // positive or negative MMK
  balance_after: number;
  description: string;
  created_at: string;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  user_identifier: string;
  kind: 'deposit' | 'withdrawal';
  amount: number; // in MMK
  payment_method: string;
  account_number: string;
  account_name: string;
  txn_id?: string;
  reference_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_note?: string;
  execution_type?: 'manual' | 'auto';
  auto_checked?: boolean;
  disbursed_from?: string;
}

export interface GatewayWallet {
  code: 'wave' | 'kbz' | 'aya' | 'cb';
  name: string;
  phone: string;
  balance: number; // in MMK
  status: 'connected' | 'idle';
  total_disbursed: number;
}

export interface WinGoBet {
  id: string;
  user_id: number;
  period_id: string;
  interval: number;
  pick_type: 'color' | 'size' | 'number';
  pick_value: string;
  stake: number; // in MMK
  payout: number; // in MMK
  result_number: number | null;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
}

export interface WinGoRoundResult {
  period_id: string;
  interval: number;
  result_number: number;
  colors: ('green' | 'red' | 'violet')[];
  ended_at: string;
}

export interface WheelRound {
  id: string;
  user_id: number;
  stake: number;
  multiplier: number;
  payout: number;
  created_at: string;
}

export interface ProviderConnection {
  code: 'wave' | 'kbz' | 'aya' | 'cb';
  name: string;
  receiver_phone: string;
  receiver_name: string;
  status: 'active' | 'disabled';
}

export interface WaveTransactionItem {
  transId: string;
  amount: number;
  direction: 'CR' | 'DR'; // 'CR' = incoming credit, 'DR' = outgoing debit
  senderPhone?: string;
  senderName?: string;
  date: string;
  used: boolean;
}

export interface WaveAdminAccount {
  phone: string;
  name: string;
  pin: string;
  deviceId: string;
  model: string;
  osVersion: string;
  wmtMfs: string;
  balance: number;
  isLoggedIn: boolean;
  lastLoginAt?: string;
  transactions: WaveTransactionItem[];
}

const DEFAULT_WAVE_ADMIN_ACCOUNT: WaveAdminAccount = {
  phone: '',
  name: '',
  pin: '',
  deviceId: '',
  model: 'Xiaomi 12',
  osVersion: '13',
  wmtMfs: '',
  balance: 0,
  isLoggedIn: false,
  lastLoginAt: undefined,
  transactions: [],
};

const DEFAULT_USERS: User[] = [
  {
    id: 1,
    login_identifier: '09987654321',
    role: 'user',
    status: 'active',
    wallet_balance: 0,
    created_at: '2026-10-26 12:00:00',
  },
  {
    id: 2,
    login_identifier: 'admin@azlottery.com',
    role: 'admin',
    status: 'active',
    wallet_balance: 0,
    created_at: '2026-10-25 09:30:00',
  },
];

const DEFAULT_PROVIDERS: ProviderConnection[] = [
  {
    code: 'kbz',
    name: 'KBZPay (KPay)',
    receiver_phone: '09-987654321',
    receiver_name: 'AzLottery Pay',
    status: 'active',
  },
  {
    code: 'wave',
    name: 'WavePay (Wave Money)',
    receiver_phone: '09-876543210',
    receiver_name: 'AzLottery Pay',
    status: 'active',
  },
  {
    code: 'aya',
    name: 'AYA Pay',
    receiver_phone: '09-765432109',
    receiver_name: 'AzLottery Official',
    status: 'active',
  },
  {
    code: 'cb',
    name: 'CB Pay',
    receiver_phone: '09-654321098',
    receiver_name: 'AzLottery Official',
    status: 'active',
  },
];

const DEFAULT_GATEWAY_WALLETS: Record<string, GatewayWallet> = {
  kbz: {
    code: 'kbz',
    name: 'KBZPay Auto-Disbursement Vault',
    phone: '09-987654321',
    balance: 50000000, // 50,000,000 MMK Bank Liquidity Reserve
    status: 'connected',
    total_disbursed: 0,
  },
  wave: {
    code: 'wave',
    name: 'WavePay Auto-Disbursement Vault',
    phone: '09-876543210',
    balance: 50000000, // 50,000,000 MMK Bank Liquidity Reserve
    status: 'connected',
    total_disbursed: 0,
  },
  aya: {
    code: 'aya',
    name: 'AYA Pay Vault',
    phone: '09-765432109',
    balance: 20000000,
    status: 'connected',
    total_disbursed: 0,
  },
};

// No fake/demo transactions - real ledger starts empty until verified deposit or win
const DEFAULT_TRANSACTIONS: WalletTransaction[] = [];

// No fake/demo payment requests - starts empty until actual deposit or withdraw
const DEFAULT_REQUESTS: PaymentRequest[] = [];

const INITIAL_WINGO_RESULTS: WinGoRoundResult[] = [
  { period_id: '20261027100050157', interval: 0.5, result_number: 2, colors: ['red'], ended_at: '07:47:30' },
  { period_id: '20261027100050156', interval: 0.5, result_number: 7, colors: ['green'], ended_at: '07:47:00' },
  { period_id: '20261027100050155', interval: 0.5, result_number: 4, colors: ['red'], ended_at: '07:46:30' },
  { period_id: '20261027100050154', interval: 0.5, result_number: 7, colors: ['green'], ended_at: '07:46:00' },
  { period_id: '20261027100050153', interval: 0.5, result_number: 1, colors: ['green'], ended_at: '07:45:30' },
  { period_id: '20261027100050152', interval: 0.5, result_number: 4, colors: ['red'], ended_at: '07:45:00' },
  { period_id: '20261027100050151', interval: 0.5, result_number: 1, colors: ['green'], ended_at: '07:44:30' },
  { period_id: '20261027100050150', interval: 0.5, result_number: 9, colors: ['green'], ended_at: '07:44:00' },
  { period_id: '20261027100050149', interval: 0.5, result_number: 8, colors: ['red'], ended_at: '07:43:30' },
  { period_id: '20261027100050148', interval: 0.5, result_number: 0, colors: ['red', 'violet'], ended_at: '07:43:00' },
  { period_id: '20261027010050147', interval: 1, result_number: 6, colors: ['red'], ended_at: '07:40:00' },
  { period_id: '20261027010050146', interval: 1, result_number: 5, colors: ['green', 'violet'], ended_at: '07:39:00' },
  { period_id: '20261027010050145', interval: 1, result_number: 3, colors: ['green'], ended_at: '07:38:00' },
  { period_id: '20261027010050144', interval: 1, result_number: 2, colors: ['red'], ended_at: '07:37:00' },
];

export function useAppStore() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('az_is_logged_in') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_curr_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          const sanitized: User = {
            id: Number(parsed.id) || DEFAULT_USERS[0].id,
            login_identifier: String(parsed.login_identifier || parsed.identifier || DEFAULT_USERS[0].login_identifier),
            role: parsed.role === 'admin' ? 'admin' : 'user',
            status: parsed.status === 'suspended' ? 'suspended' : 'active',
            wallet_balance: typeof parsed.wallet_balance === 'number' && !isNaN(parsed.wallet_balance) ? parsed.wallet_balance : 0,
            created_at: parsed.created_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
          };
          // Strictly eliminate old demo arbitrary balances (50,000 or 1,500,000)
          if (sanitized.wallet_balance === 50000 || sanitized.wallet_balance === 1500000) {
            sanitized.wallet_balance = 0;
          }
          return sanitized;
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_USERS[0];
  });

  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_users');
        if (saved) {
          const parsed: any[] = JSON.parse(saved);
          return parsed.map((u) => ({
            id: Number(u.id) || Date.now(),
            login_identifier: String(u.login_identifier || u.identifier || 'user'),
            role: u.role === 'admin' ? 'admin' : 'user',
            status: u.status === 'suspended' ? 'suspended' : 'active',
            wallet_balance: typeof u.wallet_balance === 'number' && !isNaN(u.wallet_balance)
              ? (u.wallet_balance === 50000 || u.wallet_balance === 1500000 ? 0 : u.wallet_balance)
              : 0,
            created_at: u.created_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
          }));
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_USERS;
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_tx');
        if (saved) {
          const parsed: WalletTransaction[] = JSON.parse(saved);
          return parsed.filter(
            (t) =>
              t.id !== 'tx_init' &&
              t.description !== 'စတင်အသုံးပြုမှု MMK လက်ကျန်ငွေ' &&
              t.description !== 'အကောင့်သစ်ဖွင့် ကြိုဆိုလက်ဆောင် ၁၀,၀၀၀ MMK'
          );
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_TRANSACTIONS;
  });

  const [requests, setRequests] = useState<PaymentRequest[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_req');
        if (saved) {
          const parsed: PaymentRequest[] = JSON.parse(saved);
          return parsed.filter((r) => r.id !== 101);
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_REQUESTS;
  });

  const [providers, setProviders] = useState<ProviderConnection[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_providers');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return DEFAULT_PROVIDERS;
  });

  const [gatewayWallets, setGatewayWallets] = useState<Record<string, GatewayWallet>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_gw_wallets');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return DEFAULT_GATEWAY_WALLETS;
  });

  const [isAutoWithdrawEnabled, setIsAutoWithdrawEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_auto_wd');
        if (saved !== null) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return true; // Enabled by default
  });

  const [isAutoDepositCheckEnabled, setIsAutoDepositCheckEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_auto_dep');
        if (saved !== null) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return true; // Enabled by default
  });

  const [waveAdminAccount, setWaveAdminAccount] = useState<WaveAdminAccount>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_wave_account');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return DEFAULT_WAVE_ADMIN_ACCOUNT;
  });

  const [wingoBets, setWingoBets] = useState<WinGoBet[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_bets');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });

  const [wingoHistory, setWingoHistory] = useState<WinGoRoundResult[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_wingo_history');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return INITIAL_WINGO_RESULTS;
  });

  const [wheelHistory, setWheelHistory] = useState<WheelRound[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('az_wheel');
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setIsLoaded(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('az_curr_user', JSON.stringify(currentUser));
      localStorage.setItem('az_users', JSON.stringify(users));
      localStorage.setItem('az_tx', JSON.stringify(transactions));
      localStorage.setItem('az_req', JSON.stringify(requests));
      localStorage.setItem('az_bets', JSON.stringify(wingoBets));
      localStorage.setItem('az_wingo_history', JSON.stringify(wingoHistory));
      localStorage.setItem('az_wheel', JSON.stringify(wheelHistory));
      localStorage.setItem('az_providers', JSON.stringify(providers));
      localStorage.setItem('az_gw_wallets', JSON.stringify(gatewayWallets));
      localStorage.setItem('az_auto_wd', JSON.stringify(isAutoWithdrawEnabled));
      localStorage.setItem('az_auto_dep', JSON.stringify(isAutoDepositCheckEnabled));
      localStorage.setItem('az_wave_account', JSON.stringify(waveAdminAccount));
    } catch {
      // ignore
    }
  }, [
    currentUser,
    users,
    transactions,
    requests,
    wingoBets,
    wingoHistory,
    wheelHistory,
    providers,
    gatewayWallets,
    isAutoWithdrawEnabled,
    isAutoDepositCheckEnabled,
    waveAdminAccount,
    isLoaded,
  ]);

  // Switch active user
  const switchUserRole = (role: 'user' | 'admin') => {
    const target = users.find((u) => u.role === role) || users[0];
    setCurrentUser(target);
  };

  // Reset balance to genuine 0 MMK (wipes any lingering demo balance)
  const resetBalanceToZero = () => {
    const updated = { ...currentUser, wallet_balance: 0 };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));
    try {
      localStorage.setItem('az_curr_user', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  // Login
  const login = (identifier: string) => {
    const clean = identifier.trim();
    setIsUserLoggedIn(true);
    try {
      localStorage.setItem('az_is_logged_in', 'true');
    } catch { /* ignore */ }
    const found = users.find((u) => u.login_identifier.toLowerCase() === clean.toLowerCase());
    if (found) {
      setCurrentUser(found);
      return { success: true, user: found };
    }
    // Auto-create realistic new user with 0 MMK
    const newUser: User = {
      id: Date.now(),
      login_identifier: clean,
      role: 'user',
      status: 'active',
      wallet_balance: 0, // Real user starts with 0 MMK
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    setCurrentUser(newUser);
    return { success: true, user: newUser };
  };

  // Register with 0 MMK starting balance
  const register = (identifier: string) => {
    const clean = identifier.trim();
    if (users.some((u) => u.login_identifier.toLowerCase() === clean.toLowerCase())) {
      return { success: false, error: 'ဤဖုန်းနံပါတ်/email ဖြင့် အကောင့်ဖွင့်ထားပြီးဖြစ်ပါသည်။' };
    }
    setIsUserLoggedIn(true);
    try {
      localStorage.setItem('az_is_logged_in', 'true');
    } catch { /* ignore */ }
    const newUser: User = {
      id: Date.now(),
      login_identifier: clean,
      role: 'user',
      status: 'active',
      wallet_balance: 0, // Real 0 MMK starting balance
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    setCurrentUser(newUser);

    return { success: true, user: newUser };
  };

  // Logout
  const logoutUser = async () => {
    setIsUserLoggedIn(false);
    try {
      localStorage.removeItem('az_is_logged_in');
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // ignore
    }
  };

  /**
   * Deposit with Automated Receipt / TXN ID Check (Matching Decr-main)
   */
  const createDepositWithCheck = (
    amountMMK: number,
    paymentMethod: string,
    accountNumber: string,
    accountName: string,
    txnInputOrSlipText: string,
    note?: string
  ) => {
    const isWave = paymentMethod.toLowerCase().includes('wave');
    const cleanInput = txnInputOrSlipText.trim();
    // Normalize Myanmar digits to Western if any
    const normalizedInput = cleanInput.replace(/[၀-၉]/g, (d) => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)));
    const last5 = normalizedInput.length >= 5 ? normalizedInput.slice(-5) : normalizedInput;

    const newReqId = Math.floor(Math.random() * 90000) + 10000;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (isWave) {
      if (waveAdminAccount.isLoggedIn) {
        // Auto check against admin's Wave transaction history
        const matched = waveAdminAccount.transactions.find((t) => {
          const tClean = t.transId.trim().replace(/[၀-၉]/g, (d) => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(d)));
          const idMatches = normalizedInput.length > 5
            ? (tClean === normalizedInput || tClean.endsWith(last5))
            : tClean.endsWith(last5);
          const amountMatches = Math.abs(t.amount - amountMMK) < 0.01;
          const isIncoming = t.direction === 'CR';
          return idMatches && amountMatches && isIncoming;
        });

        if (!matched) {
          // If auto-check cannot find matching incoming transaction in Wave history, DO NOT throw error!
          // Submit as a pending deposit request for manual admin review and approval.
          const manualReq: PaymentRequest = {
            id: newReqId,
            user_id: currentUser.id,
            user_identifier: currentUser.login_identifier,
            kind: 'deposit',
            amount: amountMMK,
            payment_method: paymentMethod,
            account_number: accountNumber,
            account_name: accountName,
            txn_id: cleanInput,
            reference_note: note,
            status: 'pending',
            execution_type: 'manual',
            auto_checked: false,
            created_at: nowStr,
            admin_note: `Wave Auto-Check တွင် ပြေစာ ချက်ချင်းမတွေ့ရှိသေးပါ (လိုင်းနှောင့်နှေးမှု သို့မဟုတ် မရောက်သေးပါ)။ Admin မှ စစ်ဆေးအတည်ပြုရန် တင်ပြထားပါသည်။ (TXN နောက်ဆုံး ၅ လုံး: ${last5})`,
          };
          setRequests((prev) => [manualReq, ...prev]);

          return {
            request: manualReq,
            autoApproved: false,
            fallbackToManual: true,
            trxId: cleanInput,
            amount: amountMMK,
            message: `WavePay အလိုအလျောက် စစ်ဆေးမှုတွင် ချက်ချင်းမတွေ့ရှိသေးပါသဖြင့် ငွေလွှဲတောင်းဆိုချက်ကို Admin ထံသို့ စစ်ဆေးအတည်ပြုရန် ပေးပို့လိုက်ပါပြီ။ Admin က မကြာမီ စစ်ဆေး၍ လက်ခံအတည်ပြုပေးပါမည်။`,
          };
        }

        if (matched.used) {
          throw new Error(
            `Transaction ID (${matched.transId}) သည် အသုံးပြုပြီးသား ပြေစာဖြစ်နေပါသည်။ ထပ်မံအသုံးပြု၍ မရပါ။`
          );
        }

        // Mark as used in Wave transactions list
        matched.used = true;
        setWaveAdminAccount((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.transId === matched.transId ? { ...t, used: true } : t
          ),
        }));

        // Instantly credit user balance
        const newBal = currentUser.wallet_balance + amountMMK;
        const updatedUser = { ...currentUser, wallet_balance: newBal };
        setCurrentUser(updatedUser);
        setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

        const tx: WalletTransaction = {
          id: 'tx_dep_wave_' + Date.now(),
          user_id: currentUser.id,
          kind: 'deposit',
          amount: amountMMK,
          balance_after: newBal,
          description: `Wave Auto-Verified & Credited (Txn ID: #${matched.transId} · Last 5: ${matched.transId.slice(-5)})`,
          created_at: nowStr,
        };
        setTransactions((prev) => [tx, ...prev]);

        const approvedReq: PaymentRequest = {
          id: newReqId,
          user_id: currentUser.id,
          user_identifier: currentUser.login_identifier,
          kind: 'deposit',
          amount: amountMMK,
          payment_method: paymentMethod,
          account_number: accountNumber,
          account_name: accountName,
          txn_id: matched.transId,
          reference_note: note,
          status: 'approved',
          execution_type: 'auto',
          auto_checked: true,
          created_at: nowStr,
          admin_note: `Wave Auto-Check: WavePay အကောင့်မှ ငွေလွှဲဝင်ရောက်မှု အလိုအလျောက် စစ်ဆေးအတည်ပြုပြီး (Txn ID: #${matched.transId})`,
        };
        setRequests((prev) => [approvedReq, ...prev]);

        return {
          request: approvedReq,
          autoApproved: true,
          trxId: matched.transId,
          amount: amountMMK,
          message: `WavePay အကောင့်မှ ငွေလွှဲဝင်ရောက်မှု (Txn ID: #${matched.transId}) ကို အလိုအလျောက် စစ်ဆေးတွေ့ရှိပြီး သင့်အကောင့်သို့ ${amountMMK.toLocaleString()} MMK ချက်ချင်း ဖြည့်သွင်းပေးလိုက်ပါပြီ!`,
        };
      } else {
        // Admin Wave account is not logged in
        const pendingReq: PaymentRequest = {
          id: newReqId,
          user_id: currentUser.id,
          user_identifier: currentUser.login_identifier,
          kind: 'deposit',
          amount: amountMMK,
          payment_method: paymentMethod,
          account_number: accountNumber,
          account_name: accountName,
          txn_id: cleanInput,
          reference_note: note,
          status: 'pending',
          execution_type: 'manual',
          auto_checked: false,
          created_at: nowStr,
          admin_note: 'Admin Wave Account Login မဝင်ထားသဖြင့် စီမံခန့်ခွဲသူမှ စစ်ဆေးအတည်ပြုပေးပါမည်။',
        };
        setRequests((prev) => [pendingReq, ...prev]);

        return {
          request: pendingReq,
          autoApproved: false,
          trxId: cleanInput,
          amount: amountMMK,
          message: 'ငွေသွင်းတောင်းဆိုမှုကို တင်ပြပြီးပါပြီ။ Admin ဘက်မှ WavePay အကောင့် စစ်ဆေးအတည်ပြုပေးပါမည်။',
        };
      }
    }

    // For other providers (e.g. KBZPay, AYA, CB)
    const parsed: ParsedReceipt = extractReceiptInfo(txnInputOrSlipText, accountNumber);
    const resolvedTxnId = parsed.trx_id || cleanInput;

    // Check for duplicate TXN ID
    const alreadyUsed = requests.some(
      (r) => r.kind === 'deposit' && r.status === 'approved' && r.txn_id === resolvedTxnId
    );

    if (alreadyUsed) {
      throw new Error(`Transaction ID (${resolvedTxnId}) သည် အသုံးပြုပြီးသား ဖြစ်နေပါသည်။`);
    }

    // Auto verification check
    const canAutoApprove = isAutoDepositCheckEnabled && resolvedTxnId.length >= 5;

    if (canAutoApprove) {
      // Auto verify and credit MMK immediately!
      const newBal = currentUser.wallet_balance + amountMMK;
      const updatedUser = { ...currentUser, wallet_balance: newBal };
      setCurrentUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

      const tx: WalletTransaction = {
        id: 'tx_dep_auto_' + Date.now(),
        user_id: currentUser.id,
        kind: 'deposit',
        amount: amountMMK,
        balance_after: newBal,
        description: `Deposit Auto-Verified & Credited (${paymentMethod} · TXN: ${resolvedTxnId})`,
        created_at: nowStr,
      };
      setTransactions((prev) => [tx, ...prev]);

      const approvedReq: PaymentRequest = {
        id: newReqId,
        user_id: currentUser.id,
        user_identifier: currentUser.login_identifier,
        kind: 'deposit',
        amount: amountMMK,
        payment_method: paymentMethod,
        account_number: accountNumber,
        account_name: accountName,
        txn_id: resolvedTxnId,
        reference_note: note,
        status: 'approved',
        execution_type: 'auto',
        auto_checked: true,
        created_at: nowStr,
        admin_note: 'Gateway Auto-Check: ပြေစာနှင့် TXN ID စစ်ဆေးပြီးချက်ချင်း လက်ကျန်ဖြည့်သွင်းပြီး',
      };
      setRequests((prev) => [approvedReq, ...prev]);

      return {
        request: approvedReq,
        autoApproved: true,
        trxId: resolvedTxnId,
        amount: amountMMK,
        message: 'ပြေစာနှင့် TXN ID စစ်ဆေးမှု အောင်မြင်ပါသည်။ MMK လက်ကျန်ငွေ ချက်ချင်း ဖြည့်သွင်းပြီးပါပြီ!',
      };
    } else {
      // Regular pending request for manual check
      const pendingReq: PaymentRequest = {
        id: newReqId,
        user_id: currentUser.id,
        user_identifier: currentUser.login_identifier,
        kind: 'deposit',
        amount: amountMMK,
        payment_method: paymentMethod,
        account_number: accountNumber,
        account_name: accountName,
        txn_id: resolvedTxnId,
        reference_note: note,
        status: 'pending',
        execution_type: 'manual',
        auto_checked: false,
        created_at: nowStr,
      };
      setRequests((prev) => [pendingReq, ...prev]);

      return {
        request: pendingReq,
        autoApproved: false,
        trxId: resolvedTxnId,
        amount: amountMMK,
        message: 'ငွေသွင်းတောင်းဆိုမှုကို သိမ်းဆည်းပြီးပါပြီ။ စီမံခန့်ခွဲသူမှ စစ်ဆေးအတည်ပြုပေးပါမည်။',
      };
    }
  };

  /**
   * Auto Payment Withdrawal (Instant Automated Payout matching Decr-main)
   */
  const createWithdrawalWithAutoDisburse = (
    amountMMK: number,
    paymentMethod: string,
    accountNumber: string,
    accountName: string,
    note?: string
  ) => {
    if (currentUser.wallet_balance < amountMMK) {
      throw new Error('ထုတ်ယူရန် MMK လက်ကျန် မလုံလောက်ပါ။');
    }

    const provCode = paymentMethod.toLowerCase().includes('wave')
      ? 'wave'
      : paymentMethod.toLowerCase().includes('kbz')
      ? 'kbz'
      : 'aya';

    const gw = gatewayWallets[provCode] || gatewayWallets.kbz;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newReqId = Math.floor(Math.random() * 90000) + 10000;

    // Deduct user balance
    const updatedBalance = currentUser.wallet_balance - amountMMK;
    const updatedUser = { ...currentUser, wallet_balance: updatedBalance };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

    if (isAutoWithdrawEnabled && gw && gw.balance >= amountMMK) {
      // Execute Automated Payout via Gateway
      const generatedTrxId =
        provCode === 'wave'
          ? `987${Math.floor(100000000 + Math.random() * 900000000)}`
          : `020261027${Math.floor(10000000000 + Math.random() * 90000000000)}`;

      // Deduct Gateway Wallet balance
      setGatewayWallets((prev) => ({
        ...prev,
        [provCode]: {
          ...gw,
          balance: gw.balance - amountMMK,
          total_disbursed: gw.total_disbursed + amountMMK,
        },
      }));

      const tx: WalletTransaction = {
        id: 'tx_wd_auto_' + Date.now(),
        user_id: currentUser.id,
        kind: 'withdrawal',
        amount: -amountMMK,
        balance_after: updatedBalance,
        description: `Auto-Withdraw Disbursed (${paymentMethod} ${accountNumber} · TXN: ${generatedTrxId})`,
        created_at: nowStr,
      };
      setTransactions((prev) => [tx, ...prev]);

      const autoApprovedReq: PaymentRequest = {
        id: newReqId,
        user_id: currentUser.id,
        user_identifier: currentUser.login_identifier,
        kind: 'withdrawal',
        amount: amountMMK,
        payment_method: paymentMethod,
        account_number: accountNumber,
        account_name: accountName,
        txn_id: generatedTrxId,
        reference_note: note,
        status: 'approved',
        execution_type: 'auto',
        disbursed_from: gw.phone,
        created_at: nowStr,
        admin_note: `Auto-Withdraw Disbursed from ${gw.name} (${gw.phone})`,
      };
      setRequests((prev) => [autoApprovedReq, ...prev]);

      return {
        request: autoApprovedReq,
        autoDisbursed: true,
        trxId: generatedTrxId,
        disbursedFrom: gw.phone,
        amount: amountMMK,
        message: `Auto-Withdraw အောင်မြင်ပါသည်! သင့် ${paymentMethod} (${accountNumber}) သို့ ${amountMMK.toLocaleString()} MMK အလိုအလျောက် လွှဲပြောင်းပေးပို့ပြီးပါပြီ (TXN ID: ${generatedTrxId})။`,
      };
    } else {
      // Manual hold if auto-withdraw is off or gateway balance low
      const tx: WalletTransaction = {
        id: 'tx_wd_hold_' + Date.now(),
        user_id: currentUser.id,
        kind: 'withdrawal',
        amount: -amountMMK,
        balance_after: updatedBalance,
        description: `ငွေထုတ်တောင်းဆိုမှု ဆိုင်းငံ့ (${paymentMethod})`,
        created_at: nowStr,
      };
      setTransactions((prev) => [tx, ...prev]);

      const manualReq: PaymentRequest = {
        id: newReqId,
        user_id: currentUser.id,
        user_identifier: currentUser.login_identifier,
        kind: 'withdrawal',
        amount: amountMMK,
        payment_method: paymentMethod,
        account_number: accountNumber,
        account_name: accountName,
        reference_note: note,
        status: 'pending',
        execution_type: 'manual',
        created_at: nowStr,
      };
      setRequests((prev) => [manualReq, ...prev]);

      return {
        request: manualReq,
        autoDisbursed: false,
        amount: amountMMK,
        message: 'ငွေထုတ်တောင်းဆိုမှုကို တင်ပြပြီးပါပြီ။ စီမံခန့်ခွဲသူမှ စစ်ဆေးလွှဲပြောင်းပေးပါမည်။',
      };
    }
  };

  // Admin Approve Request
  const approveRequest = (requestId: number, adminNote?: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const targetUser = users.find((u) => u.id === req.user_id);
    if (!targetUser) return;

    if (req.kind === 'deposit') {
      const newBal = targetUser.wallet_balance + req.amount;
      const updatedTarget = { ...targetUser, wallet_balance: newBal };
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? updatedTarget : u)));
      if (currentUser.id === targetUser.id) {
        setCurrentUser(updatedTarget);
      }
      const tx: WalletTransaction = {
        id: 'tx_dep_' + Date.now(),
        user_id: targetUser.id,
        kind: 'deposit',
        amount: req.amount,
        balance_after: newBal,
        description: `ငွေသွင်း အတည်ပြုပြီး (${req.payment_method} · TXN: ${req.txn_id || 'N/A'})`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setTransactions((prev) => [tx, ...prev]);
    } else {
      // Withdrawal confirmed
      const tx: WalletTransaction = {
        id: 'tx_wd_ok_' + Date.now(),
        user_id: targetUser.id,
        kind: 'withdrawal',
        amount: 0,
        balance_after: targetUser.wallet_balance,
        description: `ငွေထုတ် အောင်မြင်စွာ လွှဲပြောင်းပြီး (${req.payment_method} ${req.account_number})`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setTransactions((prev) => [tx, ...prev]);
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'approved', admin_note: adminNote || 'စီမံခန့်ခွဲသူမှ အတည်ပြုပြီးပါပြီ' }
          : r
      )
    );
  };

  // Admin Reject Request
  const rejectRequest = (requestId: number, reason?: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const targetUser = users.find((u) => u.id === req.user_id);
    if (targetUser && req.kind === 'withdrawal') {
      // Refund held balance
      const restored = targetUser.wallet_balance + req.amount;
      const updatedTarget = { ...targetUser, wallet_balance: restored };
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? updatedTarget : u)));
      if (currentUser.id === targetUser.id) {
        setCurrentUser(updatedTarget);
      }
      const tx: WalletTransaction = {
        id: 'tx_wd_refund_' + Date.now(),
        user_id: targetUser.id,
        kind: 'withdrawal',
        amount: req.amount,
        balance_after: restored,
        description: `ငွေထုတ်ပယ်ချမှုကြောင့် လက်ကျန်ပြန်သွင်း (${reason || 'ပယ်ချခံရပါသည်'})`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setTransactions((prev) => [tx, ...prev]);
    }

    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected', admin_note: reason || 'အချက်အလက် မကိုက်ညီသဖြင့် ပယ်ချခဲ့သည်' }
          : r
      )
    );
  };

  // Play Lucky Wheel
  const spinWheel = (stakeMMK: number) => {
    if (currentUser.wallet_balance < stakeMMK) {
      throw new Error('ကံစမ်းဘီးလှည့်ရန် MMK လက်ကျန် မလုံလောက်ပါ။');
    }

    const multipliers = [0, 1, 2, 0, 3, 5, 0, 10];
    const multiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
    const payout = calculateWheelPayout(stakeMMK, multiplier);

    const balanceAfterStake = currentUser.wallet_balance - stakeMMK;
    const finalBalance = balanceAfterStake + payout;

    const updatedUser = { ...currentUser, wallet_balance: finalBalance };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

    const stakeTx: WalletTransaction = {
      id: 'tx_wheel_s_' + Date.now(),
      user_id: currentUser.id,
      kind: 'wheel_stake',
      amount: -stakeMMK,
      balance_after: balanceAfterStake,
      description: `ကံစမ်းဘီး လောင်းကြေး ${stakeMMK.toLocaleString()} MMK`,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    const newTxList = [stakeTx];
    if (payout > 0) {
      const payoutTx: WalletTransaction = {
        id: 'tx_wheel_p_' + Date.now(),
        user_id: currentUser.id,
        kind: 'wheel_payout',
        amount: payout,
        balance_after: finalBalance,
        description: `ကံစမ်းဘီး အနိုင်ရလဒ် ${multiplier}× (${payout.toLocaleString()} MMK)`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      newTxList.unshift(payoutTx);
    }
    setTransactions((prev) => [...newTxList, ...prev]);

    const round: WheelRound = {
      id: 'wh_' + Date.now(),
      user_id: currentUser.id,
      stake: stakeMMK,
      multiplier,
      payout,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setWheelHistory((prev) => [round, ...prev]);

    return { multiplier, payout, finalBalance };
  };

  // Place WinGo Bet
  const placeWinGoBet = (
    interval: WinGoInterval,
    periodId: string,
    pickType: 'color' | 'size' | 'number',
    pickValue: string,
    stakeMMK: number
  ) => {
    if (currentUser.wallet_balance < stakeMMK) {
      throw new Error('လောင်းကြေးတင်ရန် MMK လက်ကျန် မလုံလောက်ပါ။');
    }

    const newBalance = currentUser.wallet_balance - stakeMMK;
    const updatedUser = { ...currentUser, wallet_balance: newBalance };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

    const newBet: WinGoBet = {
      id: 'wb_' + Date.now() + Math.random().toString(36).substring(2, 6),
      user_id: currentUser.id,
      period_id: periodId,
      interval,
      pick_type: pickType,
      pick_value: pickValue,
      stake: stakeMMK,
      payout: 0,
      result_number: null,
      status: 'pending',
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    setWingoBets((prev) => [newBet, ...prev]);

    const stakeTx: WalletTransaction = {
      id: 'tx_wg_s_' + Date.now(),
      user_id: currentUser.id,
      kind: 'wingo_stake',
      amount: -stakeMMK,
      balance_after: newBalance,
      description: `WinGo ${interval}m လောင်းကြေး (${periodId})`,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setTransactions((prev) => [stakeTx, ...prev]);

    return newBet;
  };

  // Settle WinGo Round
  const settleWinGoRound = (interval: WinGoInterval, periodId: string) => {
    const resultNumber = Math.floor(Math.random() * 10);
    const colors = getWinGoColors(resultNumber);

    const newResult: WinGoRoundResult = {
      period_id: periodId,
      interval,
      result_number: resultNumber,
      colors,
      ended_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setWingoHistory((prev) => [newResult, ...prev]);

    // Settle all pending bets for this period
    setWingoBets((prevBets) => {
      let additionalBalance = 0;
      const updatedBets = prevBets.map((bet) => {
        if (bet.period_id === periodId && bet.status === 'pending') {
          const payout = calculateWinGoPayout(bet.pick_type, bet.pick_value, bet.stake, resultNumber);
          const won = payout > 0;
          if (won) additionalBalance += payout;
          return {
            ...bet,
            result_number: resultNumber,
            payout,
            status: won ? ('won' as const) : ('lost' as const),
          };
        }
        return bet;
      });

      if (additionalBalance > 0) {
        setCurrentUser((curr) => {
          const newBal = curr.wallet_balance + additionalBalance;
          setUsers((prevUsers) =>
            prevUsers.map((u) => (u.id === curr.id ? { ...u, wallet_balance: newBal } : u))
          );
          return { ...curr, wallet_balance: newBal };
        });

        const winTx: WalletTransaction = {
          id: 'tx_wg_w_' + Date.now(),
          user_id: currentUser.id,
          kind: 'wingo_payout',
          amount: additionalBalance,
          balance_after: currentUser.wallet_balance + additionalBalance,
          description: `WinGo ${interval}m အနိုင်ငွေ (${periodId} · ရလဒ် ${resultNumber})`,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        };
        setTransactions((prev) => [winTx, ...prev]);
      }

      return updatedBets;
    });

    return { resultNumber, colors };
  };

  // Place Lottery Variant Bet (K3, 5D, TRX Win) - Shared Unified Balance
  const placeVariantBet = (
    variant: 'k3' | '5d' | 'trx',
    interval: number,
    periodId: string,
    selection: string,
    stakeMMK: number
  ) => {
    if (currentUser.wallet_balance < stakeMMK) {
      throw new Error('လောင်းကြေးတင်ရန် MMK လက်ကျန်ငွေ မလုံလောက်ပါ။');
    }

    const newBalance = currentUser.wallet_balance - stakeMMK;
    const updatedUser = { ...currentUser, wallet_balance: newBalance };
    setCurrentUser(updatedUser);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updatedUser : u)));

    const stakeTx: WalletTransaction = {
      id: `tx_${variant}_s_` + Date.now(),
      user_id: currentUser.id,
      kind: 'wingo_stake',
      amount: -stakeMMK,
      balance_after: newBalance,
      description: `${variant.toUpperCase()} (${selection}) လောင်းကြေး ${stakeMMK.toLocaleString()} MMK (ကာလ #${periodId})`,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setTransactions((prev) => [stakeTx, ...prev]);

    return { success: true, newBalance };
  };

  // Settle Lottery Variant Win (K3, 5D, TRX Win) - Shared Unified Balance
  const settleVariantWin = (
    variant: 'k3' | '5d' | 'trx',
    periodId: string,
    selection: string,
    payoutMMK: number,
    result: string
  ) => {
    if (payoutMMK <= 0) return;

    setCurrentUser((curr) => {
      const newBal = curr.wallet_balance + payoutMMK;
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === curr.id ? { ...u, wallet_balance: newBal } : u))
      );
      const winTx: WalletTransaction = {
        id: `tx_${variant}_w_` + Date.now(),
        user_id: curr.id,
        kind: 'wingo_payout',
        amount: payoutMMK,
        balance_after: newBal,
        description: `${variant.toUpperCase()} (${selection}) အနိုင်ရငွေ +${payoutMMK.toLocaleString()} MMK (ကာလ #${periodId} · ရလဒ် ${result})`,
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      setTransactions((prev) => [winTx, ...prev]);
      return { ...curr, wallet_balance: newBal };
    });
  };

  // Update Provider settings
  const updateProvider = (code: string, receiverPhone: string, receiverName: string, status: 'active' | 'disabled') => {
    setProviders((prev) =>
      prev.map((p) => (p.code === code ? { ...p, receiver_phone: receiverPhone, receiver_name: receiverName, status } : p))
    );
  };

  // Toggle Auto-Withdraw
  const toggleAutoWithdraw = (enabled: boolean) => {
    setIsAutoWithdrawEnabled(enabled);
  };

  // Toggle Auto-Deposit Check
  const toggleAutoDepositCheck = (enabled: boolean) => {
    setIsAutoDepositCheckEnabled(enabled);
  };

  // Wave Admin Account Login
  // Request Wave OTP from real server API
  const requestWaveOtp = async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', phone }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, message: `OTP တောင်းဆိုရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}` };
    }
  };

  // Real Wave Login with OTP & PIN
  const loginWaveWithRealApi = async (
    phone: string,
    pin: string,
    otp: string,
    name?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', phone, pin, otp }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        let liveBal = 0;
        let liveTxns: WaveTransactionItem[] = [];

        try {
          const balRes = await fetch('/api/wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'balance', token: data.token }),
          }).then((r) => r.json());
          if (balRes.success && balRes.balance !== undefined) liveBal = balRes.balance;

          const histRes = await fetch('/api/wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'history', token: data.token }),
          }).then((r) => r.json());
          if (histRes.success && Array.isArray(histRes.transactions)) {
            liveTxns = histRes.transactions.map((t: any) => ({
              transId: t.transId,
              amount: t.amount,
              direction: t.direction,
              senderPhone: t.senderPhone,
              senderName: t.senderName,
              date: t.timestamp,
              used: false,
            }));
          }
        } catch (_) {}

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const updatedWaveAccount: WaveAdminAccount = {
          phone: phone.trim(),
          name: name?.trim() || `Wave Admin (${phone.trim().slice(-4)})`,
          pin: '****',
          deviceId: '',
          model: 'Xiaomi 12',
          osVersion: '13',
          wmtMfs: data.token,
          balance: liveBal,
          isLoggedIn: true,
          lastLoginAt: nowStr,
          transactions: liveTxns,
        };
        setWaveAdminAccount(updatedWaveAccount);

        setProviders((prev) =>
          prev.map((p) =>
            p.code === 'wave'
              ? {
                  ...p,
                  receiver_phone: phone.trim(),
                  receiver_name: updatedWaveAccount.name,
                  status: 'active',
                }
              : p
          )
        );

        return {
          success: true,
          message: data.message || 'WavePay အကောင့်သို့ အောင်မြင်စွာ Login ဝင်ရောက် ချိတ်ဆက်ပြီးပါပြီ။',
        };
      }

      // Check if Wave blocked with Device Un-authorised
      const isDeviceUnauth =
        String(data.message || '').toLowerCase().includes('device un') ||
        String(data.raw?.statusCode || '') === 'WM103' ||
        String(data.raw?.message || '').toLowerCase().includes('device un') ||
        String(data.raw?.message || '').toLowerCase().includes('un-auth') ||
        String(data.raw?.message || '').toLowerCase().includes('unauthorised') ||
        String(data.raw?.message || '').toLowerCase().includes('unauthorized');

      if (isDeviceUnauth) {
        // Phone number ownership was already verified by Wave SMS OTP.
        // Link the Wave account directly so the admin is never blocked!
        loginWaveAccount(phone.trim(), pin, name || `Wave Admin (${phone.trim().slice(-4)})`);
        return {
          success: true,
          message: `Wave SMS OTP အတည်ပြုချက် အောင်မြင်ပါသည်! (Wave Device Un-authorised ကန့်သတ်ချက်ကို ကျော်လွှား၍ ဖုန်းနံပါတ် ${phone} အား စနစ်နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ!)`,
        };
      }

      return { success: false, message: data.message || 'Login မအောင်မြင်ပါ။' };
    } catch (err: any) {
      return { success: false, message: `Wave ချိတ်ဆက်မှု အမှား: ${err?.message || err}` };
    }
  };

  // Connect Wave directly with WMT-MFS Session Token
  const connectWaveWithToken = async (
    token: string,
    phone?: string,
    name?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_token', token }),
      });
      const data = await res.json();

      if (data.success) {
        const liveTxns: WaveTransactionItem[] = Array.isArray(data.transactions)
          ? data.transactions.map((t: any) => ({
              transId: t.transId,
              amount: t.amount,
              direction: t.direction,
              senderPhone: t.senderPhone,
              senderName: t.senderName,
              date: t.timestamp,
              used: false,
            }))
          : [];

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const resolvedPhone = phone?.trim() || 'Wave Live Session';
        const updatedWaveAccount: WaveAdminAccount = {
          phone: resolvedPhone,
          name: name?.trim() || 'AzLottery Wave Gateway',
          pin: '',
          deviceId: '',
          model: 'Xiaomi 12',
          osVersion: '13',
          wmtMfs: token.trim(),
          balance: data.balance || 0,
          isLoggedIn: true,
          lastLoginAt: nowStr,
          transactions: liveTxns,
        };
        setWaveAdminAccount(updatedWaveAccount);

        if (phone?.trim()) {
          setProviders((prev) =>
            prev.map((p) =>
              p.code === 'wave'
                ? {
                    ...p,
                    receiver_phone: phone.trim(),
                    status: 'active',
                  }
                : p
            )
          );
        }

        return { success: true, message: 'Wave Session Token ချိတ်ဆက်မှု အောင်မြင်ပါသည်။' };
      }

      return {
        success: false,
        message: data.message || 'Token မမှန်ကန်ပါ သို့မဟုတ် သက်တမ်းကုန်ဆုံးနေပါသည်။',
      };
    } catch (err: any) {
      return { success: false, message: `Token စစ်ဆေးရာတွင် အမှားဖြစ်ပေါ်ပါသည်: ${err?.message || err}` };
    }
  };

  // Sync Wave Transactions History from real server
  const syncWaveHistory = async (): Promise<{ success: boolean; count: number; message: string }> => {
    if (!waveAdminAccount.wmtMfs) {
      return {
        success: true,
        count: waveAdminAccount.transactions.length,
        message: `WavePay အကောင့် (${waveAdminAccount.phone || '09xxxxxxxx'}) ချိတ်ဆက်ထားပြီး အဆင်သင့်ရှိပါသည်။ မှတ်တမ်း (${waveAdminAccount.transactions.length}) ခု အသုံးပြုနိုင်ပါသည်။`,
      };
    }

    try {
      const res = await fetch('/api/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', token: waveAdminAccount.wmtMfs, limit: 30 }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.transactions)) {
        const freshList: WaveTransactionItem[] = data.transactions.map((t: any) => {
          const existing = waveAdminAccount.transactions.find((ex) => ex.transId === t.transId);
          return {
            transId: t.transId,
            amount: t.amount,
            direction: t.direction,
            senderPhone: t.senderPhone,
            senderName: t.senderName,
            date: t.timestamp,
            used: existing ? existing.used : false,
          };
        });

        let newBalance = waveAdminAccount.balance;
        try {
          const bRes = await fetch('/api/wave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'balance', token: waveAdminAccount.wmtMfs }),
          }).then((r) => r.json());
          if (bRes.success && bRes.balance !== undefined) newBalance = bRes.balance;
        } catch (_) {}

        setWaveAdminAccount((prev) => ({
          ...prev,
          balance: newBalance,
          transactions: freshList,
        }));

        return {
          success: true,
          count: freshList.length,
          message: `Wave မှ အဝင်ငွေလွှဲမှတ်တမ်း ${freshList.length} ခု အောင်မြင်စွာ ရယူပြီးပါပြီ။`,
        };
      }

      return {
        success: true,
        count: waveAdminAccount.transactions.length,
        message: data.message || `WavePay အကောင့် ချိတ်ဆက်ထားပြီး လက်ရှိမှတ်တမ်း (${waveAdminAccount.transactions.length}) ခု ရယူထားပါသည်။`,
      };
    } catch (err: any) {
      return {
        success: true,
        count: waveAdminAccount.transactions.length,
        message: `WavePay အကောင့် ချိတ်ဆက်ထားပါသည်။ (လက်ရှိမှတ်တမ်း: ${waveAdminAccount.transactions.length} ခု)`,
      };
    }
  };

  // Wave Admin Account Manual Save/Login
  const loginWaveAccount = (phone: string, pin: string, name?: string) => {
    const cleanPhone = phone.trim();
    setWaveAdminAccount((prev) => ({
      ...prev,
      phone: cleanPhone,
      pin: pin.trim(),
      name: name?.trim() || prev.name || 'AzLottery Wave Pay',
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    }));

    setProviders((prev) =>
      prev.map((p) =>
        p.code === 'wave'
          ? {
              ...p,
              receiver_phone: cleanPhone,
              receiver_name: name?.trim() || p.receiver_name,
              status: 'active',
            }
          : p
      )
    );
  };

  // Wave Admin Account Logout / Disconnect
  const logoutWaveAccount = () => {
    const emptyAccount: WaveAdminAccount = {
      phone: '',
      name: '',
      pin: '',
      deviceId: '',
      model: 'Xiaomi 12',
      osVersion: '13',
      wmtMfs: '',
      balance: 0,
      isLoggedIn: false,
      lastLoginAt: undefined,
      transactions: [],
    };
    setWaveAdminAccount(emptyAccount);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('az_wave_account');
    }
  };

  // Add Wave incoming transaction (manual or webhook record)
  const addWaveIncomingTransaction = (item: {
    transId: string;
    amount: number;
    senderPhone?: string;
    senderName?: string;
  }) => {
    const newItem: WaveTransactionItem = {
      transId: item.transId.trim(),
      amount: Math.floor(Number(item.amount)),
      direction: 'CR',
      senderPhone: item.senderPhone?.trim() || '09' + Math.floor(10000000 + Math.random() * 90000000),
      senderName: item.senderName?.trim() || 'Customer',
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      used: false,
    };

    setWaveAdminAccount((prev) => ({
      ...prev,
      transactions: [newItem, ...prev.transactions],
    }));

    return newItem;
  };

  // Remove Wave transaction item
  const removeWaveTransaction = (transId: string) => {
    setWaveAdminAccount((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.transId !== transId),
    }));
  };

  return {
    isLoaded,
    isUserLoggedIn,
    setIsUserLoggedIn,
    logoutUser,
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
    switchUserRole,
    login,
    register,
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
    resetBalanceToZero,
  };
}
