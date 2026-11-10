import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { asyncStorage } from './src/storage/asyncStorage';
import { createRepository } from './src/storage/repository';
import { transition } from './src/domain/transitions';
import type { AppState, Command, ErrorCode, EventId, Locale, Repository, Result, ServiceId, Transition } from './src/domain/types';
import { t, type TranslationKey } from './src/i18n';
import { AboutScreen } from './src/screens/AboutScreen';
import { EntriesScreen } from './src/screens/EntriesScreen';
import { EventScreens } from './src/screens/EventScreens';
import { HelpScreens } from './src/screens/HelpScreens';
import { HomeScreen } from './src/screens/HomeScreen';
import { Button, ErrorNotice, Heading, Notice, Screen } from './src/ui/components';
import { initialRoute, routeTitle, type Route } from './src/ui/navigation';
import { theme } from './src/ui/theme';

function newOperationId() {
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function errorText(locale: Locale, code: ErrorCode): string {
  const key: Record<ErrorCode, TranslationKey> = {
    DRAFT_EXISTS: 'draftExistsBody', DRAFT_NOT_FOUND: 'draftNotFound', INVALID_SELECTION: 'invalidSelection',
    DISTRICT_REQUIRED: 'districtRequired', SLOT_REQUIRED: 'slotRequired', EVENT_FULL: 'eventFullReason',
    EVENT_CANCELLED: 'eventCancelledReason', ALREADY_ENROLLED: 'alreadyEnrolled', ENTRY_NOT_FOUND: 'entryNotFound',
    STORAGE_READ_FAILED: 'storageReadError', STORAGE_CORRUPT: 'storageCorruptError', STORAGE_WRITE_FAILED: 'storageWriteError',
  };
  return t(locale, key[code]);
}

export default function App() {
  return <SafeAreaProvider><AppContent /></SafeAreaProvider>;
}

function AppContent() {
  const [repository] = useState<Repository>(() => createRepository(asyncStorage, () => new Date().toISOString()));
  const [appState, setAppState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const [routeStack, setRouteStack] = useState<Route[]>([initialRoute]);
  const [bootError, setBootError] = useState<ErrorCode | null>(null);
  const [actionError, setActionError] = useState<ErrorCode | null>(null);
  const [pendingCommands, setPendingCommands] = useState<Command[]>([]);
  const pendingRef = useRef<Command[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [bootLocale, setBootLocale] = useState<Locale>('ru');
  const route = routeStack[routeStack.length - 1] ?? initialRoute;
  const locale = appState?.locale ?? 'ru';
  const appRef = repository;

  const commit = useCallback((next: AppState) => {
    stateRef.current = next;
    setAppState(next);
  }, []);
  const boot = useCallback(async () => {
    setBootError(null);
    setAppState(null);
    stateRef.current = null;
    const result = await appRef.load();
    if (result.ok) {
      commit(result.value);
      setRouteStack([initialRoute]);
    } else setBootError(result.error.code);
  }, [appRef, commit]);
  useEffect(() => {
    let active = true;
    appRef.load().then((result) => {
      if (!active) return;
      if (result.ok) {
        commit(result.value);
        setRouteStack([initialRoute]);
      } else setBootError(result.error.code);
    });
    return () => { active = false; };
  }, [appRef, commit]);

  const navigate = useCallback((next: Route) => {
    setActionError(null);
    setRouteStack((stack) => [...stack, next]);
  }, []);
  const goToRoot = useCallback((next: Route) => {
    setActionError(null);
    setRouteStack([next]);
  }, []);
  const goBack = useCallback(() => {
    setActionError(null);
    setRouteStack((stack) => stack.length > 1 ? stack.slice(0, -1) : [initialRoute]);
  }, []);

  const completeCommand = useCallback((command: Command, result: Transition, before: AppState) => {
    if ((command.type === 'submitHelp' || command.type === 'enrollEvent') && result.entryId) {
      setRouteStack([{ name: 'entries' }, { name: 'entry', entryId: result.entryId }]);
      const entry = result.state.entries.find((item) => item.id === result.entryId);
      const existed = before.entries.some((item) => item.id === result.entryId);
      if (entry?.status === 'saved-demo' && !existed) AccessibilityInfo.announceForAccessibility(t(result.state.locale, 'entryStatusSaved'));
    } else if (command.type === 'cancelEntry') {
      setRouteStack([{ name: 'entries' }, { name: 'entry', entryId: command.entryId }]);
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
    if (busyRef.current || pendingRef.current.length > 0) {
      setActionError('STORAGE_WRITE_FAILED');
      return { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } };
    }
    busyRef.current = true;
    setBusy(true);
    const result = await appRef.execute(command);
    busyRef.current = false;
    setBusy(false);
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
  }, [appRef, commit, completeCommand]);

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
    const result = await runCommand({ type: 'startHelp', serviceId, operationId: newOperationId() });
    if (result.ok || result.error.code === 'STORAGE_WRITE_FAILED') navigate({ name: 'help-form' });
    else if (result.error.code === 'DRAFT_EXISTS') navigate({ name: 'replace-confirm', serviceId });
  }, [navigate, runCommand]);
  const replaceDraft = useCallback(async (serviceId: ServiceId) => {
    const result = await runCommand({ type: 'startHelp', serviceId, operationId: newOperationId(), replace: true });
    if (result.ok || result.error.code === 'STORAGE_WRITE_FAILED') navigate({ name: 'help-form' });
  }, [navigate, runCommand]);
  const beginEvent = useCallback((eventId: EventId) => {
    const existing = stateRef.current?.entries.find((entry) => entry.kind === 'event' && entry.eventId === eventId && entry.status === 'saved-demo');
    if (existing) navigate({ name: 'entry', entryId: existing.id });
    else navigate({ name: 'event-review', eventId, operationId: newOperationId() });
  }, [navigate]);
  const submitHelp = useCallback(async () => {
    const operationId = stateRef.current?.draft?.operationId;
    if (!operationId) return;
    await runCommand({ type: 'submitHelp', operationId });
  }, [runCommand]);
  const submitEvent = useCallback(async () => {
    if (route.name !== 'event-review') return;
    const result = await runCommand({ type: 'enrollEvent', eventId: route.eventId, operationId: route.operationId });
    if (!result.ok && result.error.code === 'ALREADY_ENROLLED' && result.error.existingEntryId) navigate({ name: 'entry', entryId: result.error.existingEntryId });
  }, [navigate, route, runCommand]);
  const cancelCurrent = useCallback(async () => {
    if (route.name !== 'cancel-confirm') return;
    await runCommand({ type: 'cancelEntry', entryId: route.entryId });
  }, [route, runCommand]);
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
      commit(result.value);
      pendingRef.current = [];
      setPendingCommands([]);
      setBootError(null);
      setActionError(null);
      setRouteStack([initialRoute]);
      return true;
    }
    setActionError(result.error.code);
    return false;
  }, [appRef, commit]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routeStack.length > 1) { goBack(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [goBack, routeStack.length]);

  if (!appState) {
    const loadingLocale = bootLocale;
    return <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent}>
        <View style={styles.pageMeasure}>
          <Header locale={loadingLocale} route={route} onLocale={setBootLocale} canBack={false} goBack={() => {}} disabled={busy} />
          <Notice locale={loadingLocale} />
          {bootError ? <Screen>
            <Heading>{t(loadingLocale, bootError === 'STORAGE_CORRUPT' ? 'corruptTitle' : 'loadingErrorTitle')}</Heading>
            <Text style={styles.body}>{t(loadingLocale, bootError === 'STORAGE_CORRUPT' ? 'corruptBody' : 'loadingErrorBody')}</Text>
            <Button label={t(loadingLocale, 'retry')} onPress={() => void boot()} disabled={busy} />
            <Button label={t(loadingLocale, 'resetDemo')} kind="danger" onPress={() => setRouteStack([{ name: 'reset-confirm' }])} />
            {route.name === 'reset-confirm' ? <AboutScreen locale={loadingLocale} route={route} navigate={navigate} dismiss={goBack} confirmReset={confirmReset} busy={busy} error={actionError ? errorText(loadingLocale, actionError) : null} /> : null}
          </Screen> : <Screen><Text style={styles.body}>{t(loadingLocale, 'loading')}</Text></Screen>}
        </View>
      </ScrollView>
    </SafeAreaView>;
  }

  const currentError = actionError ? errorText(locale, actionError) : null;
  const onLocale = (nextLocale: Locale) => { void runCommand({ type: 'setLocale', locale: nextLocale }); };
  const onNavigate = (next: Route) => navigate(next);
  const currentTitle = t(locale, routeTitle(route));
  const isTop = routeStack.length > 1;
  let content: React.ReactNode = null;
  const interactionLocked = busy || pendingCommands.length > 0;
  if (route.name === 'home') content = <HomeScreen locale={locale} state={appState} navigate={onNavigate} draftPending={pendingCommands.some((command) => command.type === 'startHelp' || command.type === 'editHelp' || command.type === 'setDraftStep')} />;
  else if (['help-catalog', 'help-terms', 'help-form', 'help-review'].includes(route.name)) content = <HelpScreens locale={locale} state={appState} route={route} command={runCommand} navigate={onNavigate} error={currentError} begin={beginHelp} submit={() => void submitHelp()} busy={busy} locked={interactionLocked} />;
  else if (['events', 'event-terms', 'event-review'].includes(route.name)) content = <EventScreens locale={locale} route={route} state={appState} navigate={onNavigate} begin={beginEvent} submit={() => void submitEvent()} error={currentError} busy={busy} locked={interactionLocked} />;
  else if (['entries', 'entry', 'cancel-confirm'].includes(route.name)) content = <EntriesScreen locale={locale} route={route} state={appState} navigate={onNavigate} dismiss={goBack} cancel={() => void cancelCurrent()} busy={busy} locked={interactionLocked} />;
  else content = <AboutScreen locale={locale} route={route} navigate={onNavigate} dismiss={goBack} confirmReset={confirmReset} confirmDiscard={discardDraft} confirmReplace={replaceDraft} error={currentError} busy={busy} locked={interactionLocked} />;

  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pageMeasure}>
        <Header locale={locale} route={route} title={currentTitle} onLocale={onLocale} canBack={isTop} goBack={goBack} disabled={busy || pendingCommands.length > 0} />
        <Notice locale={locale} />
        {pendingCommands.length > 0 ? <View style={styles.retryRow}>
          <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice>
          <Button label={t(locale, 'retry')} kind="secondary" disabled={busy} onPress={() => void retryPending()} />
        </View> : null}
        {actionError && pendingCommands.length === 0 ? <View style={styles.retryRow}><ErrorNotice>{currentError}</ErrorNotice></View> : null}
        {content}
      </View>
    </ScrollView>
    <TabBar locale={locale} active={route.name} navigate={goToRoot} />
  </SafeAreaView>;
}

function Header({ locale, route, title, onLocale, canBack, goBack, disabled = false }: { locale: Locale; route: Route; title?: string; onLocale: (locale: Locale) => void; canBack: boolean; goBack: () => void; disabled?: boolean }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}>
      {canBack ? <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'back')} onPress={goBack} style={styles.back}><Text style={styles.backText}>‹ {t(locale, 'back')}</Text></Pressable> : null}
      <View style={styles.brand}>
        <Text style={styles.brandName}>{t(locale, 'appName')}</Text>
        <Text style={styles.city}>{t(locale, 'city')} · {title ?? t(locale, routeTitle(route))}</Text>
      </View>
      <View style={styles.languages}>
        {(['ru', 'kz'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'ru' ? t(locale, 'languageRu') : t(locale, 'languageKz')} accessibilityState={{ selected: locale === value, disabled }} disabled={disabled} onPress={() => onLocale(value)} style={[styles.languageButton, locale === value && styles.languageSelected, disabled && styles.disabled]}>
          <Text style={[styles.languageText, locale === value && styles.languageTextSelected]}>{value.toUpperCase()}</Text>
        </Pressable>)}
      </View>
    </View>
  </View>;
}

function TabBar({ locale, active, navigate }: { locale: Locale; active: Route['name']; navigate: (route: Route) => void }) {
  const selected = active === 'entries' || active === 'entry' || active === 'cancel-confirm' ? 'entries' : active === 'about' ? 'about' : 'home';
  const tabs: { name: 'home' | 'entries' | 'about'; label: TranslationKey }[] = [
    { name: 'home', label: 'tabHome' }, { name: 'entries', label: 'tabEntries' }, { name: 'about', label: 'tabAbout' },
  ];
  return <View accessibilityRole="tablist" style={styles.tabs}>
    {tabs.map((tab) => <Pressable key={tab.name} accessibilityRole="tab" accessibilityLabel={t(locale, tab.label)} accessibilityState={{ selected: selected === tab.name }} onPress={() => navigate({ name: tab.name })} style={[styles.tab, selected === tab.name && styles.tabSelected]}>
      <Text style={[styles.tabText, selected === tab.name && styles.tabTextSelected]}>{t(locale, tab.label)}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  pageScroll: { flex: 1, minHeight: 0 },
  pageContent: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  pageMeasure: { width: '100%', maxWidth: theme.maxContentWidth, gap: 12 },
  header: { paddingTop: 8, paddingBottom: 12, backgroundColor: theme.colors.background },
  brandRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  brand: { flexGrow: 1, flexShrink: 1, minWidth: 120, gap: 2 },
  brandName: { color: theme.colors.text, fontSize: 20, lineHeight: 27, fontWeight: '700' },
  city: { color: theme.colors.secondary, fontSize: 16, lineHeight: 22 },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 },
  backText: { color: theme.colors.primary, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  languages: { flexDirection: 'row', gap: 8 },
  languageButton: { minWidth: 48, minHeight: 48, paddingHorizontal: 8, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  disabled: { opacity: 0.55 },
  languageSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softGreen },
  languageText: { color: theme.colors.secondary, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  languageTextSelected: { color: theme.colors.primary, fontWeight: '800' },
  retryRow: { gap: 8, paddingBottom: 8 },
  tabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tab: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabSelected: { backgroundColor: theme.colors.softGreen },
  tabText: { color: theme.colors.secondary, fontSize: 15, lineHeight: 20, textAlign: 'center', fontWeight: '600', ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  tabTextSelected: { color: theme.colors.primary, fontWeight: '800' },
  body: { color: theme.colors.text, fontSize: 18, lineHeight: 27 },
});
