import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountIntentStore, submitWithPersistedIntent, type PendingApplicationIntent } from '../src/firebase/intents';
import type { StorageAdapter } from '../src/domain/types';

function storage(behavior: { failRemove?: boolean } = {}) {
  const values = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { if (behavior.failRemove) throw new Error('blocked'); values.delete(key); },
  };
  return { adapter, values };
}
const intent: PendingApplicationIntent = { uid: 'account-a', operationId: 'stable-1', kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning' };

test('pending intent is stored under its captured UID and restored with frozen fields', async () => {
  const local = storage();
  const store = createAccountIntentStore(local.adapter);
  await store.save(intent);
  assert.deepEqual(await store.load('account-a'), intent);
  assert.equal(await store.load('account-b'), null);
});

test('legacy pending help intent replays with its original shape and a new intent preserves paired fields', async () => {
  const local = storage();
  local.values.set('mobi-account:v1:account-a:pending', JSON.stringify(intent));
  const store = createAccountIntentStore(local.adapter);
  const replayed = await store.load('account-a');
  assert.deepEqual(replayed, intent);
  assert.equal(replayed && 'dateId' in replayed, false);
  const fresh: PendingApplicationIntent = { ...intent, operationId: 'new-date-note', dateId: 'demo-nov19', note: 'Please knock' };
  await store.clear('account-a', intent.operationId);
  await store.save(fresh);
  assert.deepEqual(await store.load('account-a'), fresh);
  await assert.rejects(() => store.save({ ...fresh, note: 'Changed note' }), /PENDING_INTENT_EXISTS/);
  assert.throws(() => store.save({ ...fresh, operationId: 'bad-pair', dateId: undefined } as unknown as PendingApplicationIntent), /INVALID_INTENT/);
});

test('a remote success remains acknowledged when local pending-intent cleanup fails', async () => {
  const local = storage({ failRemove: true });
  const store = createAccountIntentStore(local.adapter);
  const result = await submitWithPersistedIntent(store, intent, async (captured) => ({ id: `DEMO-${captured.operationId}`, uid: captured.uid }));
  assert.equal(result.acknowledged.id, 'DEMO-stable-1');
  assert.equal(result.cleanupPending, true);
  assert.deepEqual(await store.load('account-a'), intent);
});

test('a remote success remains pending when account draft cleanup fails', async () => {
  const store = createAccountIntentStore(storage().adapter);
  const result = await submitWithPersistedIntent(store, intent, async () => ({ saved: true }), async () => { throw new Error('local cleanup failed'); });
  assert.deepEqual(result.acknowledged, { saved: true });
  assert.equal(result.cleanupPending, true);
  assert.deepEqual(await store.load('account-a'), intent);
});

test('failed remote save keeps the same intent available for retry', async () => {
  const store = createAccountIntentStore(storage().adapter);
  await assert.rejects(() => submitWithPersistedIntent(store, intent, async () => { throw new Error('offline'); }));
  assert.deepEqual(await store.load('account-a'), intent);
});

test('a different operation cannot overwrite an unresolved intent for the same account', async () => {
  const store = createAccountIntentStore(storage().adapter);
  await store.save(intent);
  await assert.rejects(() => store.save({ ...intent, operationId: 'stable-2' }), /PENDING_INTENT_EXISTS/);
  assert.deepEqual(await store.load('account-a'), intent);
});

test('cleanup for an older operation cannot delete a newer pending operation', async () => {
  const store = createAccountIntentStore(storage().adapter);
  await store.save(intent);
  await store.clear('account-a', 'stable-1');
  const newer = { ...intent, operationId: 'stable-2' };
  await store.save(newer);
  await store.clear('account-a', 'stable-1');
  assert.deepEqual(await store.load('account-a'), newer);
});

test('account drafts are isolated by UID and reject malformed data', async () => {
  const local = storage();
  const store = createAccountIntentStore(local.adapter);
  const draft = { uid: 'account-a', kind: 'help' as const, operationId: 'draft-1', serviceId: 'groceries' as const, districtId: null, slotId: null, step: 'form' as const };
  await store.saveDraft('account-a', draft);
  assert.deepEqual(await store.loadDraft('account-a'), draft);
  await assert.rejects(() => store.saveDraft('account-a', { ...draft, operationId: 'draft-2' }), /ACCOUNT_DRAFT_EXISTS/);
  assert.equal(await store.loadDraft('account-b'), null);
  local.values.set('mobi-account:v1:account-b:draft', JSON.stringify({ ...draft, uid: 'account-b', serviceId: ['groceries'] }));
  await assert.rejects(() => store.loadDraft('account-b'), /LOCAL_DRAFT_CORRUPT/);
  await assert.rejects(() => store.saveDraft('account-a', { ...draft, step: 'review' }), /INVALID_DRAFT/);
});

test('corrupt non-string IDs and enum lookalikes are rejected', async () => {
  const local = storage();
  local.values.set('mobi-account:v1:account-a:pending', JSON.stringify({ ...intent, operationId: ['x'] }));
  const store = createAccountIntentStore(local.adapter);
  await assert.rejects(() => store.load('account-a'), /LOCAL_INTENT_CORRUPT/);
  assert.throws(() => store.save({ ...intent, serviceId: ['groceries'] as unknown as 'groceries' }), /INVALID_INTENT/);
});

test('submission uses a frozen intent even if the caller mutates it while local storage is pending', async () => {
  let release!: () => void;
  const local = storage();
  const base = local.adapter.setItem;
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  local.adapter.setItem = async (key, value) => { markStarted(); await new Promise<void>((resolve) => { release = resolve; }); await base(key, value); };
  const store = createAccountIntentStore(local.adapter);
  let received: PendingApplicationIntent | undefined;
  const pending = submitWithPersistedIntent(store, intent, async (captured) => { received = captured; return captured.operationId; });
  await started;
  (intent as { serviceId?: string }).serviceId = 'home-help';
  release();
  await pending;
  assert.equal(received?.kind, 'help');
  if (received?.kind === 'help') assert.equal(received.serviceId, 'groceries');
});
