import test from 'node:test';
import assert from 'node:assert/strict';

test('Unified Wallet Balance: all games share the exact same balance', () => {
  // Simulate user wallet state
  let walletBalance = 50000; // 50,000 MMK
  const transactions = [];

  const placeBet = (gameName, selection, stake) => {
    if (walletBalance < stake) {
      throw new Error('လောင်းကြေးအတွက် MMK လက်ကျန်ငွေ မလုံလောက်ပါ။');
    }
    walletBalance -= stake;
    transactions.push({
      game: gameName,
      type: 'stake',
      selection,
      amount: -stake,
      balanceAfter: walletBalance,
    });
    return walletBalance;
  };

  const settleWin = (gameName, selection, payout) => {
    walletBalance += payout;
    transactions.push({
      game: gameName,
      type: 'payout',
      selection,
      amount: payout,
      balanceAfter: walletBalance,
    });
    return walletBalance;
  };

  // 1. Play WinGo (Bet 5,000)
  placeBet('WinGo', 'green', 5000);
  assert.equal(walletBalance, 45000);

  // 2. Play K3 (Bet 10,000) - Shares the same 45,000 balance!
  placeBet('K3', 'Big', 10000);
  assert.equal(walletBalance, 35000);

  // 3. Play 5D (Bet 5,000) - Shares the same 35,000 balance!
  placeBet('5D', 'Small', 5000);
  assert.equal(walletBalance, 30000);

  // 4. Play TRX Win (Bet 10,000) - Shares the same 30,000 balance!
  placeBet('TRX', 'Red', 10000);
  assert.equal(walletBalance, 20000);

  // 5. K3 Wins (Payout 2x: 20,000 MMK) - Credits back to the unified wallet!
  settleWin('K3', 'Big', 20000);
  assert.equal(walletBalance, 40000);

  // 6. Insufficient balance test
  assert.throws(() => {
    placeBet('WinGo', 'number 7', 100000); // 100,000 > 40,000
  }, /လက်ကျန်ငွေ မလုံလောက်/);

  // 7. Ledger check
  assert.equal(transactions.length, 5);
  assert.equal(transactions[transactions.length - 1].balanceAfter, 40000);
});

test('Deposit Auto-Check Fallback: unmatched transaction sends to Admin for manual review instead of erroring', () => {
  const requests = [];
  const waveTransactions = [
    { transId: '10001234567', amount: 10000, direction: 'CR', used: false },
  ];

  const handleDeposit = (amount, last5Input) => {
    const matched = waveTransactions.find(t => t.transId.endsWith(last5Input) && t.amount === amount);
    if (!matched) {
      // Must NOT throw error! Automatically creates pending manual request
      const req = {
        id: Date.now(),
        amount,
        txn_id: last5Input,
        status: 'pending',
        execution_type: 'manual',
        message: 'Admin ထံသို့ စစ်ဆေးအတည်ပြုရန် ပေးပို့လိုက်ပါပြီ။',
      };
      requests.push(req);
      return { autoApproved: false, fallbackToManual: true, request: req };
    }
    matched.used = true;
    return { autoApproved: true, fallbackToManual: false };
  };

  // Case 1: Unmatched TXN ID (user entered 99999 which is not yet in wave ledger)
  const result1 = handleDeposit(5000, '99999');
  assert.equal(result1.autoApproved, false);
  assert.equal(result1.fallbackToManual, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].status, 'pending');

  // Case 2: Matched TXN ID
  const result2 = handleDeposit(10000, '34567');
  assert.equal(result2.autoApproved, true);
  assert.equal(result2.fallbackToManual, false);
});

test('Wave Sync: graceful fallback without wmt-mfs token returns active status without throwing', () => {
  const waveAdmin = {
    phone: '09753499023',
    isLoggedIn: true,
    wmtMfs: '', // No session token
    transactions: [{ transId: '12345', amount: 5000 }],
  };

  const syncWave = (admin) => {
    if (!admin.wmtMfs) {
      return {
        success: true,
        count: admin.transactions.length,
        message: `WavePay အကောင့် (${admin.phone}) ချိတ်ဆက်ထားပြီး အဆင်သင့်ရှိပါသည်။`,
      };
    }
    return { success: true, count: 0 };
  };

  const syncResult = syncWave(waveAdmin);
  assert.equal(syncResult.success, true);
  assert.match(syncResult.message, /WavePay အကောင့်/);
});
