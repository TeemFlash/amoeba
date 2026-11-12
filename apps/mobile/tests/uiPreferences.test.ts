import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferencesStore, PREFERENCES_KEY, StoreError } from '../src/storage/uiPreferences';
import type { StorageAdapter } from '../src/domain/types';

class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  failRead = false;
  failWrite = false;
  writes = 0;
  async getItem(key: string) { assert.equal(key, PREFERENCES_KEY); if (this.failRead) throw Error('read'); return this.value; }
  async setItem(key: string, value: string) { assert.equal(key, PREFERENCES_KEY); if (this.failWrite) throw Error('write'); this.writes++; this.value = value; }
  async removeItem() { throw Error('unused'); }
}

test('preferences load returns null without initializing storage and round-trips valid data', async () => {
  const storage = new MemoryStorage(); const store = createPreferencesStore(storage);
  assert.equal(await store.load(), null);
  assert.equal(storage.writes, 0);
  const preferences = { version: 1 as const, welcomeCompleted: true, textSize: 'large' as const };
  await store.save(preferences);
  assert.deepEqual(await store.load(), preferences);
});

test('malformed preferences are typed corruption and save never overwrites them', async () => {
  for (const raw of ['{', JSON.stringify({ version: 2, welcomeCompleted: false, textSize: 'standard' }), JSON.stringify({ version: 1, welcomeCompleted: false, textSize: 'small' })]) {
    const storage = new MemoryStorage(); storage.value = raw; const store = createPreferencesStore(storage);
    await assert.rejects(store.load(), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    await assert.rejects(store.save({ version: 1, welcomeCompleted: true, textSize: 'large' }), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_CORRUPT');
    assert.equal(storage.value, raw); assert.equal(storage.writes, 0);
  }
});

test('read and write failures remain visible with stable codes', async () => {
  const storage = new MemoryStorage(); const store = createPreferencesStore(storage);
  storage.failRead = true;
  await assert.rejects(store.load(), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_READ_FAILED');
  storage.failRead = false; storage.failWrite = true;
  await assert.rejects(store.save({ version: 1, welcomeCompleted: true, textSize: 'standard' }), (error: unknown) => error instanceof StoreError && error.code === 'STORAGE_WRITE_FAILED');
});

test('save snapshots its input before queued storage work starts', async () => {
  const storage = new MemoryStorage(); const store = createPreferencesStore(storage);
  const next = { version: 1 as const, welcomeCompleted: false, textSize: 'standard' as const };
  const save = store.save(next);
  next.welcomeCompleted = true;
  await save;
  assert.deepEqual(JSON.parse(storage.value!), { version: 1, welcomeCompleted: false, textSize: 'standard' });
});
