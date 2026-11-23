import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthForm } from '../src/domain/authForm';

test('auth form validates email and password before allowing a mock submit', () => {
  assert.equal(validateAuthForm('sign-in', ' ', 'pw', ''), 'email-required');
  assert.equal(validateAuthForm('sign-in', 'invalid', 'pw', ''), 'email-invalid');
  assert.equal(validateAuthForm('sign-in', 'person@example.com', '', ''), 'password-required');
  assert.equal(validateAuthForm('sign-in', ' person@example.com ', 'pw', ''), null);
});

test('signup requires a long password and matching confirmation', () => {
  assert.equal(validateAuthForm('sign-up', 'person@example.com', 'short', 'short'), 'password-short');
  assert.equal(validateAuthForm('sign-up', 'person@example.com', 'password1', 'password2'), 'password-mismatch');
  assert.equal(validateAuthForm('sign-up', 'person@example.com', 'password1', 'password1'), null);
});
