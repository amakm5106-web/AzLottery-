import test from 'node:test';
import assert from 'node:assert/strict';

// Test Burmese digits normalization and Last 5 Digits matching logic as per Decr-main
const normalizeBurmeseDigits = (str) => {
  const mmDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  let res = str;
  mmDigits.forEach((d, idx) => {
    res = res.replaceAll(d, String(idx));
  });
  return res;
};

const verifyWaveDeposit = (incomingTxList, userInputTxn, amountMMK) => {
  const cleanInput = normalizeBurmeseDigits(userInputTxn.trim().replace(/[^0-9]/g, ''));
  const last5 = cleanInput.length >= 5 ? cleanInput.slice(-5) : cleanInput;

  const matched = incomingTxList.find((item) => {
    if (item.direction !== 'CR') return false;
    if (item.amount !== amountMMK) return false;
    if (item.used) return false;

    if (cleanInput.length > 5) {
      return item.transId === cleanInput || item.transId.endsWith(last5);
    }
    return item.transId.endsWith(last5);
  });

  return matched;
};

test('Wave Auto-Check: matches last 5 digits correctly', () => {
  const incoming = [
    { transId: '98712334567', amount: 10000, direction: 'CR', used: false },
    { transId: '98712355555', amount: 20000, direction: 'CR', used: false },
  ];

  // User enters only 5 digits "34567"
  const match1 = verifyWaveDeposit(incoming, '34567', 10000);
  assert.ok(match1);
  assert.equal(match1.transId, '98712334567');

  // Burmese numerals "၃၄၅၆၇"
  const matchBurmese = verifyWaveDeposit(incoming, '၃၄၅၆၇', 10000);
  assert.ok(matchBurmese);
  assert.equal(matchBurmese.transId, '98712334567');

  // Full transaction ID "98712334567"
  const matchFull = verifyWaveDeposit(incoming, '98712334567', 10000);
  assert.ok(matchFull);
  assert.equal(matchFull.transId, '98712334567');

  // Mismatched amount
  const matchWrongAmount = verifyWaveDeposit(incoming, '34567', 50000);
  assert.equal(matchWrongAmount, undefined);

  // Mismatched digits
  const matchWrongId = verifyWaveDeposit(incoming, '99999', 10000);
  assert.equal(matchWrongId, undefined);
});

test('Wave Auto-Check: prevents double spending (already used)', () => {
  const incoming = [
    { transId: '98712334567', amount: 10000, direction: 'CR', used: true },
  ];

  const match = verifyWaveDeposit(incoming, '34567', 10000);
  assert.equal(match, undefined);
});
