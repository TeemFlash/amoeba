import { useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import type { Locale } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, ErrorNotice, Heading, Label, Screen, StatusTag } from '../ui/components';
import { theme } from '../ui/theme';
import { useTextScale } from '../ui/Typography';

type Mode = 'local' | 'invalid' | 'configured';
type FormMode = 'signin' | 'register' | 'reset';
type Props = {
  locale: Locale; mode: Mode; userEmail: string | null; loading?: boolean; busy?: boolean;
  error?: string | null; notice?: string | null; historyError?: boolean; hasDraft?: boolean; hasPending?: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onReset: (email: string) => Promise<void>; onGoogle: () => Promise<void>; onLogout: () => Promise<void>;
  onContinueDraft?: () => void; onRetryPending?: () => void;
  onRetryHistory?: () => void;
  onGuest?: () => void;
  guestConflict?: boolean;
  guestTransferPending?: boolean;
  onRetryGuestTransfer?: () => void;
  onContinueAccountDraft?: () => void;
  onReplaceWithGuestDraft?: () => void;
};

export function AccountScreen({ locale, mode, userEmail, loading = false, busy = false, error, notice, historyError = false, hasDraft = false, hasPending = false, onSignIn, onRegister, onReset, onGoogle, onLogout, onContinueDraft, onRetryPending, onRetryHistory, onGuest, guestConflict = false, guestTransferPending = false, onRetryGuestTransfer, onContinueAccountDraft, onReplaceWithGuestDraft }: Props) {
  const [formMode, setFormMode] = useState<FormMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordAgain, setShowPasswordAgain] = useState(false);
  const scale = useTextScale();
  const [localError, setLocalError] = useState<string | null>(null);
  const clearSecrets = () => { setPassword(''); setPasswordAgain(''); };
  const changeMode = (next: FormMode) => { clearSecrets(); setLocalError(null); setFormMode(next); };
  const runEmailAction = async () => {
    setLocalError(null);
    if (!email.trim()) { setLocalError(t(locale, 'authErrorInvalidEmail')); return; }
    if (formMode === 'reset') { try { await onReset(email.trim()); } finally { clearSecrets(); } return; }
    if (!password) { setLocalError(t(locale, 'authErrorWeakPassword')); return; }
    if (formMode === 'register' && password !== passwordAgain) { setLocalError(t(locale, 'passwordMismatch')); return; }
    try {
      if (formMode === 'register') await onRegister(email.trim(), password);
      else await onSignIn(email.trim(), password);
    } catch { /* Error copy is owned by App and already localized. */ }
    finally { clearSecrets(); }
  };

  return <Screen>
    {mode !== 'configured' ? <Card style={{ backgroundColor: mode === 'invalid' ? theme.colors.cream : theme.colors.softBlue }}>
      <Heading level="section">{t(locale, 'accountUnavailableTitle')}</Heading>
      <Label>{t(locale, mode === 'local' ? 'accountLocalBody' : 'accountSetupBody')}</Label>
    </Card> : null}
    {loading ? <Card><Label>{t(locale, 'authLoading')}</Label></Card> : null}
    {userEmail ? <>
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
      {notice ? <StatusTag label={notice} /> : null}
      {historyError && onRetryHistory ? <Button label={t(locale, 'retry')} kind="secondary" onPress={onRetryHistory} disabled={busy} /> : null}
      <Card style={{ backgroundColor: theme.colors.softBlue }}>
        <Heading level="section">{t(locale, 'authSignedIn')}</Heading>
        <Label>{userEmail}</Label>
        <Button label={t(locale, 'logout')} kind="secondary" disabled={busy} onPress={() => void onLogout()} />
      </Card>
      {hasDraft ? <Card><Heading level="section">{t(locale, 'accountDraftTitle')}</Heading><Button label={t(locale, 'accountContinueDraft')} onPress={onContinueDraft ?? (() => {})} disabled={busy || loading} /></Card> : null}
      {guestConflict ? <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
        <Heading level="section">{t(locale, 'guestDraftConflict')}</Heading>
        <Button label={t(locale, 'guestDraftContinue')} kind="secondary" onPress={onContinueAccountDraft ?? (() => {})} disabled={busy || loading} />
        <Button label={t(locale, 'guestDraftReplace')} onPress={onReplaceWithGuestDraft ?? (() => {})} disabled={busy || loading} />
      </Card> : null}
      {guestTransferPending && !guestConflict && error ? <Button label={t(locale, 'retry')} kind="secondary" onPress={onRetryGuestTransfer ?? (() => {})} disabled={busy || loading} /> : null}
      {hasPending ? <Card style={{ backgroundColor: theme.colors.cream }}><Label>{t(locale, 'accountActionRetry')}</Label><Button label={t(locale, 'accountRetryPending')} kind="secondary" onPress={onRetryPending ?? (() => {})} disabled={busy || loading} /></Card> : null}
    </> : mode === 'configured' && !loading ? <Card>
      <Heading level="section">{t(locale, formMode === 'register' ? 'register' : formMode === 'reset' ? 'passwordReset' : 'signIn')}</Heading>
      <Label>{t(locale, 'emailLabel')}</Label>
      <TextInput accessibilityLabel={t(locale, 'emailLabel')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail} editable={!busy} returnKeyType="next" style={[styles.input, { fontSize: theme.type.body * scale }]} />
      {formMode !== 'reset' ? <>
        <Label>{t(locale, 'passwordLabel')}</Label>
        <TextInput accessibilityLabel={t(locale, 'passwordLabel')} autoCapitalize="none" autoComplete={formMode === 'register' ? 'new-password' : 'current-password'} textContentType={formMode === 'register' ? 'newPassword' : 'password'} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} editable={!busy} returnKeyType={formMode === 'register' ? 'next' : 'done'} onSubmitEditing={() => { if (formMode === 'signin') void runEmailAction(); }} style={[styles.input, { fontSize: theme.type.body * scale }]} />
        <Button label={t(locale, showPassword ? 'authHidePassword' : 'authShowPassword')} kind="quiet" onPress={() => setShowPassword((value) => !value)} disabled={busy} />
      </> : null}
      {formMode === 'register' ? <>
        <Label>{t(locale, 'passwordAgainLabel')}</Label>
        <TextInput accessibilityLabel={t(locale, 'passwordAgainLabel')} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry={!showPasswordAgain} value={passwordAgain} onChangeText={setPasswordAgain} editable={!busy} style={[styles.input, { fontSize: theme.type.body * scale }]} />
        <Button label={t(locale, showPasswordAgain ? 'authHidePassword' : 'authShowPassword')} kind="quiet" onPress={() => setShowPasswordAgain((value) => !value)} disabled={busy} />
      </> : null}
      {error || localError ? <ErrorNotice>{error ?? localError}</ErrorNotice> : null}
      {notice ? <StatusTag label={notice} /> : null}
      <Button label={t(locale, formMode === 'register' ? 'register' : formMode === 'reset' ? 'sendReset' : 'signIn')} onPress={() => void runEmailAction()} disabled={busy} />
      {formMode === 'signin' ? <>
        <Button label={t(locale, 'passwordReset')} kind="quiet" onPress={() => changeMode('reset')} disabled={busy} />
        <Button label={t(locale, 'signInGoogle')} kind="secondary" onPress={() => void onGoogle()} disabled={busy} />
        <Button label={t(locale, 'createAccountPrompt')} kind="quiet" onPress={() => changeMode('register')} disabled={busy} />
      </> : <Button label={t(locale, 'signInPrompt')} kind="quiet" onPress={() => changeMode('signin')} disabled={busy} />}
      {onGuest ? <Button label={t(locale, 'continueAsGuest')} kind="quiet" onPress={onGuest} disabled={busy} /> : null}
    </Card> : null}
    {mode !== 'configured' && onGuest ? <Button label={t(locale, 'continueAsGuest')} kind="secondary" onPress={onGuest} disabled={busy} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  input: { minHeight: 60, borderWidth: 2, borderColor: theme.colors.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.type.body },
});
