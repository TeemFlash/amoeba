import { Pressable, View } from 'react-native';
import { events, services } from '../domain/catalog';
import type { AppState, EventId, Locale } from '../domain/types';
import type { Route } from '../ui/navigation';
import { Card, Heading, Label, Screen } from '../ui/components';
import { MobiIllustration } from '../ui/MobiIllustration';
import { theme } from '../ui/theme';
import { t } from '../i18n';

export function HomeScreen({ locale, state, navigate, draftPending = false, draftSavedInAccount = false, eventDraft = null }: { locale: Locale; state: AppState; navigate: (route: Route) => void; draftPending?: boolean; draftSavedInAccount?: boolean; eventDraft?: { eventId: EventId; operationId: string } | null }) {
  const draft = state.draft;
  const draftTitle = draft ? services.find((service) => service.id === draft.serviceId)?.title[locale]
    : eventDraft ? events.find((event) => event.id === eventDraft.eventId)?.title[locale] : '';
  const open = (route: Route) => () => navigate(route);
  const resumeDraft = () => {
    if (eventDraft) { navigate({ name: 'event-review', eventId: eventDraft.eventId, operationId: eventDraft.operationId }); return; }
    if (!draft) return;
    const step = draft.formStep ?? (!draft.districtId ? 'district' : !draft.dateId ? 'date' : !draft.slotId ? 'time' : 'note');
    navigate(draft.step === 'review' && draft.dateId ? { name: 'help-review' } : { name: 'help-step', step });
  };
  return <Screen>
    <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Heading level="section">{t(locale, 'homeTitle')}</Heading>
          <Label>{t(locale, 'homeIntro')}</Label>
        </View>
        <MobiIllustration scene="armchair" height={84} style={{ width: 92, flexShrink: 0 }} />
      </View>
    </Card>
    <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'helpPath')} onPress={open({ name: 'help-catalog' })} style={({ pressed }) => [styles.pathCard, styles.helpCard, pressed && styles.pressed]}>
      <MobiIllustration scene="apple" height={82} style={{ width: 74, flexShrink: 0 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Heading level="section">{t(locale, 'helpPath')}</Heading>
        <Label>{t(locale, 'homeHelpShort')}</Label>
      </View>
      <View style={styles.chevron}><Label style={styles.chevronText}>›</Label></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'eventPath')} onPress={open({ name: 'events' })} style={({ pressed }) => [styles.pathCard, styles.eventCard, pressed && styles.pressed]}>
      <MobiIllustration scene="tea" height={82} style={{ width: 74, flexShrink: 0 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Heading level="section">{t(locale, 'eventPath')}</Heading>
        <Label>{t(locale, 'homeEventsShort')}</Label>
      </View>
      <View style={styles.chevron}><Label style={styles.chevronText}>›</Label></View>
    </Pressable>
    {draft || eventDraft ? <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'continueDraft')} onPress={resumeDraft} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}>
      <View style={styles.draftCopy}>
        <Heading level="section">{t(locale, 'continueDraft')}</Heading>
        <Label>{draftTitle}</Label>
        <Label muted>{t(locale, draftPending ? 'draftNotSavedTitle' : draftSavedInAccount ? 'accountDraftTitle' : 'draftSavedLocally')}</Label>
      </View>
      <View style={styles.chevron}><Label style={styles.chevronText}>›</Label></View>
    </Pressable> : null}
  </Screen>;
}

const styles = {
  pathCard: { minHeight: 112, borderRadius: theme.radius.card, borderWidth: 1, padding: 10, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 9 },
  helpCard: { backgroundColor: theme.colors.cream, borderColor: theme.colors.cream },
  eventCard: { backgroundColor: theme.colors.lavender, borderColor: theme.colors.lavender },
  draftCard: { minHeight: 116, borderRadius: theme.radius.card, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  draftCopy: { flex: 1, minWidth: 0, gap: 4 },
  chevron: { width: 48, height: 56, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: theme.colors.surface, flexShrink: 0 },
  chevronText: { color: theme.colors.primary, fontSize: 34, lineHeight: 40, fontWeight: '700' as const },
  pressed: { opacity: 0.82 },
};
