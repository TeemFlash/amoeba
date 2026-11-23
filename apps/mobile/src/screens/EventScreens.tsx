import { View, StyleSheet } from 'react-native';
import { events } from '../domain/catalog';
import type { AppState, Locale } from '../domain/types';
import { t } from '../i18n';
import { theme } from '../ui/theme';
import { ActionRow, Button, ErrorNotice, Heading, KeyValue, Label, Screen, StatusTag } from '../ui/components';
import type { Route } from '../ui/navigation';

type Props = { locale: Locale; route: Route; state: AppState; navigate: (route: Route) => void; begin: (eventId: 'tea' | 'walk-full' | 'club-cancelled') => void; submit: () => void; error?: string | null; busy?: boolean; locked?: boolean };
export function EventScreens({ locale, route, state, navigate, begin, submit, error, busy = false, locked = busy }: Props) {
  if (route.name === 'events') return <Screen>
    <View style={styles.lead}><Heading>{t(locale, 'eventsTitle')}</Heading></View>
    {events.map((event) => {
      const status = event.availability === 'open' ? t(locale, 'eventAvailabilityOpen') : event.availability === 'full' ? t(locale, 'eventAvailabilityFull') : t(locale, 'eventAvailabilityCancelled');
      return <ActionRow key={event.id} title={event.title[locale]} description={`${event.dateLabel[locale]} · ${status} · ${event.place[locale]}`} icon="calendar" accessibilityLabel={`${t(locale, 'choosePrefix')} ${event.title[locale]} · ${event.dateLabel[locale]} · ${status}`} onPress={() => navigate({ name: 'event-terms', eventId: event.id })} disabled={locked} />;
    })}
  </Screen>;

  if (route.name !== 'event-terms' && route.name !== 'event-review') return null;
  const event = events.find((item) => item.id === route.eventId);
  if (!event) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;
  const statusLabel = event.availability === 'open' ? t(locale, 'eventAvailabilityOpen') : event.availability === 'full' ? t(locale, 'eventAvailabilityFull') : t(locale, 'eventAvailabilityCancelled');

  if (route.name === 'event-terms') return <Screen>
    <Heading>{event.title[locale]}</Heading>
    <StatusTag label={statusLabel} cancelled={event.availability !== 'open'} />
    <View style={styles.details}>
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
      <View style={styles.rule} />
      <Label>{t(locale, 'eventAccessLabel')}: {event.accessibility[locale]}</Label>
    </View>
    {event.availability === 'full' ? <ErrorNotice>{t(locale, 'eventFullReason')}</ErrorNotice> : null}
    {event.availability === 'cancelled' ? <ErrorNotice>{t(locale, 'eventCancelledReason')}</ErrorNotice> : null}
    {event.availability === 'open' ? <Button label={t(locale, busy ? 'saving' : 'next')} icon="arrow-right" onPress={() => begin(event.id)} disabled={locked} /> : null}
  </Screen>;

  const exists = state.entries.some((entry) => entry.kind === 'event' && entry.eventId === event.id && entry.status === 'saved-demo');
  return <Screen>
    <Heading>{t(locale, 'eventReviewTitle')}</Heading>
    <Heading level="section">{event.title[locale]}</Heading>
    <StatusTag label={statusLabel} />
    <View style={styles.details}>
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <Label>{t(locale, 'eventConfirmBody')}</Label>
    </View>
    {exists ? <ErrorNotice>{t(locale, 'alreadyEnrolled')}</ErrorNotice> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, busy ? 'saving' : 'eventSave')} icon="check" onPress={submit} disabled={locked || exists} />
  </Screen>;
}

const styles = StyleSheet.create({
  lead: { gap: 8 }, details: { gap: 14, paddingVertical: 8 }, rule: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },
});
