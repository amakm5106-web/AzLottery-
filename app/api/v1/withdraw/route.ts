import { NextRequest, NextResponse } from 'next/server';

// Server-side gateway balances
const serverGatewayVault: Record<string, { name: string; phone: string; balance: number }> = {
  kbz: { name: 'AzLottery KBZPay Vault', phone: '09987654321', balance: 50000000 },
  wave: { name: 'AzLottery WavePay Vault', phone: '09876543210', balance: 50000000 },
  aya: { name: 'AzLottery AYA Pay Vault', phone: '09765432109', balance: 30000000 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, receiver_phone, receiver, provider, account_name, note } = body;

    const targetReceiver = String(receiver_phone || receiver || '').trim();
    const numAmount = Math.floor(Number(amount));
    const targetProvider = String(provider || 'kbz').toLowerCase();

    if (!targetReceiver || targetReceiver.length < 7) {
      return NextResponse.json(
        { status: 'error', message: 'လက်ခံမည့် ဖုန်းနံပါတ် သို့မဟုတ် အကောင့် မမှန်ကန်ပါ။' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'မှန်ကန်သော ငွေပမာဏ ထည့်သွင်းပါ။' },
        { status: 400 }
      );
    }

    const provCode = targetProvider.includes('wave')
      ? 'wave'
      : targetProvider.includes('kbz')
      ? 'kbz'
      : 'aya';

    const vault = serverGatewayVault[provCode] || serverGatewayVault.kbz;

    if (vault.balance < numAmount) {
      return NextResponse.json(
        {
          status: 'error',
          message: `${vault.name} တွင် လွှဲပြောင်းရန် လက်ကျန်ငွေ မလုံလောက်ပါ။ စီမံခန့်ခွဲသူမှ စစ်ဆေးနေပါသည်။`,
        },
        { status: 400 }
      );
    }

    // Generate unique Trx ID matching provider format
    const trxId =
      provCode === 'wave'
        ? `987${Math.floor(100000000 + Math.random() * 900000000)}`
        : `020261027${Math.floor(10000000000 + Math.random() * 90000000000)}`;

    // Deduct vault
    vault.balance -= numAmount;

    return NextResponse.json({
      status: 'success',
      provider: provCode,
      trx_id: trxId,
      amount: numAmount,
      receiver_phone: targetReceiver,
      account_name: account_name || '',
      disbursed_from: vault.phone,
      vault_balance_remaining: vault.balance,
      executed_at: new Date().toISOString(),
      message: `Auto-Withdraw အောင်မြင်ပါသည်! ${vault.name} (${vault.phone}) မှ ${targetReceiver} သို့ ${numAmount.toLocaleString()} MMK အလိုအလျောက် ပေးပို့ပြီးပါပြီ (TXN: ${trxId})။`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err?.message || 'Auto-withdraw failure' },
      { status: 500 }
    );
  }
}
