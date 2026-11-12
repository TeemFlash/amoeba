import type { Locale } from '../domain/types';
import type { TextSize } from '../ui/Typography';
import type { Route } from '../ui/navigation';
import { Button, Card, Choice, Heading, Label, Screen } from '../ui/components';
import { MobiIllustration } from '../ui/MobiIllustration';
import { t } from '../i18n';
import { theme } from '../ui/theme';

type Props = {
  locale: Locale;
  textSize: TextSize;
  onTextSize: (size: TextSize) => void;
  onLocale: (locale: Locale) => void;
  mode: 'local' | 'invalid' | 'configured';
  email: string | null;
  authLoading?: boolean;
  busy?: boolean;
  navigate: (route: Route) => void;
  onLogout: () => void;
};

export function ProfileScreen({ locale, textSize, onTextSize, onLocale, mode, email, authLoading = false, busy = false, navigate, onLogout }: Props) {
  return <Screen>
    <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
      <MobiIllustration scene="phone" height={112} style={{ maxWidth: 180, alignSelf: 'center' }} />
      <Heading level="section">{t(locale, 'profileTitle')}</Heading>
      <Label>{authLoading ? t(locale, 'authLoading') : email ?? (mode === 'configured' ? t(locale, 'guestStatus') : t(locale, 'accountLocalBody'))}</Label>
    </Card>
    <Card>
      <Heading level="section">{t(locale, 'language')}</Heading>
      <Choice label={t(locale, 'languageRu')} selected={locale === 'ru'} onPress={() => onLocale('ru')} disabled={busy} />
      <Choice label={t(locale, 'languageKz')} selected={locale === 'kz'} onPress={() => onLocale('kz')} disabled={busy} />
    </Card>
    <Card style={{ backgroundColor: theme.colors.lavender, borderColor: theme.colors.lavender }}>
      <Heading level="section">{t(locale, 'textSizeTitle')}</Heading>
      <Choice label={t(locale, 'textSizeStandard')} selected={textSize === 'standard'} onPress={() => onTextSize('standard')} disabled={busy} />
      <Choice label={t(locale, 'textSizeLarge')} selected={textSize === 'large'} onPress={() => onTextSize('large')} disabled={busy} />
      <Label>{t(locale, 'textSizePreview')}</Label>
    </Card>
    {email ? <Button label={t(locale, 'logout')} kind="secondary" onPress={onLogout} disabled={busy || authLoading} />
      : <Button label={t(locale, 'tabAccount')} onPress={() => navigate({ name: 'account' })} disabled={busy || authLoading} />}
    {email ? <Button label={t(locale, 'tabAccount')} kind="secondary" onPress={() => navigate({ name: 'account' })} disabled={busy} /> : null}
    <Button label={t(locale, 'aboutProfileTitle')} kind="quiet" onPress={() => navigate({ name: 'about' })} disabled={busy} />
  </Screen>;
}
