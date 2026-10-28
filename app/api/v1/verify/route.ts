import { NextRequest, NextResponse } from 'next/server';
import { extractReceiptInfo } from '@/lib/receiptParser';

// In-memory set of used transaction IDs for server-side idempotency
const usedTrxIds = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trx_id, slip_text, receiver_phone, amount, auth_token } = body;

    const rawInput = slip_text || trx_id || '';
    if (!rawInput) {
      return NextResponse.json(
        { status: 'error', message: 'Transaction ID သို့မဟုတ် ပြေစာစာသား ထည့်သွင်းပေးပါ။' },
        { status: 400 }
      );
    }

    const parsed = extractReceiptInfo(rawInput, receiver_phone);
    const resolvedTrxId = parsed.trx_id || String(trx_id || '').trim();

    if (!resolvedTrxId) {
      return NextResponse.json(
        { status: 'error', message: 'ပြေစာ သို့မဟုတ် Transaction ID ရှာမတွေ့ပါ။' },
        { status: 404 }
      );
    }

    if (usedTrxIds.has(resolvedTrxId)) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Transaction ID (${resolvedTrxId}) သည် အသုံးပြုပြီးသား ပြေစာဖြစ်နေပါသည်။ ထပ်မံအသုံးပြု၍မရပါ။`,
        },
        { status: 400 }
      );
    }

    // Verify amount match if provided
    const numAmount = Number(amount);
    const parsedAmount = parsed.extracted_amount || 0;
    if (numAmount > 0 && parsedAmount > 0 && Math.abs(numAmount - parsedAmount) > 1) {
      return NextResponse.json(
        {
          status: 'error',
          message: `ပြေစာပါ ငွေပမာဏ (${parsedAmount.toLocaleString()} MMK) နှင့် သွင်းမည့်ငွေ (${numAmount.toLocaleString()} MMK) မကိုက်ညီပါ။`,
        },
        { status: 400 }
      );
    }

    // Mark as used
    usedTrxIds.add(resolvedTrxId);

    return NextResponse.json({
      status: 'success',
      provider: parsed.provider,
      trx_id: resolvedTrxId,
      amount: parsedAmount > 0 ? parsedAmount : numAmount,
      last5_digits: parsed.last5_digits,
      verified: true,
      message: 'ငွေသွင်းပြေစာ စစ်ဆေးမှု အောင်မြင်ပါသည်။ MMK ဖြည့်သွင်းပြီးပါပြီ။',
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err?.message || 'Deposit check failure' },
      { status: 500 }
    );
  }
}
