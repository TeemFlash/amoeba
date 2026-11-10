import { districts, services, slots } from '../domain/catalog';
import type { AppState, Command, Locale, Result, ServiceId, Transition } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, Choice, ErrorNotice, Heading, Label, Screen } from '../ui/components';
import type { Route } from '../ui/navigation';

type Props = { locale: Locale; state: AppState; route: Route; command: (command: Command) => Promise<Result<Transition>>; navigate: (route: Route) => void; error?: string | null; begin?: (id: ServiceId) => void; submit?: () => void; busy?: boolean; locked?: boolean };
export function HelpScreens({ locale, state, route, command, navigate, error, begin, submit, busy = false, locked = busy }: Props) {
  const draft = state.draft;
  return <>
    {route.name === 'help-catalog' ? <Screen>
      {services.map((service) => <Card key={service.id}>
        <Heading level="section">{service.title[locale]}</Heading>
        <Label>{service.description[locale]}</Label>
        <Button label={t(locale, 'next')} accessibilityLabel={`${t(locale, 'choosePrefix')} ${service.title[locale]}`} onPress={() => navigate({ name: 'help-terms', serviceId: service.id })} disabled={locked} />
      </Card>)}
    </Screen> : null}
    {route.name === 'help-terms' ? (() => {
      const service = services.find((item) => item.id === route.serviceId);
      if (!service) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;
      return <Screen>
        <Card>
          <Heading level="section">{service.title[locale]}</Heading>
          <Label>{service.description[locale]}</Label>
          <Heading level="section">{t(locale, 'includes')}</Heading><Label>{service.includes[locale]}</Label>
          <Heading level="section">{t(locale, 'excludes')}</Heading><Label>{service.excludes[locale]}</Label>
          <Label>{t(locale, 'costUnknown')}</Label><Label>{t(locale, 'noProvider')}</Label>
        </Card>
        <Button label={t(locale, busy ? 'saving' : 'next')} onPress={() => begin?.(service.id)} disabled={locked} />
      </Screen>;
    })() : null}
    {route.name === 'help-form' ? <Screen>
      {draft ? <>
        <Heading level="section">{t(locale, 'selectDistrict')}</Heading>
        {districts.map((item) => <Choice key={item.id} label={item.title[locale]} selected={draft.districtId === item.id} onPress={() => void command({ type: 'editHelp', patch: { districtId: item.id } })} disabled={locked} />)}
        <Heading level="section">{t(locale, 'selectTime')}</Heading>
        {slots.map((item) => <Choice key={item.id} label={item.title[locale]} selected={draft.slotId === item.id} onPress={() => void command({ type: 'editHelp', patch: { slotId: item.id } })} disabled={locked} />)}
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <Button label={t(locale, busy ? 'saving' : 'next')} onPress={() => void command({ type: 'setDraftStep', step: 'review' }).then((result) => { if (result.ok) navigate({ name: 'help-review' }); })} disabled={locked} />
        <Button label={t(locale, 'discardDraft')} kind="quiet" onPress={() => navigate({ name: 'discard-confirm' })} disabled={locked} />
      </> : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
    </Screen> : null}
    {route.name === 'help-review' ? <Screen>
      {draft ? (() => {
        const service = services.find((item) => item.id === draft.serviceId);
        const district = districts.find((item) => item.id === draft.districtId);
        const slot = slots.find((item) => item.id === draft.slotId);
        return <>
          <Card>
            <Heading level="section">{service?.title[locale] ?? t(locale, 'invalidSelection')}</Heading>
            <Heading level="section">{t(locale, 'selectDistrict')}</Heading><Label>{district?.title[locale] ?? t(locale, 'districtRequired')}</Label>
            <Heading level="section">{t(locale, 'selectTime')}</Heading><Label>{slot?.title[locale] ?? t(locale, 'slotRequired')}</Label>
            <Label>{t(locale, 'reviewHelpIntro')}</Label><Label>{t(locale, 'costUnknown')}</Label><Label>{t(locale, 'noProvider')}</Label>
          </Card>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <Button label={t(locale, 'change')} kind="secondary" onPress={() => void command({ type: 'setDraftStep', step: 'form' }).then((result) => { if (result.ok) navigate({ name: 'help-form' }); })} disabled={locked} />
          <Button label={t(locale, busy ? 'saving' : 'saveDemo')} onPress={() => submit?.()} disabled={locked} />
        </>;
      })() : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
    </Screen> : null}
  </>;
}
