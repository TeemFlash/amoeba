import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository, STORAGE_KEY } from '../src/storage/repository';
import { initialState } from '../src/domain/transitions';
import { parseState } from '../src/domain/validation';
import type { StorageAdapter } from '../src/domain/types';

class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  failRead = false;
  failWriteCount = 0;
  failRemove = false;
  async getItem(key: string) { assert.equal(key, STORAGE_KEY); if (this.failRead) throw Error('read'); return this.value; }
  async setItem(key: string, value: string) { assert.equal(key, STORAGE_KEY); if (this.failWriteCount > 0) { this.failWriteCount--; throw Error('write'); } this.value = value; }
  async removeItem(key: string) { assert.equal(key, STORAGE_KEY); if (this.failRemove) throw Error('remove'); this.value = null; }
}
const now = () => '2026-11-09T00:00:00.000Z';

test('loading a new installation initializes a persisted empty snapshot', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  const result = await repository.load();
  assert.deepEqual(result, { ok: true, value: initialState() });
  assert.equal(storage.value, JSON.stringify(initialState()));
});

test('load restores a valid saved snapshot', async () => {
  const storage = new MemoryStorage();
  storage.value = JSON.stringify({ schemaVersion: 1, locale: 'kz', draft: null, entries: [] });
  const result = await createRepository(storage, now).load();
  assert.deepEqual(result, { ok: true, value: { schemaVersion: 1, locale: 'kz', draft: null, entries: [] } });
});

test('legacy help entries and drafts round-trip without migration and new fields round-trip exactly', async () => {
  const legacy = {
    schemaVersion: 1, locale: 'ru', draft: {
      operationId: 'old-draft', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', step: 'form',
    }, entries: [{
      id: 'DEMO-old-entry', operationId: 'old-entry', kind: 'help', serviceId: 'groceries', districtId: 'demo-left-bank',
      slotId: 'demo-afternoon', status: 'saved-demo', createdAt: '2026-11-09T00:00:00.000Z', cancelledAt: null,
    }],
  };
  const legacyStorage = new MemoryStorage(); legacyStorage.value = JSON.stringify(legacy);
  const legacyResult = await createRepository(legacyStorage, now).load();
  assert.equal(legacyResult.ok, true);
  assert.equal(legacyStorage.value, JSON.stringify(legacy));
  if (legacyResult.ok) {
    assert.equal(legacyResult.value.draft?.dateId, undefined);
    assert.equal(legacyResult.value.entries[0]?.kind === 'help' && legacyResult.value.entries[0].dateId, undefined);
  }

  const current = new MemoryStorage();
  const repository = createRepository(current, now);
  await repository.load();
  await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'new-entry' });
  await repository.execute({ type: 'editHelp', patch: { districtId: 'astana-esil', dateId: 'demo-nov17', slotId: 'demo-10-12', note: 'side door' } });
  await repository.execute({ type: 'setDraftStep', step: 'review' });
  const submitted = await repository.execute({ type: 'submitHelp', operationId: 'new-entry' });
  assert.equal(submitted.ok, true);
  const reloaded = await createRepository(current, now).load();
  assert.equal(reloaded.ok, true);
  if (reloaded.ok) {
    const entry = reloaded.value.entries[0];
    assert.equal(entry?.kind === 'help' && entry.dateId, 'demo-nov17');
    assert.equal(entry?.kind === 'help' && entry.note, 'side door');
  }
});

test('legacy draft is preserved and a new date must be chosen before submission', async () => {
  const storage = new MemoryStorage();
  storage.value = JSON.stringify({ schemaVersion: 1, locale: 'ru', draft: {
    operationId: 'legacy-draft', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', step: 'form',
  }, entries: [] });
  const repository = createRepository(storage, now);
  const loaded = await repository.load();
  assert.equal(loaded.ok, true);
  const result = await repository.execute({ type: 'submitHelp', operationId: 'legacy-draft' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'DATE_REQUIRED');
  assert.equal(JSON.parse(storage.value!).draft.dateId, undefined);
});

test('cancelling a new help record retains the selected date and note unchanged', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'cancel-date-note' });
  await repository.execute({ type: 'editHelp', patch: { districtId: 'astana-saryarka', dateId: 'demo-nov19', slotId: 'demo-14-16', note: 'Text remains after cancel' } });
  await repository.execute({ type: 'setDraftStep', step: 'review' });
  await repository.execute({ type: 'submitHelp', operationId: 'cancel-date-note' });
  const cancelled = await repository.execute({ type: 'cancelEntry', entryId: 'DEMO-cancel-date-note' });
  assert.equal(cancelled.ok, true);
  if (cancelled.ok) {
    const entry = cancelled.value.state.entries[0];
    assert.equal(entry?.kind === 'help' && entry.dateId, 'demo-nov19');
    assert.equal(entry?.kind === 'help' && entry.note, 'Text remains after cancel');
  }
});

test('corrupt JSON, unknown versions, invalid enums, and duplicate IDs are rejected without overwrite', async (t) => {
  const snapshots = [
    '{',
    JSON.stringify({ schemaVersion: 99, locale: 'ru', draft: null, entries: [] }),
    JSON.stringify({ schemaVersion: 1, locale: 'en', draft: null, entries: [] }),
    JSON.stringify({ schemaVersion: 1, locale: 'ru', draft: null, entries: [
      { id: 'DEMO-x', operationId: 'x', kind: 'event', eventId: 'tea', status: 'saved-demo', createdAt: '2026-11-09T00:00:00.000Z', cancelledAt: null },
      { id: 'DEMO-x', operationId: 'x', kind: 'event', eventId: 'tea', status: 'saved-demo', createdAt: '2026-11-09T00:00:00.000Z', cancelledAt: null },
    ] }),
  ];
  for (const value of snapshots) await t.test(value.slice(0, 24), async () => {
    const storage = new MemoryStorage(); storage.value = value;
    const result = await createRepository(storage, now).load();
    assert.deepEqual(result, { ok: false, error: { code: 'STORAGE_CORRUPT' } });
    assert.equal(storage.value, value);
  });
});

test('parseState rejects unknown catalogue references, inconsistent cancellation and multiple active event entries', async (t) => {
  const base = { schemaVersion: 1, locale: 'ru', draft: null, entries: [] as unknown[] };
  const eventEntry = (id: string, operationId: string, patch: object = {}) => ({ id, operationId, kind: 'event', eventId: 'tea', status: 'saved-demo', createdAt: '2026-11-09T00:00:00.000Z', cancelledAt: null, ...patch });
  const helpEntry = (id: string, operationId: string, patch: object = {}) => ({ id, operationId, kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', status: 'saved-demo', createdAt: '2026-11-09T00:00:00.000Z', cancelledAt: null, ...patch });
  const invalid = [
    { ...base, draft: { operationId: 'd', serviceId: 'unknown', districtId: null, slotId: null, step: 'form' } },
    { ...base, draft: { operationId: 'd', serviceId: 'groceries', districtId: 'unknown', slotId: null, step: 'form' } },
    { ...base, draft: { operationId: 'd', serviceId: 'groceries', districtId: null, dateId: 'wrong', slotId: null, note: '', formStep: 'date', step: 'form' } },
    { ...base, draft: { operationId: 'd', serviceId: 'groceries', districtId: null, slotId: null, note: 'x'.repeat(281), step: 'form' } },
    { ...base, draft: { operationId: 'd', serviceId: 'groceries', districtId: null, slotId: null, formStep: 'review', step: 'form' } },
    { ...base, entries: [eventEntry('DEMO-e', 'e', { eventId: 'unknown' })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { serviceId: 'unknown' })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { districtId: 'unknown' })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { dateId: 'demo-nov12' })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { dateId: 'bad', note: '' })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { dateId: 'demo-nov12', note: 7 })] },
    { ...base, entries: [helpEntry('DEMO-h', 'h', { dateId: 'demo-nov12', note: 'x'.repeat(281) })] },
    { ...base, entries: [eventEntry('DEMO-e', 'e', { status: 'cancelled-demo', cancelledAt: null })] },
    { ...base, entries: [eventEntry('DEMO-e', 'e', { status: 'saved-demo', cancelledAt: '2026-11-09T00:00:00.000Z' })] },
    { ...base, entries: [eventEntry('DEMO-e1', 'e1'), eventEntry('DEMO-e2', 'e2')] },
  ];
  for (const value of invalid) await t.test(JSON.stringify(value).slice(0, 36), () => {
    assert.deepEqual(parseState(JSON.stringify(value)), { ok: false, error: { code: 'STORAGE_CORRUPT' } });
  });
});

test('rejected storage read blocks execution and is reported as a read failure', async () => {
  const storage = new MemoryStorage(); storage.failRead = true;
  const repository = createRepository(storage, now);
  const loaded = await repository.load();
  assert.deepEqual(loaded, { ok: false, error: { code: 'STORAGE_READ_FAILED' } });
  const executed = await repository.execute({ type: 'setLocale', locale: 'kz' });
  assert.deepEqual(executed, { ok: false, error: { code: 'STORAGE_READ_FAILED' } });
  assert.equal(storage.value, null);
});

test('a rejected write never updates the accepted state and retry uses the same operation id', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  storage.failWriteCount = 1;
  const failed = await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'same-id' });
  assert.deepEqual(failed, { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
  const retried = await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'same-id' });
  assert.equal(retried.ok, true);
  assert.equal(retried.ok && retried.value.state.draft?.operationId, 'same-id');
});

test('a rejected submission write does not confirm success; retry persists exactly one entry', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'submit-retry' });
  await repository.execute({ type: 'editHelp', patch: { districtId: 'demo-center', dateId: 'demo-nov12', slotId: 'demo-morning' } });
  await repository.execute({ type: 'setDraftStep', step: 'review' });
  storage.failWriteCount = 1;
  const failed = await repository.execute({ type: 'submitHelp', operationId: 'submit-retry' });
  assert.deepEqual(failed, { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
  const retried = await repository.execute({ type: 'submitHelp', operationId: 'submit-retry' });
  assert.equal(retried.ok, true);
  const reloaded = await createRepository(storage, now).load();
  assert.equal(reloaded.ok, true);
  if (reloaded.ok) {
    assert.equal(reloaded.value.entries.length, 1);
    assert.equal(reloaded.value.entries[0]?.id, 'DEMO-submit-retry');
  }
});

test('two parallel submissions with the same operation id persist exactly one entry', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'same-submit' });
  await repository.execute({ type: 'editHelp', patch: { districtId: 'demo-center', dateId: 'demo-nov12', slotId: 'demo-morning' } });
  await repository.execute({ type: 'setDraftStep', step: 'review' });
  const results = await Promise.all([
    repository.execute({ type: 'submitHelp', operationId: 'same-submit' }),
    repository.execute({ type: 'submitHelp', operationId: 'same-submit' }),
  ]);
  assert.ok(results.every((result) => result.ok));
  const reloaded = await createRepository(storage, now).load();
  assert.equal(reloaded.ok, true);
  if (reloaded.ok) assert.equal(reloaded.value.entries.length, 1);
});

test('parallel commands are serialized and retain both locale and draft changes', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  const results = await Promise.all([
    repository.execute({ type: 'setLocale', locale: 'kz' }),
    repository.execute({ type: 'startHelp', serviceId: 'home-help', operationId: 'parallel-id' }),
  ]);
  assert.ok(results.every((result) => result.ok));
  const loaded = await repository.load();
  assert.equal(loaded.ok, true);
  if (loaded.ok) {
    assert.equal(loaded.value.locale, 'kz');
    assert.equal(loaded.value.draft?.operationId, 'parallel-id');
  }
});

test('failed reset preserves the current accepted state', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  await repository.execute({ type: 'setLocale', locale: 'kz' });
  storage.failRemove = true;
  const result = await repository.reset();
  assert.deepEqual(result, { ok: false, error: { code: 'STORAGE_WRITE_FAILED' } });
  assert.equal(storage.value, JSON.stringify({ schemaVersion: 1, locale: 'kz', draft: null, entries: [] }));
  const loaded = await repository.load();
  assert.equal(loaded.ok && loaded.value.locale, 'kz');
});

test('a failed reload invalidates readiness and cannot overwrite unread storage', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  const oldSnapshot = storage.value;
  storage.failRead = true;
  assert.deepEqual(await repository.load(), { ok: false, error: { code: 'STORAGE_READ_FAILED' } });
  const command = await repository.execute({ type: 'setLocale', locale: 'kz' });
  assert.deepEqual(command, { ok: false, error: { code: 'STORAGE_READ_FAILED' } });
  assert.equal(storage.value, oldSnapshot);
});

test('mutating a result snapshot cannot mutate the repository accepted state', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  const loaded = await repository.load();
  assert.equal(loaded.ok, true);
  if (loaded.ok) loaded.value.locale = 'kz';
  const next = await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'owned-state' });
  assert.equal(next.ok, true);
  if (next.ok) next.value.state.locale = 'kz';
  const again = await repository.load();
  assert.equal(again.ok, true);
  if (again.ok) assert.equal(again.value.locale, 'ru');
});

test('executing a command before load writes nothing', async () => {
  const storage = new MemoryStorage();
  const result = await createRepository(storage, now).execute({ type: 'setLocale', locale: 'kz' });
  assert.deepEqual(result, { ok: false, error: { code: 'STORAGE_READ_FAILED' } });
  assert.equal(storage.value, null);
});

test('an invalid draft step is rejected without writing or changing the accepted snapshot', async () => {
  const storage = new MemoryStorage();
  const repository = createRepository(storage, now);
  await repository.load();
  await repository.execute({ type: 'startHelp', serviceId: 'groceries', operationId: 'repo-invalid-step' });
  const before = storage.value;
  const result = await repository.execute({ type: 'setDraftStep', step: 'saved-demo' as 'form' });
  assert.deepEqual(result, { ok: false, error: { code: 'INVALID_SELECTION' } });
  assert.equal(storage.value, before);
  const current = await repository.load();
  assert.equal(current.ok, true);
  if (current.ok) assert.equal(current.value.draft?.step, 'form');
  assert.equal(parseState(storage.value ?? '').ok, true);
});
