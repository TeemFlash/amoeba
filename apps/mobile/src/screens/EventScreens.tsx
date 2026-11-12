import { View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { events } from '../domain/catalog';
import type { AppState, EventId, Locale } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, ErrorNotice, Heading, KeyValue, Label, Screen, StatusTag, StepIndicator } from '../ui/components';
import { MobiIllustration, type IllustrationScene } from '../ui/MobiIllustration';
import { theme } from '../ui/theme';
import type { Route } from '../ui/navigation';

type Props = {
  locale: Locale;
  route: Route;
  state: AppState;
  navigate: (route: Route) => void;
  begin: (eventId: EventId) => void;
  submit: () => void;
  error?: string | null;
  busy?: boolean;
  locked?: boolean;
  cloudMode?: boolean;
};

function sceneFor(eventId: EventId): IllustrationScene {
  return eventId === 'tea' ? 'tea' : eventId === 'walk-full' ? 'park' : 'game';
}

function availabilityLabel(locale: Locale, status: 'open' | 'full' | 'cancelled') {
  return t(locale, status === 'open' ? 'eventAvailabilityOpen' : status === 'full' ? 'eventAvailabilityFull' : 'eventAvailabilityCancelled');
}
function availabilityVariant(status: 'open' | 'full' | 'cancelled') {
  return status === 'open' ? 'available' as const : status === 'full' ? 'full' as const : 'cancelled' as const;
}

function EventSummary({ eventId, locale, compact = false }: { eventId: EventId; locale: Locale; compact?: boolean }) {
  const event = events.find((item) => item.id === eventId);
  if (!event) return null;
  return <ViewRow compact={compact}>
    <MobiIllustration scene={sceneFor(eventId)} height={compact ? 92 : 150} style={compact ? { width: 96, flexShrink: 0 } : undefined} />
    <ViewColumn>
      <Heading level="section">{event.title[locale]}</Heading>
      {!compact ? <Label>{event.description[locale]}</Label> : null}
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <StatusTag label={availabilityLabel(locale, event.availability)} variant={availabilityVariant(event.availability)} />
    </ViewColumn>
  </ViewRow>;
}

// Kept as tiny layout helpers so artwork and text remain readable at narrow widths.
function ViewRow({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return <View style={{ flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'stretch', gap: theme.spacing.md }}>{children}</View>;
}
function ViewColumn({ children }: PropsWithChildren) {
  return <View style={{ flex: 1, gap: theme.spacing.sm }}>{children}</View>;
}

export function EventScreens({ locale, route, state, navigate, begin, submit, error, busy = false, locked = busy, cloudMode = false }: Props) {
  if (route.name === 'events') return <Screen>
    <Heading>{t(locale, 'eventsTitle')}</Heading>
    <Label>{t(locale, 'eventListDisclaimer')}</Label>
    {events.map((event) => <Card key={event.id} style={{ backgroundColor: event.availability === 'open' ? theme.colors.lavender : theme.colors.surface }}>
      <EventSummary eventId={event.id} locale={locale} compact />
      <Button
        label={t(locale, 'next')}
        accessibilityLabel={`${t(locale, 'choosePrefix')} ${event.title[locale]}`}
        onPress={() => navigate({ name: 'event-terms', eventId: event.id })}
        disabled={locked}
      />
    </Card>)}
  </Screen>;

  if (route.name !== 'event-terms' && route.name !== 'event-confirm' && route.name !== 'event-review') return null;
  const eventId = route.eventId;
  const event = events.find((item) => item.id === eventId);
  if (!event) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;

  if (route.name === 'event-terms') return <Screen>
    <Heading>{event.title[locale]}</Heading>
    <Card style={{ backgroundColor: theme.colors.lavender, borderColor: theme.colors.lavender }}>
      <MobiIllustration scene={sceneFor(eventId)} height={160} />
      <Label>{event.description[locale]}</Label>
      <KeyValue label={t(locale, 'eventDateLabel')} value={event.dateLabel[locale]} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
      <KeyValue label={t(locale, 'eventAccessLabel')} value={event.accessibility[locale]} />
    </Card>
    <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
      <Label>{t(locale, 'eventNoOrganizer')}</Label>
      <Label>{t(locale, 'costUnknown')}</Label>
    </Card>
    <StatusTag label={availabilityLabel(locale, event.availability)} variant={availabilityVariant(event.availability)} />
    {event.availability === 'full' ? <ErrorNotice>{t(locale, 'eventFullReason')}</ErrorNotice> : null}
    {event.availability === 'cancelled' ? <ErrorNotice>{t(locale, 'eventCancelledReason')}</ErrorNotice> : null}
    {event.availability === 'open'
      ? <Button label={t(locale, 'eventSave')} onPress={() => begin(eventId)} disabled={locked} />
      : <Button label={t(locale, event.availability === 'full' ? 'eventFullReason' : 'eventCancelledReason')} disabled onPress={() => {}} />}
  </Screen>;

  const operationId = route.operationId;
  if (route.name === 'event-confirm') return <Screen>
    <StepIndicator label={t(locale, 'eventStepConfirm')} current={1} total={3} />
    <Heading>{t(locale, 'eventConfirmTitle')}</Heading>
    <Card style={{ backgroundColor: theme.colors.lavender, borderColor: theme.colors.lavender }}>
      <EventSummary eventId={eventId} locale={locale} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
    </Card>
    <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
      <Label>{t(locale, cloudMode ? 'accountReviewEventBody' : 'eventConfirmBody')}</Label>
      <Label>{t(locale, 'eventNoOrganizer')}</Label>
      <Label>{t(locale, 'eventAccessLabel')}: {event.accessibility[locale]}</Label>
    </Card>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button
      label={t(locale, 'eventContinueToReview')}
      onPress={() => navigate({ name: 'event-review', eventId, operationId })}
      disabled={locked}
    />
  </Screen>;

  const alreadyEnrolled = state.entries.some((entry) => entry.kind === 'event' && entry.eventId === eventId && entry.status === 'saved-demo');
  return <Screen>
    <StepIndicator label={t(locale, 'eventStepReviewNew')} current={2} total={3} />
    <Heading>{t(locale, 'eventReviewTitle')}</Heading>
    <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
      <EventSummary eventId={eventId} locale={locale} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={event.place[locale]} />
      <KeyValue label={t(locale, 'eventLanguageLabel')} value={event.languages[locale]} />
    </Card>
    <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
      <Label>{t(locale, cloudMode ? 'accountReviewEventBody' : 'eventConfirmBody')}</Label>
      <Label>{t(locale, 'eventNoOrganizer')}</Label>
      <Label>{t(locale, 'eventAccessLabel')}: {event.accessibility[locale]}</Label>
    </Card>
    {alreadyEnrolled ? <ErrorNotice>{t(locale, 'alreadyEnrolled')}</ErrorNotice> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, busy ? 'saving' : 'eventReviewAction')} onPress={submit} disabled={locked || alreadyEnrolled} />
  </Screen>;
}
