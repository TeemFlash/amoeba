import { View, StyleSheet } from 'react-native';
import { districts, services, slots } from '../domain/catalog';
import type { AppState, Command, Locale, Result, ServiceId, Transition } from '../domain/types';
import { t } from '../i18n';
import { ActionRow, Button, Card, Choice, ChoiceGroup, ErrorNotice, Heading, KeyValue, Label, Screen } from '../ui/components';
import { theme } from '../ui/theme';
import type { IconName } from '../ui/icons';
import type { Route } from '../ui/navigation';

const serviceIcons: Record<ServiceId, IconName> = { groceries: 'basket', 'home-help': 'home', 'digital-help': 'phone' };

type Props = { locale: Locale; state: AppState; route: Route; command: (command: Command) => Promise<Result<Transition>>; navigate: (route: Route) => void; error?: string | null; begin?: (id: ServiceId) => void; submit?: () => void; busy?: boolean; locked?: boolean; draftPending?: boolean };
export function HelpScreens({ locale, state, route, command, navigate, error, begin, submit, busy = false, locked = busy, draftPending = false }: Props) {
  const draft = state.draft;
  if (route.name === 'help-catalog') return <Screen>
    <View style={styles.screenLead}><Heading>{t(locale, 'helpCatalogTitle')}</Heading></View>
    {draft ? <ActionRow compact title={t(locale, 'continueDraft')} description={`${services.find((item) => item.id === draft.serviceId)?.title[locale] ?? ''}${draftPending ? ` · ${t(locale, 'draftNotSavedTitle')}` : ''}`} icon="clock" accessibilityLabel={t(locale, 'continueDraft')} onPress={() => navigate({ name: draft.step === 'review' ? 'help-review' : 'help-form' })} disabled={locked} /> : null}
    {services.map((service) => <ActionRow key={service.id} title={service.title[locale]} description={service.description[locale]} icon={serviceIcons[service.id]} accessibilityLabel={`${t(locale, 'choosePrefix')} ${service.title[locale]}`} onPress={() => navigate({ name: 'help-terms', serviceId: service.id })} disabled={locked} />)}
  </Screen>;

  if (route.name === 'help-terms') {
    const service = services.find((item) => item.id === route.serviceId);
    if (!service) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;
    return <Screen>
      <Heading>{service.title[locale]}</Heading>
      <View style={styles.details}>
        <Heading level="section">{t(locale, 'includes')}</Heading><Label>{service.includes[locale]}</Label>
        <View style={styles.rule} />
        <Heading level="section">{t(locale, 'excludes')}</Heading><Label>{service.excludes[locale]}</Label>
      </View>
      <Button label={t(locale, busy ? 'saving' : 'next')} icon="arrow-right" onPress={() => begin?.(service.id)} disabled={locked} />
    </Screen>;
  }

  if (route.name === 'help-form') return <Screen>
    {draft ? <>
      <View style={styles.screenLead}><Heading>{t(locale, 'selectDistrict')}</Heading></View>
      <ChoiceGroup label={t(locale, 'selectDistrict')}>{districts.map((item) => <Choice key={item.id} label={item.title[locale]} selected={draft.districtId === item.id} onPress={() => void command({ type: 'editHelp', patch: { districtId: item.id } })} disabled={locked} />)}</ChoiceGroup>
      <View style={[styles.screenLead, styles.timeLead]}><Heading level="section">{t(locale, 'selectTime')}</Heading></View>
      <ChoiceGroup label={t(locale, 'selectTime')}>{slots.map((item) => <Choice key={item.id} label={item.title[locale]} selected={draft.slotId === item.id} onPress={() => void command({ type: 'editHelp', patch: { slotId: item.id } })} disabled={locked} />)}</ChoiceGroup>
      {error ? <ErrorNotice>{error}</ErrorNotice> : null}
      <Button label={t(locale, busy ? 'saving' : 'next')} icon="arrow-right" onPress={() => void command({ type: 'setDraftStep', step: 'review' }).then((result) => { if (result.ok) navigate({ name: 'help-review' }); })} disabled={locked} />
      <Button label={t(locale, 'discardDraft')} kind="quiet" onPress={() => navigate({ name: 'discard-confirm' })} disabled={locked} />
    </> : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
  </Screen>;

  if (route.name === 'help-review') return <Screen>
    {draft ? (() => {
      const service = services.find((item) => item.id === draft.serviceId);
      const district = districts.find((item) => item.id === draft.districtId);
      const slot = slots.find((item) => item.id === draft.slotId);
      return <>
        <Card tone="blue">
          <Heading>{t(locale, 'reviewTitle')}</Heading>
          <Label>{service?.title[locale] ?? t(locale, 'invalidSelection')}</Label>
          <KeyValue label={t(locale, 'selectDistrict')} value={district?.title[locale] ?? t(locale, 'districtRequired')} />
          <KeyValue label={t(locale, 'selectTime')} value={slot?.title[locale] ?? t(locale, 'slotRequired')} />
        </Card>
        {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        <View style={styles.buttonGroup}>
          <Button label={t(locale, 'change')} kind="secondary" icon="back" onPress={() => void command({ type: 'setDraftStep', step: 'form' }).then((result) => { if (result.ok) navigate({ name: 'help-form' }); })} disabled={locked} />
          <Button label={t(locale, busy ? 'saving' : 'saveDemo')} icon="check" onPress={() => submit?.()} disabled={locked} />
        </View>
      </>;
    })() : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
  </Screen>;

  return null;
}

const styles = StyleSheet.create({
  screenLead: { gap: 8 }, details: { gap: 10, paddingVertical: 8 }, timeLead: { marginTop: 8 }, rule: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 }, buttonGroup: { gap: 10 },
});
