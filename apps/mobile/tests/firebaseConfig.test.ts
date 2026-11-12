import test from 'node:test';
import assert from 'node:assert/strict';
import { readFirebaseConfig } from '../src/firebase/config';

test('no Firebase values selects the existing local demo mode', () => {
  assert.deepEqual(readFirebaseConfig({}), { mode: 'local' });
});

test('complete public Firebase values enable cloud mode', () => {
  assert.deepEqual(readFirebaseConfig({
    EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'mobi-demo.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'mobi-demo',
    EXPO_PUBLIC_FIREBASE_APP_ID: 'app-id',
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'sender-id',
  }), {
    mode: 'cloud',
    config: {
      apiKey: 'key', authDomain: 'mobi-demo.firebaseapp.com', projectId: 'mobi-demo',
      appId: 'app-id', messagingSenderId: 'sender-id',
    },
  });
});

test('partial Firebase configuration is a setup error, not local mode', () => {
  const result = readFirebaseConfig({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'mobi-demo' });
  assert.equal(result.mode, 'invalid');
  assert.deepEqual(result.missing, ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_APP_ID', 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']);
});

test('emulator-only configuration is explicitly isolated from a live Firebase project', () => {
  const result = readFirebaseConfig({ EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-mobi-rules', EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1' });
  assert.equal(result.mode, 'emulator');
  if (result.mode === 'emulator') {
    assert.equal(result.config.projectId, 'demo-mobi-rules');
    assert.equal(result.emulatorHost, '127.0.0.1');
  }
});
