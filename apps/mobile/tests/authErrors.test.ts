import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthError, mapAuthError } from '../src/firebase/authErrors';

test('Firebase authentication errors map to safe product-level cases', () => {
  assert.equal(mapAuthError({ code: 'auth/invalid-credential' }), 'credentials-invalid');
  assert.equal(mapAuthError({ code: 'auth/email-already-in-use' }), 'email-in-use');
  assert.equal(mapAuthError({ code: 'auth/account-exists-with-different-credential' }), 'provider-conflict');
  assert.equal(mapAuthError({ code: 'auth/popup-closed-by-user' }), 'cancelled');
  assert.equal(mapAuthError({ code: 'auth/popup-blocked' }), 'popup-blocked');
  assert.equal(mapAuthError({ code: 'auth/network-request-failed' }), 'network');
});

test('raw SDK messages never become UI copy', () => {
  assert.equal(mapAuthError(new Error('secret or vendor diagnostic')), 'unknown');
});

test('platform adapter errors use the same Firebase code shape as SDK errors', () => {
  assert.equal(mapAuthError(createAuthError('auth/google-setup')), 'google-setup');
  assert.equal(mapAuthError(createAuthError('auth/provider-cancelled')), 'cancelled');
  assert.equal(mapAuthError(createAuthError('auth/google-unavailable')), 'google-unavailable');
});
