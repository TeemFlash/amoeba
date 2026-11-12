import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc, type Firestore } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createApplicationsRepository, CloudApplicationError } from '../src/firebase/applications';

let environment: RulesTestEnvironment;
before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-mobi-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await environment.cleanup(); });
beforeEach(async () => { await environment.clearFirestore(); });

function helpRecord(operationId = 'intent-1') {
  return {
    schemaVersion: 1, id: `DEMO-${operationId}`, operationId, kind: 'help', status: 'saved-demo',
    serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', createdAt: serverTimestamp(), cancelledAt: null,
  };
}

test('applications are private to the owning UID and unavailable to anonymous clients', async () => {
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'users/user-a/applications/seed'), {
    ...helpRecord('seed'), createdAt: new Date(),
  }));
  const owner = environment.authenticatedContext('user-a').firestore();
  const other = environment.authenticatedContext('user-b').firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(owner, 'users/user-a/applications/seed')));
  await assertFails(getDoc(doc(other, 'users/user-a/applications/seed')));
  await assertFails(getDoc(doc(anonymous, 'users/user-a/applications/seed')));
});

test('help saves validate exact fields and permit only immutable saved-to-cancelled transition', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const ref = doc(db, 'users/user-a/applications/intent-1');
  await assertSucceeds(setDoc(ref, helpRecord()));
  await assertFails(setDoc(doc(db, 'users/user-a/applications/invalid'), { ...helpRecord('invalid'), admin: true }));
  await assertFails(updateDoc(ref, { serviceId: 'home-help' }));
  await assertSucceeds(updateDoc(ref, { status: 'cancelled-demo', cancelledAt: serverTimestamp() }));
  await assertFails(updateDoc(ref, { status: 'saved-demo', cancelledAt: null }));
  await assertFails(deleteDoc(ref));
});

test('legacy help records remain readable and cancellable while new date-note fields require a valid pair', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const legacyRef = doc(db, 'users/user-a/applications/legacy-help');
  const legacy = { ...helpRecord('legacy-help'), districtId: 'demo-left-bank', slotId: 'demo-afternoon' };
  await assertSucceeds(setDoc(legacyRef, legacy));
  await assertSucceeds(updateDoc(legacyRef, { status: 'cancelled-demo', cancelledAt: serverTimestamp() }));

  const valid = { ...helpRecord('new-help'), districtId: 'astana-esil', slotId: 'demo-10-12', dateId: 'demo-nov14', note: 'Side entrance' };
  await assertSucceeds(setDoc(doc(db, 'users/user-a/applications/new-help'), valid));
  await assertSucceeds(setDoc(doc(db, 'users/user-a/applications/unicode-note'), {
    ...helpRecord('unicode-note'), districtId: 'astana-esil', slotId: 'demo-10-12', dateId: 'demo-nov14', note: '😀'.repeat(140),
  }));
  await assertFails(setDoc(doc(db, 'users/user-a/applications/unicode-note-too-long'), {
    ...helpRecord('unicode-note-too-long'), districtId: 'astana-esil', slotId: 'demo-10-12', dateId: 'demo-nov14', note: '😀'.repeat(141),
  }));
  const { note: _note, ...dateOnly } = valid;
  await assertFails(setDoc(doc(db, 'users/user-a/applications/date-only'), { ...dateOnly, operationId: 'date-only', id: 'DEMO-date-only' }));
  await assertFails(setDoc(doc(db, 'users/user-a/applications/note-only'), { ...helpRecord('note-only'), note: '' }));
  await assertFails(setDoc(doc(db, 'users/user-a/applications/bad-date'), { ...valid, operationId: 'bad-date', id: 'DEMO-bad-date', dateId: 'nov-12' }));
  await assertFails(setDoc(doc(db, 'users/user-a/applications/long-note'), { ...valid, operationId: 'long-note', id: 'DEMO-long-note', note: 'x'.repeat(281) }));
});

test('event applications and active pointers must be created and cancelled atomically', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const repository = createApplicationsRepository(db as unknown as Firestore);
  const saved = await repository.submit({ uid: 'user-a', operationId: 'event-1', kind: 'event', eventId: 'tea' });
  assert.equal(saved.status, 'saved-demo');
  const pointerRef = doc(db, 'users/user-a/activeEvents/tea');
  const eventRef = doc(db, 'users/user-a/applications/event-1');
  await assertFails(setDoc(doc(db, 'users/user-a/applications/direct-event'), {
    schemaVersion: 1, id: 'DEMO-direct-event', operationId: 'direct-event', kind: 'event', status: 'saved-demo', eventId: 'tea', createdAt: serverTimestamp(), cancelledAt: null,
  }));
  const cancelled = await repository.cancel('user-a', saved.id);
  assert.equal(cancelled.status, 'cancelled-demo');
  assert.equal((await assertSucceeds(getDoc(pointerRef))).exists(), false);
  const repeated = await repository.cancel('user-a', saved.id);
  assert.equal(repeated.cancelledAt, cancelled.cancelledAt);
  await assertSucceeds(getDoc(eventRef));
});

test('concurrent event submissions cannot create two active applications', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const repository = createApplicationsRepository(db as unknown as Firestore);
  const results = await Promise.allSettled([
    repository.submit({ uid: 'user-a', operationId: 'event-a', kind: 'event', eventId: 'tea' }),
    repository.submit({ uid: 'user-a', operationId: 'event-b', kind: 'event', eventId: 'tea' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  assert.ok(rejected?.reason instanceof CloudApplicationError);
  assert.equal((rejected!.reason as CloudApplicationError).code, 'ALREADY_ENROLLED');
});

test('rules reject cross-owner writes, malformed IDs, active pointer tampering, and unpaired event cancellation', async () => {
  const owner = environment.authenticatedContext('user-a').firestore();
  const other = environment.authenticatedContext('user-b').firestore();
  await assertFails(setDoc(doc(other, 'users/user-a/applications/other-user'), helpRecord('other-user')));
  await assertFails(setDoc(doc(owner, `users/user-a/applications/${'x'.repeat(129)}`), helpRecord('x'.repeat(129))));
  await assertFails(getDocs(collection(other, 'users/user-a/applications')));

  const repository = createApplicationsRepository(owner as unknown as Firestore);
  const saved = await repository.submit({ uid: 'user-a', operationId: 'active-1', kind: 'event', eventId: 'tea' });
  const pointer = doc(owner, 'users/user-a/activeEvents/tea');
  const app = doc(owner, 'users/user-a/applications/active-1');
  await assertFails(deleteDoc(pointer));
  await assertFails(setDoc(pointer, { operationId: 'other', applicationId: 'DEMO-other' }));
  await assertFails(updateDoc(app, { status: 'cancelled-demo', cancelledAt: serverTimestamp() }));
  assert.equal((await assertSucceeds(getDoc(pointer))).data()?.operationId, 'active-1');
  assert.equal(saved.id, 'DEMO-active-1');
});

test('duplicate operation IDs cannot change selection and retry after cancellation preserves the first cancel time', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const repository = createApplicationsRepository(db as unknown as Firestore);
  const saved = await repository.submit({ uid: 'user-a', operationId: 'same-1', kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning' });
  await assert.rejects(() => repository.submit({ uid: 'user-a', operationId: 'same-1', kind: 'help', serviceId: 'home-help', districtId: 'demo-center', slotId: 'demo-morning' }), (error: unknown) => error instanceof CloudApplicationError && error.code === 'INVALID_INTENT');
  const cancelled = await repository.cancel('user-a', saved.id);
  const retry = await repository.submit({ uid: 'user-a', operationId: 'same-1', kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning' });
  assert.equal(retry.status, 'cancelled-demo');
  assert.equal(retry.cancelledAt, cancelled.cancelledAt);
});

test('reusing a help operation ID with a changed date or note is rejected', async () => {
  const db = environment.authenticatedContext('user-a').firestore();
  const repository = createApplicationsRepository(db as unknown as Firestore);
  const intent = { uid: 'user-a', operationId: 'date-note-id', kind: 'help' as const, serviceId: 'groceries' as const,
    districtId: 'astana-esil' as const, slotId: 'demo-10-12' as const, dateId: 'demo-nov12' as const, note: 'Ring once' };
  await repository.submit(intent);
  await assert.rejects(() => repository.submit({ ...intent, dateId: 'demo-nov14' }), (error: unknown) => error instanceof CloudApplicationError && error.code === 'INVALID_INTENT');
  await assert.rejects(() => repository.submit({ ...intent, note: 'Ring twice' }), (error: unknown) => error instanceof CloudApplicationError && error.code === 'INVALID_INTENT');
});
