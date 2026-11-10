import { services } from '../domain/catalog';
import type { AppState, Locale } from '../domain/types';
import type { Route } from '../ui/navigation';
import { Button, Card, Heading, Label, Screen } from '../ui/components';
import { t } from '../i18n';

export function HomeScreen({ locale, state, navigate, draftPending = false }: { locale: Locale; state: AppState; navigate: (route: Route) => void; draftPending?: boolean }) {
  const draft = state.draft;
  const draftTitle = draft ? services.find((service) => service.id === draft.serviceId)?.title[locale] : '';
  return <Screen>
    <Heading>{t(locale, 'homeTitle')}</Heading>
    <Label muted>{t(locale, 'homeIntro')}</Label>
    <Card>
      <Heading level="section">{t(locale, 'helpPath')}</Heading>
      <Label>{t(locale, 'helpPathBody')}</Label>
      <Button label={t(locale, 'helpPath')} onPress={() => navigate({ name: 'help-catalog' })} />
    </Card>
    <Card>
      <Heading level="section">{t(locale, 'eventPath')}</Heading>
      <Label>{t(locale, 'eventPathBody')}</Label>
      <Button label={t(locale, 'eventPath')} kind="secondary" onPress={() => navigate({ name: 'events' })} />
    </Card>
    {draft ? <Card>
      <Heading level="section">{t(locale, draftPending ? 'draftNotSavedTitle' : 'continueDraft')}</Heading>
      <Label>{draftTitle}</Label>
      <Label muted>{t(locale, draftPending ? 'draftNotSavedBody' : 'draftSavedLocally')}</Label>
      <Button label={t(locale, 'continueDraft')} onPress={() => navigate({ name: draft.step === 'review' ? 'help-review' : 'help-form' })} />
    </Card> : null}
    <Button label={t(locale, 'openEntries')} kind="quiet" onPress={() => navigate({ name: 'entries' })} />
  </Screen>;
}
