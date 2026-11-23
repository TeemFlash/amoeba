import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler } from 'react-native';
import type { Locale, Entry } from '../domain/types';
import { parseState } from '../domain/validation';
import { registerEmail, resetPassword, signInEmail, signInGoogle, signOut } from '../firebase/auth';
import { mapAuthError, type AuthErrorCode } from '../firebase/authErrors';
import { getFirebaseDatabase } from '../firebase/client';
import { firebaseConfig } from '../firebase/config';
import { createOperationsRepository, OperationalError, type OperationalMeeting } from '../firebase/operations';
import { useFirebaseAccount } from '../firebase/useFirebaseAccount';
import { t } from '../i18n';
import { asyncStorage } from '../storage/asyncStorage';
import { STORAGE_KEY } from '../storage/repository';
import { createPreferencesStore, type Preferences } from '../storage/uiPreferences';
import type { OperationalDraft } from '../storage/operationalDraft';
import { Button, Card, ErrorNotice, Heading, Label, Screen, StatusTag } from '../ui/components';
import type { Route } from '../ui/navigation';
import { TextSizeProvider, type TextSize } from '../ui/Typography';
import { AccountScreen } from './AccountScreen';
import { ArchivedEntry } from './EntriesScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { operationalText as copy, type OperationalCopyKey } from './operationalCopy';
import { ResourceState, useOperationalResource, type Confirmation, type Mutate, type Operations } from './operationalResource';
import { HelpForm, HelpList, MeetingList, EnrollmentList } from './OperationalWork';

type Tab = 'home' | 'events' | 'entries' | 'calls' | 'profile';
type WorkPage = Tab | 'help' | 'archive';
type Page = WorkPage | 'account';
type SignInReturn = { page: WorkPage; guestDraft?: OperationalDraft; selectedMeeting?: OperationalMeeting };
type Account = ReturnType<typeof useFirebaseAccount>;
type Chrome = {
  locale: Locale; onLocale: (locale: Locale) => void; back?: () => void; tab?: Tab;
  selectTab: (route: Route) => void; volunteer: boolean; children: ReactNode;
};
type Props = { renderChrome: (chrome: Chrome) => ReactNode; authErrorText: (locale: Locale, code: AuthErrorCode) => string };
const localeKey = 'mobi-operational-locale:v1';
const initialPreferences: Preferences = { version: 1, welcomeCompleted: false, textSize: 'standard' };
const isTab = (name: Page): name is Tab => ['home', 'events', 'entries', 'calls', 'profile'].includes(name);

async function readDeviceArchive() {
  const raw = await asyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const parsed = parseState(raw);
  if (!parsed.ok) throw new Error(parsed.error.code);
  return parsed.value;
}

function errorLabel(error: unknown): OperationalCopyKey {
  if (error instanceof OperationalError) {
    switch (error.code) {
      case 'CAPACITY': return 'full';
      case 'ALREADY_ENROLLED': return 'enrolled';
      case 'NOT_FOUND': case 'UNAVAILABLE': case 'ACCESS_DENIED': return 'unavailable';
      case 'CONFLICT': return 'conflict';
      case 'INVALID_INPUT': return 'invalid';
    }
  }
  return 'writeError';
}


function InitialChrome({ children, locale, onLocale, textSize, preferenceError, frame: ChromeFrame }: {
  children: ReactNode; locale: Locale; onLocale: Chrome['onLocale']; textSize: TextSize; preferenceError: boolean; frame: Props['renderChrome'];
}) {
  return <TextSizeProvider value={textSize}>
    <ChromeFrame locale={locale} onLocale={onLocale} selectTab={() => {}} volunteer={false}>
      {firebaseConfig.mode === 'emulator' ? <StatusTag label={copy(locale, 'test')} /> : null}
      {preferenceError ? <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice> : null}
      {children}
    </ChromeFrame>
  </TextSizeProvider>;
}

export function OperationalApp({ renderChrome, authErrorText }: Props) {
  const account = useFirebaseAccount(true);
  const [preferencesStore] = useState(() => createPreferencesStore(asyncStorage));
  const [preferences, setPreferences] = useState(initialPreferences);
  const [locale, setLocale] = useState<Locale>('ru');
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState(false);
  const [preferenceError, setPreferenceError] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authActionError, setAuthActionError] = useState<AuthErrorCode | null>(null);
  const [passwordNotice, setPasswordNotice] = useState(false);
  const authBusyRef = useRef(false);
  const [returnAfterSignIn, setReturnAfterSignIn] = useState<SignInReturn | null>(null);
  const settingsQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [repo] = useState<Operations | null>(() => {
    try { return createOperationsRepository(getFirebaseDatabase()); }
    catch { return null; }
  });

  const loadSettings = useCallback(async () => {
    try {
      const [saved, language] = await Promise.all([preferencesStore.load(), asyncStorage.getItem(localeKey)]);
      if (language === 'ru' || language === 'kz') setLocale(language);
      else {
        const local = await readDeviceArchive().catch(() => null);
        if (local) setLocale(local.locale);
      }
      setPreferences(saved ?? initialPreferences);
      setSetupError(false);
      setReady(true);
    } catch { setSetupError(true); }
  }, [preferencesStore]);
  useEffect(() => { void Promise.resolve().then(loadSettings); }, [loadSettings]);

  const save = (work: () => Promise<void>) => {
    const result = settingsQueue.current.then(async () => {
      try { await work(); setPreferenceError(false); }
      catch { setPreferenceError(true); }
    });
    settingsQueue.current = result;
  };
  const selectLanguage = (language: Locale) => {
    setLocale(language);
    save(() => asyncStorage.setItem(localeKey, language));
  };
  const updateSettings = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    save(() => preferencesStore.save(next));
  };
  const authAction = async (run: () => Promise<unknown>, reset = false) => {
    if (authBusyRef.current) return;
    authBusyRef.current = true;
    setAuthBusy(true); setAuthActionError(null); setPasswordNotice(false); account.clearAuthError();
    try { await run(); if (reset) setPasswordNotice(true); }
    catch (error) { setAuthActionError(mapAuthError(error)); }
    finally { authBusyRef.current = false; setAuthBusy(false); }
  };
  const user = account.user;
  const signOutAccount = () => authAction(signOut);
  const authError = authActionError ?? account.authError;
  const initialChrome = { frame: renderChrome, locale, onLocale: selectLanguage, textSize: preferences.textSize, preferenceError };

  if (!ready || !repo || account.authLoading || (user && !account.role)) return <InitialChrome {...initialChrome}><Screen>
    {setupError ? <><ErrorNotice>{t(locale, 'storageReadError')}</ErrorNotice><Button label={t(locale, 'retry')} onPress={() => void loadSettings()} /></>
      : !repo ? <ErrorNotice>{t(locale, 'authErrorSetup')}</ErrorNotice>
        : user && account.roleError ? <><ErrorNotice>{t(locale, 'volunteerRoleError')}</ErrorNotice><Button label={t(locale, 'retry')} onPress={() => void account.refreshRole(user.uid)} /></>
          : <StatusTag label={copy(locale, 'loading')} />}
    {user ? <Button label={t(locale, 'logout')} kind="secondary" disabled={authBusy} onPress={() => void signOutAccount()} /> : null}
    {authError ? <ErrorNotice>{authErrorText(locale, authError)}</ErrorNotice> : null}
  </Screen></InitialChrome>;
  if (!preferences.welcomeCompleted && !user) return <InitialChrome {...initialChrome}><WelcomeScreen locale={locale} onLocale={selectLanguage} onStart={() => updateSettings({ welcomeCompleted: true })} intro={copy(locale, 'welcome')} /></InitialChrome>;
  const generation = user ? account.generationFor(user.uid) : null;
  if (user && generation === null) return <InitialChrome {...initialChrome}><StatusTag label={copy(locale, 'loading')} /></InitialChrome>;
  return <OperationalWorkspace key={`${user?.uid ?? 'guest'}:${account.role ?? 'guest'}:${generation ?? ''}`}
    account={account} locale={locale} repo={repo} chrome={renderChrome} preferenceError={preferenceError} authBusy={authBusy} authError={authError ? authErrorText(locale, authError) : null}
    passwordNotice={passwordNotice} authAction={authAction} signOutAccount={signOutAccount} textSize={preferences.textSize}
    signInReturn={user && account.role === 'resident' ? returnAfterSignIn : null}
    onSignInTarget={setReturnAfterSignIn}
    onLocale={selectLanguage} onTextSize={(textSize) => updateSettings({ textSize })} />;
}

function OperationalWorkspace({ account, locale, repo, chrome: ChromeFrame, preferenceError, textSize, onLocale, onTextSize, authBusy, authError, passwordNotice, authAction, signOutAccount, signInReturn, onSignInTarget }: {
  account: Account; locale: Locale; repo: Operations; chrome: Props['renderChrome']; preferenceError: boolean;
  textSize: TextSize; onLocale: (next: Locale) => void; onTextSize: (size: TextSize) => void;
  authBusy: boolean; authError: string | null; passwordNotice: boolean;
  authAction: (run: () => Promise<unknown>, reset?: boolean) => Promise<void>; signOutAccount: () => Promise<void>;
  signInReturn: SignInReturn | null; onSignInTarget: (target: SignInReturn | null) => void;
}) {
  const uid = account.user?.uid;
  const volunteer = account.role === 'volunteer';
  const defaultPage: Tab = volunteer ? 'calls' : 'home';
  const [page, setPage] = useState<Page>(signInReturn?.page ?? defaultPage);
  const [handedOffDraft, setHandedOffDraft] = useState(signInReturn?.guestDraft);
  const [selectedMeeting, setSelectedMeeting] = useState(signInReturn?.selectedMeeting);
  const priorPage = useRef<WorkPage>('home');
  const helpBack = useRef<(() => boolean) | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const busyLock = useRef(false);
  const [error, setError] = useState<OperationalCopyKey | null>(null);
  const [notice, setNotice] = useState<OperationalCopyKey | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (uid) onSignInTarget(null); }, [onSignInTarget, uid]);

  const residentHelpLoader = useCallback(() => repo.listResidentHelp(uid!), [repo, uid]);
  const queueLoader = useCallback(() => repo.listOpenHelp(uid!), [repo, uid]);
  const ownHelpLoader = useCallback(() => repo.listVolunteerHelp(uid!), [repo, uid]);
  const meetingLoader = useCallback(() => repo.listMeetings(), [repo]);
  const enrollmentLoader = useCallback(() => repo.listEnrollments(uid!), [repo, uid]);
  const residentHelp = useOperationalResource(uid && !volunteer && page === 'entries' ? residentHelpLoader : null);
  const queue = useOperationalResource(uid && volunteer && page === 'calls' ? queueLoader : null);
  const ownHelp = useOperationalResource(uid && volunteer && (page === 'calls' || page === 'profile') ? ownHelpLoader : null);
  const meetings = useOperationalResource(!volunteer && (page === 'events' || Boolean(uid && page === 'entries')) ? meetingLoader : null);
  const enrollments = useOperationalResource(uid && !volunteer && (page === 'events' || page === 'entries') ? enrollmentLoader : null);

  const go = (next: Page) => {
    if (busyLock.current || authBusy) return;
    if (next === 'account' && page !== 'account') priorPage.current = page;
    if (page === 'account' && next !== 'account') onSignInTarget(null);
    setConfirmation(null); setError(null); setNotice(null); setPage(next);
  };
  const back = () => {
    if (confirmation) { if (!busyLock.current) { setConfirmation(null); setError(null); } return; }
    if (page === 'help' && !busyLock.current && helpBack.current?.()) return;
    go(page === 'account' ? priorPage.current : page === 'archive' ? 'entries' : defaultPage);
  };
  const hasBack = Boolean(confirmation) || !isTab(page);
  useEffect(() => {
    if (!hasBack) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  });

  const refresh = () => {
    residentHelp.refresh(); queue.refresh(); ownHelp.refresh(); meetings.refresh(); enrollments.refresh();
  };
  const mutate: Mutate = async (run, noticeKey = 'actionSaved') => {
    if (busyLock.current) return false;
    const generation = uid ? account.generationFor(uid) : null;
    if (!uid || generation === null) return false;
    const current = () => active.current && account.isCurrent(uid, generation);
    busyLock.current = true;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await run();
      if (!current()) return false;
      setConfirmation(null); setNotice(result ?? noticeKey); refresh();
      return true;
    } catch (failure) {
      if (current()) {
        const label = errorLabel(failure);
        setError(label);
        if (label === 'conflict' || label === 'unavailable' || label === 'full' || label === 'enrolled') setConfirmation(null);
        refresh();
      }
      return false;
    } finally {
      busyLock.current = false;
      if (current()) setBusy(false);
    }
  };
  const confirm = (value: Confirmation) => { setError(null); setNotice(null); setConfirmation(value); };
  const submitHelp: Mutate = async (run) => {
    const sent = await mutate(run, 'helpSaved');
    if (sent) setPage('entries');
    return sent;
  };
  const signIn = () => { onSignInTarget(page === 'account' ? null : { page }); go('account'); };
  const signInCard = <Card><Label>{copy(locale, 'guestSignIn')}</Label><Button label={t(locale, 'signIn')} onPress={signIn} /></Card>;
  let content: ReactNode;
  switch (page) {
    case 'home': content = <Screen>
      <Heading>{t(locale, 'appName')}</Heading><Label>{copy(locale, 'intro')}</Label>
      <Button label={copy(locale, 'help')} onPress={() => go('help')} />
      <Button label={copy(locale, 'meetings')} kind="secondary" onPress={() => go('events')} />
      {!uid ? signInCard : null}
    </Screen>; break;
    case 'account': content = <AccountScreen locale={locale} mode="configured" userEmail={account.user?.email ?? null} busy={authBusy}
      error={authError} notice={passwordNotice ? t(locale, 'passwordResetSent') : null}
      onSignIn={(email, password) => authAction(() => signInEmail(email, password))}
      onRegister={(email, password) => authAction(() => registerEmail(email, password))}
      onReset={(email) => authAction(() => resetPassword(email), true)} onGoogle={() => authAction(signInGoogle)}
      onLogout={signOutAccount} onGuest={() => go(defaultPage)} />; break;
    case 'help': content = <HelpForm locale={locale} uid={uid} repo={repo} busy={busy} submit={submitHelp} guestDraft={handedOffDraft}
      registerBack={(handler) => { helpBack.current = handler; }} releaseGuestDraft={() => setHandedOffDraft(undefined)} onGuestSubmit={(guestDraft) => { onSignInTarget({ page: 'help', guestDraft }); go('account'); }} />; break;
    case 'events': content = <Screen>
      <Heading>{copy(locale, 'meetings')}</Heading>
      <Button label={t(locale, 'volunteerRefresh')} kind="secondary" onPress={refresh} disabled={meetings.loading || busy} />
      <ResourceState locale={locale} {...meetings} />
      {uid ? <ResourceState locale={locale} {...enrollments} /> : null}
      {meetings.data ? <MeetingList locale={locale} meetings={meetings.data} enrollments={enrollments.data} uid={uid} repo={repo} confirm={confirm}
        signIn={(meeting) => { onSignInTarget({ page: 'events', selectedMeeting: meeting }); go('account'); }}
        selectedMeeting={selectedMeeting} onSelectionReviewed={() => setSelectedMeeting(undefined)} busy={busy} /> : null}
    </Screen>; break;
    case 'entries': content = uid ? <Screen>
      <Heading>{t(locale, 'entriesTitle')}</Heading>
      <Button label={t(locale, 'volunteerRefresh')} kind="secondary" onPress={refresh} disabled={busy || residentHelp.loading || enrollments.loading || meetings.loading} />
      <Heading level="section">{copy(locale, 'helpHistory')}</Heading>
      <ResourceState locale={locale} {...residentHelp} />
      {residentHelp.data ? <HelpList locale={locale} rows={residentHelp.data} empty="emptyHelp" kind="resident" uid={uid} repo={repo} confirm={confirm} mutate={mutate} busy={busy} /> : null}
      <Heading level="section">{copy(locale, 'enrollments')}</Heading>
      <ResourceState locale={locale} {...enrollments} />
      <ResourceState locale={locale} {...meetings} />
      {enrollments.data ? <EnrollmentList locale={locale} enrollments={enrollments.data} meetings={meetings.data} uid={uid} repo={repo} confirm={confirm} busy={busy} /> : null}
      <Button label={copy(locale, 'archived')} kind="quiet" onPress={() => go('archive')} />
    </Screen> : <Screen><Heading>{t(locale, 'entriesTitle')}</Heading>{signInCard}</Screen>; break;
    case 'archive': content = uid ? <Archive account={account} locale={locale} uid={uid} /> : signInCard; break;
    case 'calls': content = uid ? <Screen>
      <Heading>{t(locale, 'volunteerCallsTitle')}</Heading>
      <Button label={t(locale, 'volunteerRefresh')} kind="secondary" onPress={refresh} disabled={busy || queue.loading || ownHelp.loading} />
      <Heading level="section">{copy(locale, 'accepted')}</Heading><ResourceState locale={locale} {...ownHelp} />
      {ownHelp.data ? <HelpList locale={locale} rows={ownHelp.data.filter((row) => row.status === 'claimed')} empty="emptyAccepted" kind="assigned" uid={uid} repo={repo} confirm={confirm} mutate={mutate} busy={busy} /> : null}
      <Heading level="section">{copy(locale, 'queue')}</Heading><ResourceState locale={locale} {...queue} />
      {queue.data ? <HelpList locale={locale} rows={queue.data} empty="emptyQueue" kind="queue" uid={uid} repo={repo} confirm={confirm} mutate={mutate} busy={busy} /> : null}
      <Heading level="section">{copy(locale, 'history')}</Heading>
      {ownHelp.data ? <HelpList locale={locale} rows={ownHelp.data.filter((row) => row.status !== 'claimed')} empty="emptyHistory" kind="assigned" uid={uid} repo={repo} confirm={confirm} mutate={mutate} busy={busy} /> : null}
    </Screen> : signInCard; break;
    case 'profile': content = <OperationalProfile locale={locale} email={account.user?.email ?? null} role={account.role} stats={ownHelp} textSize={textSize} busy={authBusy} authError={authError} onLocale={onLocale} onTextSize={onTextSize} onSignIn={signIn} onSignOut={() => void signOutAccount()} />;
  }
  if (confirmation) content = <Screen><Card>
    <Heading>{copy(locale, confirmation.action)}</Heading><Label>{confirmation.summary(locale)}</Label><Label>{copy(locale, confirmation.body)}</Label>
    <Button label={copy(locale, 'confirm')} kind={confirmation.danger ? 'danger' : 'primary'} disabled={busy} onPress={() => void mutate(confirmation.run)} />
    <Button label={t(locale, 'back')} kind="secondary" disabled={busy} onPress={back} />
  </Card></Screen>;
  return <TextSizeProvider value={textSize}><ChromeFrame locale={locale} onLocale={onLocale} back={hasBack ? back : undefined}
    tab={isTab(page) && !confirmation ? page : undefined} selectTab={(route) => { if (isTab(route.name as Page)) go(route.name as Tab); }} volunteer={volunteer}>
    {firebaseConfig.mode === 'emulator' ? <StatusTag label={copy(locale, 'test')} /> : null}
    {preferenceError ? <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice> : null}
    {error ? <ErrorNotice>{copy(locale, error)}</ErrorNotice> : null}
    {notice ? <StatusTag label={copy(locale, notice)} /> : null}
    {busy ? <StatusTag label={copy(locale, 'loading')} /> : null}
    {content}
  </ChromeFrame></TextSizeProvider>;
}

function OperationalProfile({ locale, email, role, stats, textSize, busy, authError, onLocale, onTextSize, onSignIn, onSignOut }: {
  locale: Locale; email: string | null; role: Account['role']; textSize: TextSize; busy: boolean; authError: string | null;
  stats: ReturnType<typeof useOperationalResource<Awaited<ReturnType<Operations['listVolunteerHelp']>>>>;
  onLocale: (locale: Locale) => void; onTextSize: (size: TextSize) => void; onSignIn: () => void; onSignOut: () => void;
}) {
  return <Screen>
    <Heading>{t(locale, 'profileTitle')}</Heading>
    <Card><Label>{email ?? t(locale, 'guestStatus')}</Label>{role ? <Label>{copy(locale, role)}</Label> : null}</Card>
    {role === 'volunteer' ? <Card>
      <Heading level="section">{copy(locale, 'statistics')}</Heading>
      <ResourceState locale={locale} {...stats} />
      {stats.data ? <>
        <Label>{t(locale, 'volunteerStatsPickedUp')}: {stats.data.length}</Label>
        <Label>{t(locale, 'volunteerStatsActive')}: {stats.data.filter((row) => row.status === 'claimed').length}</Label>
        <Label>{copy(locale, 'completedCount')}: {stats.data.filter((row) => row.status === 'completed').length}</Label>
        <Label>{t(locale, 'volunteerStatsCancelled')}: {stats.data.filter((row) => row.status === 'cancelled').length}</Label>
      </> : null}
    </Card> : null}
    <Card><Heading level="section">{t(locale, 'language')}</Heading>
      <Button label={t(locale, 'languageRu')} kind={locale === 'ru' ? 'primary' : 'secondary'} onPress={() => onLocale('ru')} />
      <Button label={t(locale, 'languageKz')} kind={locale === 'kz' ? 'primary' : 'secondary'} onPress={() => onLocale('kz')} />
    </Card>
    <Card><Heading level="section">{t(locale, 'textSizeTitle')}</Heading>
      <Button label={t(locale, 'textSizeStandard')} kind={textSize === 'standard' ? 'primary' : 'secondary'} onPress={() => onTextSize('standard')} />
      <Button label={t(locale, 'textSizeLarge')} kind={textSize === 'large' ? 'primary' : 'secondary'} onPress={() => onTextSize('large')} />
      <Label>{t(locale, 'textSizePreview')}</Label>
    </Card>
    {authError ? <ErrorNotice>{authError}</ErrorNotice> : null}
    {role ? <Button label={t(locale, 'logout')} kind="secondary" disabled={busy} onPress={onSignOut} />
      : <Button label={t(locale, 'signIn')} disabled={busy} onPress={onSignIn} />}
  </Screen>;
}

function Archive({ account, locale, uid }: { account: Account; locale: Locale; uid: string }) {
  const [device, setDevice] = useState<Entry[] | null>(null);
  const [deviceError, setDeviceError] = useState(false);
  const generation = account.generationFor(uid);
  const { refresh: loadAccountArchive } = account;
  const refresh = useCallback(() => {
    if (generation !== null) void loadAccountArchive(uid, generation);
  }, [loadAccountArchive, generation, uid]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    void readDeviceArchive().then((value) => {
      if (active) setDevice(value?.entries ?? []);
    }).catch(() => { if (active) setDeviceError(true); });
    return () => { active = false; };
  }, []);
  return <Screen>
    <Heading>{copy(locale, 'archived')}</Heading><Label>{copy(locale, 'archiveExplanation')}</Label>
    <Heading level="section">{copy(locale, 'archiveAccount')}</Heading>
    <ResourceState locale={locale} error={account.historyError} loading={!account.historyReady && !account.historyError} refresh={refresh} />
    {account.historyReady && account.entries.length === 0 ? <Label>{copy(locale, 'archiveEmpty')}</Label> : null}
    {account.historyReady ? account.entries.map((entry) => <ArchivedEntry key={entry.id} entry={entry} locale={locale} />) : null}
    <Heading level="section">{copy(locale, 'archiveDevice')}</Heading>
    {deviceError ? <ErrorNotice>{t(locale, 'storageReadError')}</ErrorNotice> : !device ? <StatusTag label={copy(locale, 'loading')} /> : null}
    {device?.length === 0 ? <Label>{copy(locale, 'archiveEmpty')}</Label> : null}
    {device?.map((entry) => <ArchivedEntry key={entry.id} entry={entry} locale={locale} />)}
  </Screen>;
}

