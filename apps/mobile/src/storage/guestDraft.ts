import { dateIds, districtIds, serviceIds, slotIds } from '../domain/catalog';
import type { HelpDraft, StorageAdapter } from '../domain/types';
import { StoreError } from './uiPreferences';

export { StoreError } from './uiPreferences';

export const GUEST_DRAFT_KEY = 'mobi-guest:v1';

export type GuestDraft = (HelpDraft & { kind: 'help' })
  | { kind: 'event'; eventId: 'tea'; operationId: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isOperationId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const exactKeys = (value: Record<string, unknown>, required: string[], optional: string[] = []) => {
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key))
    && keys.every((key) => required.includes(key) || optional.includes(key));
};

function validateGuestDraft(value: unknown): GuestDraft | null {
  if (!isRecord(value) || !isOperationId(value.operationId)) return null;
  if (value.kind === 'event') {
    if (!exactKeys(value, ['kind', 'eventId', 'operationId']) || value.eventId !== 'tea') return null;
    return { kind: 'event', eventId: 'tea', operationId: value.operationId };
  }
  if (value.kind !== 'help'
    || !exactKeys(value, ['kind', 'operationId', 'serviceId', 'districtId', 'slotId', 'step'], ['dateId', 'note', 'formStep'])
    || !serviceIds.has(value.serviceId as never)
    || !(value.districtId === null || districtIds.has(value.districtId as never))
    || !(value.slotId === null || slotIds.has(value.slotId as never))
    || (value.step !== 'form' && value.step !== 'review')) return null;
  if (value.step === 'review' && (value.districtId === null || value.slotId === null)) return null;

  const hasDateId = Object.hasOwn(value, 'dateId');
  const hasNote = Object.hasOwn(value, 'note');
  const hasFormStep = Object.hasOwn(value, 'formStep');
  if (hasDateId && !(value.dateId === null || dateIds.has(value.dateId as never))) return null;
  if (hasNote && (typeof value.note !== 'string' || value.note.length > 280)) return null;
  if (hasFormStep && !['district', 'date', 'time', 'note'].includes(value.formStep as string)) return null;

  return {
    kind: 'help',
    operationId: value.operationId,
    serviceId: value.serviceId as HelpDraft['serviceId'],
    districtId: value.districtId as HelpDraft['districtId'],
    slotId: value.slotId as HelpDraft['slotId'],
    ...(hasDateId ? { dateId: value.dateId as HelpDraft['dateId'] } : {}),
    ...(hasNote ? { note: value.note as string } : {}),
    ...(hasFormStep ? { formStep: value.formStep as HelpDraft['formStep'] } : {}),
    step: value.step,
  };
}

function parseGuestDraft(raw: string): GuestDraft {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new StoreError('STORAGE_CORRUPT'); }
  const draft = validateGuestDraft(value);
  if (!draft) throw new StoreError('STORAGE_CORRUPT');
  return draft;
}

export function createGuestDraftStore(storage: StorageAdapter) {
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work, work);
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
  const read = async (): Promise<GuestDraft | null> => {
    let raw: string | null;
    try { raw = await storage.getItem(GUEST_DRAFT_KEY); }
    catch { throw new StoreError('STORAGE_READ_FAILED'); }
    return raw === null ? null : parseGuestDraft(raw);
  };

  return {
    load: () => serialize(read),
    save: (draft: GuestDraft): Promise<void> => {
      // Draft records contain primitives only; clone synchronously before queueing.
      const snapshot = { ...draft } as GuestDraft;
      return serialize(async () => {
        const validated = validateGuestDraft(snapshot);
        if (!validated) throw new StoreError('STORAGE_CORRUPT');
        // Checking the prior value prevents saving over data that needs recovery.
        await read();
        try { await storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(validated)); }
        catch { throw new StoreError('STORAGE_WRITE_FAILED'); }
      });
    },
    clear: (expectedOperationId?: string): Promise<void> => serialize(async () => {
      const current = await read();
      if (expectedOperationId !== undefined && current?.operationId !== expectedOperationId) return;
      if (current === null) return;
      try { await storage.removeItem(GUEST_DRAFT_KEY); }
      catch { throw new StoreError('STORAGE_WRITE_FAILED'); }
    }),
  };
}
