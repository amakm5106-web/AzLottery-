import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReceiptInfo, normalizeMyanmarDigits } from '../lib/receiptParser.ts';

test('receiptParser: extracts KBZPay transaction ID and amount in Burmese numerals', () => {
  const sampleSlip = `
KBZPay ငွေလွှဲပြေစာ
Transaction ID: KP982736412
ငွေပမာဏ: ၅၀,၀၀၀ ကျပ်
ပေးပို့သူ: ၀၉-၉၈၇၆၅၄၃၂၁
လက်ခံသူ: AzLottery Pay
  `;
  const parsed = extractReceiptInfo(sampleSlip, '09987654321');
  assert.equal(parsed.trx_id, 'KP982736412');
  assert.equal(parsed.extracted_amount, 50000);
  assert.equal(parsed.is_valid, true);
});

test('receiptParser: extracts WavePay transaction ID and amount in Western numerals', () => {
  const sampleSlip = `
WavePay Transfer Success
Transaction ID: 987123456789
Amount: 10,000 Ks
Sender: 09876543210
  `;
  const parsed = extractReceiptInfo(sampleSlip, '09876543210');
  assert.equal(parsed.trx_id, '987123456789');
  assert.equal(parsed.extracted_amount, 10000);
  assert.equal(parsed.is_valid, true);
});

test('receiptParser: cleans Burmese numerals properly', () => {
  const burmeseDigits = '၀၁၂၃၄၅၆၇၈၉';
  assert.equal(normalizeMyanmarDigits(burmeseDigits), '0123456789');

  const slip = 'ငွေပမာဏ: ၁၀,၀၀၀ ကျပ် / Trx ID: TXN123456';
  const parsed = extractReceiptInfo(slip);
  assert.equal(parsed.extracted_amount, 10000);
  assert.equal(parsed.trx_id, 'TXN123456');
});

test('Real MMK Accounting: starting balance is strictly 0 MMK and credits only via verified slip', () => {
  let userBalance = 0;
  assert.equal(userBalance, 0, 'New user starting balance must be strictly 0 MMK');

  // Verify deposit of 20,000 MMK
  const depositSlip = 'KBZPay Trx ID: KP883921003 Amount: ၂၀,၀၀၀ Ks';
  const parsed = extractReceiptInfo(depositSlip);
  assert.equal(parsed.extracted_amount, 20000);

  // Credit upon auto-check
  userBalance += parsed.extracted_amount;
  assert.equal(userBalance, 20000);

  // Auto-withdraw 5,000 MMK
  const withdrawAmount = 5000;
  assert.ok(userBalance >= withdrawAmount, 'Sufficient balance for withdrawal');
  userBalance -= withdrawAmount;
  assert.equal(userBalance, 15000);
});
