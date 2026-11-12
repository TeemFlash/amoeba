export type AuthErrorCode =
  | 'invalid-email' | 'email-in-use' | 'weak-password' | 'credentials-invalid'
  | 'provider-conflict' | 'cancelled' | 'popup-blocked' | 'rate-limited'
  | 'network' | 'google-setup' | 'google-unavailable' | 'setup' | 'unknown';

export function createAuthError(code: string) {
  return Object.assign(new Error(code), { code });
}

export function mapAuthError(error: unknown): AuthErrorCode {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (code === 'GOOGLE_SETUP_MISSING' || code === 'auth/google-setup') return 'google-setup';
  if (code === 'auth/google-unavailable' || code === 'auth/missing-id-token') return 'google-unavailable';
  if (code === 'FIREBASE_SETUP_INVALID' || code === 'FIREBASE_NOT_CONFIGURED') return 'setup';
  if (code === 'auth/provider-cancelled' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'cancelled';
  if (code === 'auth/popup-blocked') return 'popup-blocked';
  if (code === 'auth/email-already-in-use') return 'email-in-use';
  if (code === 'auth/invalid-email') return 'invalid-email';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'weak-password';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) return 'credentials-invalid';
  if (code === 'auth/account-exists-with-different-credential') return 'provider-conflict';
  if (code === 'auth/too-many-requests') return 'rate-limited';
  if (code === 'auth/network-request-failed') return 'network';
  if (code === 'auth/operation-not-allowed' || code === 'auth/unauthorized-domain') return 'setup';
  return 'unknown';
}
