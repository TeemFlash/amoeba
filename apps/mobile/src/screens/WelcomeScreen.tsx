import type { Locale } from '../domain/types';
import { Button, Card, Heading, Label, Screen } from '../ui/components';
import { MobiIllustration } from '../ui/MobiIllustration';
import { t } from '../i18n';
import { theme } from '../ui/theme';

export function WelcomeScreen({ locale, onLocale, onStart, busy = false, intro }: { locale: Locale; onLocale: (value: Locale) => void; onStart: () => void; busy?: boolean; intro?: string }) {
  return <Screen>
    <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
      <Heading>{t(locale, 'welcomeTitle')}</Heading>
      <Label>{intro ?? t(locale, 'welcomeIntro')}</Label>
      <MobiIllustration scene="armchair" height={190} style={{ maxWidth: 280, alignSelf: 'center' }} />
    </Card>
    <Card>
      <Heading level="section">{t(locale, 'welcomeLanguageTitle')}</Heading>
      <Button label={t(locale, 'languageRu')} kind={locale === 'ru' ? 'primary' : 'secondary'} onPress={() => onLocale('ru')} disabled={busy} />
      <Button label={t(locale, 'languageKz')} kind={locale === 'kz' ? 'primary' : 'secondary'} onPress={() => onLocale('kz')} disabled={busy} />
    </Card>
    <Button label={t(locale, 'welcomeStart')} onPress={onStart} disabled={busy} />
  </Screen>;
}
