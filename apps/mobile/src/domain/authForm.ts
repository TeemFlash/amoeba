export type AuthFormMode = 'sign-in' | 'sign-up';
export type AuthFormIssue = 'email-required' | 'email-invalid' | 'password-required' | 'password-short' | 'password-mismatch';

export function validateAuthForm(mode: AuthFormMode, email: string, password: string, confirmation: string): AuthFormIssue | null {
  const address = email.trim();
  if (!address) return 'email-required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return 'email-invalid';
  if (!password) return 'password-required';
  if (mode === 'sign-up' && password.length < 8) return 'password-short';
  if (mode === 'sign-up' && password !== confirmation) return 'password-mismatch';
  return null;
}
