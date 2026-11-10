import type { Locale } from '../domain/types';
import { t } from '../i18n';
import { Button, Card, ErrorNotice, Heading, Label, Screen } from '../ui/components';
import type { Route } from '../ui/navigation';

type Props = { locale: Locale; route: Route; navigate: (route: Route) => void; dismiss: () => void; confirmReset?: () => Promise<boolean>; confirmDiscard?: () => Promise<void>; confirmReplace?: (serviceId: 'groceries' | 'home-help' | 'digital-help') => Promise<void>; error?: string | null; busy?: boolean; locked?: boolean };
export function AboutScreen({ locale, route, navigate, dismiss, confirmReset, confirmDiscard, confirmReplace, error, busy = false, locked = busy }: Props) {
  if (route.name === 'about') return <Screen>
    <Card><Heading level="section">{t(locale, 'aboutHowTitle')}</Heading><Label>{t(locale, 'aboutHelp')}</Label><Label>{t(locale, 'aboutEvent')}</Label></Card>
    <Card><Heading level="section">{t(locale, 'localOnlyTitle')}</Heading><Label>{t(locale, 'localOnlyBody')}</Label><Label>{t(locale, 'storageAbout')}</Label></Card>
    <Card><Heading level="section">{t(locale, 'resetSection')}</Heading><Button label={t(locale, 'resetDemo')} kind="danger" onPress={() => navigate({ name: 'reset-confirm' })} disabled={locked} /></Card>
  </Screen>;
  if (route.name === 'discard-confirm') return <Screen>
    <Card><Heading level="section">{t(locale, 'confirmDiscardTitle')}</Heading><Label>{t(locale, 'confirmDiscardBody')}</Label></Card>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, 'keep')} kind="secondary" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : 'discardDraft')} kind="danger" onPress={() => void confirmDiscard?.()} disabled={locked} />
  </Screen>;
  if (route.name === 'replace-confirm') return <Screen>
    <Card><Heading level="section">{t(locale, 'confirmReplaceTitle')}</Heading><Label>{t(locale, 'confirmReplaceBody')}</Label></Card>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, 'keep')} kind="secondary" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : 'replaceDraft')} kind="danger" onPress={() => void confirmReplace?.(route.serviceId)} disabled={locked} />
  </Screen>;
  if (route.name === 'reset-confirm') return <Screen>
    <Card><Heading level="section">{t(locale, 'confirmReset')}</Heading><Label>{t(locale, 'resetExplanation')}</Label></Card>
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    <Button label={t(locale, 'keep')} kind="secondary" onPress={dismiss} disabled={locked} />
    <Button label={t(locale, busy ? 'saving' : 'resetDemo')} kind="danger" onPress={() => void confirmReset?.()} disabled={locked} />
  </Screen>;
  return null;
}
