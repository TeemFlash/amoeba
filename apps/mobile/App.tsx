import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { asyncStorage } from './src/storage/asyncStorage';
import { createRepository } from './src/storage/repository';
import { transition } from './src/domain/transitions';
import type { AppState, Command, ErrorCode, EventId, Locale, Repository, Result, ServiceId, Transition } from './src/domain/types';
import { t, type TranslationKey } from './src/i18n';
import { AboutScreen } from './src/screens/AboutScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { EntriesScreen } from './src/screens/EntriesScreen';
import { EventScreens } from './src/screens/EventScreens';
import { HelpScreens } from './src/screens/HelpScreens';
import { HomeScreen } from './src/screens/HomeScreen';
import { Button, ErrorNotice, Heading, Notice, Screen } from './src/ui/components';
import { initialRoute, routeTitle, type Route } from './src/ui/navigation';
import { theme } from './src/ui/theme';
import { useTextScale } from './src/ui/Typography';
import { useFirebaseAccount } from './src/firebase/useFirebaseAccount';
import { registerEmail, resetPassword, signInEmail, signInGoogle, signOut as firebaseSignOut } from './src/firebase/auth';
import { mapAuthError, type AuthErrorCode } from './src/firebase/authErrors';
import { firebaseConfig } from './src/firebase/config';
import { submitWithPersistedIntent, type AccountDraft, type PendingApplicationIntent } from './src/firebase/intents';
import { CloudApplicationError, type ApplicationIntent } from './src/firebase/applications';
import { createPreferencesStore, type Preferences, StoreError } from './src/storage/uiPreferences';
import { createGuestDraftStore, type GuestDraft } from './src/storage/guestDraft';
import { TextSizeProvider } from './src/ui/Typography';
import { TabIcon, type TabIconName } from './src/ui/TabIcon';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

function localHelpDraft(draft: AccountDraft | null): AppState['draft'] {
  if (!draft || draft.kind !== 'help') return null;
  const { uid: _uid, kind: _kind, ...helpDraft } = draft;
  return helpDraft;
}
function accountHelpDraft(uid: string, draft: AppState['draft']): AccountDraft | null {
  return draft ? { ...draft, uid, kind: 'help' } : null;
}

function newOperationId() {
  return `op-${randomUUID()}`;
}
function preferenceStoreError(error: unknown): StoreError {
  return error instanceof StoreError ? error : new StoreError('STORAGE_WRITE_FAILED');
}
function authErrorText(locale: Locale, code: AuthErrorCode) {
  const key: Record<AuthErrorCode, TranslationKey> = {
    'invalid-email': 'authErrorInvalidEmail', 'email-in-use': 'authErrorEmailInUse', 'weak-password': 'authErrorWeakPassword',
    'credentials-invalid': 'authErrorCredentials', 'provider-conflict': 'authErrorProviderConflict', cancelled: 'authErrorCancelled',
    'popup-blocked': 'authErrorPopupBlocked', 'rate-limited': 'authErrorRateLimited', network: 'authErrorNetwork',
    'google-setup': 'authErrorGoogleSetup', 'google-unavailable': 'authErrorGoogleUnavailable', setup: 'authErrorSetup', unknown: 'authErrorUnknown',
  };
  return t(locale, key[code]);
}
function cloudErrorText(locale: Locale, error: unknown) {
  if (!(error instanceof CloudApplicationError)) return t(locale, 'accountRemoteError');
  const key: Record<CloudApplicationError['code'], TranslationKey> = {
    AUTH_REQUIRED: 'authErrorSetup', INVALID_INTENT: 'invalidSelection', DATA_CORRUPT: 'accountReadError',
    ALREADY_ENROLLED: 'alreadyEnrolled', NOT_FOUND: 'entryNotFound', REMOTE_FAILED: 'accountRemoteError',
  };
  return t(locale, key[error.code]);
}
function errorText(locale: Locale, code: ErrorCode): string {
  const key: Record<ErrorCode, TranslationKey> = {
    DRAFT_EXISTS: 'draftExistsBody', DRAFT_NOT_FOUND: 'draftNotFound', INVALID_SELECTION: 'invalidSelection',
    DISTRICT_REQUIRED: 'districtRequired', DATE_REQUIRED: 'dateRequired', SLOT_REQUIRED: 'slotRequired', EVENT_FULL: 'eventFullReason',
    EVENT_CANCELLED: 'eventCancelledReason', ALREADY_ENROLLED: 'alreadyEnrolled', ENTRY_NOT_FOUND: 'entryNotFound',
    STORAGE_READ_FAILED: 'storageReadError', STORAGE_CORRUPT: 'storageCorruptError', STORAGE_WRITE_FAILED: 'storageWriteError',
  };
  return t(locale, key[code]);
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const account = useFirebaseAccount();
  const accountDraftRef = useRef(account.draft);
  const [repository] = useState<Repository>(() => createRepository(asyncStorage, () => new Date().toISOString()));
  const [preferencesStore] = useState(() => createPreferencesStore(asyncStorage));
  const [guestDraftStore] = useState(() => createGuestDraftStore(asyncStorage));
  const [appState, setAppState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const [routeStack, setRouteStack] = useState<Route[]>([{ name: 'welcome' }]);
  const [preferences, setPreferences] = useState<Preferences>({ version: 1, welcomeCompleted: false, textSize: 'standard' });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesError, setPreferencesError] = useState<StoreError | null>(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const pendingPreferences = useRef<Preferences | null>(null);
  const [guestDraft, setGuestDraft] = useState<GuestDraft | null>(null);
  const initialLoadStarted = useRef(false);
  const guestDraftRef = useRef<GuestDraft | null>(null);
  const guestCommandQueue = useRef<Promise<unknown>>(Promise.resolve());
  const noteQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [bootError, setBootError] = useState<ErrorCode | null>(null);
  const [actionError, setActionError] = useState<ErrorCode | null>(null);
  const [cloudActionError, setCloudActionError] = useState<string | null>(null);
  const [pendingCommands, setPendingCommands] = useState<Command[]>([]);
  const pendingRef = useRef<Command[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const busyOwner = useRef(0);
  const lastUid = useRef<string | null>(null);
  const [bootLocale, setBootLocale] = useState<Locale>('ru');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [guestConflict, setGuestConflict] = useState(false);
  const [handoffRetry, setHandoffRetry] = useState(0);
  const authReturnRoute = useRef<Route | null>(null);
  const guestReturnRoute = useRef<Route | null>(null);
  const guestTransfer = useRef<GuestDraft | null>(null);
  const guestTransferRunning = useRef(false);
  const route = routeStack[routeStack.length - 1] ?? initialRoute;
  const focusedFlowNeedsBack = ['account', 'help-terms', 'help-form', 'help-step', 'help-review', 'event-terms', 'event-confirm', 'event-review', 'entry', 'entry-success', 'cancel-confirm', 'discard-confirm', 'replace-confirm', 'reset-confirm', 'about'].includes(route.name);
  const locale = appState?.locale ?? 'ru';
  const appRef = repository;
  const cloudMode = account.mode === 'configured';
  const localMode = account.mode === 'local';
  const accountMode: 'local' | 'invalid' | 'configured' = account.mode;
  const textSize = preferences.textSize;
  const textScale = textSize === 'large' ? 1.25 : 1;
  useEffect(() => { accountDraftRef.current = account.draft; }, [account.draft]);

  const claimBusy = useCallback(() => {
    busyOwner.current += 1;
    busyRef.current = true;
    setBusy(true);
    return busyOwner.current;
  }, []);
  const releaseBusy = useCallback((owner: number) => {
    if (busyOwner.current !== owner) return;
    busyRef.current = false;
    setBusy(false);
  }, []);

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setAppState(next);
  }, []);
  const updateGuestDraft = useCallback((next: GuestDraft | null) => {
    guestDraftRef.current = next;
    setGuestDraft(next);
  }, []);
  const boot = useCallback(async () => {
    setBootError(null);
    setAppState(null);
    stateRef.current = null;
    try {
      const [result, savedPreferences, savedGuest] = await Promise.all([appRef.load(), preferencesStore.load(), guestDraftStore.load()]);
      if (result.ok) {
        commit(result.value);
        if (savedPreferences) setPreferences(savedPreferences);
        updateGuestDraft(savedGuest);
        setPreferencesReady(true);
        setRouteStack([(savedPreferences?.welcomeCompleted ?? false) ? (account.mode === 'local' || account.user ? initialRoute : { name: 'account' }) : { name: 'welcome' }]);
      } else { setBootError(result.error.code); setPreferencesReady(true); }
    } catch (error) { setPreferencesError(preferenceStoreError(error)); setPreferencesReady(true); }
  }, [account.mode, account.user, appRef, commit, guestDraftStore, preferencesStore, updateGuestDraft]);
  useEffect(() => {
    if (account.mode === 'configured' && account.authLoading) return;
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    let active = true;
    let completed = false;
    Promise.all([appRef.load(), preferencesStore.load(), guestDraftStore.load()]).then(([result, savedPreferences, savedGuest]) => {
      completed = true;
      if (!active) return;
      if (result.ok) {
        commit(result.value);
        updateGuestDraft(savedGuest);
        if (savedPreferences) {
          setPreferences(savedPreferences);
          setRouteStack([savedPreferences.welcomeCompleted ? (account.mode === 'local' ? initialRoute : account.user ? initialRoute : { name: 'account' }) : { name: 'welcome' }]);
        } else {
          const first = { version: 1 as const, welcomeCompleted: false, textSize: 'standard' as const };
          setPreferences(first);
          setRouteStack([{ name: 'welcome' }]);
        }
        setPreferencesReady(true);
      } else { setBootError(result.error.code); setPreferencesReady(true); }
    }).catch((error: unknown) => { completed = true; if (active) { setPreferencesError(preferenceStoreError(error)); setPreferencesReady(true); } });
    return () => { active = false; if (!completed) initialLoadStarted.current = false; };
  }, [appRef, commit, guestDraftStore, preferencesStore, preferencesReady, loadRetry, account.authLoading, account.mode, account.user, updateGuestDraft]);

  const navigate = useCallback((next: Route) => {
    setActionError(null);
    setCloudActionError(null);
    setRouteStack((stack) => [...stack, next]);
  }, []);
  const goToRoot = useCallback((next: Route) => {
    setActionError(null);
    setCloudActionError(null);
    setRouteStack([next]);
  }, []);
  const requireAccount = useCallback((returnRoute: Route) => {
    if (account.user) return true;
    authReturnRoute.current = returnRoute;
    setAccountFeedback(null);
    setRouteStack((stack) => [...stack, { name: 'account' }]);
    return false;
  }, [account.user]);
  const goBack = useCallback(() => {
    setActionError(null);
    setCloudActionError(null);
    if (!account.user && guestTransfer.current) {
      guestTransfer.current = null;
      guestReturnRoute.current = null;
      authReturnRoute.current = null;
      setGuestConflict(false);
    }
    setRouteStack((stack) => stack.length > 1 ? stack.slice(0, -1) : [initialRoute]);
  }, [account.user]);
  const continueAsGuest = useCallback(() => {
    if (guestTransfer.current) {
      guestTransfer.current = null;
      guestReturnRoute.current = null;
      authReturnRoute.current = null;
      setGuestConflict(false);
    }
    goToRoot({ name: 'home' });
  }, [goToRoot]);

  useEffect(() => {
    const nextUid = account.user?.uid ?? null;
    if (nextUid === lastUid.current) return;
    lastUid.current = nextUid;
    busyOwner.current += 1;
    busyRef.current = false; setBusy(false);
    pendingRef.current = []; setPendingCommands([]);
    setActionError(null); setCloudActionError(null); setAccountFeedback(null); setAccountNotice(null);
    const returnRoute = nextUid ? authReturnRoute.current : null;
    if (returnRoute && guestTransfer.current) {
      guestReturnRoute.current = returnRoute;
      setRouteStack([{ name: 'account' }]);
    }
    else setRouteStack(returnRoute ? [returnRoute] : [{ name: 'account' }]);
    if (!guestTransfer.current) authReturnRoute.current = null;
  }, [account.user?.uid]);
  useEffect(() => {
    if (route.name !== 'entries' && route.name !== 'account' || !account.user) return;
    const generation = account.generationFor(account.user.uid);
    if (generation !== null) void account.refresh(account.user.uid, generation);
  }, [route.name, account.user?.uid, account.generationFor, account.refresh]);

  useEffect(() => {
    const captured = guestTransfer.current;
    const user = account.user;
    if (!captured || !user || account.authLoading || guestTransferRunning.current) return;
    if (account.pendingIntent) { setAccountFeedback(t(locale, 'accountActionRetry')); return; }
    if (!account.historyReady || account.loadingHistory || account.historyError || account.storageError) return;
    if (account.draft && account.draft.operationId !== captured.operationId) { setGuestConflict(true); return; }
    guestTransferRunning.current = true;
    const generation = account.generationFor(user.uid);
    if (generation === null) { guestTransferRunning.current = false; return; }
    const returnTo = guestReturnRoute.current ?? authReturnRoute.current ?? { name: 'home' as const };
    const transfer = async () => {
      const owner = claimBusy();
      setAccountFeedback(null);
      try {
        const destination: AccountDraft = captured.kind === 'help'
          ? { ...captured, kind: 'help', uid: user.uid }
          : { ...captured, uid: user.uid };
        await account.store.saveDraft(user.uid, destination, false);
        if (!account.isCurrent(user.uid, generation)) return;
        await guestDraftStore.clear(captured.operationId);
        if (!account.isCurrent(user.uid, generation)) return;
        accountDraftRef.current = destination;
        account.setDraft(destination);
        updateGuestDraft(null);
        guestTransfer.current = null;
        guestReturnRoute.current = null;
        authReturnRoute.current = null;
        setRouteStack([returnTo]);
      } catch (error) {
        if (account.isCurrent(user.uid, generation)) setAccountFeedback(t(locale, 'guestTransferError'));
      } finally { guestTransferRunning.current = false; releaseBusy(owner); }
    };
    void transfer();
  }, [account.user?.uid, account.authLoading, account.historyReady, account.loadingHistory, account.historyError, account.storageError, account.pendingIntent?.operationId, account.draft?.operationId, account.generationFor, account.store, account.isCurrent, account.setDraft, claimBusy, guestDraftStore, locale, releaseBusy, updateGuestDraft, handoffRetry]);

  const runAuthAction = useCallback(async (action: () => Promise<unknown>, successNotice?: TranslationKey) => {
    setAccountBusy(true); setAccountFeedback(null); setAccountNotice(null); account.clearAuthError();
    try {
      await action();
      if (successNotice) setAccountNotice(t(locale, successNotice));
    } catch (error) { account.reportAuthError(error); }
    finally { setAccountBusy(false); }
  }, [account, locale]);
  const logoutAccount = useCallback(async () => {
    setAccountBusy(true); setAccountFeedback(null); setAccountNotice(null);
    authReturnRoute.current = null;
    setRouteStack([{ name: 'account' }]);
    try { await firebaseSignOut(); account.clearAuthError(); }
    catch (error) { account.reportAuthError(error); }
    finally { setAccountBusy(false); }
  }, [account]);
  const retryAccountHistory = useCallback(() => {
    const uid = account.user?.uid;
    const generation = uid ? account.generationFor(uid) : null;
    if (uid && generation !== null) void account.refresh(uid, generation);
  }, [account]);
  const retryGuestTransfer = useCallback(() => {
    setAccountFeedback(null);
    setGuestConflict(false);
    setHandoffRetry((value) => value + 1);
  }, []);
  const resolveGuestConflict = useCallback(async (useGuest: boolean) => {
    const captured = guestTransfer.current;
    const user = account.user;
    if (!captured || !user || busyRef.current) return;
    const generation = account.generationFor(user.uid);
    if (generation === null || !account.historyReady || account.loadingHistory || account.pendingIntent) return;
    const owner = claimBusy();
    setAccountFeedback(null);
    try {
      let destination = account.draft;
      if (useGuest) {
        destination = captured.kind === 'help' ? { ...captured, kind: 'help', uid: user.uid } : { ...captured, uid: user.uid };
        await account.store.saveDraft(user.uid, destination, true);
      }
      if (!account.isCurrent(user.uid, generation)) return;
      await guestDraftStore.clear(captured.operationId);
      if (!account.isCurrent(user.uid, generation)) return;
      accountDraftRef.current = destination;
      account.setDraft(destination);
      updateGuestDraft(null);
      guestTransfer.current = null;
      guestReturnRoute.current = null;
      authReturnRoute.current = null;
      setGuestConflict(false);
      const target = destination?.kind === 'help'
        ? destination.step === 'review' && destination.dateId ? { name: 'help-review' as const }
          : { name: 'help-step' as const, step: destination.formStep ?? (!destination.districtId ? 'district' : !destination.dateId ? 'date' : !destination.slotId ? 'time' : 'note') }
        : destination?.kind === 'event' ? { name: 'event-review' as const, eventId: destination.eventId, operationId: destination.operationId }
          : guestReturnRoute.current ?? { name: 'home' as const };
      setRouteStack([target]);
    } catch { if (account.isCurrent(user.uid, generation)) setAccountFeedback(t(locale, 'guestTransferError')); }
    finally { releaseBusy(owner); }
  }, [account.user?.uid, account.generationFor, account.historyReady, account.loadingHistory, account.pendingIntent, account.draft, account.store, account.isCurrent, account.setDraft, claimBusy, guestDraftStore, locale, releaseBusy, updateGuestDraft]);
  const finishWelcome = useCallback(async () => {
    setPreferencesError(null);
    const next = { ...preferences, welcomeCompleted: true };
    pendingPreferences.current = next;
    try {
      await preferencesStore.save(next);
      pendingPreferences.current = null;
      setPreferences(next);
      setRouteStack([account.mode === 'local' || account.user ? initialRoute : { name: 'account' }]);
    } catch (error) {
      setPreferencesError(preferenceStoreError(error));
    }
  }, [account.mode, account.user, preferences, preferencesStore]);
  const updateTextSize = useCallback(async (nextSize: Preferences['textSize']) => {
    const next = { ...preferences, textSize: nextSize };
    pendingPreferences.current = next;
    try { await preferencesStore.save(next); pendingPreferences.current = null; setPreferences(next); setPreferencesError(null); }
    catch (error) { setPreferencesError(preferenceStoreError(error)); }
  }, [preferences, preferencesStore]);
  const retryPreferences = useCallback(() => {
    const pending = pendingPreferences.current;
    if (pending) {
      void preferencesStore.save(pending).then(() => {
        pendingPreferences.current = null;
        setPreferences(pending);
        setPreferencesError(null);
        if (pending.welcomeCompleted && route.name === 'welcome') setRouteStack([account.mode === 'local' || account.user ? initialRoute : { name: 'account' }]);
      }).catch((error: unknown) => setPreferencesError(preferenceStoreError(error)));
      return;
    }
    setPreferencesError(null); initialLoadStarted.current = false; setPreferencesReady(false); setLoadRetry((value) => value + 1);
  }, [account.mode, account.user, preferencesStore, route.name]);

  const saveAccountIntent = useCallback(async (intent: ApplicationIntent, openEntry = true) => {
    if (!account.applications || !account.user || account.user.uid !== intent.uid) return;
    const generation = account.generationFor(intent.uid);
    if (generation === null || busyRef.current) return;
    if (!account.historyReady || account.loadingHistory || account.historyError || account.storageError) { setCloudActionError(t(locale, 'accountReadError')); return; }
    if (account.pendingIntent && account.pendingIntent.operationId !== intent.operationId) { setCloudActionError(t(locale, 'accountActionRetry')); return; }
    const owner = claimBusy(); setCloudActionError(null); setActionError(null); setAccountNotice(null);
    try {
      const result = await submitWithPersistedIntent(
        account.store,
        intent,
        (frozen) => account.applications!.submit(frozen),
        async () => { if (!account.isCurrent(intent.uid, generation)) throw new Error('STALE_SESSION'); await account.store.saveDraft(intent.uid, null); },
      );
      if (!account.isCurrent(intent.uid, generation)) return;
      const nextEntries = [result.acknowledged, ...account.entries.filter((entry) => entry.id !== result.acknowledged.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      account.replaceEntries(nextEntries);
      setAccountNotice(t(locale, 'accountSaveNotice'));
      if (!result.cleanupPending) { accountDraftRef.current = null; account.setDraft(null); }
      const nextPending = await account.store.load(intent.uid).catch(() => intent);
      if (!account.isCurrent(intent.uid, generation)) return;
      account.setPendingIntent(nextPending);
      void account.refresh(intent.uid, generation);
      if (openEntry) {
        setRouteStack(result.acknowledged.status === 'cancelled-demo'
          ? [{ name: 'entries' }, { name: 'entry', entryId: result.acknowledged.id, source: 'account' }]
          : [{ name: 'entries' }, { name: 'entry-success', entryId: result.acknowledged.id }]);
        if (result.acknowledged.status === 'saved-demo') AccessibilityInfo.announceForAccessibility(t(locale, 'entryStatusSaved'));
      }
    } catch (error) {
      if (!account.isCurrent(intent.uid, generation)) return;
      setCloudActionError(cloudErrorText(locale, error));
      if (error instanceof CloudApplicationError && error.code === 'ALREADY_ENROLLED') {
        await account.store.clear(intent.uid, intent.operationId).catch(() => {});
        if (!account.isCurrent(intent.uid, generation)) return;
      }
      const pending = await account.store.load(intent.uid).catch(() => intent);
      if (!account.isCurrent(intent.uid, generation)) return;
      account.setPendingIntent(pending);
      if (error instanceof CloudApplicationError && error.code === 'ALREADY_ENROLLED' && error.existingEntryId) {
        const existing = account.entries.find((entry) => entry.id === error.existingEntryId);
        if (existing) setRouteStack([{ name: 'entries' }, { name: 'entry', entryId: existing.id }]);
      }
    } finally { releaseBusy(owner); }
  }, [account, claimBusy, locale, releaseBusy]);

  const retryPendingAccountSave = useCallback(() => {
    if (account.pendingIntent) void saveAccountIntent(account.pendingIntent, true);
  }, [account.pendingIntent, saveAccountIntent]);

  const completeCommand = useCallback((command: Command, result: Transition, before: AppState) => {
    if ((command.type === 'submitHelp' || command.type === 'enrollEvent') && result.entryId) {
      const entry = result.state.entries.find((item) => item.id === result.entryId);
      const existed = before.entries.some((item) => item.id === result.entryId);
      setRouteStack(entry?.status === 'cancelled-demo'
        ? [{ name: 'entries' }, { name: 'entry', entryId: result.entryId, source: 'local' }]
        : [{ name: 'entries' }, { name: 'entry-success', entryId: result.entryId }]);
      if (entry?.status === 'saved-demo' && !existed) AccessibilityInfo.announceForAccessibility(t(result.state.locale, 'entryStatusSaved'));
    } else if (command.type === 'cancelEntry') {
      setRouteStack([{ name: 'entries' }, { name: 'entry', entryId: command.entryId, source: 'local' }]);
      const beforeEntry = before.entries.find((item) => item.id === command.entryId);
      const afterEntry = result.state.entries.find((item) => item.id === command.entryId);
      if (beforeEntry?.status === 'saved-demo' && afterEntry?.status === 'cancelled-demo') AccessibilityInfo.announceForAccessibility(t(result.state.locale, 'entryStatusCancelled'));
    } else if (command.type === 'discardDraft') {
      setRouteStack([initialRoute]);
    }
  }, []);

  const runCommand = useCallback(async (command: Command): Promise<Result<Transition>> => {
    const current = stateRef.current;
    if (!current) return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
    if (cloudMode && !account.user && command.type !== 'setLocale') {
      if (command.type === 'submitHelp' || command.type === 'enrollEvent' || command.type === 'cancelEntry') {
        setCloudActionError(t(locale, 'guestSaveGate'));
        return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
      }
      const task = guestCommandQueue.current.then(async () => {
        const latest = stateRef.current;
        if (!latest) return { ok: false as const, error: { code: 'STORAGE_READ_FAILED' as const } };
        const activeGuest = guestDraftRef.current;
        const guestHelp = activeGuest?.kind === 'help' ? activeGuest : null;
        if (activeGuest?.kind === 'event' && command.type !== 'discardDraft' && !(command.type === 'startHelp' && command.replace)) {
          setActionError('DRAFT_EXISTS');
          return { ok: false as const, error: { code: 'DRAFT_EXISTS' as const } };
        }
        const base: AppState = { ...latest, draft: guestHelp };
        const result = transition(base, command, new Date().toISOString());
        if (!result.ok) { setActionError(result.error.code); return result; }
        try {
          if (command.type === 'discardDraft') await guestDraftStore.clear(activeGuest?.operationId);
          else if (result.value.state.draft) await guestDraftStore.save({ ...result.value.state.draft, kind: 'help' });
          const nextGuest = command.type === 'discardDraft' ? null : result.value.state.draft ? { ...result.value.state.draft, kind: 'help' as const } : activeGuest?.kind === 'event' ? activeGuest : null;
          updateGuestDraft(nextGuest);
          const nextState = { ...latest, locale: result.value.state.locale, draft: null };
          commit(nextState);
          setActionError(null);
          return { ok: true as const, value: { ...result.value, state: nextState } };
        } catch (error) {
          const code = error instanceof StoreError ? error.code : 'STORAGE_WRITE_FAILED';
          setActionError(code);
          return { ok: false as const, error: { code } };
        }
      });
      guestCommandQueue.current = task.then(() => undefined, () => undefined);
      return task;
    }
    if (account.mode === 'invalid' && command.type !== 'setLocale') {
      setCloudActionError(t(locale, 'accountSetupBody'));
      return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
    }
    if (busyRef.current || pendingRef.current.length > 0) {
      setActionError('STORAGE_WRITE_FAILED');
      return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
    }
    if (cloudMode && account.user && command.type !== 'setLocale' && command.type !== 'submitHelp' && command.type !== 'enrollEvent' && command.type !== 'cancelEntry') {
      const uid = account.user.uid;
      const generation = account.generationFor(uid);
      if (generation === null) return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
      if (!account.historyReady || account.loadingHistory || account.historyError || account.storageError) {
        setCloudActionError(t(locale, 'accountReadError'));
        return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
      }
      if (account.pendingIntent) {
        setCloudActionError(t(locale, 'accountActionRetry'));
        return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
      }
      const latestAccountDraft = accountDraftRef.current;
      if (latestAccountDraft?.kind === 'event' && command.type !== 'discardDraft' && !(command.type === 'startHelp' && command.replace)) {
        setActionError('DRAFT_EXISTS');
        return { ok: false, error: { code: 'DRAFT_EXISTS' } };
      }
      const owner = claimBusy();
      try {
        if (command.type === 'discardDraft' && latestAccountDraft?.kind === 'event') {
          await account.store.saveDraft(uid, null);
          if (!account.isCurrent(uid, generation)) return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
          accountDraftRef.current = null;
          account.setDraft(null);
          setActionError(null);
          const discarded: Transition = { state: current };
          completeCommand(command, discarded, current);
          return { ok: true, value: discarded };
        }
        const currentDraft = localHelpDraft(latestAccountDraft);
        const result = transition({ ...current, draft: command.type === 'startHelp' && command.replace && latestAccountDraft?.kind === 'event' ? null : currentDraft }, command, new Date().toISOString());
        if (!result.ok) { setActionError(result.error.code); return result; }
        const nextDraft = accountHelpDraft(uid, result.value.state.draft);
        await account.store.saveDraft(uid, nextDraft, command.type === 'startHelp' && Boolean(command.replace));
        if (!account.isCurrent(uid, generation)) return { ok: false, error: { code: 'STORAGE_READ_FAILED' } };
        account.setDraft(nextDraft);
        accountDraftRef.current = nextDraft;
        setActionError(null);
        completeCommand(command, result.value, current);
        return result;
      } catch {
        if (account.isCurrent(uid, generation))
        setActionError('STORAGE_WRITE_FAILED');
        return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
      } finally { releaseBusy(owner); }
    }
    const owner = claimBusy();
    const result = await appRef.execute(command);
    releaseBusy(owner);
    if (result.ok) {
      commit(result.value.state);
      completeCommand(command, result.value, current);
      setActionError(null);
      return result;
    }
    setActionError(result.error.code);
    if (result.error.code === 'STORAGE_READ_FAILED' || result.error.code === 'STORAGE_CORRUPT') {
      setBootError(result.error.code);
      return result;
    }
    if (result.error.code === 'STORAGE_WRITE_FAILED') {
      const queued = [command];
      pendingRef.current = queued;
      setPendingCommands(queued);
      if (command.type === 'startHelp' || command.type === 'editHelp' || command.type === 'setDraftStep' || command.type === 'setLocale') {
        const optimistic = transition(current, command, new Date().toISOString());
        if (optimistic.ok) commit(optimistic.value.state);
      }
    }
    return result;
  }, [account, appRef, claimBusy, cloudMode, commit, completeCommand, guestDraftStore, locale, releaseBusy, updateGuestDraft]);

  const retryPending = useCallback(async () => {
    const queue = [...pendingRef.current];
    if (!queue.length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    for (let i = 0; i < queue.length; i++) {
      const before = stateRef.current;
      const result = await appRef.execute(queue[i]!);
      if (!result.ok) {
        pendingRef.current = queue.slice(i);
        setPendingCommands(pendingRef.current);
        setActionError(result.error.code);
        busyRef.current = false;
        setBusy(false);
        return;
      }
      commit(result.value.state);
      if (before) completeCommand(queue[i]!, result.value, before);
    }
    pendingRef.current = [];
    setPendingCommands([]);
    setActionError(null);
    busyRef.current = false;
    setBusy(false);
  }, [appRef, commit, completeCommand]);

  const beginHelp = useCallback(async (serviceId: ServiceId) => {
    if (account.mode === 'invalid') { navigate({ name: 'account' }); return; }
    const result = await runCommand({ type: 'startHelp', serviceId, operationId: newOperationId() });
    if (result.ok) navigate({ name: 'help-step', step: 'district' });
    else if (result.error.code === 'DRAFT_EXISTS') navigate({ name: 'replace-confirm', serviceId });
  }, [account.mode, navigate, runCommand]);
  const replaceDraft = useCallback(async (serviceId: ServiceId) => {
    if (account.mode === 'invalid') { navigate({ name: 'account' }); return; }
    const result = await runCommand({ type: 'startHelp', serviceId, operationId: newOperationId(), replace: true });
    if (result.ok) navigate({ name: 'help-step', step: 'district' });
  }, [account.mode, navigate, runCommand]);
  const beginEvent = useCallback(async (eventId: EventId) => {
    if (account.mode === 'invalid') { navigate({ name: 'account' }); return; }
    const entries = cloudMode ? account.entries : stateRef.current?.entries ?? [];
    const existing = entries.find((entry) => entry.kind === 'event' && entry.eventId === eventId && entry.status === 'saved-demo');
    if (existing) navigate({ name: 'entry', entryId: existing.id });
    else if (cloudMode && account.user) {
      const uid = account.user.uid;
      const generation = account.generationFor(uid);
      if (generation === null) return;
      if (!account.historyReady || account.loadingHistory || account.historyError || account.storageError) { setCloudActionError(t(locale, 'accountReadError')); return; }
      if (account.pendingIntent) { setCloudActionError(t(locale, 'accountActionRetry')); return; }
      if (account.draft && !(account.draft.kind === 'event' && account.draft.eventId === eventId)) { setCloudActionError(t(locale, 'draftExistsBody')); return; }
      const draft = account.draft?.kind === 'event' && account.draft.eventId === eventId
        ? account.draft
        : { kind: 'event' as const, uid, eventId: eventId as 'tea', operationId: newOperationId() };
      const owner = claimBusy();
      try {
        await account.store.saveDraft(uid, draft);
        if (!account.isCurrent(uid, generation)) return;
        accountDraftRef.current = draft;
        account.setDraft(draft);
        navigate({ name: 'event-confirm', eventId, operationId: draft.operationId });
      } catch (error) { if (account.isCurrent(uid, generation)) setCloudActionError(error instanceof Error && error.message === 'ACCOUNT_DRAFT_EXISTS' ? t(locale, 'draftExistsBody') : t(locale, 'storageWriteError')); }
      finally { releaseBusy(owner); }
    } else if (cloudMode && !account.user) {
      if (guestDraftRef.current && !(guestDraftRef.current.kind === 'event' && guestDraftRef.current.eventId === eventId)) { setActionError('DRAFT_EXISTS'); return; }
      const eventDraft: GuestDraft = guestDraftRef.current?.kind === 'event' ? guestDraftRef.current : { kind: 'event', eventId: eventId as 'tea', operationId: newOperationId() };
      try { await guestDraftStore.save(eventDraft); updateGuestDraft(eventDraft); navigate({ name: 'event-confirm', eventId, operationId: eventDraft.operationId }); }
      catch { setCloudActionError(t(locale, 'storageWriteError')); }
    } else navigate({ name: 'event-confirm', eventId, operationId: newOperationId() });
  }, [account, cloudMode, guestDraftStore, locale, navigate, updateGuestDraft]);
  const persistHelpNote = useCallback((value: string, operationId: string): Promise<boolean> => {
    const targetUid = cloudMode ? account.user?.uid ?? null : null;
    const targetGeneration = targetUid ? account.generationFor(targetUid) : null;
    const task = noteQueue.current.then(async () => {
      if (value.length > 280) return false;
      if (cloudMode && !account.user) {
        const active = guestDraftRef.current;
        if (active?.kind !== 'help' || active.operationId !== operationId) return false;
        const updated: GuestDraft = { ...active, note: value };
        try { await guestDraftStore.save(updated); updateGuestDraft(updated); return true; }
        catch { setCloudActionError(t(locale, 'storageWriteError')); return false; }
      }
      if (cloudMode && account.user) {
        const uid = targetUid;
        const generation = targetGeneration;
        if (!uid || generation === null || account.user.uid !== uid || !account.isCurrent(uid, generation)) return false;
        try {
          const latest = await account.store.loadDraft(uid);
          if (!account.isCurrent(uid, generation) || latest?.kind !== 'help' || latest.operationId !== operationId) return false;
          const updated: AccountDraft = { ...latest, note: value };
          await account.store.saveDraft(uid, updated);
          if (!account.isCurrent(uid, generation) || account.user?.uid !== uid) return false;
          accountDraftRef.current = updated;
          account.setDraft(updated);
          return true;
        } catch { setCloudActionError(t(locale, 'storageWriteError')); return false; }
      }
      if (stateRef.current?.draft?.operationId !== operationId) return false;
      const result = await appRef.execute({ type: 'editHelp', patch: { note: value } });
      if (result.ok && result.value.state.draft?.operationId === operationId) { commit(result.value.state); return true; }
      if (!result.ok) setActionError(result.error.code);
      return false;
    });
    noteQueue.current = task.then(() => undefined, () => undefined);
    return task;
  }, [account.user?.uid, account.generationFor, account.isCurrent, account.setDraft, account.store, appRef, cloudMode, commit, guestDraftStore, locale, updateGuestDraft]);
  const submitHelp = useCallback(async () => {
    if (cloudMode && !account.user) {
      if (guestDraft?.kind !== 'help') return;
      guestTransfer.current = { ...guestDraft };
      authReturnRoute.current = { name: 'help-review' };
      setAccountFeedback(t(locale, 'guestSaveGate'));
      setRouteStack((stack) => [...stack, { name: 'account' }]);
      return;
    }
    if (cloudMode && account.user) {
      const draft = localHelpDraft(account.draft);
      if (!draft) { setCloudActionError(t(locale, 'draftNotFound')); return; }
      const checked = transition({ ...(stateRef.current ?? { schemaVersion: 1, locale, draft: null, entries: [] }), draft }, { type: 'submitHelp', operationId: draft.operationId }, new Date().toISOString());
      if (!checked.ok) { setCloudActionError(errorText(locale, checked.error.code)); return; }
      if (!draft.districtId || !draft.slotId) return;
      const intent: ApplicationIntent = { uid: account.user.uid, operationId: draft.operationId, kind: 'help', serviceId: draft.serviceId, districtId: draft.districtId!, dateId: draft.dateId!, note: draft.note ?? '', slotId: draft.slotId };
      await saveAccountIntent(intent);
      return;
    }
    const operationId = stateRef.current?.draft?.operationId;
    if (!operationId) return;
    await runCommand({ type: 'submitHelp', operationId });
  }, [account, cloudMode, guestDraft, locale, runCommand, saveAccountIntent]);
  const submitEvent = useCallback(async () => {
    if (route.name !== 'event-review') return;
    if (cloudMode && !account.user && guestDraft?.kind === 'event') {
      guestTransfer.current = { ...guestDraft };
      authReturnRoute.current = { name: 'event-review', eventId: route.eventId, operationId: route.operationId };
      setAccountFeedback(t(locale, 'guestSaveGate'));
      setRouteStack((stack) => [...stack, { name: 'account' }]);
      return;
    }
    if (cloudMode && account.user) {
      const intent: ApplicationIntent = { uid: account.user.uid, operationId: route.operationId, kind: 'event', eventId: route.eventId };
      await saveAccountIntent(intent);
      return;
    }
    const result = await runCommand({ type: 'enrollEvent', eventId: route.eventId, operationId: route.operationId });
    if (!result.ok && result.error.code === 'ALREADY_ENROLLED' && result.error.existingEntryId) navigate({ name: 'entry', entryId: result.error.existingEntryId });
  }, [account.user, cloudMode, guestDraft, locale, navigate, route, runCommand, saveAccountIntent]);
  const cancelCurrent = useCallback(async () => {
    if (route.name !== 'cancel-confirm') return;
    if (cloudMode && account.user && account.applications) {
      const uid = account.user.uid;
      const generation = account.generationFor(uid);
      if (generation === null || busyRef.current || !account.historyReady || account.loadingHistory || account.historyError || account.storageError || account.pendingIntent) return;
      const owner = claimBusy(); setCloudActionError(null);
      try {
        const cancelled = await account.applications.cancel(uid, route.entryId);
        if (!account.isCurrent(uid, generation)) return;
        account.replaceEntries(account.entries.map((entry) => entry.id === cancelled.id ? cancelled : entry));
        setAccountNotice(t(locale, 'accountCancelNotice'));
        setRouteStack([{ name: 'entries' }, { name: 'entry', entryId: cancelled.id, source: 'account' }]);
        AccessibilityInfo.announceForAccessibility(t(locale, 'entryStatusCancelled'));
        void account.refresh(uid, generation);
      } catch (error) { if (account.isCurrent(uid, generation)) setCloudActionError(cloudErrorText(locale, error)); }
      finally { releaseBusy(owner); }
      return;
    }
    await runCommand({ type: 'cancelEntry', entryId: route.entryId });
  }, [account, claimBusy, cloudMode, locale, releaseBusy, route, runCommand]);
  const discardDraft = useCallback(async () => {
    await runCommand({ type: 'discardDraft' });
  }, [runCommand]);
  const confirmReset = useCallback(async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    const result = await appRef.reset();
    busyRef.current = false;
    setBusy(false);
    if (result.ok) {
      pendingRef.current = [];
      setPendingCommands([]);
      setBootError(null);
      setActionError(null);
      await boot();
      return true;
    }
    setActionError(result.error.code);
    return false;
  }, [appRef, boot]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routeStack.length > 1 || focusedFlowNeedsBack) { goBack(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [focusedFlowNeedsBack, goBack, routeStack.length]);

  if (!appState || !preferencesReady) {
    const loadingLocale = bootLocale;
    return <TextSizeProvider value={textSize}><SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.waveDecor}><View style={styles.waveA} /><View style={styles.waveB} /></View>
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <View style={styles.pageMeasure}>
          <Header locale={loadingLocale} onLocale={setBootLocale} canBack={false} goBack={() => {}} disabled={busy} />
          <Notice locale={loadingLocale} />
          {preferencesError ? <Screen>
            <Heading>{t(loadingLocale, 'loadingErrorTitle')}</Heading>
            <Text style={[styles.body, { fontSize: theme.type.body * textScale, lineHeight: theme.lineHeight.body * textScale }]}>{t(loadingLocale, preferencesError.code === 'STORAGE_CORRUPT' ? 'storageCorruptError' : preferencesError.code === 'STORAGE_WRITE_FAILED' ? 'storageWriteError' : 'storageReadError')}</Text>
            <Button label={t(loadingLocale, 'retry')} onPress={retryPreferences} disabled={busy} />
          </Screen> : bootError ? <Screen>
            {route.name === 'reset-confirm'
              ? <AboutScreen locale={loadingLocale} route={route} navigate={navigate} dismiss={goBack} confirmReset={confirmReset} busy={busy} error={actionError ? errorText(loadingLocale, actionError) : null} showTitle storageMode={accountMode} />
              : <>
                <Heading>{t(loadingLocale, bootError === 'STORAGE_CORRUPT' ? 'corruptTitle' : 'loadingErrorTitle')}</Heading>
                <Text style={[styles.body, { fontSize: theme.type.body * textScale, lineHeight: theme.lineHeight.body * textScale }]}>{t(loadingLocale, bootError === 'STORAGE_CORRUPT' ? 'corruptBody' : 'loadingErrorBody')}</Text>
                <Button label={t(loadingLocale, 'retry')} onPress={() => void boot()} disabled={busy} />
                <Button label={t(loadingLocale, 'resetDemo')} kind="danger" onPress={() => setRouteStack([{ name: 'reset-confirm' }])} />
              </>}
          </Screen> : <Screen><Text style={[styles.body, { fontSize: theme.type.body * textScale, lineHeight: theme.lineHeight.body * textScale }]}>{t(loadingLocale, 'loading')}</Text></Screen>}
        </View>
      </ScrollView>
    </SafeAreaView></TextSizeProvider>;
  }

  const visibleState: AppState = {
    ...appState,
    draft: localMode ? appState.draft : cloudMode && account.user ? localHelpDraft(account.draft) : cloudMode && guestDraft?.kind === 'help' ? guestDraft : null,
    entries: cloudMode ? account.user ? account.entries : [] : appState.entries,
  };
  const currentError = cloudActionError ?? (actionError ? errorText(locale, actionError) : null);
  const accountError = account.authError ? authErrorText(locale, account.authError)
    : account.historyError || account.storageError ? t(locale, 'accountReadError')
      : cloudActionError ?? accountFeedback;
  const onLocale = (nextLocale: Locale) => { void runCommand({ type: 'setLocale', locale: nextLocale }); };
  const onNavigate = (next: Route) => navigate(next);
  const currentTitle = t(locale, routeTitle(route));
  const isTop = routeStack.length > 1;
  const canGoBack = isTop || focusedFlowNeedsBack;
  let content: React.ReactNode = null;
  const interactionLocked = busy || pendingCommands.length > 0 || cloudMode && (account.loadingHistory || account.historyError || account.storageError || Boolean(account.pendingIntent));
  if (route.name === 'welcome') content = <WelcomeScreen locale={locale} onLocale={onLocale} onStart={() => void finishWelcome()} busy={busy} />;
  else if (route.name === 'home') content = <HomeScreen locale={locale} state={visibleState} navigate={onNavigate} draftPending={!cloudMode && pendingCommands.some((command) => command.type === 'startHelp' || command.type === 'editHelp' || command.type === 'setDraftStep')} draftSavedInAccount={cloudMode && Boolean(account.draft)} eventDraft={cloudMode ? account.user ? account.draft?.kind === 'event' ? { eventId: account.draft.eventId, operationId: account.draft.operationId } : null : guestDraft?.kind === 'event' ? { eventId: guestDraft.eventId, operationId: guestDraft.operationId } : null : null} />;
  else if (route.name === 'profile') content = <ProfileScreen locale={locale} textSize={textSize} onTextSize={(size) => void updateTextSize(size)} onLocale={onLocale} mode={accountMode} email={account.user?.email ?? null} authLoading={account.authLoading} busy={busy} navigate={onNavigate} onLogout={logoutAccount} />;
  else if (route.name === 'account') content = <AccountScreen
    locale={locale} mode={accountMode} userEmail={account.user?.email ?? null} loading={account.authLoading || account.loadingHistory} busy={accountBusy || busy}
    error={accountError} notice={accountNotice} historyError={account.historyError || account.storageError}
    hasDraft={Boolean(account.draft)} hasPending={Boolean(account.pendingIntent)}
    onSignIn={(email, password) => runAuthAction(() => signInEmail(email, password))}
    onRegister={(email, password) => runAuthAction(() => registerEmail(email, password))}
    onReset={(email) => runAuthAction(() => resetPassword(email), 'passwordResetSent')}
    onGoogle={() => runAuthAction(() => signInGoogle())} onLogout={logoutAccount} onGuest={continueAsGuest}
    onRetryHistory={retryAccountHistory} onRetryPending={retryPendingAccountSave}
    guestConflict={guestConflict} onContinueAccountDraft={() => void resolveGuestConflict(false)} onReplaceWithGuestDraft={() => void resolveGuestConflict(true)}
    guestTransferPending={Boolean(guestTransfer.current)} onRetryGuestTransfer={retryGuestTransfer}
    onContinueDraft={() => {
      if (account.draft?.kind === 'help') {
        if (account.draft.step === 'review' && account.draft.dateId && account.draft.districtId && account.draft.slotId) setRouteStack([{ name: 'help-review' }]);
        else setRouteStack([{ name: 'help-step', step: account.draft.formStep ?? (!account.draft.districtId ? 'district' : !account.draft.dateId ? 'date' : !account.draft.slotId ? 'time' : 'note') }]);
      } else if (account.draft?.kind === 'event') setRouteStack([{ name: 'event-review', eventId: account.draft.eventId, operationId: account.draft.operationId }]);
    }}
  />;
  else if (['help-catalog', 'help-terms', 'help-form', 'help-step', 'help-review'].includes(route.name)) content = <HelpScreens locale={locale} state={visibleState} route={route} command={runCommand} persistNote={persistHelpNote} navigate={onNavigate} error={currentError} begin={beginHelp} submit={() => void submitHelp()} busy={busy} locked={interactionLocked} cloudMode={cloudMode} />;
  else if (['events', 'event-terms', 'event-confirm', 'event-review'].includes(route.name)) content = <EventScreens locale={locale} route={route} state={visibleState} navigate={onNavigate} begin={beginEvent} submit={() => void submitEvent()} error={currentError} busy={busy} locked={interactionLocked} cloudMode={cloudMode} />;
  else if (['entries', 'entry', 'entry-success', 'cancel-confirm'].includes(route.name)) content = <EntriesScreen locale={locale} route={route} state={visibleState} navigate={onNavigate} dismiss={goBack} cancel={() => void cancelCurrent()} busy={busy} locked={interactionLocked} cloudMode={cloudMode} localReadOnly={account.mode === 'invalid'} signedIn={Boolean(account.user)} historyReady={account.historyReady} loadingHistory={account.loadingHistory} historyError={account.historyError} legacyEntries={cloudMode ? appState.entries : []} onSignIn={() => goToRoot({ name: 'account' })} onRetryHistory={retryAccountHistory} error={currentError} />;
  else content = <AboutScreen locale={locale} route={route} navigate={onNavigate} dismiss={goBack} confirmReset={confirmReset} confirmDiscard={discardDraft} confirmReplace={replaceDraft} error={currentError} busy={busy} locked={interactionLocked} storageMode={accountMode} />;

  return <TextSizeProvider value={textSize}><SafeAreaView style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.waveDecor}><View style={styles.waveA} /><View style={styles.waveB} /></View>
    <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pageMeasure}>
        <Header locale={locale} onLocale={onLocale} canBack={canGoBack} goBack={goBack} disabled={busy || pendingCommands.length > 0} />
        {route.name !== 'home' && route.name !== 'welcome' ? <Text accessibilityRole="header" style={[styles.pageTitle, { fontSize: 26 * textScale, lineHeight: 34 * textScale }]}>{currentTitle}</Text> : null}
        <Notice locale={locale} />
        {preferencesError ? <View style={styles.retryRow}><ErrorNotice>{t(locale, preferencesError.code === 'STORAGE_CORRUPT' ? 'storageCorruptError' : preferencesError.code === 'STORAGE_WRITE_FAILED' ? 'storageWriteError' : 'storageReadError')}</ErrorNotice><Button label={t(locale, 'retry')} kind="secondary" onPress={retryPreferences} disabled={busy} /></View> : null}
        {pendingCommands.length > 0 ? <View style={styles.retryRow}>
          <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice>
          <Button label={t(locale, 'retry')} kind="secondary" disabled={busy} onPress={() => void retryPending()} />
        </View> : null}
        {(actionError || cloudActionError) && pendingCommands.length === 0 ? <View style={styles.retryRow}><ErrorNotice>{currentError}</ErrorNotice></View> : null}
        {content}
      </View>
    </ScrollView>
    {!['welcome', 'account', 'help-terms', 'help-form', 'help-step', 'help-review', 'event-terms', 'event-confirm', 'event-review', 'entry-success', 'entry', 'cancel-confirm', 'about', 'discard-confirm', 'replace-confirm', 'reset-confirm'].includes(route.name) ? <TabBar locale={locale} active={route.name} navigate={goToRoot} /> : null}
  </SafeAreaView></TextSizeProvider>;
}

function Header({ locale, onLocale, canBack, goBack, disabled = false }: { locale: Locale; onLocale: (locale: Locale) => void; canBack: boolean; goBack: () => void; disabled?: boolean }) {
  const scale = useTextScale();
  return <View style={styles.header}>
    <View style={styles.brandRow}>
      {canBack ? <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'back')} onPress={goBack} style={styles.back}><Text style={[styles.backText, { fontSize: 18 * scale, lineHeight: 25 * scale }]}>‹ {t(locale, 'back')}</Text></Pressable> : null}
      <View style={styles.brand}>
        <Text style={[styles.brandName, { fontSize: 23 * scale, lineHeight: 30 * scale }]}>{t(locale, 'appName')}</Text>
        <Text style={[styles.city, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }]}>{t(locale, 'city')}</Text>
      </View>
      <View style={styles.languages}>
        {(['ru', 'kz'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'ru' ? t(locale, 'languageRu') : t(locale, 'languageKz')} accessibilityState={{ selected: locale === value, disabled }} aria-pressed={locale === value} disabled={disabled} onPress={() => onLocale(value)} style={[styles.languageButton, locale === value && styles.languageSelected, disabled && styles.disabled]}>
          <Text style={[styles.languageText, { fontSize: 18 * scale, lineHeight: 25 * scale }, locale === value && styles.languageTextSelected]}>{value.toUpperCase()}</Text>
        </Pressable>)}
      </View>
    </View>
  </View>;
}

function TabBar({ locale, active, navigate }: { locale: Locale; active: Route['name']; navigate: (route: Route) => void }) {
  const selected = active === 'events' || active === 'event-terms' || active === 'event-confirm' || active === 'event-review' ? 'events'
    : active === 'entries' || active === 'entry' || active === 'entry-success' || active === 'cancel-confirm' ? 'entries'
      : active === 'profile' || active === 'account' || active === 'about' || active === 'reset-confirm' ? 'profile' : 'home';
  const scale = useTextScale();
  const { width, fontScale } = useWindowDimensions();
  const requiredCellWidth = 88 * scale * fontScale;
  const cellWidth = (count: number) => (width - 4 - 2 * (count - 1)) / count - 2;
  const columnCount = cellWidth(4) >= requiredCellWidth ? 4 : cellWidth(2) >= requiredCellWidth ? 2 : 1;
  const tabs: { name: 'home' | 'events' | 'entries' | 'profile'; label: TranslationKey; visual: TranslationKey; icon: TabIconName }[] = [
    { name: 'home', label: 'tabHome', visual: 'tabHomeVisual', icon: 'home' },
    { name: 'events', label: 'tabActivities', visual: 'tabActivitiesVisual', icon: 'activities' },
    { name: 'entries', label: 'tabEntries', visual: 'tabEntriesVisual', icon: 'requests' },
    { name: 'profile', label: 'tabProfile', visual: 'tabProfileVisual', icon: 'profile' },
  ];
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {tabs.map((tab) => <Pressable key={tab.name} accessibilityRole="tab" accessibilityLabel={t(locale, tab.label)} accessibilityState={{ selected: selected === tab.name }} aria-selected={selected === tab.name} onPress={() => navigate({ name: tab.name })} style={[styles.tab, columnCount === 2 && styles.tabTwoColumns, columnCount === 1 && styles.tabOneColumn, selected === tab.name && styles.tabSelected]}>
      <TabIcon name={tab.icon} color={selected === tab.name ? theme.colors.primary : theme.colors.secondary} size={26 * scale} />
      <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.tabText, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }, selected === tab.name && styles.tabTextSelected]}>{t(locale, tab.visual)}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  waveDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, overflow: 'hidden' },
  waveA: { position: 'absolute', top: -115, left: -90, width: 540, height: 210, borderRadius: 220, backgroundColor: theme.colors.wave, transform: [{ rotate: '-8deg' }] },
  waveB: { position: 'absolute', top: 155, right: -185, width: 450, height: 150, borderRadius: 180, backgroundColor: theme.colors.wave, opacity: 0.55, transform: [{ rotate: '-12deg' }] },
  pageScroll: { flex: 1, minHeight: 0 },
  pageContent: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  pageMeasure: { width: '100%', maxWidth: theme.maxContentWidth, gap: 16 },
  pageTitle: { color: theme.colors.text, fontSize: 32, lineHeight: 40, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  header: { paddingTop: 4, paddingBottom: 4, backgroundColor: theme.colors.background },
  brandRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, backgroundColor: theme.colors.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, padding: 10 },
  brand: { flexGrow: 1, flexShrink: 1, minWidth: 72, gap: 1 },
  brandName: { color: theme.colors.text, fontSize: 23, lineHeight: 30, fontWeight: '800' },
  city: { color: theme.colors.secondary, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  back: { minHeight: 56, justifyContent: 'center', paddingHorizontal: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.softBlue },
  backText: { color: theme.colors.text, fontSize: 18, lineHeight: 25, fontWeight: '700', flexShrink: 1, ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  languages: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.background },
  languageButton: { minWidth: 56, minHeight: 56, paddingHorizontal: 10, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  disabled: { opacity: 0.55 },
  languageSelected: { borderColor: theme.colors.primary, borderWidth: 2, backgroundColor: theme.colors.softBlue },
  languageText: { color: theme.colors.secondary, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  languageTextSelected: { color: theme.colors.text, fontWeight: '800' },
  retryRow: { gap: 8, paddingBottom: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 2, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tab: { flexGrow: 1, flexBasis: 0, flexShrink: 1, minWidth: 0, maxWidth: '100%', minHeight: 64, paddingHorizontal: 0, paddingVertical: 7, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabTwoColumns: { flexGrow: 1, flexBasis: '48%', minWidth: 0 },
  tabOneColumn: { flexGrow: 0, flexBasis: '100%', minWidth: 0 },
  tabSelected: { backgroundColor: theme.colors.softBlue, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.secondary, fontSize: theme.type.caption, lineHeight: theme.lineHeight.caption, textAlign: 'center', fontWeight: '700', flexShrink: 0, width: '100%', maxWidth: '100%' },
  tabTextSelected: { color: theme.colors.text, fontWeight: '800' },
  body: { color: theme.colors.text, fontSize: theme.type.body, lineHeight: theme.lineHeight.body },
});
