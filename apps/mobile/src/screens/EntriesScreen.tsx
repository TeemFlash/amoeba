import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dates, districts, events, services, slots } from '../domain/catalog';
import type { AppState, Entry, EventId, Locale, ServiceId } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, ErrorNotice, Heading, KeyValue, Label, Screen, StatusTag, StepIndicator } from '../ui/components';
import { useTextScale } from '../ui/Typography';
import { MobiIllustration, type IllustrationScene } from '../ui/MobiIllustration';
import { theme } from '../ui/theme';
import type { Route } from '../ui/navigation';

type RequestFilter = 'all' | 'help' | 'events';
type Props = {
  locale: Locale;
  route: Route;
  state: AppState;
  navigate: (route: Route) => void;
  dismiss: () => void;
  cancel: () => void;
  busy?: boolean;
  locked?: boolean;
  cloudMode?: boolean;
  localReadOnly?: boolean;
  signedIn?: boolean;
  historyReady?: boolean;
  loadingHistory?: boolean;
  historyError?: boolean;
  legacyEntries?: Entry[];
  onSignIn?: () => void;
  onRetryHistory?: () => void;
  error?: string | null;
};

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-KZ' : 'kk-KZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function entryTitle(entry: Entry, locale: Locale) {
  return entry.kind === 'help'
    ? services.find((item) => item.id === entry.serviceId)?.title[locale] ?? ''
    : events.find((item) => item.id === entry.eventId)?.title[locale] ?? '';
}

export function ArchivedEntry({ entry, locale }: { entry: Entry; locale: Locale }) {
  return <Card>
    <Heading level="section">{entryTitle(entry, locale)}</Heading>
    <Label>{t(locale, entry.status === 'saved-demo' ? 'entryStatusSaved' : 'entryStatusCancelled')}</Label>
    {entry.kind === 'help' ? <>
      <KeyValue label={t(locale, 'selectDistrict')} value={districts.find((item) => item.id === entry.districtId)?.title[locale] ?? ''} />
      <KeyValue label={t(locale, 'dateLabel')} value={dates.find((item) => item.id === entry.dateId)?.title[locale] ?? t(locale, 'entryDateUnspecified')} />
      <KeyValue label={t(locale, 'selectTime')} value={slots.find((item) => item.id === entry.slotId)?.title[locale] ?? ''} />
      {entry.note ? <KeyValue label={t(locale, 'noteTitle')} value={entry.note} /> : null}
    </> : <KeyValue label={t(locale, 'eventDateLabel')} value={events.find((item) => item.id === entry.eventId)?.dateLabel[locale] ?? ''} />}
    <Label muted>{formatDate(entry.createdAt, locale)}</Label>
  </Card>;
}
function entryScene(entry: Entry): IllustrationScene {
  if (entry.kind === 'event') return eventScene(entry.eventId);
  return serviceScene(entry.serviceId);
}
function eventScene(eventId: EventId): IllustrationScene {
  return eventId === 'tea' ? 'tea' : eventId === 'walk-full' ? 'park' : 'game';
}
function serviceScene(serviceId: ServiceId): IllustrationScene {
  return serviceId === 'groceries' ? 'apple' : serviceId === 'digital-help' ? 'phone' : 'armchair';
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const scale = useTextScale();
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ checked: selected }}
    aria-checked={selected}
    onPress={onPress}
    style={({ pressed }) => [styles.filterChip, selected && styles.filterSelected, pressed && styles.filterPressed]}
  >
    <Text style={[styles.filterText, { fontSize: theme.type.caption * scale, lineHeight: theme.lineHeight.caption * scale }]}>{selected ? `✓ ${label}` : label}</Text>
  </Pressable>;
}

function FilterBar({ locale, value, onChange }: { locale: Locale; value: RequestFilter; onChange: (value: RequestFilter) => void }) {
  return <View accessibilityRole="radiogroup" style={styles.filters}>
    <FilterChip label={t(locale, 'requestsFilterAll')} selected={value === 'all'} onPress={() => onChange('all')} />
    <FilterChip label={t(locale, 'requestsFilterHelp')} selected={value === 'help'} onPress={() => onChange('help')} />
    <FilterChip label={t(locale, 'requestsFilterEvents')} selected={value === 'events'} onPress={() => onChange('events')} />
  </View>;
}

function EntryCard({ entry, locale, navigate, source, locked = false }: { entry: Entry; locale: Locale; navigate: (route: Route) => void; source: 'local' | 'account' | 'legacy'; locked?: boolean }) {
  const title = entryTitle(entry, locale);
  return <Card style={{ backgroundColor: entry.status === 'cancelled-demo' ? theme.colors.muted : theme.colors.surface }}>
    <View style={styles.entryHeading}>
      <MobiIllustration scene={entryScene(entry)} height={88} style={{ width: 88, flexShrink: 0 }} />
      <View style={styles.entryCopy}>
        <Heading level="section">{title}</Heading>
        <Label muted>{entry.kind === 'help' ? t(locale, 'helpEntryType') : t(locale, 'eventEntryType')}</Label>
        <StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} variant={entry.status === 'saved-demo' ? 'available' : 'cancelled'} />
      </View>
    </View>
    {entry.kind === 'help' ? <>
      <KeyValue label={t(locale, 'dateLabel')} value={entry.dateId ? dates.find((item) => item.id === entry.dateId)?.title[locale] ?? t(locale, 'entryDateUnspecified') : t(locale, 'entryDateUnspecified')} />
      <KeyValue label={t(locale, 'selectTime')} value={slots.find((item) => item.id === entry.slotId)?.title[locale] ?? ''} />
      {entry.note ? <KeyValue label={t(locale, 'noteTitle')} value={entry.note} /> : null}
    </> : <KeyValue label={t(locale, 'eventDateLabel')} value={events.find((item) => item.id === entry.eventId)?.dateLabel[locale] ?? ''} />}
    <Label muted>{formatDate(entry.createdAt, locale)}</Label>
    {entry.status === 'cancelled-demo' ? <Label>{t(locale, 'entryCancelledBody')}</Label> : null}
    <Button label={t(locale, 'openEntry')} accessibilityLabel={`${t(locale, 'openEntryPrefix')} ${title}`} onPress={() => navigate({ name: 'entry', entryId: entry.id, source })} disabled={locked} />
  </Card>;
}

export function EntriesScreen({ locale, route, state, navigate, dismiss, cancel, busy = false, locked = busy, cloudMode = false, localReadOnly = false, signedIn = true, historyReady = true, loadingHistory = false, historyError = false, legacyEntries = [], onSignIn, onRetryHistory, error }: Props) {
  const [filter, setFilter] = useState<RequestFilter>('all');
  const sourceEntries = state.entries;
  const filteredEntries = useMemo(() => sourceEntries.filter((entry) => filter === 'all' || (filter === 'help' ? entry.kind === 'help' : entry.kind === 'event')), [filter, sourceEntries]);
  const filteredLegacyEntries = useMemo(() => legacyEntries.filter((entry) => filter === 'all' || (filter === 'help' ? entry.kind === 'help' : entry.kind === 'event')), [filter, legacyEntries]);

  if (route.name === 'entries') return <Screen>
    <Heading>{t(locale, 'entriesTitle')}</Heading>
    {cloudMode && !signedIn ? <Card style={{ backgroundColor: theme.colors.softBlue }}>
      <Heading level="section">{t(locale, 'accountSavedHistory')}</Heading>
      <Label>{t(locale, 'accountSignInRequired')}</Label>
      <Button label={t(locale, 'tabAccount')} onPress={onSignIn ?? (() => {})} disabled={locked} />
    </Card> : null}
    {cloudMode && signedIn && historyError ? <Card>
      <ErrorNotice>{t(locale, 'accountReadError')}</ErrorNotice>
      <Button label={t(locale, 'retry')} kind="secondary" onPress={onRetryHistory ?? (() => {})} disabled={busy} />
    </Card> : null}
    {cloudMode && signedIn && (loadingHistory || !historyReady) && !historyError ? <Card><Label>{t(locale, 'authLoading')}</Label></Card> : null}
    {(!cloudMode && !localReadOnly || cloudMode && signedIn && historyReady && !loadingHistory && !historyError) ? <>
      <FilterBar locale={locale} value={filter} onChange={setFilter} />
      {filteredEntries.length === 0 ? <Card>
        <Heading level="section">{filter === 'all' ? t(locale, 'entriesEmptyTitle') : t(locale, 'requestsNoFiltered')}</Heading>
        {filter === 'all' ? <>
          <Label>{t(locale, 'entriesEmptyBody')}</Label>
          <Button label={t(locale, 'helpPath')} onPress={() => navigate({ name: 'help-catalog' })} disabled={locked} />
          <Button label={t(locale, 'eventPath')} kind="secondary" onPress={() => navigate({ name: 'events' })} disabled={locked} />
        </> : null}
      </Card> : filteredEntries.map((entry) => <EntryCard key={entry.id} entry={entry} locale={locale} navigate={navigate} source={cloudMode ? 'account' : 'local'} locked={locked} />)}
    </> : null}
    {cloudMode && filteredLegacyEntries.length > 0 ? <Card>
      <Heading level="section">{t(locale, 'accountLocalHistory')}</Heading>
      <Label>{t(locale, 'entryNotSent')}</Label>
      {filteredLegacyEntries.map((entry) => <EntryCard key={`legacy-${entry.id}`} entry={entry} locale={locale} navigate={navigate} source="legacy" locked={locked} />)}
    </Card> : null}
    {!cloudMode && localReadOnly ? <Card>
      <Heading level="section">{t(locale, 'accountLocalHistory')}</Heading>
      <FilterBar locale={locale} value={filter} onChange={setFilter} />
      {filteredEntries.length === 0 ? <Label>{t(locale, 'requestsNoFiltered')}</Label> : filteredEntries.map((entry) => <EntryCard key={entry.id} entry={entry} locale={locale} navigate={navigate} source="local" locked />)}
    </Card> : null}
  </Screen>;

  if (route.name !== 'entry' && route.name !== 'cancel-confirm' && route.name !== 'entry-success') return null;
  const routeSource = route.name === 'entry' || route.name === 'cancel-confirm' ? route.source : undefined;
  const entry = routeSource === 'legacy'
    ? legacyEntries.find((item) => item.id === route.entryId)
    : routeSource === 'account'
      ? state.entries.find((item) => item.id === route.entryId)
      : routeSource === 'local'
        ? state.entries.find((item) => item.id === route.entryId)
        : state.entries.find((item) => item.id === route.entryId) ?? legacyEntries.find((item) => item.id === route.entryId);
  const entryIsLegacy = routeSource === 'legacy';

  if (route.name === 'entry-success') {
    if (!entry) return <Screen>
      <ErrorNotice>{t(locale, 'entryNotFound')}</ErrorNotice>
      <Button label={t(locale, 'tabEntries')} onPress={() => navigate({ name: 'entries' })} disabled={locked} />
    </Screen>;
    if (entry.status === 'cancelled-demo') return <Screen>
      <Heading>{t(locale, 'entryCancelledTitle')}</Heading>
      <EntryDetails entry={entry} locale={locale} navigate={navigate} cloudMode={cloudMode} readOnly source={cloudMode ? 'account' : 'local'} locked />
    </Screen>;
    return <Screen>
      {entry.kind === 'event' ? <StepIndicator label={t(locale, 'eventStepSaved')} current={3} total={3} /> : null}
      <View style={styles.successHeader}>
        <MobiIllustration scene={entryScene(entry)} height={150} style={{ width: 160, flexShrink: 0 }} />
        <Heading>{t(locale, 'entrySuccessTitle')}</Heading>
      </View>
      <Card style={{ backgroundColor: theme.colors.lavender, borderColor: theme.colors.lavender }}>
        <Heading level="section">{entryTitle(entry, locale)}</Heading>
        <Label>{entry.kind === 'help'
          ? t(locale, cloudMode ? 'helpSavedAccount' : 'helpSavedLocal')
          : t(locale, cloudMode ? 'eventSavedAccount' : 'eventSavedLocal')}</Label>
        {entry.kind === 'help' && cloudMode ? <Label>{t(locale, 'accountVolunteerPrivacy')}</Label> : null}
        <KeyValue label={t(locale, 'entryIdLabel')} value={entry.id} />
        {entry.kind === 'event'
          ? <KeyValue label={t(locale, 'eventDateLabel')} value={events.find((item) => item.id === entry.eventId)?.dateLabel[locale] ?? ''} />
          : <KeyValue label={t(locale, 'dateLabel')} value={entry.dateId ? dates.find((item) => item.id === entry.dateId)?.title[locale] ?? t(locale, 'entryDateUnspecified') : t(locale, 'entryDateUnspecified')} />}
      </Card>
      <Button label={t(locale, 'openEntry')} onPress={() => navigate({ name: 'entry', entryId: entry.id })} disabled={locked} />
      <Button label={t(locale, 'tabHome')} kind="secondary" onPress={() => navigate({ name: 'home' })} disabled={locked} />
    </Screen>;
  }

  if ((localReadOnly || entryIsLegacy) && entry) return <Screen><EntryDetails entry={entry} locale={locale} navigate={navigate} cloudMode={cloudMode && !entryIsLegacy} readOnly source={entryIsLegacy ? 'legacy' : 'local'} locked /></Screen>;
  if (!entry) return <Screen><Heading level="section">{t(locale, 'entryNotFound')}</Heading><Button label={t(locale, 'tabEntries')} onPress={() => navigate({ name: 'entries' })} disabled={locked} /></Screen>;

  if (route.name === 'cancel-confirm') return <Screen>
    <Heading>{t(locale, 'confirmCancelTitle')}</Heading>
    <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
      <Heading level="section">{entryTitle(entry, locale)}</Heading>
      <StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} variant={entry.status === 'saved-demo' ? 'available' : 'cancelled'} />
      <Label>{t(locale, cloudMode ? 'accountConfirmCancelBody' : 'confirmCancelBody')}</Label>
    </Card>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, 'keep')} kind="secondary" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : cloudMode ? 'accountCancelNow' : 'cancelNow')} kind="danger" onPress={cancel} disabled={locked || entry.status === 'cancelled-demo'} />
  </Screen>;

  return <Screen><EntryDetails entry={entry} locale={locale} navigate={navigate} cloudMode={cloudMode && !entryIsLegacy} readOnly={entryIsLegacy || localReadOnly} source={entryIsLegacy ? 'legacy' : routeSource ?? (cloudMode ? 'account' : 'local')} locked={locked} /></Screen>;
}

function EntryDetails({ entry, locale, navigate, cloudMode, readOnly = false, source, locked }: { entry: Entry; locale: Locale; navigate: (route: Route) => void; cloudMode: boolean; readOnly?: boolean; source: 'local' | 'account' | 'legacy'; locked: boolean }) {
  const event = entry.kind === 'event' ? events.find((item) => item.id === entry.eventId) : undefined;
  return <>
    <View style={styles.successHeader}>
      <MobiIllustration scene={entryScene(entry)} height={120} style={{ width: 132, flexShrink: 0 }} />
      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        <Heading>{entryTitle(entry, locale)}</Heading>
        <StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} variant={entry.status === 'saved-demo' ? 'available' : 'cancelled'} />
      </View>
    </View>
    <Card style={{ backgroundColor: source === 'legacy' ? theme.colors.muted : theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
      {source === 'legacy' ? <><Heading level="section">{t(locale, 'accountLocalHistory')}</Heading><Label>{t(locale, 'entryNotSent')}</Label></> : null}
      <KeyValue label={t(locale, 'entryIdLabel')} value={entry.id} />
      <KeyValue label={t(locale, cloudMode ? 'accountCreatedLabel' : 'createdLabel')} value={formatDate(entry.createdAt, locale)} />
      {entry.cancelledAt ? <KeyValue label={t(locale, 'entryStatusCancelled')} value={formatDate(entry.cancelledAt, locale)} /> : null}
      {entry.kind === 'help' ? <>
        <KeyValue label={t(locale, 'selectDistrict')} value={districts.find((item) => item.id === entry.districtId)?.title[locale] ?? ''} />
        <KeyValue label={t(locale, 'dateLabel')} value={entry.dateId ? dates.find((item) => item.id === entry.dateId)?.title[locale] ?? t(locale, 'entryDateUnspecified') : t(locale, 'entryDateUnspecified')} />
        <KeyValue label={t(locale, 'selectTime')} value={slots.find((item) => item.id === entry.slotId)?.title[locale] ?? ''} />
        {entry.note ? <KeyValue label={t(locale, 'noteTitle')} value={entry.note} /> : null}
        <Label>{t(locale, cloudMode ? 'accountEntryDetails' : 'helpSavedLocal')}</Label>
      </> : <>
        {event ? <>
          <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
          <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
          <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
          <Label>{t(locale, 'eventNoOrganizer')}</Label>
          <Label>{t(locale, cloudMode ? 'accountEventDetails' : 'eventSavedLocal')}</Label>
        </> : null}
      </>}
    </Card>
    {entry.status === 'cancelled-demo'
      ? <Card><Heading level="section">{t(locale, 'entryCancelledTitle')}</Heading><Label>{t(locale, cloudMode ? 'accountEntryCancelledBody' : 'entryCancelledBody')}</Label></Card>
      : readOnly ? null : <Button label={t(locale, cloudMode ? 'accountCancelEntry' : 'cancelEntry')} kind="danger" onPress={() => navigate({ name: 'cancel-confirm', entryId: entry.id, source })} disabled={locked} />}
    <Button label={t(locale, 'tabEntries')} kind="quiet" onPress={() => navigate({ name: 'entries' })} disabled={locked} />
  </>;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  filterChip: { flexGrow: 1, flexShrink: 1, minWidth: 82, minHeight: 60, borderRadius: theme.radius.pill, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing.sm, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softBlue },
  filterPressed: { opacity: 0.78 },
  filterText: { color: theme.colors.text, textAlign: 'center', fontWeight: '700', flexShrink: 1, width: '100%', maxWidth: '100%', ...( { overflowWrap: 'anywhere', wordBreak: 'break-word' } as object) },
  entryHeading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  entryCopy: { flex: 1, gap: theme.spacing.xs },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
});
