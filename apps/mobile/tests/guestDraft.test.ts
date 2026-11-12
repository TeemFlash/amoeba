import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestDraftStore, GUEST_DRAFT_KEY, StoreError } from '../src/storage/guestDraft';
import type { StorageAdapter } from '../src/domain/types';

class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  failRead = false;
  failWrite = false;
  failRemove = false;
  writes = 0;
  async getItem(key: string) { assert.equal(key, GUEST_DRAFT_KEY); if (this.failRead) throw Error('read'); return this.value; }
  async setItem(key: string, value: string) { assert.equal(key, GUEST_DRAFT_KEY); if (this.failWrite) throw Error('write'); this.writes++; this.value = value; }
  async removeItem(key: string) { assert.equal(key, GUEST_DRAFT_KEY); if (this.failRemove) throw Error('remove'); this.value = null; }
}
const help = () => ({ operationId: 'guest-help', kind: 'help' as const, serviceId: 'groceries' as const, districtId: 'astana-esil' as const, dateId: 'demo-nov17' as const, slotId: 'demo-10-12' as const, note: 'bring a list', formStep: 'note' as const, step: 'form' as const });
const event = () => ({ operationId: 'guest-event', kind: 'event' as const, eventId: 'tea' as const });

test('guest store returns null without a write and round-trips both draft kinds exactly', async () => {
  const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
  assert.equal(await store.load(), null); assert.equal(storage.writes, 0);
  await store.save(help()); assert.deepEqual(await store.load(), help());
  await store.save(event()); assert.deepEqual(await store.load(), event());
});

test('invalid or corrupt guest records are visible and never overwritten', async () => {
  const invalidNotes = [undefined, null, 1, 'x'.repeat(281)];
  for (const note of invalidNotes) {
    const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
    const draft = { ...help(), note };
    await assert.rejects(store.save(draft as never), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    assert.equal(storage.value, null);
  }
  for (const raw of ['{', JSON.stringify({ operationId: 'x', kind: 'event', eventId: 'unknown' })]) {
    const storage = new MemoryStorage(); storage.value = raw; const store = createGuestDraftStore(storage);
    await assert.rejects(store.load(), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    await assert.rejects(store.save(event()), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    assert.equal(storage.value, raw); assert.equal(storage.writes, 0);
  }
});

test('guest validation matches account operation IDs and rejects incomplete review snapshots', async () => {
  for (const operationId of ['space id', 'slash/id', 'café', 'x'.repeat(129)]) {
    const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
    await assert.rejects(store.save({ ...help(), operationId } as never), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    assert.equal(storage.value, null);
  }
  for (const draft of [
    { ...help(), step: 'review' as const, districtId: null },
    { ...help(), step: 'review' as const, slotId: null },
  ]) {
    const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
    await assert.rejects(store.save(draft as never), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
  }
});

test('read, write and remove failures remain visible', async () => {
  const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
  storage.failRead = true;
  await assert.rejects(store.load(), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_READ_FAILED');
  storage.failRead = false; storage.failWrite = true;
  await assert.rejects(store.save(event()), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_WRITE_FAILED');
  storage.failWrite = false; await store.save(event()); storage.failRemove = true;
  await assert.rejects(store.clear(), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_WRITE_FAILED');
});

test('save snapshots caller changes, and a stale compare-and-clear preserves newer choices', async () => {
  const storage = new MemoryStorage(); const store = createGuestDraftStore(storage);
  const draft = help(); const saving = store.save(draft); draft.note = 'changed after call'; await saving;
  assert.equal((await store.load())?.kind === 'help' && (await store.load() as Extract<Awaited<ReturnType<typeof store.load>>, {kind:'help'}>).note, 'bring a list');
  await store.save({ ...help(), operationId: 'newer-draft', note: 'new typing' });
  await store.clear('older-draft');
  assert.equal((await store.load())?.operationId, 'newer-draft');
  await store.clear('newer-draft'); assert.equal(await store.load(), null);
});

test('queued saves preserve call order during asynchronous writes', async () => {
  let releaseFirst!: () => void;
  let firstWriteStarted!: () => void;
  const started = new Promise<void>((resolve) => { firstWriteStarted = resolve; });
  const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  class DelayedStorage extends MemoryStorage {
    override async setItem(key: string, value: string) {
      if (this.writes === 0) { firstWriteStarted(); await gate; }
      return super.setItem(key, value);
    }
  }
  const storage = new DelayedStorage(); const store = createGuestDraftStore(storage);
  const first = store.save({ ...help(), operationId: 'first' });
  await started;
  const second = store.save({ ...help(), operationId: 'second' });
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal((await store.load())?.operationId, 'second');
});
