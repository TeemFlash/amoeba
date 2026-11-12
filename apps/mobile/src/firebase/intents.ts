import type { HelpDraft, StorageAdapter } from '../domain/types';
import { dateIds } from '../domain/catalog';
import type { ApplicationIntent } from './applications';

export type PendingApplicationIntent = ApplicationIntent;
export type AccountIntentStore = ReturnType<typeof createAccountIntentStore>;
const prefix = 'mobi-account:v1:';
const keyFor = (uid: string) => `${prefix}${encodeURIComponent(uid)}:pending`;
const draftKeyFor = (uid: string) => `${prefix}${encodeURIComponent(uid)}:draft`;

export type AccountDraft = (HelpDraft & { kind: 'help'; uid: string }) | { kind: 'event'; uid: string; operationId: string; eventId: 'tea' };

function validIntent(value: unknown, uid: string): value is PendingApplicationIntent {
  if (!value || typeof value !== 'object') return false;
  const intent = value as Record<string, unknown>;
  if (intent.uid !== uid || typeof intent.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(intent.operationId)) return false;
  if (intent.kind === 'help') {
    const oldKeys = 'districtId,kind,operationId,serviceId,slotId,uid';
    const newKeys = `${oldKeys},dateId,note`.split(',').sort().join(',');
    const keys = Object.keys(intent).sort().join(',');
    const pair = Object.hasOwn(intent, 'dateId') && Object.hasOwn(intent, 'note');
    return (keys === oldKeys || pair && keys === newKeys)
      && typeof intent.serviceId === 'string' && ['groceries', 'home-help', 'digital-help'].includes(intent.serviceId)
      && typeof intent.districtId === 'string' && ['demo-center', 'demo-left-bank', 'astana-esil', 'astana-almaty', 'astana-saryarka', 'astana-baikonur'].includes(intent.districtId)
      && typeof intent.slotId === 'string' && ['demo-morning', 'demo-afternoon', 'demo-10-12', 'demo-14-16'].includes(intent.slotId)
      && (!pair || dateIds.has(intent.dateId as never) && typeof intent.note === 'string' && intent.note.length <= 280);
  }
  return intent.kind === 'event' && Object.keys(intent).sort().join(',') === 'eventId,kind,operationId,uid'
    && typeof intent.eventId === 'string' && intent.eventId === 'tea';
}
function validDraft(value: unknown, uid: string): value is AccountDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  if (draft.uid !== uid || typeof draft.operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(draft.operationId)) return false;
  if (draft.kind === 'event') return Object.keys(draft).sort().join(',') === 'eventId,kind,operationId,uid' && draft.eventId === 'tea';
  const legacyKeys = 'districtId,kind,operationId,serviceId,slotId,step,uid';
  const allowed = new Set([...legacyKeys.split(','), 'dateId', 'note', 'formStep']);
  const keys = Object.keys(draft);
  return draft.kind === 'help' && keys.every((key) => allowed.has(key)) && legacyKeys.split(',').every((key) => Object.hasOwn(draft, key))
    && typeof draft.serviceId === 'string' && ['groceries', 'home-help', 'digital-help'].includes(draft.serviceId)
    && (draft.districtId === null || typeof draft.districtId === 'string' && ['demo-center', 'demo-left-bank', 'astana-esil', 'astana-almaty', 'astana-saryarka', 'astana-baikonur'].includes(draft.districtId))
    && (draft.slotId === null || typeof draft.slotId === 'string' && ['demo-morning', 'demo-afternoon', 'demo-10-12', 'demo-14-16'].includes(draft.slotId))
    && (!Object.hasOwn(draft, 'dateId') || draft.dateId === null || dateIds.has(draft.dateId as never))
    && (!Object.hasOwn(draft, 'note') || typeof draft.note === 'string' && draft.note.length <= 280)
    && (!Object.hasOwn(draft, 'formStep') || ['district', 'date', 'time', 'note'].includes(draft.formStep as string))
    && typeof draft.step === 'string' && ['form', 'review'].includes(draft.step)
    && (draft.step !== 'review' || draft.districtId !== null && draft.slotId !== null);
}

export function createAccountIntentStore(storage: StorageAdapter) {
  const queues = new Map<string, Promise<unknown>>();
  const serialize = <T>(uid: string, work: () => Promise<T>) => {
    const prior = queues.get(uid) ?? Promise.resolve();
    const result = prior.then(work, work);
    queues.set(uid, result.then(() => undefined, () => undefined));
    return result;
  };
  const read = async (uid: string): Promise<PendingApplicationIntent | null> => {
    const raw = await storage.getItem(keyFor(uid));
    if (raw === null) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('LOCAL_INTENT_CORRUPT'); }
    if (!validIntent(parsed, uid)) throw new Error('LOCAL_INTENT_CORRUPT');
    return parsed;
  };
  const readDraft = async (uid: string): Promise<AccountDraft | null> => {
    const raw = await storage.getItem(draftKeyFor(uid));
    if (raw === null) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('LOCAL_DRAFT_CORRUPT'); }
    if (!validDraft(parsed, uid)) throw new Error('LOCAL_DRAFT_CORRUPT');
    return parsed;
  };
  const sameIntent = (left: PendingApplicationIntent, right: PendingApplicationIntent) => {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key as keyof PendingApplicationIntent] === right[key as keyof PendingApplicationIntent]);
  };
  return {
    save(intent: PendingApplicationIntent) {
      if (!validIntent(intent, intent.uid)) throw new Error('INVALID_INTENT');
      const frozen = Object.freeze({ ...intent }) as PendingApplicationIntent;
      const uid = frozen.uid;
      return serialize(uid, async () => {
        const current = await read(uid);
        if (current && !sameIntent(current, frozen)) throw new Error('PENDING_INTENT_EXISTS');
        if (!current) await storage.setItem(keyFor(uid), JSON.stringify(frozen));
      });
    },
    load: read,
    clear(uid: string, operationId: string) {
      return serialize(uid, async () => {
        const current = await read(uid);
        if (current?.operationId === operationId) await storage.removeItem(keyFor(uid));
      });
    },
    async saveDraft(uid: string, draft: AccountDraft | null, replace = false) {
      if (draft === null) return serialize(uid, () => storage.removeItem(draftKeyFor(uid)));
      const captured = Object.freeze({ ...draft }) as AccountDraft;
      if (!validDraft(captured, uid)) throw new Error('INVALID_DRAFT');
      return serialize(uid, async () => {
        const current = await readDraft(uid);
        if (current && current.operationId !== captured.operationId && !replace) throw new Error('ACCOUNT_DRAFT_EXISTS');
        await storage.setItem(draftKeyFor(uid), JSON.stringify(captured));
      });
    },
    loadDraft: readDraft,
  };
}

export async function submitWithPersistedIntent<T>(
  store: AccountIntentStore,
  intent: PendingApplicationIntent,
  submit: (captured: PendingApplicationIntent) => Promise<T>,
  cleanup?: () => Promise<void>,
): Promise<{ acknowledged: T; cleanupPending: boolean }> {
  if (!validIntent(intent, intent.uid)) throw new Error('INVALID_INTENT');
  const captured = Object.freeze({ ...intent }) as PendingApplicationIntent;
  await store.save(captured);
  const acknowledged = await submit(captured);
  try {
    await cleanup?.();
    await store.clear(captured.uid, captured.operationId);
    return { acknowledged, cleanupPending: false };
  } catch {
    return { acknowledged, cleanupPending: true };
  }
}
