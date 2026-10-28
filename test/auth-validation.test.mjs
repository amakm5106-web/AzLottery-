import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthInputError, normalizeIdentifier, passwordValidationError } from '../lib/auth/validation.ts';

test('normalizes email identifiers to lowercase', () => {
  assert.deepEqual(normalizeIdentifier('  Name@Example.COM  '), {
    value: 'name@example.com',
    type: 'email',
  });
});

test('normalizes Myanmar phone digits and separators', () => {
  assert.deepEqual(normalizeIdentifier('၀၉ ၇၈၉-၁၂၃-၄၅၆'), {
    value: '+959789123456',
    type: 'phone',
  });
  assert.deepEqual(normalizeIdentifier('+959789123456'), {
    value: '+959789123456',
    type: 'phone',
  });
});

test('rejects malformed identifiers', () => {
  assert.throws(() => normalizeIdentifier('not-an-email-or-phone'), AuthInputError);
  assert.throws(() => normalizeIdentifier('bad@address'), AuthInputError);
});

test('accepts only passwords with at least eight characters and at most 72 UTF-8 bytes', () => {
  assert.match(passwordValidationError('short') || '', /အနည်းဆုံး ၈ လုံး/);
  assert.match(passwordValidationError('က'.repeat(25)) || '', /၇၂ bytes/);
  assert.equal(passwordValidationError('long-enough-password'), null);
});
