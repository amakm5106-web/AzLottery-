import test from 'node:test';
import assert from 'node:assert/strict';
import { WaveApiClient, rsaEncryptSecret, generateDeviceId } from '../lib/waveClient.ts';

test('WaveApiClient: generates 40-hex device ID', () => {
  const deviceId = generateDeviceId();
  assert.equal(typeof deviceId, 'string');
  assert.equal(deviceId.length, 40);
  assert.match(deviceId, /^[0-9a-f]{40}$/);
});

test('WaveApiClient: encrypts PIN with RSA_PUBLIC_KEY_1 (PKCS#1 v1.5)', () => {
  const cipherB64 = rsaEncryptSecret('1234', 'counter_999');
  assert.equal(typeof cipherB64, 'string');
  const buffer = Buffer.from(cipherB64, 'base64');
  // 2048-bit RSA key produces exactly 256 bytes ciphertext
  assert.equal(buffer.length, 256);
});

test('WaveApiClient: creates valid headers and options', () => {
  const client = new WaveApiClient({
    phone: '09876543210',
    wmtMfs: 'session_token_123',
  });

  assert.equal(client.phone, '09876543210');
  assert.equal(client.wmtMfs, 'session_token_123');

  const headers = client.getHeaders();
  assert.equal(headers['appId'], 'mm.com.wavemoney.wavepay');
  assert.equal(headers['versionCode'], '1470');
  assert.equal(headers['wmt-mfs'], 'session_token_123');
});
