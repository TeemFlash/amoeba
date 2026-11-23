import {
  collection, doc, getDocFromServer, getDocsFromServer, onSnapshot,
  query, runTransaction, serverTimestamp, where, type Firestore,
} from 'firebase/firestore';
import { dateIds, districts, services, slots } from '../domain/catalog';
import type { DateId, DistrictId, ServiceId, SlotId } from '../domain/types';

export type AccountRole = 'resident' | 'volunteer';
export type HelpCallStatus = 'open' | 'claimed' | 'cancelled';
export interface HelpCall {
  operationId: string;
  serviceId: ServiceId;
  districtId: DistrictId;
  slotId: SlotId;
  dateId: DateId | null;
  status: HelpCallStatus;
  claimedBy: string | null;
  createdAt: string;
  claimedAt: string | null;
}
export interface VolunteerStats { pickedUp: number; active: number; cancelled: number }
export type VolunteerErrorCode = 'AUTH_REQUIRED' | 'NOT_VOLUNTEER' | 'CALL_NOT_FOUND' | 'CALL_TAKEN' | 'DATA_CORRUPT' | 'REMOTE_FAILED';
export class VolunteerError extends Error {
  constructor(readonly code: VolunteerErrorCode) { super(code); }
}

function roleRef(db: Firestore, uid: string) { return doc(db, 'volunteerRoles', uid); }
function callRef(db: Firestore, operationId: string) { return doc(db, 'helpCalls', operationId); }
function requireUid(uid: string) { if (!uid) throw new VolunteerError('AUTH_REQUIRED'); }
function timestamp(value: unknown): string | null {
  try {
    const date = value instanceof Date ? value : (value as { toDate?: () => Date })?.toDate?.();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  } catch { return null; }
}
function parseCall(operationId: string, value: unknown): HelpCall {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId) || !value || typeof value !== 'object' || Array.isArray(value)) throw new VolunteerError('DATA_CORRUPT');
  const data = value as Record<string, unknown>;
  const allowed = ['serviceId', 'districtId', 'slotId', 'dateId', 'status', 'claimedBy', 'createdAt', 'claimedAt'];
  if (Object.keys(data).some((key) => !allowed.includes(key)) || allowed.some((key) => !Object.hasOwn(data, key))
    || !services.some((item) => item.id === data.serviceId) || !districts.some((item) => item.id === data.districtId)
    || !slots.some((item) => item.id === data.slotId) || data.dateId !== null && !dateIds.has(data.dateId as DateId)
    || !['open', 'claimed', 'cancelled'].includes(String(data.status))
    || data.claimedBy !== null && typeof data.claimedBy !== 'string'
    || !timestamp(data.createdAt) || data.claimedAt !== null && !timestamp(data.claimedAt)) throw new VolunteerError('DATA_CORRUPT');
  const status = data.status as HelpCallStatus;
  if (status === 'open' && (data.claimedBy !== null || data.claimedAt !== null)
    || status === 'claimed' && (typeof data.claimedBy !== 'string' || !timestamp(data.claimedAt))
    || status === 'cancelled' && (data.claimedBy === null ? data.claimedAt !== null : typeof data.claimedBy !== 'string' || !timestamp(data.claimedAt))) throw new VolunteerError('DATA_CORRUPT');
  return {
    operationId, serviceId: data.serviceId as ServiceId, districtId: data.districtId as DistrictId,
    slotId: data.slotId as SlotId, dateId: data.dateId as DateId | null, status,
    claimedBy: data.claimedBy as string | null, createdAt: timestamp(data.createdAt)!, claimedAt: timestamp(data.claimedAt),
  };
}

export async function resolveAccountRole(db: Firestore, uid: string): Promise<AccountRole> {
  requireUid(uid);
  try { return (await getDocFromServer(roleRef(db, uid))).exists() ? 'volunteer' : 'resident'; }
  catch { throw new VolunteerError('REMOTE_FAILED'); }
}

export function watchAccountRole(db: Firestore, uid: string, next: (role: AccountRole) => void, error: (terminal?: boolean) => void) {
  requireUid(uid);
  const unsubscribe = onSnapshot(roleRef(db, uid), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
    next(snapshot.exists() ? 'volunteer' : 'resident');
  }, () => error(true));
  return unsubscribe;
}

async function requireVolunteer(db: Firestore, uid: string) {
  if (await resolveAccountRole(db, uid) !== 'volunteer') throw new VolunteerError('NOT_VOLUNTEER');
}

export function createVolunteerRepository(db: Firestore) {
  return {
    async listOpenHelpCalls(uid: string): Promise<HelpCall[]> {
      requireUid(uid);
      await requireVolunteer(db, uid);
      try {
        const snapshot = await getDocsFromServer(query(collection(db, 'helpCalls'), where('status', '==', 'open')));
        return snapshot.docs.map((item) => parseCall(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (error) {
        if (error instanceof VolunteerError) throw error;
        throw new VolunteerError('REMOTE_FAILED');
      }
    },
    async pickUpHelpCall(uid: string, operationId: string): Promise<void> {
      requireUid(uid);
      await requireVolunteer(db, uid);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new VolunteerError('CALL_NOT_FOUND');
      const ref = callRef(db, operationId);
      try {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new VolunteerError('CALL_NOT_FOUND');
          const existing = parseCall(operationId, snapshot.data());
          if (existing.claimedBy === uid) return;
          if (existing.status !== 'open') throw new VolunteerError('CALL_TAKEN');
          transaction.update(ref, { status: 'claimed', claimedBy: uid, claimedAt: serverTimestamp() });
        });
      } catch (error) {
        if (error instanceof VolunteerError) throw error;
        if ((error as { code?: unknown })?.code === 'permission-denied') {
          try { await requireVolunteer(db, uid); } catch (roleError) { if (roleError instanceof VolunteerError) throw roleError; }
          throw new VolunteerError('CALL_TAKEN');
        }
        throw new VolunteerError('REMOTE_FAILED');
      }
    },
    async getVolunteerStats(uid: string): Promise<VolunteerStats> {
      requireUid(uid);
      await requireVolunteer(db, uid);
      try {
        const snapshot = await getDocsFromServer(query(collection(db, 'helpCalls'), where('claimedBy', '==', uid)));
        const calls = snapshot.docs.map((item) => parseCall(item.id, item.data()));
        return { pickedUp: calls.length, active: calls.filter((call) => call.status === 'claimed').length, cancelled: calls.filter((call) => call.status === 'cancelled').length };
      } catch (error) {
        if (error instanceof VolunteerError) throw error;
        throw new VolunteerError('REMOTE_FAILED');
      }
    },
  };
}
