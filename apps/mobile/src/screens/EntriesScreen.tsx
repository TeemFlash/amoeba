import { View, StyleSheet } from 'react-native';
import { districts, events, services, slots } from '../domain/catalog';
import type { AppState, Entry, Locale } from '../domain/types';
import { t } from '../i18n';
import { ActionRow, Button, Card, Heading, KeyValue, Label, Screen, StatusTag } from '../ui/components';
import type { Route } from '../ui/navigation';

 type Props = { locale: Locale; route: Route; state: AppState; navigate: (route: Route) => void; dismiss: () => void; cancel: () => void; busy?: boolean; locked?: boolean };
function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-KZ' : 'kk-KZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function entryTitle(entry: Entry, locale: Locale) {
  return entry.kind === 'help' ? services.find((item) => item.id === entry.serviceId)?.title[locale] ?? '' : events.find((item) => item.id === entry.eventId)?.title[locale] ?? '';
}
export function EntriesScreen({ locale, route, state, navigate, dismiss, cancel, busy = false, locked = busy }: Props) {
  if (route.name === 'entries') return <Screen>
    <View style={styles.lead}><Heading>{t(locale, 'entriesTitle')}</Heading>{state.entries.length ? <Label muted>{t(locale, 'entryNotSent')}</Label> : null}</View>
    {state.entries.length === 0 ? <>
      <View style={styles.emptyCopy}><Heading level="section">{t(locale, 'entriesEmptyTitle')}</Heading><Label muted>{t(locale, 'entriesEmptyBody')}</Label></View>
      <ActionRow title={t(locale, 'helpPath')} icon="basket" accessibilityLabel={t(locale, 'helpPath')} onPress={() => navigate({ name: 'help-catalog' })} disabled={locked} />
      <ActionRow title={t(locale, 'eventPath')} icon="calendar" accessibilityLabel={t(locale, 'eventPath')} onPress={() => navigate({ name: 'events' })} disabled={locked} />
    </> : state.entries.map((entry) => {
      const status = entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled');
      return <ActionRow key={entry.id} title={entryTitle(entry, locale)} description={`${status} · ${formatDate(entry.createdAt, locale)}`} icon={entry.kind === 'help' ? 'basket' : 'calendar'} tone={entry.status === 'saved-demo' ? 'blue' : 'yellow'} accessibilityLabel={`${t(locale, 'openEntryPrefix')} ${entryTitle(entry, locale)} · ${entry.kind === 'help' ? t(locale, 'helpEntryType') : t(locale, 'eventEntryType')} · ${status} · ${formatDate(entry.createdAt, locale)}`} onPress={() => navigate({ name: 'entry', entryId: entry.id })} disabled={locked} />;
    })}
  </Screen>;
  if (route.name !== 'entry' && route.name !== 'cancel-confirm') return null;
  const entry = state.entries.find((item) => item.id === route.entryId);
  if (!entry) return <Screen><Heading level="section">{t(locale, 'entryNotFound')}</Heading><Button label={t(locale, 'tabEntries')} onPress={() => navigate({ name: 'entries' })} disabled={locked} /></Screen>;
  const saved = entry.status === 'saved-demo';
  if (route.name === 'cancel-confirm') return <Screen>
    <Card tone="yellow">
      <View style={styles.emptyCopy}><Heading>{t(locale, 'confirmCancelTitle')}</Heading><Label>{t(locale, 'confirmCancelBody')}</Label></View>
      <Label>{entryTitle(entry, locale)}</Label><StatusTag label={saved ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} cancelled={!saved} />
    </Card>
    <Button label={t(locale, 'keep')} kind="secondary" icon="back" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : 'cancelNow')} kind="danger" onPress={cancel} disabled={locked || !saved} />
  </Screen>;

  return <Screen>
    <Heading>{entryTitle(entry, locale)}</Heading>
    <StatusTag label={saved ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} cancelled={!saved} />
    <View style={styles.recordDetails}>
      <KeyValue label={t(locale, 'entryIdLabel')} value={entry.id} />
      <KeyValue label={t(locale, 'createdLabel')} value={formatDate(entry.createdAt, locale)} />
      {entry.cancelledAt ? <KeyValue label={t(locale, 'entryStatusCancelled')} value={formatDate(entry.cancelledAt, locale)} /> : null}
      {entry.kind === 'help' ? <>
        <KeyValue label={t(locale, 'selectDistrict')} value={districts.find((item) => item.id === entry.districtId)?.title[locale] ?? ''} />
        <KeyValue label={t(locale, 'selectTime')} value={slots.find((item) => item.id === entry.slotId)?.title[locale] ?? ''} />
              </> : (() => { const event = events.find((item) => item.id === entry.eventId); return event ? <>
        <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
        <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      </> : null; })()}
    </View>
    {saved ? <Button label={t(locale, 'cancelEntry')} kind="danger" icon="info" onPress={() => navigate({ name: 'cancel-confirm', entryId: entry.id })} disabled={locked} /> : <Label muted>{t(locale, 'entryCancelledBody')}</Label>}
    <Button label={t(locale, 'tabEntries')} kind="quiet" icon="list" onPress={() => navigate({ name: 'entries' })} disabled={locked} />
  </Screen>;
}

const styles = StyleSheet.create({
  lead: { gap: 6 }, emptyCopy: { flex: 1, minWidth: 0, gap: 8, paddingVertical: 10 }, recordDetails: { gap: 14, paddingVertical: 8 },
});
