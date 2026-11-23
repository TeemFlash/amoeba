import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { Locale } from '../domain/types';
import {
  getOperationalDates, isOperationalSlotAvailable, operationalDistricts, operationalServices, operationalSlots,
  type OperationalEnrollment, type OperationalHelp, type OperationalMeeting,
} from '../firebase/operations';
import { t } from '../i18n';
import { clearOperationalDraft, ensureEnrollmentOperation, newOperationalDraft, operationalSteps, readOperationalDraft, writeOperationalDraft, type OperationalDraft } from '../storage/operationalDraft';
import { Button, Card, Choice, ErrorNotice, Heading, KeyValue, Label, Screen, StatusTag } from '../ui/components';
import { theme } from '../ui/theme';
import { useTextScale } from '../ui/Typography';
import { ResourceState, useOperationalResource, type Confirmation, type Mutate, type Operations } from './operationalResource';
import { operationalText as copy, type OperationalCopyKey } from './operationalCopy';

const timeLocale = (locale: Locale) => locale === 'ru' ? 'ru-KZ' : 'kk-KZ';
const formatDate = (value: string, locale: Locale) => new Intl.DateTimeFormat(timeLocale(locale), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const formatMeetingTime = (value: string, locale: Locale) => {
  // Operational times use UTC+05:00 even on devices with pre-2024 time zone data.
  const astanaTime = new Date(Date.parse(value) + 5 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat(timeLocale(locale), { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(astanaTime);
};
const serviceTitle = (id: string, locale: Locale) => operationalServices.find((item) => item.id === id)?.title[locale] ?? id;
const districtTitle = (id: string, locale: Locale) => operationalDistricts.find((item) => item.id === id)?.title[locale] ?? id;
const slotTitle = (id: string, locale: Locale) => operationalSlots.find((item) => item.id === id)?.title[locale] ?? id;
const helpSummary = (row: OperationalHelp, locale: Locale) => [serviceTitle(row.serviceId, locale), districtTitle(row.districtId, locale), formatDate(row.date, locale), slotTitle(row.slotId, locale)].join('\n');
const meetingSummary = (meeting: Pick<OperationalMeeting, 'title' | 'startsAt' | 'place'>, locale: Locale) => [meeting.title[locale], formatMeetingTime(meeting.startsAt, locale), meeting.place[locale]].join('\n');

function MultiLineEntry({ label, value, onChange, busy }: { label: string; value: string; onChange: (value: string) => void; busy: boolean }) {
  const scale = useTextScale();
  return <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline maxLength={300}
    editable={!busy} style={[styles.input, { fontSize: theme.type.body * scale, lineHeight: theme.lineHeight.body * scale }]} />;
}

type HelpDetailsProps = Pick<OperationalHelp, 'serviceId' | 'districtId' | 'date' | 'slotId'> & { locale: Locale };
function HelpDetails({ locale, serviceId, districtId, date, slotId }: HelpDetailsProps) {
  return <>
    <KeyValue label={copy(locale, 'service')} value={serviceTitle(serviceId, locale)} />
    <KeyValue label={copy(locale, 'districtName')} value={districtTitle(districtId, locale)} />
    <KeyValue label={copy(locale, 'dateName')} value={formatDate(date, locale)} />
    <KeyValue label={copy(locale, 'timeZone')} value={slotTitle(slotId, locale)} />
  </>;
}

export function HelpForm({ locale, uid, repo, busy, submit, guestDraft, releaseGuestDraft, onGuestSubmit, registerBack }: {
  locale: Locale; uid?: string; repo: Operations; busy: boolean; submit: Mutate; guestDraft?: OperationalDraft;
  releaseGuestDraft: () => void; onGuestSubmit: (draft: OperationalDraft) => void;
  registerBack: (handler: (() => boolean) | null) => void;
}) {
  const [draft, setDraft] = useState<OperationalDraft | null>(null);
  const draftRef = useRef<OperationalDraft | null>(null);
  const active = useRef(true);
  const [storageError, setStorageError] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [maxDates, setMaxDates] = useState(7);
  const remember = (next: OperationalDraft) => { draftRef.current = next; setDraft(next); };
  const load = useCallback(async () => {
    try {
      const saved = await readOperationalDraft(uid);
      if (!active.current) return;
      setStorageError(false);
      remember(saved ?? newOperationalDraft());
      setConflict(Boolean(uid && guestDraft && guestDraft.operationId !== saved?.operationId));
    } catch { if (active.current) setStorageError(true); }
  }, [guestDraft, uid]);
  useEffect(() => {
    active.current = true;
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) return load(); });
    return () => { cancelled = true; active.current = false; };
  }, [load]);
  const save = (patch: Partial<OperationalDraft>) => {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...patch };
    remember(next);
    void writeOperationalDraft(uid, next).then(
      () => { if (active.current && draftRef.current === next) setStorageError(false); },
      () => { if (active.current && draftRef.current === next) setStorageError(true); },
    );
  };
  const discard = async () => {
    setStorageBusy(true);
    try {
      await clearOperationalDraft(uid);
      if (active.current) { remember(newOperationalDraft()); setAskDiscard(false); setStorageError(false); }
    } catch { if (active.current) setStorageError(true); }
    finally { if (active.current) setStorageBusy(false); }
  };
  const restoreGuest = async () => {
    if (!uid || !guestDraft || draftRef.current?.submitted || storageBusy) return;
    setStorageBusy(true);
    try {
      await writeOperationalDraft(uid, guestDraft);
      await clearOperationalDraft(undefined, guestDraft.operationId).catch(() => undefined);
      if (active.current) { remember(guestDraft); setConflict(false); releaseGuestDraft(); }
    } catch { if (active.current) setStorageError(true); }
    finally { if (active.current) setStorageBusy(false); }
  };
  const requestSignIn = async () => {
    const selection = draftRef.current;
    if (!selection || storageBusy) return;
    setStorageBusy(true);
    try {
      await writeOperationalDraft(undefined, selection);
      if (active.current) onGuestSubmit(selection);
    } catch { if (active.current) setStorageError(true); }
    finally { if (active.current) setStorageBusy(false); }
  };
  const goBack = () => {
    if (busy || storageBusy) return true;
    if (askDiscard) { setAskDiscard(false); return true; }
    if (!draft || conflict || draft.step === 'service' || draft.submitted) return false;
    const prior = draft.step === 'review' && !uid ? 'slot' : operationalSteps[Math.max(0, operationalSteps.indexOf(draft.step) - 1)]!;
    save({ step: prior });
    return true;
  };
  useEffect(() => {
    registerBack(goBack);
    return () => registerBack(null);
  });
  if (!draft) return <Screen><Heading>{copy(locale, 'helpTitle')}</Heading>{storageError ? <>
    <ErrorNotice>{copy(locale, 'corruptDraft')}</ErrorNotice>
    <Button label={t(locale, 'retry')} onPress={() => void load()} disabled={storageBusy || askDiscard} />
    {askDiscard ? <>
      <Label>{copy(locale, 'discardPendingConfirm')}</Label>
      <Button label={copy(locale, 'confirm')} kind="danger" disabled={storageBusy} onPress={() => void discard()} />
      <Button label={t(locale, 'back')} kind="secondary" disabled={storageBusy} onPress={() => setAskDiscard(false)} />
    </> : <Button label={copy(locale, 'discardPending')} kind="quiet" onPress={() => setAskDiscard(true)} />}
  </> : <StatusTag label={copy(locale, 'loading')} />}</Screen>;
  if (conflict) return <Screen><Heading>{copy(locale, 'helpTitle')}</Heading><Card>
    <Heading level="section">{copy(locale, 'guestHandoff')}</Heading>
    <Label>{copy(locale, draft.submitted ? 'guestPendingConflict' : draft.serviceId ? 'guestDraftConflict' : 'guestReady')}</Label>
    {storageError ? <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice> : null}
    {!draft.submitted ? <Button label={copy(locale, draft.serviceId ? 'guestReplace' : 'guestContinue')} disabled={storageBusy} onPress={() => void restoreGuest()} /> : null}
    <Button label={copy(locale, draft.serviceId ? 'keepAccountDraft' : 'skipGuestDraft')} kind="secondary" disabled={storageBusy} onPress={() => { setConflict(false); releaseGuestDraft(); }} />
  </Card></Screen>;
  const { operationId, serviceId, districtId, slotId, date, note, step, submitted } = draft;
  const availableSlots = date ? operationalSlots.filter((item) => isOperationalSlotAvailable(date, item.id)) : [];
  const valid = !!(serviceId && districtId && slotId && date);
  const selectDate = (next: string) => save({ date: next, slotId: null, step: 'slot' });
  const submitDraft = () => {
    if (!serviceId || !districtId || !slotId || !date) return;
    if (!uid) { void requestSignIn(); return; }
    const pending = { ...draft, submitted: true };
    remember(pending);
    void submit(async () => {
      await writeOperationalDraft(uid, pending);
      const result = await repo.createHelp(uid, { operationId, serviceId, districtId, slotId, date, note: note.trim() });
      // A successful retry can also clean up this draft if removal fails here.
      await clearOperationalDraft(uid, operationId).catch(() => undefined);
      return result.status === 'open' ? 'helpSaved' : 'helpRecovered';
    });
  };
  const dates = step === 'date' ? getOperationalDates().filter((day) => operationalSlots.some((item) => isOperationalSlotAvailable(day, item.id))) : [];
  return <Screen>
    <Heading>{copy(locale, 'helpTitle')}</Heading>
    {storageError ? <ErrorNotice>{t(locale, 'storageWriteError')}</ErrorNotice> : null}
    <Card>
      <Heading level="section">{step === 'note' ? `${t(locale, 'noteTitle')} (${t(locale, 'noteOptional')})` : copy(locale, step)}</Heading>
      {step === 'service' ? <View accessibilityRole="radiogroup" style={styles.stack}>
        {operationalServices.map((item) => <Choice key={item.id} label={item.title[locale]} selected={item.id === serviceId} onPress={() => save({ serviceId: item.id, step: 'district' })} />)}
      </View> : null}
      {step === 'district' ? <View accessibilityRole="radiogroup" style={styles.stack}>
        {operationalDistricts.map((item) => <Choice key={item.id} label={item.title[locale]} selected={item.id === districtId} onPress={() => save({ districtId: item.id, step: 'date' })} />)}
      </View> : null}
      {step === 'date' ? <>
        <View accessibilityRole="radiogroup" style={styles.stack}>{dates.slice(0, maxDates).map((day) => <Choice key={day} label={formatDate(day, locale)} selected={day === date} onPress={() => selectDate(day)} />)}</View>
        {maxDates < dates.length ? <Button label={copy(locale, 'datesLater')} kind="quiet" onPress={() => setMaxDates((count) => count + 7)} /> : null}
      </> : null}
      {step === 'slot' ? <>
        <Label>{copy(locale, 'timeZone')}</Label>
        {availableSlots.length ? <View accessibilityRole="radiogroup" style={styles.stack}>{availableSlots.map((item) => <Choice key={item.id} label={item.title[locale]} selected={item.id === slotId} onPress={() => save({ slotId: item.id, step: uid ? 'note' : 'review' })} />)}</View> : <Label>{copy(locale, 'noSlots')}</Label>}
      </> : null}
      {step === 'note' ? <>
        <Label>{copy(locale, 'noteHelp')}</Label>
        <MultiLineEntry label={t(locale, 'noteTitle')} value={note} onChange={(value) => save({ note: value })} busy={busy} />
        <Button label={copy(locale, 'review')} onPress={() => save({ step: 'review' })} />
      </> : null}
      {step === 'review' && valid ? <>
        <HelpDetails locale={locale} serviceId={serviceId!} districtId={districtId!} date={date} slotId={slotId!} />
        {note.trim() ? <KeyValue label={t(locale, 'noteTitle')} value={note.trim()} /> : null}
        <Label>{copy(locale, 'helpPrivacy')}</Label>
        {!uid ? <Label>{copy(locale, 'guestHelpSignIn')}</Label> : null}
        <Button label={uid ? copy(locale, submitted ? 'retryCreate' : 'submit') : t(locale, 'signIn')} disabled={busy || storageBusy || askDiscard} onPress={submitDraft} />
      </> : null}
      {step !== 'service' && !submitted ? <Button label={copy(locale, 'previousStep')} kind="secondary" disabled={busy} onPress={goBack} /> : null}
      {submitted && !askDiscard ? <Button label={copy(locale, 'discardPending')} kind="quiet" disabled={busy} onPress={() => setAskDiscard(true)} /> : null}
      {askDiscard ? <>
        <Label>{copy(locale, 'discardPendingConfirm')}</Label>
        <Button label={copy(locale, 'confirm')} kind="danger" disabled={storageBusy} onPress={() => void discard()} />
        <Button label={t(locale, 'back')} kind="secondary" disabled={storageBusy} onPress={() => setAskDiscard(false)} />
      </> : null}
    </Card>
  </Screen>;
}

type HelpKind = 'resident' | 'assigned' | 'queue';
type HelpListProps = {
  locale: Locale; rows: OperationalHelp[]; empty: OperationalCopyKey; kind: HelpKind; uid: string; repo: Operations;
  confirm: (value: Confirmation) => void; mutate: Mutate; busy: boolean;
};

export function HelpList({ rows, empty, ...props }: HelpListProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 20_000); return () => clearInterval(timer); }, []);
  if (rows.length === 0) return <Label>{copy(props.locale, empty)}</Label>;
  const sorted = [...rows].sort((a, b) => props.kind === 'queue' ? a.startsAt.localeCompare(b.startsAt) : b.createdAt.localeCompare(a.createdAt));
  return sorted.map((row) => <HelpCard key={row.id} row={row} now={now} {...props} />);
}

function HelpCard({ row, now, locale, kind, uid, repo, confirm, mutate, busy }: Omit<HelpListProps, 'rows' | 'empty'> & { row: OperationalHelp; now: number }) {
  const [showCoordination, setShowCoordination] = useState(false);
  const canSeeCoordination = kind === 'resident' || kind === 'assigned' && row.status === 'claimed';
  const action = kind === 'queue' && row.status === 'open' ? { key: 'claim', body: 'claimConfirm', run: () => repo.claimHelp(uid, row.id) } as const
    : kind === 'assigned' && row.status === 'claimed' ? { key: 'complete', body: 'completeConfirm', run: () => repo.completeHelp(uid, row.id) } as const
      : kind === 'resident' && (row.status === 'open' || row.status === 'claimed') ? { key: 'withdraw', body: 'withdrawConfirm', run: () => repo.cancelHelp(uid, row.id), danger: true } as const
        : null;
  return <Card>
    <Heading level="section">{serviceTitle(row.serviceId, locale)}</Heading>
    <StatusTag label={copy(locale, row.status === 'open' && Date.parse(row.startsAt) <= now ? 'expired' : row.status)} variant={row.status === 'cancelled' ? 'cancelled' : row.status === 'completed' ? 'available' : undefined} />
    <KeyValue label={copy(locale, 'districtName')} value={districtTitle(row.districtId, locale)} />
    <KeyValue label={copy(locale, 'dateName')} value={formatDate(row.date, locale)} />
    <KeyValue label={copy(locale, 'timeZone')} value={slotTitle(row.slotId, locale)} />
    {canSeeCoordination && !showCoordination ? <Button label={copy(locale, 'coordination')} kind={row.status === 'claimed' ? 'primary' : 'secondary'} onPress={() => setShowCoordination(true)} disabled={busy} /> : null}
    {canSeeCoordination && showCoordination ? <Coordination key={`${row.id}:${row.status}`} locale={locale} uid={uid} id={row.id} repo={repo} enabled={row.status === 'claimed'} busy={busy} mutate={mutate} /> : null}
    {action ? <Button label={copy(locale, action.key)} disabled={busy} kind={('danger' in action) ? 'danger' : 'secondary'} onPress={() => confirm({ action: action.key, body: action.body, run: action.run, summary: (language) => helpSummary(row, language), danger: 'danger' in action })} /> : null}
  </Card>;
}

function Coordination({ locale, uid, id, repo, enabled, busy, mutate }: { locale: Locale; uid: string; id: string; repo: Operations; enabled: boolean; busy: boolean; mutate: Mutate }) {
  const [message, setMessage] = useState('');
  const read = useCallback(() => repo.getCoordination(uid, id), [repo, uid, id]);
  const resource = useOperationalResource(read);
  const send = async () => {
    if (!message.trim()) return;
    if (await mutate(() => repo.sendCoordination(uid, id, message.trim()))) { setMessage(''); resource.refresh(); }
  };
  return <View style={styles.stack}>
    <Heading level="section">{copy(locale, 'coordination')}</Heading>
    <ResourceState locale={locale} {...resource} />
    {resource.data ? <>
      {resource.data.note ? <KeyValue label={t(locale, 'noteTitle')} value={resource.data.note} /> : null}
      {resource.data.residentMessage ? <KeyValue label={copy(locale, 'residentUpdate')} value={resource.data.residentMessage} /> : null}
      {resource.data.volunteerMessage ? <KeyValue label={copy(locale, 'volunteerUpdate')} value={resource.data.volunteerMessage} /> : null}
      {!resource.data.residentMessage && !resource.data.volunteerMessage ? <Label>{copy(locale, 'noMessages')}</Label> : null}
      {enabled ? <>
        <Label>{copy(locale, 'coordinationHelp')}</Label><Label>{copy(locale, 'message')}</Label>
        <MultiLineEntry label={copy(locale, 'message')} value={message} onChange={setMessage} busy={busy} />
        <Button label={copy(locale, 'send')} disabled={busy || resource.loading || !message.trim()} onPress={() => void send()} />
      </> : null}
    </> : null}
    {!resource.error ? <Button label={t(locale, 'volunteerRefresh')} kind="quiet" onPress={resource.refresh} disabled={busy || resource.loading} /> : null}
  </View>;
}

function meetingState(meeting: OperationalMeeting): 'cancelled' | 'closed' | 'full' | 'places' {
  if (meeting.status !== 'open') return meeting.status;
  if (Date.parse(meeting.startsAt) <= Date.now()) return 'closed';
  return meeting.enrolledCount >= meeting.capacity ? 'full' : 'places';
}

type MeetingsProps = { locale: Locale; meetings: OperationalMeeting[]; repo: Operations; confirm: (value: Confirmation) => void; busy: boolean };

export function MeetingList({ locale, meetings, enrollments, uid, repo, confirm, signIn, selectedMeeting, onSelectionReviewed, busy }: MeetingsProps & {
  enrollments: OperationalEnrollment[] | null; uid?: string; signIn: (meeting: OperationalMeeting) => void;
  selectedMeeting?: OperationalMeeting; onSelectionReviewed: () => void;
}) {
  const selectedAvailable = selectedMeeting && meetings.some((meeting) => meeting.id === selectedMeeting.id);
  const rows = [...meetings].sort((a, b) => a.id === selectedMeeting?.id ? -1 : b.id === selectedMeeting?.id ? 1 : a.startsAt.localeCompare(b.startsAt));
  return <>
    {selectedMeeting && !selectedAvailable ? <ErrorNotice>{copy(locale, 'meetingUnpublished')}</ErrorNotice> : null}
    {!rows.length ? <Label>{copy(locale, 'emptyMeetings')}</Label> : null}
    {rows.map((meeting) => {
    const state = meetingState(meeting);
    const wasSelected = selectedMeeting?.id === meeting.id;
    const changedAfterSignIn = wasSelected && (meeting.startsAt !== selectedMeeting.startsAt
      || meeting.title.ru !== selectedMeeting.title.ru || meeting.title.kz !== selectedMeeting.title.kz
      || meeting.place.ru !== selectedMeeting.place.ru || meeting.place.kz !== selectedMeeting.place.kz);
    const alreadyEnrolled = enrollments?.some((item) => item.meetingId === meeting.id && item.status === 'enrolled');
    const enroll = () => {
      if (!uid) { signIn(meeting); return; }
      confirm({ action: 'enroll', body: 'enrollConfirm', summary: (language) => meetingSummary(meeting, language), run: async () => {
        const previous = enrollments?.filter((entry) => entry.meetingId === meeting.id).map((entry) => entry.id) ?? [];
        const id = await ensureEnrollmentOperation(uid, meeting.id, previous);
        await repo.enrollMeeting(uid, meeting.id, id, meeting);
        onSelectionReviewed();
      } });
    };
    return <Card key={meeting.id}>
      {wasSelected ? <StatusTag label={copy(locale, changedAfterSignIn ? 'rescheduled' : 'selectedMeeting')} /> : null}
      <Heading level="section">{meeting.title[locale]}</Heading>
      <Label>{meeting.description[locale]}</Label>
      <KeyValue label={copy(locale, 'timeZone')} value={formatMeetingTime(meeting.startsAt, locale)} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={meeting.place[locale]} />
      <StatusTag label={state === 'places' ? `${copy(locale, state)}: ${meeting.capacity - meeting.enrolledCount}` : copy(locale, state)} variant={state === 'places' ? 'available' : state === 'full' ? 'full' : 'cancelled'} />
      {alreadyEnrolled ? <StatusTag label={copy(locale, 'enrolled')} /> : state === 'places' ? <Button label={copy(locale, 'enroll')} onPress={enroll} disabled={busy || Boolean(uid && !enrollments)} /> : null}
    </Card>;
    })}
  </>;
}

export function EnrollmentList({ locale, enrollments, meetings, uid, repo, confirm, busy }: Omit<MeetingsProps, 'meetings'> & { meetings: OperationalMeeting[] | null; enrollments: OperationalEnrollment[]; uid: string }) {
  if (!enrollments.length) return <Label>{copy(locale, 'emptyEnrollments')}</Label>;
  return [...enrollments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((entry) => {
    const meeting = meetings?.find((item) => item.id === entry.meetingId);
    const current = entry.status === 'enrolled' ? meeting : undefined;
    const title = current?.title[locale] ?? entry.title[locale];
    const startsAt = current?.startsAt ?? entry.startsAt;
    const place = current?.place[locale] ?? entry.place[locale];
    const changed = Boolean(current && (startsAt !== entry.startsAt || place !== entry.place[locale] || title !== entry.title[locale]));
    return <Card key={entry.id}>
      <Heading level="section">{title}</Heading>
      <StatusTag label={copy(locale, entry.status)} variant={entry.status === 'cancelled' ? 'cancelled' : 'available'} />
      {current?.status === 'cancelled' ? <ErrorNotice>{copy(locale, 'meetingCancelled')}</ErrorNotice> : null}
      {!current && entry.status === 'enrolled' ? <Label>{copy(locale, meetings === null ? 'meetingUnknown' : 'meetingUnpublished')}</Label> : null}
      {changed ? <>
        <StatusTag label={copy(locale, 'rescheduled')} />
        <KeyValue label={copy(locale, 'originalTime')} value={`${formatMeetingTime(entry.startsAt, locale)} · ${entry.place[locale]}`} />
      </> : null}
      <KeyValue label={changed ? copy(locale, 'currentTime') : !current ? copy(locale, 'originalTime') : copy(locale, 'timeZone')} value={formatMeetingTime(startsAt, locale)} />
      <KeyValue label={t(locale, 'eventPlaceLabel')} value={place} />
      {entry.status === 'enrolled' ? <Button label={copy(locale, 'unenroll')} kind="danger" disabled={busy} onPress={() => confirm({ action: 'unenroll', body: 'unenrollConfirm', summary: (language) => meetingSummary(current ?? entry, language), danger: true, run: () => repo.cancelEnrollment(uid, entry.meetingId, entry.id) })} /> : null}
    </Card>;
  });
}

const styles = StyleSheet.create({
  stack: { gap: theme.spacing.md },
  input: { minHeight: 110, borderWidth: 2, borderColor: theme.colors.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, color: theme.colors.text, backgroundColor: theme.colors.surface, textAlignVertical: 'top' },
});
