'use client';

import React, { useState } from 'react';
import type { User, WalletTransaction } from '@/lib/store';
import { History, ArrowDownCircle, ArrowUpCircle, Filter, Search } from 'lucide-react';

interface TransactionsViewProps {
  currentUser: User;
  transactions: WalletTransaction[];
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  currentUser,
  transactions,
}) => {
  const [filter, setFilter] = useState<string>('all');

  const userTransactions = transactions.filter((t) => t.user_id === currentUser.id);

  const filtered = userTransactions.filter((t) => {
    if (filter === 'deposit') return t.kind === 'deposit' || t.kind === 'bonus';
    if (filter === 'withdrawal') return t.kind === 'withdrawal';
    if (filter === 'wingo') return t.kind === 'wingo_stake' || t.kind === 'wingo_payout';
    if (filter === 'wheel') return t.kind === 'wheel_stake' || t.kind === 'wheel_payout';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="section-head bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="eyebrow text-[#4782ff] font-bold">ငွေကြေးမှတ်တမ်း</span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1e2637]">ပိုက်ဆံအိတ် စာရင်းမှတ်တမ်းများ</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            MMK လက်ကျန်ငွေ အတိုး/အလျော့ အပြောင်းအလဲနှင့် ကစားမှုမှတ်တမ်းအားလုံးကို ရှင်းလင်းစွာ စစ်ဆေးနိုင်သည်။
          </p>
        </div>
        <div className="balance-pill bg-[#4782ff] text-white border-0 py-1.5 px-4 text-xs sm:text-sm">
          လက်ကျန်: K{(currentUser?.wallet_balance ?? 0).toLocaleString()}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`button small ${filter === 'all' ? '' : 'secondary text-xs'}`}
        >
          အားလုံး ({userTransactions.length})
        </button>
        <button
          onClick={() => setFilter('deposit')}
          className={`button small ${filter === 'deposit' ? '' : 'secondary text-xs'}`}
        >
          ငွေသွင်းနှင့် လက်ဆောင်
        </button>
        <button
          onClick={() => setFilter('withdrawal')}
          className={`button small ${filter === 'withdrawal' ? '' : 'secondary text-xs'}`}
        >
          ငွေထုတ်ယူမှု
        </button>
        <button
          onClick={() => setFilter('wingo')}
          className={`button small ${filter === 'wingo' ? '' : 'secondary text-xs'}`}
        >
          WinGo ထီ
        </button>
        <button
          onClick={() => setFilter('wheel')}
          className={`button small ${filter === 'wheel' ? '' : 'secondary text-xs'}`}
        >
          ကံစမ်းဘီး
        </button>
      </div>

      {/* Transactions Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>အမျိုးအစား</th>
              <th>ဖော်ပြချက်</th>
              <th>ငွေပမာဏ</th>
              <th>လက်ကျန် (Balance After)</th>
              <th>ရက်စွဲ / အချိန်</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  ဤအမျိုးအစားအတွက် မှတ်တမ်း မရှိသေးပါ။
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isPositive = t.amount > 0;
                return (
                  <tr key={t.id}>
                    <td className="font-medium">
                      {t.kind === 'deposit' && <span className="text-emerald-400 font-bold">ငွေသွင်း</span>}
                      {t.kind === 'bonus' && <span className="text-emerald-400 font-bold">လက်ဆောင်</span>}
                      {t.kind === 'withdrawal' && <span className="text-amber-400 font-bold">ငွေထုတ်</span>}
                      {t.kind === 'wingo_stake' && <span className="text-slate-300">WinGo လောင်းကြေး</span>}
                      {t.kind === 'wingo_payout' && <span className="text-emerald-400 font-bold">WinGo အနိုင်</span>}
                      {t.kind === 'wheel_stake' && <span className="text-slate-300">ဘီးလောင်းကြေး</span>}
                      {t.kind === 'wheel_payout' && <span className="text-emerald-400 font-bold">ဘီးအနိုင်</span>}
                    </td>
                    <td className="text-slate-200">{t.description}</td>
                    <td className={`font-mono font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? `+${t.amount.toLocaleString()} MMK` : `${t.amount.toLocaleString()} MMK`}
                    </td>
                    <td className="font-mono text-slate-300">
                      {t.balance_after.toLocaleString()} MMK
                    </td>
                    <td className="text-slate-400 text-xs">{t.created_at}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
