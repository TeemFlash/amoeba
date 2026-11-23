import { randomUUID } from 'expo-crypto';
import { firebaseConfig } from '../firebase/config';
import { operationalDistricts, operationalServices, operationalSlots, type OperationalHelpInput } from '../firebase/operations';
import { asyncStorage } from './asyncStorage';

export const operationalSteps = ['service', 'district', 'date', 'slot', 'note', 'review'] as const;
export type OperationalStep = typeof operationalSteps[number];
export type OperationalDraft = {
  operationId: string;
  serviceId: OperationalHelpInput['serviceId'] | null;
  districtId: OperationalHelpInput['districtId'] | null;
  slotId: OperationalHelpInput['slotId'] | null;
  date: string;
  note: string;
  step: OperationalStep;
  submitted: boolean;
};

const scope = firebaseConfig.mode === 'emulator' || firebaseConfig.mode === 'cloud'
  ? `${firebaseConfig.mode}:${firebaseConfig.config.projectId}` : firebaseConfig.mode;
const key = (uid?: string) => `mobi-operational-help:v1:${scope}:${uid ? `account:${encodeURIComponent(uid)}` : 'guest'}`;
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}

export const newOperationalId = () => `op-${randomUUID()}`;
export const newOperationalDraft = (): OperationalDraft => ({
  operationId: newOperationalId(), serviceId: null, districtId: null, slotId: null,
  date: '', note: '', step: 'service', submitted: false,
});

function parse(raw: string): OperationalDraft {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object'
    || typeof value.operationId !== 'string' || !/^op-[0-9a-f-]{36}$/.test(value.operationId)
    || (value.serviceId !== null && !operationalServices.some((entry) => entry.id === value.serviceId))
    || (value.districtId !== null && !operationalDistricts.some((entry) => entry.id === value.districtId))
    || (value.slotId !== null && !operationalSlots.some((entry) => entry.id === value.slotId))
    || typeof value.date !== 'string' || (value.date !== '' && !isCalendarDate(value.date))
    || typeof value.note !== 'string' || value.note.length > 300
    || !operationalSteps.includes(value.step) || typeof value.submitted !== 'boolean') throw new Error('Corrupt help draft');
  const step = operationalSteps.indexOf(value.step);
  if (step >= 1 && !value.serviceId || step >= 2 && !value.districtId || step >= 3 && !value.date
    || step >= 4 && !value.slotId || value.submitted && value.step !== 'review') throw new Error('Incomplete help draft');
  return value;
}

function isCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export const readOperationalDraft = (uid?: string) => serialize(async () => {
  const raw = await asyncStorage.getItem(key(uid));
  return raw === null ? null : parse(raw);
});
export const writeOperationalDraft = (uid: string | undefined, draft: OperationalDraft) => serialize(() => asyncStorage.setItem(key(uid), JSON.stringify(draft)));
export const clearOperationalDraft = (uid?: string, operationId?: string) => serialize(async () => {
  const storageKey = key(uid);
  if (operationId) {
    const raw = await asyncStorage.getItem(storageKey);
    if (raw === null || parse(raw).operationId !== operationId) return;
  }
  await asyncStorage.removeItem(storageKey);
});

const enrollmentKey = (uid: string, meetingId: string) => `mobi-operational-enrollment:v1:${scope}:${encodeURIComponent(uid)}:${encodeURIComponent(meetingId)}`;
export const ensureEnrollmentOperation = (uid: string, meetingId: string, priorOperationIds: string[]) => serialize(async () => {
  const storageKey = enrollmentKey(uid, meetingId);
  const previous = await asyncStorage.getItem(storageKey);
  if (previous && /^op-[0-9a-f-]{36}$/.test(previous) && !priorOperationIds.includes(previous)) return previous;
  const operationId = newOperationalId();
  await asyncStorage.setItem(storageKey, operationId);
  return operationId;
});
