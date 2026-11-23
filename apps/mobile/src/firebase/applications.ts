import {
  collection, doc, getDocFromServer, getDocsFromServer, runTransaction, serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { dateIds, districts, events, services, slots } from '../domain/catalog';
import type { Entry, EventId, ServiceId, DistrictId, SlotId, DateId } from '../domain/types';
import { applicationToFirestore, parseCloudApplication } from './firestoreSerialization';

export type ApplicationIntent =
  | { uid: string; operationId: string; kind: 'help'; serviceId: ServiceId; districtId: DistrictId; slotId: SlotId; dateId?: never; note?: never }
  | { uid: string; operationId: string; kind: 'help'; serviceId: ServiceId; districtId: DistrictId; slotId: SlotId; dateId: DateId; note: string }
  | { uid: string; operationId: string; kind: 'event'; eventId: EventId };

export type CloudErrorCode = 'AUTH_REQUIRED' | 'INVALID_INTENT' | 'DATA_CORRUPT' | 'ALREADY_ENROLLED' | 'NOT_FOUND' | 'REMOTE_FAILED';
export class CloudApplicationError extends Error {
  constructor(readonly code: CloudErrorCode, readonly existingEntryId?: string) { super(code); }
}

function paths(db: Firestore, uid: string) {
  return { apps: collection(db, 'users', uid, 'applications'), events: collection(db, 'users', uid, 'activeEvents') };
}
function appRef(db: Firestore, uid: string, operationId: string) { return doc(db, 'users', uid, 'applications', operationId); }
function eventRef(db: Firestore, uid: string, eventId: string) { return doc(db, 'users', uid, 'activeEvents', eventId); }
function helpCallRef(db: Firestore, operationId: string) { return doc(db, 'helpCalls', operationId); }
function helpCallLinkRef(db: Firestore, uid: string, operationId: string) { return doc(db, 'users', uid, 'helpCallLinks', operationId); }
function requireUid(uid: string) { if (!uid) throw new CloudApplicationError('AUTH_REQUIRED'); }
async function requireResident(db: Firestore, uid: string) {
  const grant = await getDocFromServer(doc(db, 'volunteerRoles', uid));
  if (grant.exists()) throw new CloudApplicationError('AUTH_REQUIRED');
}
function parseSnapshot(id: string, data: unknown): Entry {
  const entry = parseCloudApplication(id, data);
  if (!entry) throw new CloudApplicationError('DATA_CORRUPT');
  return entry;
}
function isMatchingIntent(entry: Entry, intent: ApplicationIntent) {
  if (entry.kind !== intent.kind) return false;
  return intent.kind === 'help'
    ? entry.kind === 'help' && entry.serviceId === intent.serviceId && entry.districtId === intent.districtId && entry.slotId === intent.slotId
      && entry.dateId === intent.dateId && entry.note === intent.note
    : entry.kind === 'event' && entry.eventId === intent.eventId;
}
function newEntry(intent: ApplicationIntent): Entry {
  const common = { id: `DEMO-${intent.operationId}`, operationId: intent.operationId, status: 'saved-demo' as const, createdAt: new Date(0).toISOString(), cancelledAt: null };
  if (intent.kind === 'event') return { ...common, kind: 'event', eventId: intent.eventId };
  const selection = { ...common, kind: 'help' as const, serviceId: intent.serviceId, districtId: intent.districtId, slotId: intent.slotId };
  return intent.dateId !== undefined
    ? { ...selection, dateId: intent.dateId, note: intent.note }
    : selection;
}
function validateIntent(intent: ApplicationIntent) {
  if (!intent.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(intent.operationId)) throw new CloudApplicationError('INVALID_INTENT');
  if (intent.kind === 'event' && !events.some((event) => event.id === intent.eventId && event.availability === 'open')) throw new CloudApplicationError('INVALID_INTENT');
  if (intent.kind === 'help' && !services.some((service) => service.id === intent.serviceId)) throw new CloudApplicationError('INVALID_INTENT');
  if (intent.kind === 'help' && !districts.some((district) => district.id === intent.districtId)) throw new CloudApplicationError('INVALID_INTENT');
  if (intent.kind === 'help' && !slots.some((slot) => slot.id === intent.slotId)) throw new CloudApplicationError('INVALID_INTENT');
  if (intent.kind === 'help') {
    const hasDate = Object.hasOwn(intent, 'dateId');
    const hasNote = Object.hasOwn(intent, 'note');
    if (hasDate !== hasNote || hasDate && (!dateIds.has(intent.dateId as DateId) || typeof intent.note !== 'string' || intent.note.length > 280)) throw new CloudApplicationError('INVALID_INTENT');
  }
}

export function createApplicationsRepository(db: Firestore) {
  return {
    async list(uid: string): Promise<Entry[]> {
      requireUid(uid);
      try {
        await requireResident(db, uid);
        const snapshot = await getDocsFromServer(paths(db, uid).apps);
        return snapshot.docs.map((item) => parseSnapshot(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (error) {
        if (error instanceof CloudApplicationError) throw error;
        throw new CloudApplicationError('REMOTE_FAILED');
      }
    },
    async submit(intent: ApplicationIntent): Promise<Entry> {
      requireUid(intent.uid);
      validateIntent(intent);
      try { await requireResident(db, intent.uid); }
      catch (error) { if (error instanceof CloudApplicationError) throw error; throw new CloudApplicationError('REMOTE_FAILED'); }
      const ref = appRef(db, intent.uid, intent.operationId);
      try {
        const priorEntry = await runTransaction(db, async (transaction): Promise<Entry | null> => {
          const priorSnap = await transaction.get(ref);
          if (priorSnap.exists()) {
            const prior = parseSnapshot(intent.operationId, priorSnap.data());
            if (!isMatchingIntent(prior, intent)) throw new CloudApplicationError('INVALID_INTENT');
            return prior;
          }
          if (intent.kind === 'help') {
            transaction.set(helpCallLinkRef(db, intent.uid, intent.operationId), { operationId: intent.operationId });
          }
          if (intent.kind === 'event') {
            const pointerRef = eventRef(db, intent.uid, intent.eventId);
            const pointerSnap = await transaction.get(pointerRef);
            if (pointerSnap.exists()) {
              const pointer = pointerSnap.data();
              const priorOperationId = typeof pointer.operationId === 'string' ? pointer.operationId : '';
              const priorRef = priorOperationId ? appRef(db, intent.uid, priorOperationId) : null;
              const activeSnap = priorRef ? await transaction.get(priorRef) : null;
              if (!activeSnap?.exists()) throw new CloudApplicationError('DATA_CORRUPT');
              const prior = parseSnapshot(priorOperationId, activeSnap.data());
              if (prior.kind !== 'event' || prior.eventId !== intent.eventId || prior.status !== 'saved-demo') throw new CloudApplicationError('DATA_CORRUPT');
              throw new CloudApplicationError('ALREADY_ENROLLED', prior.id);
            }
          }
          const entry = newEntry(intent);
          transaction.set(ref, applicationToFirestore(entry, serverTimestamp()));
          if (intent.kind === 'help') {
            transaction.set(helpCallRef(db, intent.operationId), {
              serviceId: intent.serviceId, districtId: intent.districtId, slotId: intent.slotId,
              dateId: intent.dateId ?? null, status: 'open', claimedBy: null,
              createdAt: serverTimestamp(), claimedAt: null,
            });
          }
          if (intent.kind === 'event') {
            transaction.set(eventRef(db, intent.uid, intent.eventId), { operationId: intent.operationId, applicationId: entry.id });
          }
          return null;
        });
        if (priorEntry) return priorEntry;
        const saved = await getDocFromServer(ref);
        if (!saved.exists()) throw new CloudApplicationError('REMOTE_FAILED');
        return parseSnapshot(intent.operationId, saved.data());
      } catch (error) {
        if (error instanceof CloudApplicationError) throw error;
        throw new CloudApplicationError('REMOTE_FAILED');
      }
    },
    async cancel(uid: string, entryId: string): Promise<Entry> {
      requireUid(uid);
      try { await requireResident(db, uid); }
      catch (error) { if (error instanceof CloudApplicationError) throw error; throw new CloudApplicationError('REMOTE_FAILED'); }
      const operationId = entryId.startsWith('DEMO-') ? entryId.slice(5) : '';
      if (!operationId) throw new CloudApplicationError('NOT_FOUND');
      const ref = appRef(db, uid, operationId);
      try {
        const alreadyCancelled = await runTransaction(db, async (transaction): Promise<Entry | null> => {
          const appSnap = await transaction.get(ref);
          if (!appSnap.exists()) throw new CloudApplicationError('NOT_FOUND');
          const entry = parseSnapshot(operationId, appSnap.data());
          if (entry.id !== entryId) throw new CloudApplicationError('DATA_CORRUPT');
          if (entry.status === 'cancelled-demo') return entry;
          const linkRef = entry.kind === 'help' ? helpCallLinkRef(db, uid, operationId) : null;
          const linkSnap = linkRef ? await transaction.get(linkRef) : null;
          const pointerRef = entry.kind === 'event' ? eventRef(db, uid, entry.eventId) : null;
          const pointerSnap = pointerRef ? await transaction.get(pointerRef) : null;
          transaction.update(ref, { status: 'cancelled-demo', cancelledAt: serverTimestamp() });
          if (linkSnap?.exists()) transaction.update(helpCallRef(db, operationId), { status: 'cancelled' });
          if (pointerRef && pointerSnap?.exists() && pointerSnap.data().operationId === operationId) transaction.delete(pointerRef);
          return null;
        });
        if (alreadyCancelled) return alreadyCancelled;
        const saved = await getDocFromServer(ref);
        if (!saved.exists()) throw new CloudApplicationError('NOT_FOUND');
        return parseSnapshot(operationId, saved.data());
      } catch (error) {
        if (error instanceof CloudApplicationError) throw error;
        throw new CloudApplicationError('REMOTE_FAILED');
      }
    },
  };
}
