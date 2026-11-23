import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, deleteDoc, type Firestore } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createApplicationsRepository, CloudApplicationError } from '../src/firebase/applications';
import { createVolunteerRepository, resolveAccountRole, VolunteerError } from '../src/firebase/volunteers';

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
async function grantVolunteer(uid: string) {
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), 'volunteerRoles', uid), { grantedAt: new Date() }));
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

test('operator role grants are owner-readable and client-unwritable, with server-backed resolution', async () => {
  await grantVolunteer('volunteer-a');
  const volunteer = environment.authenticatedContext('volunteer-a').firestore();
  const other = environment.authenticatedContext('resident-a').firestore();
  await assertSucceeds(getDoc(doc(volunteer, 'volunteerRoles/volunteer-a')));
  await assertFails(getDoc(doc(other, 'volunteerRoles/volunteer-a')));
  await assertFails(setDoc(doc(volunteer, 'volunteerRoles/volunteer-a'), {}));
  await assertFails(setDoc(doc(volunteer, 'users/volunteer-a/applications/private'), helpRecord('private')));
  await assertFails(getDoc(doc(volunteer, 'users/volunteer-a/applications/private')));
  assert.equal(await resolveAccountRole(volunteer as unknown as Firestore, 'volunteer-a'), 'volunteer');
  assert.equal(await resolveAccountRole(other as unknown as Firestore, 'resident-a'), 'resident');
});

test('help submission atomically publishes only sanitized queue data and volunteers cannot read resident records', async () => {
  await grantVolunteer('volunteer-a');
  const residentDb = environment.authenticatedContext('resident-a').firestore();
  const volunteerDb = environment.authenticatedContext('volunteer-a').firestore();
  const residentApps = createApplicationsRepository(residentDb as unknown as Firestore);
  const call = await residentApps.submit({ uid: 'resident-a', operationId: 'public-1', kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', dateId: 'demo-nov12', note: 'Private note' });
  const queue = createVolunteerRepository(volunteerDb as unknown as Firestore);
  const openCalls = await queue.listOpenHelpCalls('volunteer-a');
  assert.equal(openCalls.length, 1);
  assert.equal(openCalls[0]?.operationId, 'public-1');
  assert.equal('note' in openCalls[0]!, false);
  assert.equal('claimedBy' in openCalls[0]!, true);
  await assertFails(getDoc(doc(volunteerDb, 'users/resident-a/applications/public-1')));
  await assertFails(getDoc(doc(volunteerDb, 'users/resident-a/helpCallLinks/public-1')));
  await assertFails(setDoc(doc(volunteerDb, 'helpCalls/forged'), {
    serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', dateId: null,
    status: 'open', claimedBy: null, createdAt: serverTimestamp(), claimedAt: null,
  }));
  await assertFails(getDocs(collection(volunteerDb, 'helpCalls')));
  assert.equal(call.status, 'saved-demo');
});

test('only one volunteer can claim a call, retries are idempotent, and statistics are UID-scoped', async () => {
  await grantVolunteer('volunteer-a');
  await grantVolunteer('volunteer-b');
  const resident = createApplicationsRepository(environment.authenticatedContext('resident-a').firestore() as unknown as Firestore);
  await resident.submit({ uid: 'resident-a', operationId: 'claim-1', kind: 'help', serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning' });
  const dbA = environment.authenticatedContext('volunteer-a').firestore();
  const dbB = environment.authenticatedContext('volunteer-b').firestore();
  const queueA = createVolunteerRepository(dbA as unknown as Firestore);
  const queueB = createVolunteerRepository(dbB as unknown as Firestore);
  const results = await Promise.allSettled([queueA.pickUpHelpCall('volunteer-a', 'claim-1'), queueB.pickUpHelpCall('volunteer-b', 'claim-1')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const statsA = await queueA.getVolunteerStats('volunteer-a');
  const statsB = await queueB.getVolunteerStats('volunteer-b');
  const winnerUid = statsA.pickedUp === 1 ? 'volunteer-a' : 'volunteer-b';
  const winningRepo = winnerUid === 'volunteer-a' ? queueA : queueB;
  const losingRepo = winnerUid === 'volunteer-a' ? queueB : queueA;
  await winningRepo.pickUpHelpCall(winnerUid, 'claim-1');
  await assert.rejects(() => losingRepo.pickUpHelpCall(winnerUid === 'volunteer-a' ? 'volunteer-b' : 'volunteer-a', 'claim-1'),
    (error: unknown) => error instanceof VolunteerError && error.code === 'CALL_TAKEN');
  assert.deepEqual(await winningRepo.getVolunteerStats(winnerUid), { pickedUp: 1, active: 1, cancelled: 0 });
  assert.deepEqual(await losingRepo.getVolunteerStats(winnerUid === 'volunteer-a' ? 'volunteer-b' : 'volunteer-a'), { pickedUp: 0, active: 0, cancelled: 0 });
  const residentRepo = createVolunteerRepository(environment.authenticatedContext('resident-a').firestore() as unknown as Firestore);
  await assert.rejects(() => residentRepo.listOpenHelpCalls('resident-a'), (error: unknown) => error instanceof VolunteerError && error.code === 'NOT_VOLUNTEER');
});

test('resident cancellation after pickup keeps the volunteer historical statistic', async () => {
  await grantVolunteer('volunteer-a');
  const resident = createApplicationsRepository(environment.authenticatedContext('resident-a').firestore() as unknown as Firestore);
  const saved = await resident.submit({ uid: 'resident-a', operationId: 'cancel-picked', kind: 'help', serviceId: 'home-help', districtId: 'demo-left-bank', slotId: 'demo-afternoon' });
  const queue = createVolunteerRepository(environment.authenticatedContext('volunteer-a').firestore() as unknown as Firestore);
  await queue.pickUpHelpCall('volunteer-a', saved.operationId);
  await resident.cancel('resident-a', saved.id);
  assert.deepEqual(await queue.getVolunteerStats('volunteer-a'), { pickedUp: 1, active: 0, cancelled: 1 });
  assert.equal((await queue.listOpenHelpCalls('volunteer-a')).length, 0);
});

test('legacy private-only help remains cancellable without retroactive queue publication', async () => {
  const residentDb = environment.authenticatedContext('resident-a').firestore();
  const legacy = createApplicationsRepository(residentDb as unknown as Firestore);
  const ref = doc(residentDb, 'users/resident-a/applications/old-private');
  await assertSucceeds(setDoc(ref, helpRecord('old-private')));
  const cancelled = await legacy.cancel('resident-a', 'DEMO-old-private');
  assert.equal(cancelled.status, 'cancelled-demo');
  await environment.withSecurityRulesDisabled(async (context) => assert.equal((await getDoc(doc(context.firestore(), 'helpCalls/old-private'))).exists(), false));
  await assertFails(setDoc(doc(residentDb, 'users/resident-a/helpCallLinks/old-private'), { operationId: 'old-private' }));
  await assertFails(setDoc(doc(residentDb, 'helpCalls/old-private'), {
    serviceId: 'groceries', districtId: 'demo-center', slotId: 'demo-morning', dateId: null,
    status: 'open', claimedBy: null, createdAt: serverTimestamp(), claimedAt: null,
  }));
});

test('revoking a volunteer grant immediately removes the queue capability', async () => {
  await grantVolunteer('volunteer-a');
  const db = environment.authenticatedContext('volunteer-a').firestore();
  const queue = createVolunteerRepository(db as unknown as Firestore);
  assert.equal(await resolveAccountRole(db as unknown as Firestore, 'volunteer-a'), 'volunteer');
  await environment.withSecurityRulesDisabled(async (context) => deleteDoc(doc(context.firestore(), 'volunteerRoles/volunteer-a')));
  assert.equal(await resolveAccountRole(db as unknown as Firestore, 'volunteer-a'), 'resident');
  await assert.rejects(() => queue.listOpenHelpCalls('volunteer-a'), (error: unknown) => error instanceof VolunteerError && error.code === 'NOT_VOLUNTEER');
});
