import { services, districts, dates, slots } from '../domain/catalog';
import type { Locale } from '../domain/types';
import type { HelpCall } from '../firebase/volunteers';
import { t, type TranslationKey } from '../i18n';
import { Button, Card, ErrorNotice, Heading, Label, Screen } from '../ui/components';

type Props = {
  locale: Locale;
  calls: HelpCall[];
  loading: boolean;
  error: boolean;
  busyId: string | null;
  pickupNotice: TranslationKey | null;
  pickupError: TranslationKey | null;
  onPickUp: (operationId: string) => Promise<boolean>;
  onRefresh: () => void;
};

export function VolunteerCallsScreen({ locale, calls, loading, error, busyId, pickupNotice, pickupError, onPickUp, onRefresh }: Props) {
  return <Screen>
    <Card><Heading level="section">{t(locale, 'volunteerCallsTitle')}</Heading><Label>{t(locale, 'volunteerCallsIntro')}</Label></Card>
    {pickupNotice ? <Card><Label>{t(locale, pickupNotice)}</Label></Card> : null}
    {pickupError ? <Card><ErrorNotice>{t(locale, pickupError)}</ErrorNotice></Card> : null}
    {!loading && calls.length > 0 ? <Button label={t(locale, 'volunteerRefresh')} kind="secondary" onPress={onRefresh} disabled={busyId !== null} /> : null}
    {error ? <Card><ErrorNotice>{t(locale, 'accountReadError')}</ErrorNotice><Button label={t(locale, 'retry')} onPress={onRefresh} disabled={loading || busyId !== null} /></Card> : null}
    {loading && !error ? <Card><Label>{t(locale, 'authLoading')}</Label></Card> : null}
    {!loading && !error && calls.length === 0 ? <Card><Label>{t(locale, 'volunteerCallsEmpty')}</Label><Button label={t(locale, 'volunteerRefresh')} kind="secondary" onPress={onRefresh} disabled={busyId !== null} /></Card> : null}
    {!error ? calls.map((call) => {
      const service = services.find((item) => item.id === call.serviceId);
      const district = districts.find((item) => item.id === call.districtId);
      const date = dates.find((item) => item.id === call.dateId);
      const slot = slots.find((item) => item.id === call.slotId);
      return <Card key={call.operationId}>
        <Heading level="section">{service?.title[locale] ?? t(locale, 'invalidSelection')}</Heading>
        <Label>{district?.title[locale] ?? ''}</Label>
        <Label>{date?.title[locale] ?? t(locale, 'entryDateUnspecified')}</Label>
        <Label>{slot?.title[locale] ?? ''}</Label>
        <Button label={t(locale, busyId === call.operationId ? 'saving' : 'volunteerPickUp')} onPress={() => { void onPickUp(call.operationId); }} disabled={busyId !== null || call.status !== 'open'} />
      </Card>;
    }) : null}
  </Screen>;
}
