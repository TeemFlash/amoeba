import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { dates, districts, selectableDistricts, selectableSlots, services, slots } from '../domain/catalog';
import type { AppState, Command, DateId, HelpFormStep, Locale, Result, ServiceId, Transition } from '../domain/types';
import { t, type TranslationKey } from '../i18n';
import { Button, Card, Choice, ErrorNotice, Heading, Label, Screen, StepIndicator } from '../ui/components';
import { theme } from '../ui/theme';
import { useTextScale } from '../ui/Typography';
import { MobiIllustration } from '../ui/MobiIllustration';
import type { Route } from '../ui/navigation';

type Props = { locale: Locale; state: AppState; route: Route; command: (command: Command) => Promise<Result<Transition>>; persistNote?: (note: string, operationId: string) => Promise<boolean>; navigate: (route: Route) => void; error?: string | null; begin?: (id: ServiceId) => void; submit?: () => void; busy?: boolean; locked?: boolean; cloudMode?: boolean };
const stepKeys: Record<HelpFormStep, TranslationKey> = { district: 'helpStepDistrict', date: 'helpStepDate', time: 'helpStepTime', note: 'helpStepNote' };
const order: HelpFormStep[] = ['district', 'date', 'time', 'note'];
const districtLabels: Record<string, TranslationKey> = { 'astana-esil': 'districtEsil', 'astana-almaty': 'districtAlmaty', 'astana-saryarka': 'districtSaryarka', 'astana-baikonur': 'districtBaikonur' };
const dateLabels: Record<DateId, TranslationKey> = { 'demo-nov12': 'dateNov12', 'demo-nov14': 'dateNov14', 'demo-nov17': 'dateNov17', 'demo-nov19': 'dateNov19' };
const slotLabels: Record<string, TranslationKey> = { 'demo-10-12': 'slot10to12', 'demo-14-16': 'slot14to16' };

export function HelpScreens({ locale, state, route, command, persistNote, navigate, error, begin, submit, busy = false, locked = busy, cloudMode = false }: Props) {
  const draft = state.draft;
  const draftOperationId = draft?.operationId;
  const persistedNote = draft?.note;
  const scale = useTextScale();
  const routeStep: HelpFormStep = route.name === 'help-step' ? route.step : draft?.formStep ?? 'district';
  const returnToReview = (route.name === 'help-step' || route.name === 'help-catalog') && Boolean(route.returnToReview);
  const [note, setNote] = useState(draft?.note ?? '');
  const noteOperation = useRef(draft?.operationId);
  const noteValue = useRef(note);
  const persistNoteHandler = useRef(persistNote);
  const noteDirty = useRef(false);
  const noteRevision = useRef(0);
  useEffect(() => { noteValue.current = note; persistNoteHandler.current = persistNote; }, [note, persistNote]);
  useEffect(() => {
    if (noteOperation.current !== draftOperationId) {
      noteOperation.current = draftOperationId;
      noteRevision.current += 1;
      noteDirty.current = false;
      setNote(persistedNote ?? '');
    }
  }, [draftOperationId, persistedNote]);
  useEffect(() => {
    if (!draftOperationId || noteDirty.current || note !== (persistedNote ?? '')) return;
    noteValue.current = persistedNote ?? '';
  }, [draftOperationId, persistedNote, note]);
  const persistNoteValue = useCallback(async (value: string, operationId: string) => {
    const revision = noteRevision.current;
    const success = persistNote
      ? await persistNote(value, operationId)
      : (await command({ type: 'editHelp', patch: { note: value } })).ok;
    if (success && revision === noteRevision.current) noteDirty.current = false;
    return success;
  }, [command, persistNote]);
  useEffect(() => {
    if (!draftOperationId || note === (persistedNote ?? '') || note.length > 280 || !persistNote || locked) return;
    const operationId = draftOperationId;
    const value = note;
    const timeout = setTimeout(() => { void persistNoteValue(value, operationId); }, 320);
    return () => clearTimeout(timeout);
  }, [draftOperationId, persistedNote, note, persistNote, persistNoteValue, locked]);
  useEffect(() => {
    if (!draftOperationId) return;
    const operationId = draftOperationId;
    return () => { const latest = noteValue.current; if (noteDirty.current && latest.length <= 280) void persistNoteHandler.current?.(latest, operationId); };
  }, [draftOperationId]);
  const choose = async (patch: Extract<Command, { type: 'editHelp' }>['patch'], nextStep: HelpFormStep) => {
    const result = await command({ type: 'editHelp', patch });
    if (!result.ok) return;
    if (returnToReview) {
      const review = await command({ type: 'setDraftStep', step: 'review' });
      if (review.ok) navigate({ name: 'help-review' });
    } else {
      const stepResult = await command({ type: 'setHelpFormStep', formStep: nextStep });
      if (stepResult.ok) navigate({ name: 'help-step', step: nextStep });
    }
  };
  const saveNote = async (value: string, skip = false) => {
    const finalValue = skip ? '' : value;
    if (finalValue !== noteValue.current) {
      noteRevision.current += 1;
      noteValue.current = finalValue;
      noteDirty.current = true;
      setNote(finalValue);
    }
    const saved = draft ? await persistNoteValue(finalValue, draft.operationId) : false;
    if (!saved) return;
    if (returnToReview) {
      const review = await command({ type: 'setDraftStep', step: 'review' });
      if (review.ok) navigate({ name: 'help-review' });
    } else {
      const stepResult = await command({ type: 'setHelpFormStep', formStep: 'note' });
      if (stepResult.ok) {
        const review = await command({ type: 'setDraftStep', step: 'review' });
        if (review.ok) navigate({ name: 'help-review' });
      }
    }
  };

  return <>
    {route.name === 'help-catalog' ? <Screen>
      {services.map((service) => <Card key={service.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MobiIllustration scene={service.id === 'groceries' ? 'apple' : service.id === 'home-help' ? 'armchair' : 'phone'} height={92} style={{ width: 92, flexShrink: 0 }} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Heading level="section">{service.title[locale]}</Heading><Label>{service.description[locale]}</Label></View>
        </View>
        <Button label={t(locale, 'next')} accessibilityLabel={`${t(locale, 'choosePrefix')} ${service.title[locale]}`} onPress={() => {
          if (draft && route.returnToReview) void choose({ serviceId: service.id }, 'district');
          else navigate({ name: 'help-terms', serviceId: service.id });
        }} disabled={locked} />
      </Card>)}
    </Screen> : null}
    {route.name === 'help-terms' ? (() => {
      const service = services.find((item) => item.id === route.serviceId);
      if (!service) return <Screen><ErrorNotice>{t(locale, 'invalidSelection')}</ErrorNotice></Screen>;
      return <Screen>
        <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
          <MobiIllustration scene={service.id === 'groceries' ? 'apple' : service.id === 'home-help' ? 'armchair' : 'phone'} height={116} style={{ width: 160, alignSelf: 'center' }} />
          <Heading level="section">{service.title[locale]}</Heading><Label>{service.description[locale]}</Label>
        </Card>
        <Card><Heading level="section">{t(locale, 'includes')}</Heading><Label>✓ {service.includes[locale]}</Label></Card>
        <Card><Heading level="section">{t(locale, 'excludes')}</Heading><Label>× {service.excludes[locale]}</Label></Card>
        <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}><Label>{t(locale, 'costUnknown')}</Label><Label>{t(locale, 'noProvider')}</Label></Card>
        <Button label={t(locale, busy ? 'saving' : 'next')} onPress={() => begin?.(service.id)} disabled={locked} />
      </Screen>;
    })() : null}
    {route.name === 'help-form' || route.name === 'help-step' ? <Screen>
      {draft ? <>
        <StepIndicator label={t(locale, stepKeys[routeStep])} current={order.indexOf(routeStep) + 1} total={5} />
        {routeStep === 'district' ? <Card>
          <Heading level="section">{t(locale, 'selectDistrict')}</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {selectableDistricts.map((item) => <View key={item.id} style={{ width: '48%' }}><Choice label={t(locale, districtLabels[item.id]!)} selected={draft.districtId === item.id} onPress={() => void choose({ districtId: item.id }, 'date')} disabled={locked} /></View>)}
          </View>
        </Card> : null}
        {routeStep === 'date' ? <Card>
          <Heading level="section">{t(locale, 'selectDate')}</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {dates.map((item) => <View key={item.id} style={{ width: '48%' }}><Choice label={t(locale, dateLabels[item.id])} selected={draft.dateId === item.id} onPress={() => void choose({ dateId: item.id }, 'time')} disabled={locked} /></View>)}
          </View>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        </Card> : null}
        {routeStep === 'time' ? <Card>
          <Heading level="section">{t(locale, 'selectTime')}</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {selectableSlots.map((item) => <View key={item.id} style={{ width: '48%' }}><Choice label={t(locale, slotLabels[item.id]!)} selected={draft.slotId === item.id} onPress={() => void choose({ slotId: item.id }, 'note')} disabled={locked} /></View>)}
          </View>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
        </Card> : null}
        {routeStep === 'note' ? <Card>
          <Heading level="section">{t(locale, 'noteTitle')} · {t(locale, 'noteOptional')}</Heading>
          <TextInput accessibilityLabel={t(locale, 'noteTitle')} value={note} onChangeText={(value) => { noteRevision.current += 1; noteValue.current = value; noteDirty.current = true; setNote(value); }} onBlur={() => { if (note.length <= 280 && draft) void persistNoteValue(noteValue.current, draft.operationId); }} editable={!locked} multiline maxLength={280} textAlignVertical="top" style={{ minHeight: 128, borderWidth: 2, borderColor: theme.colors.border, borderRadius: 18, padding: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: theme.type.body * scale, lineHeight: theme.lineHeight.body * scale }} />
          <Label>{t(locale, 'noteLimit')}</Label>
          <Label>{`${note.length}/280`}</Label>
          <Button label={t(locale, 'next')} onPress={() => void saveNote(note)} disabled={locked || note.length > 280} />
          <Button label={t(locale, 'noteSkip')} kind="quiet" onPress={() => void saveNote('', true)} disabled={locked} />
        </Card> : null}
        <Button label={t(locale, 'discardDraft')} kind="quiet" onPress={() => navigate({ name: 'discard-confirm' })} disabled={locked} />
      </> : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
    </Screen> : null}
    {route.name === 'help-review' ? <Screen>
      {draft ? (() => {
        const service = services.find((item) => item.id === draft.serviceId);
        const district = districts.find((item) => item.id === draft.districtId);
        const date = dates.find((item) => item.id === draft.dateId);
        const slot = slots.find((item) => item.id === draft.slotId);
        const editRoute = (step: HelpFormStep) => navigate({ name: 'help-step', step, returnToReview: true });
        const row = (label: string, value: string, editLabel: string, step?: HelpFormStep) => <View key={label} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 8, gap: 4 }}>
          <Label muted>{label}</Label><Label>{value}</Label>
          {step ? <Button label={editLabel} kind="quiet" onPress={() => editRoute(step)} disabled={locked} /> : null}
        </View>;
        return <>
          <StepIndicator label={t(locale, 'helpStepReviewNew')} current={5} total={5} />
          <Card style={{ backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlue }}>
            <View style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 8, gap: 4 }}>
              <Label muted>{t(locale, 'helpCatalogTitle')}</Label><Label>{service?.title[locale] ?? t(locale, 'invalidSelection')}</Label>
              <Button label={t(locale, 'editCategory')} kind="quiet" onPress={() => navigate({ name: 'help-catalog', returnToReview: true })} disabled={locked} />
            </View>
            {row(t(locale, 'selectDistrict'), district ? district.title[locale] : t(locale, 'districtRequired'), t(locale, 'editDistrict'), 'district')}
            {row(t(locale, 'selectDate'), date ? t(locale, dateLabels[date.id]) : t(locale, 'dateRequired'), t(locale, 'editDate'), 'date')}
            {row(t(locale, 'selectTime'), slot ? slot.title[locale] : t(locale, 'slotRequired'), t(locale, 'editTime'), 'time')}
            {row(t(locale, 'noteTitle'), draft.note || t(locale, 'noteOptional'), t(locale, 'editNote'), 'note')}
          </Card>
          <Card style={{ backgroundColor: theme.colors.cream, borderColor: theme.colors.cream }}>
            <Label>{t(locale, cloudMode ? 'accountReviewHelpIntro' : 'reviewHelpIntro')}</Label>
            {cloudMode ? <Label>{t(locale, 'accountVolunteerPrivacy')}</Label> : null}
            <Label>{t(locale, 'costUnknown')}</Label><Label>{t(locale, 'noProvider')}</Label>
          </Card>
          {error ? <ErrorNotice>{error}</ErrorNotice> : null}
          <Button label={t(locale, busy ? 'saving' : 'saveDemo')} onPress={() => submit?.()} disabled={locked} />
        </>;
      })() : <ErrorNotice>{t(locale, 'draftNotFound')}</ErrorNotice>}
    </Screen> : null}
  </>;
}
