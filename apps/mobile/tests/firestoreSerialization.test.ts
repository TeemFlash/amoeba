import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationToFirestore, parseCloudApplication } from '../src/firebase/firestoreSerialization';

test('Firestore timestamps normalize to the existing entry boundary', () => {
  const value = parseCloudApplication('op-1', {
    schemaVersion: 1, id: 'DEMO-op-1', operationId: 'op-1', kind: 'help', status: 'saved-demo',
    serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning',
    createdAt: { toDate: () => new Date('2026-11-10T12:00:00.000Z') }, cancelledAt: null,
  });
  assert.deepEqual(value, {
    id: 'DEMO-op-1', operationId: 'op-1', kind: 'help', status: 'saved-demo',
    serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning',
    createdAt: '2026-11-10T12:00:00.000Z', cancelledAt: null,
  });
});

test('Firestore documents with mismatched identity or corrupt timestamps are rejected', () => {
  const document = {
    schemaVersion: 1, id: 'DEMO-op-2', operationId: 'op-2', kind: 'event', status: 'saved-demo',
    eventId: 'tea', createdAt: { toDate: () => new Date('invalid') }, cancelledAt: null,
  };
  assert.equal(parseCloudApplication('other-id', document), null);
  assert.equal(parseCloudApplication('op-2', document), null);
});

test('help Firestore serialization round-trips legacy and paired date-note shapes only', () => {
  const timestamp = { toDate: () => new Date('2026-11-10T12:00:00.000Z') };
  const base = {
    schemaVersion: 1, id: 'DEMO-op-new', operationId: 'op-new', kind: 'help', status: 'saved-demo',
    serviceId: 'groceries', districtId: 'astana-esil', slotId: 'demo-10-12', createdAt: timestamp, cancelledAt: null,
  };
  const legacy = parseCloudApplication('op-old', {
    ...base, id: 'DEMO-op-old', operationId: 'op-old', districtId: 'demo-center', slotId: 'demo-morning',
  });
  assert.equal(legacy?.kind === 'help' && legacy.dateId, undefined);
  const fresh = parseCloudApplication('op-new', { ...base, dateId: 'demo-nov12', note: 'Gate B' });
  assert.equal(fresh?.kind === 'help' && fresh.dateId, 'demo-nov12');
  assert.equal(fresh?.kind === 'help' && fresh.note, 'Gate B');
  assert.equal(parseCloudApplication('op-new', { ...base, dateId: 'demo-nov12' }), null);
  assert.equal(parseCloudApplication('op-new', { ...base, note: '' }), null);
  assert.equal(parseCloudApplication('op-new', { ...base, dateId: 'not-a-date', note: '' }), null);
  assert.equal(parseCloudApplication('op-new', { ...base, dateId: 'demo-nov12', note: 'x'.repeat(281) }), null);
});

test('Firestore writer refuses to downgrade a partial date-note pair to a legacy record', () => {
  const partial = {
    id: 'DEMO-partial', operationId: 'partial', kind: 'help', status: 'saved-demo', serviceId: 'groceries',
    districtId: 'astana-esil', slotId: 'demo-10-12', dateId: 'demo-nov12', createdAt: '2026-11-10T00:00:00.000Z', cancelledAt: null,
  } as never;
  assert.throws(() => applicationToFirestore(partial, 'server-time'), /INVALID_HELP_DATE_NOTE_PAIR/);
});
