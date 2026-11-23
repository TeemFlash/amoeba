import { useWindowDimensions, View, StyleSheet } from 'react-native';
import { services } from '../domain/catalog';
import type { AppState, Locale } from '../domain/types';
import type { Route } from '../ui/navigation';
import { ActionRow, Screen } from '../ui/components';
import { t } from '../i18n';

export function HomeScreen({ locale, state, navigate, draftPending = false }: { locale: Locale; state: AppState; navigate: (route: Route) => void; draftPending?: boolean }) {
  const draft = state.draft;
  const { width } = useWindowDimensions();
  const wide = width >= 680;
  const draftTitle = draft ? services.find((service) => service.id === draft.serviceId)?.title[locale] ?? '' : '';
  return <Screen>
    <View style={[styles.actionGrid, wide && styles.actionGridWide]}>
      <ActionRow style={wide ? styles.actionWide : undefined} title={t(locale, 'helpPath')} icon="basket" tone="blue" accessibilityLabel={t(locale, 'helpPath')} onPress={() => navigate({ name: 'help-catalog' })} />
      <ActionRow style={wide ? styles.actionWide : undefined} title={t(locale, 'eventPath')} icon="calendar" tone="peach" accessibilityLabel={t(locale, 'eventPath')} onPress={() => navigate({ name: 'events' })} />
    </View>
    {draft ? <ActionRow compact title={t(locale, 'continueDraft')} description={`${draftTitle}${draftPending ? ` · ${t(locale, 'draftNotSavedTitle')}` : ''}`} icon="clock" tone={draftPending ? 'yellow' : 'blue'} accessibilityLabel={t(locale, 'continueDraft')} onPress={() => navigate({ name: draft.step === 'review' ? 'help-review' : 'help-form' })} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  actionGrid: { gap: 12 }, actionGridWide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' }, actionWide: { flexGrow: 1, flexBasis: '48%' },
});
