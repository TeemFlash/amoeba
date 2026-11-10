import { districts, events, services, slots } from '../domain/catalog';
import type { AppState, Entry, Locale } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, Heading, KeyValue, Label, Screen, StatusTag } from '../ui/components';
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
    {state.entries.length === 0 ? <Card>
      <Heading level="section">{t(locale, 'entriesEmptyTitle')}</Heading><Label>{t(locale, 'entriesEmptyBody')}</Label>
      <Button label={t(locale, 'helpPath')} onPress={() => navigate({ name: 'help-catalog' })} disabled={locked} />
      <Button label={t(locale, 'eventPath')} kind="secondary" onPress={() => navigate({ name: 'events' })} disabled={locked} />
    </Card> : state.entries.map((entry) => <Card key={entry.id}>
      <Heading level="section">{entryTitle(entry, locale)}</Heading>
      <Label muted>{entry.kind === 'help' ? t(locale, 'helpEntryType') : t(locale, 'eventEntryType')}</Label>
      <StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} cancelled={entry.status === 'cancelled-demo'} />
      <Label>{formatDate(entry.createdAt, locale)}</Label>
      <Button label={t(locale, 'openEntry')} accessibilityLabel={`${t(locale, 'openEntryPrefix')} ${entryTitle(entry, locale)}`} onPress={() => navigate({ name: 'entry', entryId: entry.id })} disabled={locked} />
    </Card>)}
  </Screen>;
  if (route.name !== 'entry' && route.name !== 'cancel-confirm') return null;
  const entry = state.entries.find((item) => item.id === route.entryId);
  if (!entry) return <Screen><Heading level="section">{t(locale, 'entryNotFound')}</Heading><Button label={t(locale, 'tabEntries')} onPress={() => navigate({ name: 'entries' })} disabled={locked} /></Screen>;
  if (route.name === 'cancel-confirm') return <Screen>
    <Card><Heading level="section">{t(locale, 'confirmCancelTitle')}</Heading><Label>{t(locale, 'confirmCancelBody')}</Label><Label>{entryTitle(entry, locale)}</Label><StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} cancelled={entry.status === 'cancelled-demo'} /></Card>
    <Button label={t(locale, 'keep')} kind="secondary" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : 'cancelNow')} kind="danger" onPress={cancel} disabled={locked || entry.status === 'cancelled-demo'} />
  </Screen>;
  return <Screen>
    <Card>
      <Heading level="section">{entryTitle(entry, locale)}</Heading>
      <StatusTag label={entry.status === 'saved-demo' ? t(locale, 'entryStatusSaved') : t(locale, 'entryStatusCancelled')} cancelled={entry.status === 'cancelled-demo'} />
      <KeyValue label={t(locale, 'entryIdLabel')} value={entry.id} />
      <KeyValue label={t(locale, 'createdLabel')} value={formatDate(entry.createdAt, locale)} />
      {entry.cancelledAt ? <KeyValue label={t(locale, 'entryStatusCancelled')} value={formatDate(entry.cancelledAt, locale)} /> : null}
      {entry.kind === 'help' ? <>
        <KeyValue label={t(locale, 'selectDistrict')} value={districts.find((item) => item.id === entry.districtId)?.title[locale] ?? ''} />
        <KeyValue label={t(locale, 'selectTime')} value={slots.find((item) => item.id === entry.slotId)?.title[locale] ?? ''} />
        <Label>{t(locale, 'entryNotSent')}</Label>
      </> : <>
        {(() => { const event = events.find((item) => item.id === entry.eventId); return event ? <>
          <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
          <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
          <Label>{t(locale, 'eventNoOrganizer')}</Label><Label>{t(locale, 'eventConfirmBody')}</Label>
        </> : null; })()}
      </>}
    </Card>
    {entry.status === 'cancelled-demo' ? <Card><Heading level="section">{t(locale, 'entryCancelledTitle')}</Heading><Label>{t(locale, 'entryCancelledBody')}</Label></Card> : <Button label={t(locale, 'cancelEntry')} kind="danger" onPress={() => navigate({ name: 'cancel-confirm', entryId: entry.id })} disabled={locked} />}
    <Button label={t(locale, 'tabEntries')} kind="quiet" onPress={() => navigate({ name: 'entries' })} disabled={locked} />
  </Screen>;
}
