import { events } from '../domain/catalog';
import type { AppState, Locale } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, ErrorNotice, Heading, KeyValue, Label, Screen, StatusTag } from '../ui/components';
import type { Route } from '../ui/navigation';

type Props = { locale: Locale; route: Route; state: AppState; navigate: (route: Route) => void; begin: (eventId: 'tea' | 'walk-full' | 'club-cancelled') => void; submit: () => void; error?: string | null; busy?: boolean; locked?: boolean };
export function EventScreens({ locale, route, state, navigate, begin, submit, error, busy = false, locked = busy }: Props) {
  if (route.name === 'events') return <Screen>
    {events.map((event) => <Card key={event.id}>
      <Heading level="section">{event.title[locale]}</Heading>
      <Label>{event.description[locale]}</Label>
      <StatusTag label={event.availability === 'open' ? t(locale, 'eventAvailabilityOpen') : event.availability === 'full' ? t(locale, 'eventAvailabilityFull') : t(locale, 'eventAvailabilityCancelled')} cancelled={event.availability !== 'open'} />
      <Button label={t(locale, 'next')} accessibilityLabel={`${t(locale, 'choosePrefix')} ${event.title[locale]}`} onPress={() => navigate({ name: 'event-terms', eventId: event.id })} disabled={locked} />
    </Card>)}
  </Screen>;
  if (route.name !== 'event-terms' && route.name !== 'event-review') return null;
  const eventId = route.eventId;
  const event = events.find((item) => item.id === eventId);
  if (!event) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;
  if (route.name === 'event-terms') return <Screen>
    <Card>
      <Heading level="section">{event.title[locale]}</Heading><Label>{event.description[locale]}</Label>
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
      <KeyValue label={t(locale, 'eventAccessLabel')} value={event.accessibility[locale]} />
      <Label>{t(locale, 'eventNoOrganizer')}</Label><Label>{t(locale, 'costUnknown')}</Label>
      <StatusTag label={event.availability === 'open' ? t(locale, 'eventAvailabilityOpen') : event.availability === 'full' ? t(locale, 'eventAvailabilityFull') : t(locale, 'eventAvailabilityCancelled')} cancelled={event.availability !== 'open'} />
      {event.availability === 'full' ? <ErrorNotice>{t(locale, 'eventFullReason')}</ErrorNotice> : null}
      {event.availability === 'cancelled' ? <ErrorNotice>{t(locale, 'eventCancelledReason')}</ErrorNotice> : null}
    </Card>
    {event.availability === 'open' ? <Button label={t(locale, busy ? 'saving' : 'next')} onPress={() => begin(eventId)} disabled={locked} /> : null}
  </Screen>;
  return <Screen>
    <Card>
      <Heading level="section">{event.title[locale]}</Heading>
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <Label>{t(locale, 'eventConfirmBody')}</Label>
    </Card>
    {state.entries.some((entry) => entry.kind === 'event' && entry.eventId === event.id && entry.status === 'saved-demo') ? <ErrorNotice>{t(locale, 'alreadyEnrolled')}</ErrorNotice> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, busy ? 'saving' : 'eventSave')} onPress={submit} disabled={locked || state.entries.some((entry) => entry.kind === 'event' && entry.eventId === event.id && entry.status === 'saved-demo')} />
  </Screen>;
}
