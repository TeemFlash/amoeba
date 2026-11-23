import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { asyncStorage } from './src/storage/asyncStorage';
import { createRepository } from './src/storage/repository';
import { transition } from './src/domain/transitions';
import type { AppState, Command, ErrorCode, EventId, Locale, Repository, Result, ServiceId, Transition } from './src/domain/types';
import { t, type TranslationKey } from './src/i18n';
import { AboutScreen } from './src/screens/AboutScreen';
import { CityScreen } from './src/screens/CityScreen';
import { SignIn1 } from './components/ui/modern-stunning-sign-in';
import { cityName, type CityId } from './src/domain/cities';
import { loadCityPreference, saveCityPreference } from './src/storage/cityPreference';
import { EntriesScreen } from './src/screens/EntriesScreen';
import { EventScreens } from './src/screens/EventScreens';
import { HelpScreens } from './src/screens/HelpScreens';
import { Button, ErrorNotice, Heading, SceneTransition, Screen } from './src/ui/components';
import { Icon } from './src/ui/icons';
import { initialRoute, startupRoute, type Route } from './src/ui/navigation';
import { theme } from './src/ui/theme';

function selectedSection(active: Route['name']) {
  return ['entries', 'entry', 'cancel-confirm'].includes(active) ? 'entries' : ['events', 'event-terms', 'event-review'].includes(active) ? 'events' : ['about', 'reset-confirm', 'cities', 'sign-in'].includes(active) ? null : 'help-catalog';
}

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
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [repository] = useState<Repository>(() => createRepository(asyncStorage, () => new Date().toISOString()));
  const [appState, setAppState] = useState<AppState | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const [routeStack, setRouteStack] = useState<Route[]>([startupRoute]);
  const [bootError, setBootError] = useState<ErrorCode | null>(null);
  const [actionError, setActionError] = useState<ErrorCode | null>(null);
  const [pendingCommands, setPendingCommands] = useState<Command[]>([]);
  const pendingRef = useRef<Command[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [bootLocale, setBootLocale] = useState<Locale>('ru');
  const [cityId, setCityId] = useState<CityId>('astana');
  const [cityPreferenceError, setCityPreferenceError] = useState<string | null>(null);
  const [cityPreferenceReady, setCityPreferenceReady] = useState(false);
  const [citySaving, setCitySaving] = useState(false);
  const citySavingRef = useRef(false);
  const route = routeStack[routeStack.length - 1] ?? initialRoute;
  const locale = appState?.locale ?? 'ru';
  const appRef = repository;
  useEffect(() => {
    let active = true;
    void loadCityPreference(asyncStorage).then(({ cityId: stored, error }) => {
      if (!active) return;
      if (stored) setCityId(stored);
      if (error) setCityPreferenceError(error === 'corrupt' ? 'cityCorruptError' : 'cityReadError');
      setCityPreferenceReady(true);
    }).catch(() => { if (active) { setCityPreferenceError('cityReadError'); setCityPreferenceReady(true); } });
    return () => { active = false; };
  }, []);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const lastScreen = useRef(JSON.stringify(route));
  const scrollPositions = useRef<Record<string, number>>({});
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = '[role="button"]:focus-visible,[role="tab"]:focus-visible,[role="radio"]:focus-visible{outline:3px solid #163F73!important;outline-offset:3px}';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  useEffect(() => {
    if (lastScreen.current === routeKey) return;
    lastScreen.current = routeKey;
    scrollRef.current?.scrollTo({ y: scrollPositions.current[routeKey] ?? 0, animated: false });
    if (Platform.OS !== 'web') return;
    const frame = requestAnimationFrame(() => {
      if (document.activeElement?.getAttribute('role') === 'tab') {
        document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
        return;
      }
      const heading = document.querySelector<HTMLElement>('[role="heading"],h1,h2,h3');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [routeKey]);

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
      setRouteStack([startupRoute]);
    } else setBootError(result.error.code);
  }, [appRef, commit]);
  useEffect(() => {
    let active = true;
    appRef.load().then((result) => {
      if (!active) return;
      if (result.ok) {
        commit(result.value);
        setRouteStack([startupRoute]);
      } else setBootError(result.error.code);
    });
    return () => { active = false; };
  }, [appRef, commit]);

  const navigate = useCallback((next: Route) => {
    if (citySavingRef.current) return;
    setActionError(null);
    setRouteStack((stack) => [...stack, next]);
  }, []);
  const goToRoot = useCallback((next: Route) => {
    if (citySavingRef.current) return;
    setActionError(null);
    setRouteStack([next]);
  }, []);
  const goBack = useCallback(() => {
    if (citySavingRef.current) return;
    setActionError(null);
    setRouteStack((stack) => stack.length > 1 ? stack.slice(0, -1) : [initialRoute]);
  }, []);
  const chooseCity = useCallback(async (next: CityId) => {
    if (!cityPreferenceReady || citySavingRef.current || route.name !== 'cities') return;
    citySavingRef.current = true;
    setCitySaving(true);
    try {
      const error = await saveCityPreference(asyncStorage, next);
      if (error) { setCityPreferenceError(error === 'corrupt' ? 'cityCorruptError' : error === 'read' ? 'cityReadError' : 'cityWriteError'); return; }
      setCityId(next);
      setCityPreferenceError(null);
      setRouteStack((stack) => stack[stack.length - 1]?.name === 'cities' ? stack.slice(0, -1) : stack);
    } finally { citySavingRef.current = false; setCitySaving(false); }
  }, [cityPreferenceReady, route.name]);

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
      setRouteStack([startupRoute]);
      return true;
    }
    setActionError(result.error.code);
    return false;
  }, [appRef, commit]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (citySavingRef.current) return true;
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
          <Header locale={loadingLocale} cityId={cityId} citySaving={false} onCity={() => navigate({ name: 'cities' })} onLocale={setBootLocale} canBack={false} goBack={() => {}} hideCity={route.name === 'sign-in'} cityDisabled />
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
  const isTop = routeStack.length > 1;
  const startupAuthFlow = routeStack[0]?.name === 'sign-in';
  let content: React.ReactNode = null;
  const interactionLocked = busy || pendingCommands.length > 0;
  if (route.name === 'cities') content = <CityScreen disabled={!cityPreferenceReady || citySaving} locale={locale} selectedCity={cityId} error={cityPreferenceError ? t(locale, cityPreferenceError as TranslationKey) : null} choose={(id) => void chooseCity(id)} cancel={goBack} />;
  else if (['help-catalog', 'help-terms', 'help-form', 'help-review'].includes(route.name)) content = <HelpScreens cityId={cityId} draftPending={pendingCommands.some((command) => command.type === 'startHelp' || command.type === 'editHelp' || command.type === 'setDraftStep')} locale={locale} state={appState} route={route} command={runCommand} navigate={onNavigate} begin={beginHelp} submit={() => void submitHelp()} busy={busy} locked={interactionLocked} />;
  else if (['events', 'event-terms', 'event-review'].includes(route.name)) content = <EventScreens locale={locale} route={route} state={appState} navigate={onNavigate} begin={beginEvent} submit={() => void submitEvent()} busy={busy} locked={interactionLocked} />;
  else if (route.name === 'sign-in') content = <SignIn1 locale={locale} onContinue={() => goToRoot(initialRoute)} onAbout={() => navigate({ name: 'about' })} />;
  else if (['entries', 'entry', 'cancel-confirm'].includes(route.name)) content = <EntriesScreen locale={locale} route={route} state={appState} navigate={onNavigate} dismiss={goBack} cancel={() => void cancelCurrent()} busy={busy} locked={interactionLocked} />;
  else content = <AboutScreen locale={locale} route={route} navigate={onNavigate} dismiss={goBack} confirmReset={confirmReset} confirmDiscard={discardDraft} confirmReplace={replaceDraft} busy={busy} locked={interactionLocked} />;

  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="dark-content" />
    <View style={[styles.workspace, wide && styles.workspaceWide]}>
    {wide && !startupAuthFlow ? <TabBar locale={locale} active={route.name} navigate={goToRoot} vertical /> : null}
    <ScrollView ref={scrollRef} scrollEventThrottle={16} onScroll={(event) => { scrollPositions.current[routeKey] = event.nativeEvent.contentOffset.y; }} style={styles.pageScroll} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      <View style={styles.pageMeasure}>
        <Header locale={locale} cityId={cityId} citySaving={citySaving} onCity={() => navigate({ name: 'cities' })} onLocale={onLocale} canBack={isTop} goBack={goBack} hideCity={route.name === 'sign-in'} cityDisabled={!cityPreferenceReady || citySaving || busy || pendingCommands.length > 0} disabled={busy || pendingCommands.length > 0 || citySaving} />
        {cityPreferenceError && route.name !== 'cities' ? <View style={styles.retryRow}><ErrorNotice>{t(locale, cityPreferenceError as TranslationKey)}</ErrorNotice></View> : null}
        {pendingCommands.length > 0 ? <View style={styles.retryRow}>
          <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice>
          <Button label={t(locale, 'retry')} kind="secondary" disabled={busy} onPress={() => void retryPending()} />
        </View> : null}
        {actionError && pendingCommands.length === 0 ? <View style={styles.retryRow}><ErrorNotice>{currentError}</ErrorNotice></View> : null}
        <View nativeID="main-panel" {...(Platform.OS === 'web' && selectedSection(route.name) ? { role: 'tabpanel' as const, 'aria-labelledby': `tab-${selectedSection(route.name)}` } : {})}><SceneTransition routeKey={JSON.stringify(route)}>{content}</SceneTransition></View>
        {route.name === 'help-catalog' ? <Button label={t(locale, 'tabAbout')} kind="quiet" onPress={() => navigate({ name: 'about' })} /> : null}
      </View>
    </ScrollView>
    </View>
    {!wide && !startupAuthFlow ? <TabBar locale={locale} active={route.name} navigate={goToRoot} /> : null}
  </SafeAreaView>;
}

function Header({ locale, cityId, citySaving, onCity, onLocale, canBack, goBack, hideCity = false, cityDisabled = false, disabled = false }: { locale: Locale; cityId: CityId; citySaving: boolean; onCity: () => void; onLocale: (locale: Locale) => void; canBack: boolean; goBack: () => void; hideCity?: boolean; cityDisabled?: boolean; disabled?: boolean }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}>
      <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Icon name="home" color={theme.colors.white} size={22} /></View>
      <View style={styles.brand}>
        <Text allowFontScaling style={styles.brandName}>{t(locale, 'appName')}</Text>
      </View>
    </View>
    <View style={styles.headerTools}>
      {canBack ? <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'back')} accessibilityState={{ disabled: citySaving }} disabled={citySaving} onPress={goBack} style={styles.back}><Icon name="back" color={theme.colors.primary} size={22} /><Text style={styles.backText}>{t(locale, 'back')}</Text></Pressable> : <View style={styles.backSpacer} />}
      {!hideCity ? <Pressable accessibilityRole="button" accessibilityLabel={`${t(locale, 'chooseCity')}: ${cityName(cityId, locale)}`} accessibilityState={{ selected: false, disabled: cityDisabled }} disabled={cityDisabled} onPress={onCity} style={[styles.cityButton, cityDisabled && styles.disabled]}><Text allowFontScaling style={styles.city}>{cityName(cityId, locale)}</Text></Pressable> : null}
      <View style={styles.languages}>
        {(['ru', 'kz'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'ru' ? t(locale, 'languageRu') : t(locale, 'languageKz')} accessibilityState={{ selected: locale === value, disabled }} disabled={disabled} onPress={() => onLocale(value)} style={[styles.languageButton, locale === value && styles.languageSelected, disabled && styles.disabled]}>
          <Text style={[styles.languageText, locale === value && styles.languageTextSelected]}>{value.toUpperCase()}</Text>
        </Pressable>)}
      </View>
    </View>
  </View>;
}

function TabBar({ locale, active, navigate, vertical = false }: { locale: Locale; active: Route['name']; navigate: (route: Route) => void; vertical?: boolean }) {
  const selected = selectedSection(active);
  const tabs: { name: 'help-catalog' | 'events' | 'entries'; label: TranslationKey; icon: 'home' | 'calendar' | 'list' }[] = [
    { name: 'help-catalog', label: 'tabHelp', icon: 'home' }, { name: 'events', label: 'tabEvents', icon: 'calendar' }, { name: 'entries', label: 'tabEntries', icon: 'list' },
  ];
  return <View accessibilityRole="tablist" {...(Platform.OS === 'web' ? { onKeyDown: (event: Parameters<NonNullable<React.ComponentProps<typeof View>['onKeyDown']>>[0]) => {
    const key = event.nativeEvent.key;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(key)) return;
    event.preventDefault();
    const focusedName = Platform.OS === 'web' ? document.activeElement?.getAttribute('data-tab-name') : null;
    const index = Math.max(0, tabs.findIndex((tab) => tab.name === (focusedName ?? selected)));
    const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : (index + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) + tabs.length) % tabs.length;
    navigate({ name: tabs[next]!.name });
  }} : {})} style={[styles.tabs, vertical && styles.sideTabs]}>
    {tabs.map((tab) => <Pressable key={tab.name} nativeID={`tab-${tab.name}`} aria-controls="main-panel" {...(Platform.OS === 'web' ? { 'data-tab-name': tab.name, tabIndex: selected === tab.name || (!selected && tab.name === 'help-catalog') ? 0 : -1 } : {})} accessibilityRole="tab" accessibilityLabel={t(locale, tab.label)} accessibilityState={{ selected: selected === tab.name }} aria-selected={selected === tab.name} onPress={() => navigate({ name: tab.name })} style={({pressed}) => [styles.tab, vertical && styles.sideTab, selected === tab.name && styles.tabSelected, pressed && { opacity: 0.7 }]}>
      <View style={[styles.tabContent, vertical && styles.sideTabContent]}><Icon name={tab.icon} size={23} color={selected === tab.name ? theme.colors.primary : theme.colors.secondary} /><Text allowFontScaling style={[styles.tabText, vertical && styles.sideTabText, selected === tab.name && styles.tabTextSelected]}>{t(locale, tab.label)}</Text></View>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  workspace: { flex: 1, minHeight: 0, width: '100%', maxWidth: 1240, alignSelf: 'center' },
  workspaceWide: { flexDirection: 'row' },
  sideTabs: { width: 232, flexDirection: 'column', borderTopWidth: 0, borderRightWidth: 1, borderRightColor: theme.colors.border, paddingTop: 34, paddingHorizontal: 16, gap: 8 },
  sideTab: { flex: 0, minHeight: 60, alignItems: 'stretch', paddingHorizontal: 16 },
  sideTabContent: { flexDirection: 'row', justifyContent: 'flex-start', gap: 12 },
  sideTabText: { fontSize: 18, lineHeight: 26, textAlign: 'left', flexShrink: 1 },
  pageScroll: { flex: 1, minHeight: 0 },
  pageContent: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36, flexGrow: 1 },
  pageMeasure: { width: '100%', maxWidth: theme.maxContentWidth, gap: 12 },
  headerTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  header: { paddingTop: 8, paddingBottom: 10, backgroundColor: theme.colors.background },
  brandRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  brandMark: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  brand: { flexGrow: 1, flexShrink: 1, minWidth: 110, gap: 1 },
  brandName: { color: theme.colors.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  city: { color: theme.colors.secondary, fontSize: 16, lineHeight: 21, textDecorationLine: 'underline' },
  cityButton: { minWidth: 56, minHeight: 56, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 8 },
  backSpacer: { minHeight: 48 },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: theme.colors.primary, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  languages: { flexDirection: 'row', gap: 8 },
  languageButton: { minWidth: 48, minHeight: 48, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  disabled: { opacity: 0.55 },
  languageSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softBlue },
  languageText: { color: theme.colors.secondary, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  languageTextSelected: { color: theme.colors.primary, fontWeight: '700' },
  retryRow: { gap: 8, paddingBottom: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 5, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tab: { flex: 1, ...(Platform.OS === 'web' ? { minWidth: 'min-content', flexBasis: 'min-content' } as object : { minWidth: 100 }), minHeight: 58, paddingHorizontal: 3, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabSelected: { backgroundColor: theme.colors.softBlue },
  tabContent: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabText: { color: theme.colors.secondary, fontSize: 14, lineHeight: 18, textAlign: 'center', fontWeight: '600', ...( { overflowWrap: 'normal', wordBreak: 'normal' } as object) },
  tabTextSelected: { color: theme.colors.primaryDark, fontWeight: '700' },
  body: { color: theme.colors.text, fontSize: 18, lineHeight: 27 },
});
