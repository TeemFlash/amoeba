import {
  Timestamp, collection, doc, getDocFromServer, getDocsFromServer, increment, query, runTransaction, serverTimestamp,
  where, type DocumentData, type Firestore,
} from 'firebase/firestore';
import type { AccountRole } from './volunteers';

export const operationalServices = [
  { id: 'groceries', title: { ru: 'Помощь с покупками', kz: 'Сатып алуға көмек' } },
  { id: 'home-help', title: { ru: 'Помощь по дому', kz: 'Үй шаруасына көмек' } },
  { id: 'digital-help', title: { ru: 'Подсказка с телефоном', kz: 'Телефонға қатысты кеңес' } },
] as const;

export const operationalDistricts = [
  { id: 'astana-esil', title: { ru: 'Есиль', kz: 'Есіл' } },
  { id: 'astana-almaty', title: { ru: 'Алматы', kz: 'Алматы' } },
  { id: 'astana-saryarka', title: { ru: 'Сарыарка', kz: 'Сарыарқа' } },
  { id: 'astana-baikonur', title: { ru: 'Байқоңыр', kz: 'Байқоңыр' } },
  { id: 'astana-nura', title: { ru: 'Нұра', kz: 'Нұра' } },
  { id: 'astana-saraiyshyk', title: { ru: 'Сарайшық', kz: 'Сарайшық' } },
] as const;

export const operationalSlots = [
  { id: '10-12', title: { ru: '10:00–12:00', kz: '10:00–12:00' } },
  { id: '14-16', title: { ru: '14:00–16:00', kz: '14:00–16:00' } },
] as const;

type ServiceId = typeof operationalServices[number]['id'];
type DistrictId = typeof operationalDistricts[number]['id'];
type SlotId = typeof operationalSlots[number]['id'];
type Bilingual = { ru: string; kz: string };

export interface OperationalHelpInput {
  operationId: string;
  serviceId: ServiceId;
  districtId: DistrictId;
  slotId: SlotId;
  date: string;
  note: string;
}

export interface OperationalHelp extends Omit<OperationalHelpInput, 'note'> {
  id: string;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  createdAt: string;
  startsAt: string;
}

export interface OperationalCoordination {
  note: string;
  residentMessage: string;
  volunteerMessage: string;
}

export interface OperationalMeeting {
  id: string;
  title: Bilingual;
  description: Bilingual;
  place: Bilingual;
  startsAt: string;
  status: 'open' | 'closed' | 'cancelled';
  capacity: number;
  enrolledCount: number;
}

export interface OperationalEnrollment {
  id: string;
  meetingId: string;
  title: Bilingual;
  place: Bilingual;
  startsAt: string;
  status: 'enrolled' | 'cancelled';
  createdAt: string;
  cancelledAt: string | null;
}

export type ReviewedMeeting = Pick<OperationalMeeting, 'title' | 'place' | 'startsAt'>;

export type OperationalErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'UNAVAILABLE' | 'CAPACITY'
  | 'ALREADY_ENROLLED' | 'CONFLICT' | 'ACCESS_DENIED' | 'DATA_CORRUPT' | 'REMOTE_FAILED';

export class OperationalError extends Error {
  constructor(readonly code: OperationalErrorCode) { super(code); }
}

const astanaOffset = 5 * 60 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const documentId = /^[A-Za-z0-9_-]{1,128}$/;
const maximumTextLength = 300;

function astanaDate(time: number): string {
  return new Date(time + astanaOffset).toISOString().slice(0, 10);
}

export function getOperationalDates(now = new Date()): string[] {
  return Array.from({ length: 31 }, (_, index) => astanaDate(now.getTime() + index * day));
}

function slotStart(date: string, slotId: string): number {
  if (!isoDate.test(date) || !operationalSlots.some((slot) => slot.id === slotId)) return NaN;
  const startsAt = Date.parse(date + 'T' + slotId.slice(0, 2) + ':00:00+05:00');
  return Number.isFinite(startsAt) && astanaDate(startsAt) === date ? startsAt : NaN;
}

export function isOperationalSlotAvailable(date: string, slotId: string, now = new Date()): boolean {
  const startsAt = slotStart(date, slotId);
  return startsAt > now.getTime() && date <= astanaDate(now.getTime() + 30 * day);
}

function requireIds(...ids: string[]) {
  if (ids.some((id) => !documentId.test(id) || /^__.*__$/.test(id))) throw new OperationalError('INVALID_INPUT');
}

function requireUid(uid: string) {
  if (!uid || uid.includes('/') || uid === '.' || uid === '..') throw new OperationalError('ACCESS_DENIED');
}

function timestamp(value: unknown): string {
  if (!(value instanceof Timestamp)) throw new OperationalError('DATA_CORRUPT');
  return value.toDate().toISOString();
}

function isText(value: unknown, max: number, min = 0): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function bilingual(value: unknown, max: number): Bilingual {
  if (!value || typeof value !== 'object' || !('ru' in value) || !('kz' in value)
    || !isText(value.ru, max, 1) || !isText(value.kz, max, 1)
    || !value.ru.trim() || !value.kz.trim()) throw new OperationalError('DATA_CORRUPT');
  return { ru: value.ru, kz: value.kz };
}

function parseHelp(id: string, data: DocumentData): OperationalHelp {
  const { serviceId, districtId, slotId, status } = data;
  const startsAt = timestamp(data.startsAt);
  const date = astanaDate(Date.parse(startsAt));
  if (!operationalServices.some((item) => item.id === serviceId)
    || !operationalDistricts.some((item) => item.id === districtId)
    || slotStart(date, slotId) !== Date.parse(startsAt)
    || !['open', 'claimed', 'completed', 'cancelled'].includes(status)) throw new OperationalError('DATA_CORRUPT');
  return { id, operationId: id, serviceId, districtId, slotId, date, startsAt, status, createdAt: timestamp(data.createdAt) };
}

function parseCoordination(data: DocumentData): OperationalCoordination {
  const { note, residentMessage, volunteerMessage } = data;
  if (!isText(note, maximumTextLength) || !isText(residentMessage, maximumTextLength) || !isText(volunteerMessage, maximumTextLength)) {
    throw new OperationalError('DATA_CORRUPT');
  }
  return { note, residentMessage, volunteerMessage };
}

function parseMeeting(id: string, data: DocumentData): OperationalMeeting {
  const { status, capacity, enrolledCount } = data;
  if (!['open', 'closed', 'cancelled'].includes(status) || !Number.isSafeInteger(capacity) || capacity < 1
    || !Number.isSafeInteger(enrolledCount) || enrolledCount < 0) throw new OperationalError('DATA_CORRUPT');
  return {
    id, status, capacity, enrolledCount, startsAt: timestamp(data.startsAt),
    title: bilingual(data.title, 150), place: bilingual(data.place, 300), description: bilingual(data.description, 1000),
  };
}

function parseEnrollment(id: string, data: DocumentData): OperationalEnrollment {
  const { meetingId, status, cancelledAt } = data;
  if (typeof meetingId !== 'string' || !documentId.test(meetingId)
    || !(status === 'enrolled' && cancelledAt === null || status === 'cancelled' && cancelledAt instanceof Timestamp)) {
    throw new OperationalError('DATA_CORRUPT');
  }
  return {
    id, meetingId, status, startsAt: timestamp(data.startsAt), createdAt: timestamp(data.createdAt),
    cancelledAt: cancelledAt === null ? null : timestamp(cancelledAt),
    title: bilingual(data.title, 150), place: bilingual(data.place, 300),
  };
}

function sameMeetingDetails(reviewed: ReviewedMeeting, current: ReviewedMeeting): boolean {
  return reviewed.startsAt === current.startsAt
    && reviewed.title.ru === current.title.ru && reviewed.title.kz === current.title.kz
    && reviewed.place.ru === current.place.ru && reviewed.place.kz === current.place.kz;
}

async function remote<T>(action: () => Promise<T>, onDenied: OperationalErrorCode = 'ACCESS_DENIED'): Promise<T> {
  try {
    return await action();
  } catch (error: unknown) {
    if (error instanceof OperationalError) throw error;
    const code = (error as { code?: string } | null)?.code;
    throw new OperationalError(code === 'permission-denied' ? onDenied : 'REMOTE_FAILED');
  }
}

export function createOperationsRepository(db: Firestore) {
  const help = (id: string) => doc(db, 'operationalHelp', id);
  const coordination = (id: string) => doc(db, 'operationalHelpPrivate', id);
  const ownerLink = (uid: string, id: string) => doc(db, 'users', uid, 'operationalHelpLinks', id);
  const meeting = (id: string) => doc(db, 'operationalMeetings', id);
  const enrollment = (uid: string, id: string) => doc(db, 'users', uid, 'operationalEnrollments', id);
  const seat = (uid: string, id: string) => doc(db, 'users', uid, 'operationalMeetingSeats', id);

  async function changeHelp(uid: string, id: string, status: 'claimed' | 'completed' | 'cancelled'): Promise<void> {
    requireUid(uid);
    requireIds(id);
    await remote(() => runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(help(id));
      if (!snapshot.exists()) throw new OperationalError('NOT_FOUND');
      const data = snapshot.data();
      const current = parseHelp(id, data);
      if (current.status === status && (status === 'cancelled' || data.claimedBy === uid)) return;
      if (status === 'claimed' && current.status === 'open' && Date.parse(current.startsAt) > Date.now()) {
        transaction.update(help(id), { status, claimedBy: uid, claimedAt: serverTimestamp() });
      } else if (status === 'completed' && current.status === 'claimed' && data.claimedBy === uid) {
        transaction.update(help(id), { status, endedAt: serverTimestamp() });
      } else if (status === 'cancelled' && (current.status === 'open' || current.status === 'claimed')) {
        transaction.update(help(id), { status, endedAt: serverTimestamp() });
      } else {
        throw new OperationalError('UNAVAILABLE');
      }
    }), status === 'claimed' ? 'UNAVAILABLE' : 'ACCESS_DENIED');
  }

  async function listVolunteerHelp(uid: string, open: boolean): Promise<OperationalHelp[]> {
    requireUid(uid);
    return remote(async () => {
      const filter = open ? where('status', '==', 'open') : where('claimedBy', '==', uid);
      const results = await getDocsFromServer(query(collection(db, 'operationalHelp'), filter));
      const entries = results.docs.map((item) => parseHelp(item.id, item.data()));
      return (open ? entries.filter((item) => Date.parse(item.startsAt) > Date.now()) : entries)
        .sort((a, b) => open ? a.startsAt.localeCompare(b.startsAt) : b.createdAt.localeCompare(a.createdAt));
    });
  }

  return {
    async createHelp(uid: string, input: OperationalHelpInput): Promise<OperationalHelp> {
      requireUid(uid);
      const { operationId: id, serviceId, districtId, slotId, date, note } = input;
      requireIds(id);
      if (!operationalServices.some((item) => item.id === serviceId) || !operationalDistricts.some((item) => item.id === districtId)
        || !isText(note, maximumTextLength) || !Number.isFinite(slotStart(date, slotId))) throw new OperationalError('INVALID_INPUT');
      return remote(async () => {
        await runTransaction(db, async (transaction) => {
          const link = await transaction.get(ownerLink(uid, id));
          if (link.exists()) {
            const [existing, details] = await Promise.all([transaction.get(help(id)), transaction.get(coordination(id))]);
            if (!existing.exists() || !details.exists()) throw new OperationalError('DATA_CORRUPT');
            const saved = parseHelp(id, existing.data());
            if (saved.serviceId !== serviceId || saved.districtId !== districtId || saved.slotId !== slotId
              || saved.date !== date || parseCoordination(details.data()).note !== note.trim()) throw new OperationalError('CONFLICT');
            return;
          }
          if (!isOperationalSlotAvailable(date, slotId)) throw new OperationalError('UNAVAILABLE');
          transaction.set(help(id), {
            serviceId, districtId, slotId, startsAt: Timestamp.fromMillis(slotStart(date, slotId)), status: 'open',
            createdAt: serverTimestamp(), claimedBy: null, claimedAt: null, endedAt: null,
          });
          transaction.set(coordination(id), {
            note: note.trim(), residentMessage: '', volunteerMessage: '',
            residentMessageAt: null, volunteerMessageAt: null,
          });
          transaction.set(ownerLink(uid, id), { createdAt: serverTimestamp() });
        });
        const saved = await getDocFromServer(help(id));
        if (!saved.exists()) throw new OperationalError('DATA_CORRUPT');
        return parseHelp(id, saved.data());
      });
    },
    async listResidentHelp(uid: string): Promise<OperationalHelp[]> {
      requireUid(uid);
      return remote(async () => {
        const links = await getDocsFromServer(collection(db, 'users', uid, 'operationalHelpLinks'));
        const entries = await Promise.all(links.docs.map(async ({ id }) => {
          const saved = await getDocFromServer(help(id));
          if (!saved.exists()) throw new OperationalError('DATA_CORRUPT');
          return parseHelp(id, saved.data());
        }));
        return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
    listOpenHelp: (uid: string) => listVolunteerHelp(uid, true),
    listVolunteerHelp: (uid: string) => listVolunteerHelp(uid, false),
    claimHelp: (uid: string, id: string) => changeHelp(uid, id, 'claimed'),
    completeHelp: (uid: string, id: string) => changeHelp(uid, id, 'completed'),
    cancelHelp: (uid: string, id: string) => changeHelp(uid, id, 'cancelled'),
    async getCoordination(uid: string, id: string): Promise<OperationalCoordination> {
      requireUid(uid);
      requireIds(id);
      return remote(async () => {
        const details = await getDocFromServer(coordination(id));
        if (!details.exists()) throw new OperationalError('NOT_FOUND');
        return parseCoordination(details.data());
      });
    },
    async sendCoordination(uid: string, id: string, message: string): Promise<void> {
      requireUid(uid);
      requireIds(id);
      if (!isText(message, maximumTextLength, 1) || !message.trim()) throw new OperationalError('INVALID_INPUT');
      await remote(() => runTransaction(db, async (transaction) => {
        const [record, details] = await Promise.all([transaction.get(help(id)), transaction.get(coordination(id))]);
        if (!record.exists() || !details.exists()) throw new OperationalError('NOT_FOUND');
        if (record.data().status !== 'claimed') throw new OperationalError('UNAVAILABLE');
        const role: AccountRole = record.data().claimedBy === uid ? 'volunteer' : 'resident';
        transaction.update(coordination(id), {
          [role + 'Message']: message.trim(),
          [role + 'MessageAt']: serverTimestamp(),
        });
      }));
    },
    async listMeetings(): Promise<OperationalMeeting[]> {
      return remote(async () => {
        const results = await getDocsFromServer(query(collection(db, 'operationalMeetings'), where('published', '==', true)));
        return results.docs.map((item) => parseMeeting(item.id, item.data())).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      });
    },
    async listEnrollments(uid: string): Promise<OperationalEnrollment[]> {
      requireUid(uid);
      return remote(async () => {
        const results = await getDocsFromServer(collection(db, 'users', uid, 'operationalEnrollments'));
        return results.docs.map((item) => parseEnrollment(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    },
    async enrollMeeting(uid: string, meetingId: string, operationId: string, reviewed: ReviewedMeeting): Promise<void> {
      requireUid(uid);
      requireIds(meetingId, operationId);
      await remote(() => runTransaction(db, async (transaction) => {
        const existing = await transaction.get(enrollment(uid, operationId));
        if (existing.exists()) {
          if (parseEnrollment(operationId, existing.data()).meetingId !== meetingId) throw new OperationalError('CONFLICT');
          return;
        }
        const active = await transaction.get(seat(uid, meetingId));
        if (active.data()?.status === 'enrolled') throw new OperationalError('ALREADY_ENROLLED');
        const current = await transaction.get(meeting(meetingId));
        if (!current.exists()) throw new OperationalError('NOT_FOUND');
        const data = current.data();
        const entry = parseMeeting(meetingId, data);
        if (data.published !== true || entry.status !== 'open' || Date.parse(entry.startsAt) <= Date.now()) {
          throw new OperationalError('UNAVAILABLE');
        }
        if (!sameMeetingDetails(reviewed, entry)) throw new OperationalError('CONFLICT');
        if (entry.enrolledCount >= entry.capacity) throw new OperationalError('CAPACITY');
        transaction.set(enrollment(uid, operationId), {
          meetingId, title: data.title, place: data.place, startsAt: data.startsAt,
          status: 'enrolled', createdAt: serverTimestamp(), cancelledAt: null,
        });
        transaction.set(seat(uid, meetingId), { operationId, status: 'enrolled' });
        transaction.update(meeting(meetingId), { enrolledCount: entry.enrolledCount + 1 });
      }), 'UNAVAILABLE');
    },
    async cancelEnrollment(uid: string, meetingId: string, operationId: string): Promise<void> {
      requireUid(uid);
      requireIds(meetingId, operationId);
      const cancel = (updateCounter: boolean) => runTransaction(db, async (transaction) => {
        const existing = await transaction.get(enrollment(uid, operationId));
        if (!existing.exists()) throw new OperationalError('NOT_FOUND');
        const saved = parseEnrollment(operationId, existing.data());
        if (saved.meetingId !== meetingId) throw new OperationalError('CONFLICT');
        if (saved.status === 'cancelled') return;
        if (updateCounter) transaction.update(meeting(meetingId), { enrolledCount: increment(-1) });
        transaction.update(enrollment(uid, operationId), { status: 'cancelled', cancelledAt: serverTimestamp() });
        transaction.update(seat(uid, meetingId), { status: 'cancelled' });
      });
      await remote(async () => {
        try {
          await cancel(true);
        } catch (error) {
          const code = (error as { code?: string } | null)?.code;
          if (code !== 'not-found' && code !== 'permission-denied') throw error;
          // The rules permit cancellation without a counter write only after trusted removal.
          await cancel(false);
        }
      });
    },
  };
}
