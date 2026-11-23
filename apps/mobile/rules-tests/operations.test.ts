import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, before, beforeEach } from 'node:test';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDocFromServer, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { createOperationsRepository, getOperationalDates, isOperationalSlotAvailable } from '../src/firebase/operations';

let environment: RulesTestEnvironment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-mobi-operations-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => { await environment?.cleanup(); });
beforeEach(async () => { await environment.clearFirestore(); });

function client(uid: string) {
  const db = environment.authenticatedContext(uid).firestore() as unknown as Firestore;
  return { db, repo: createOperationsRepository(db) };
}

async function seed(path: string, data: Record<string, unknown>) {
  await environment.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), path), data));
}

const input = (operationId: string) => ({
  operationId, serviceId: 'groceries', districtId: 'astana-esil', slotId: '10-12',
  date: getOperationalDates()[1], note: 'Please knock.',
} as const);

test('help retries, atomic assignment, private coordination and completion', async () => {
  await seed('volunteerRoles/v1', {});
  await seed('volunteerRoles/v2', {});
  const resident = client('resident');
  const first = client('v1');
  const second = client('v2');
  const other = client('other');

  const created = await resident.repo.createHelp('resident', input('request-1'));
  assert.deepEqual(await resident.repo.createHelp('resident', input('request-1')), created);
  const queue = await first.repo.listOpenHelp('v1');
  assert.deepEqual(queue, [created]);
  const raw = await getDocFromServer(doc(first.db, 'operationalHelp', created.id));
  assert.equal(Object.hasOwn(raw.data()!, 'note'), false);
  assert.equal(Object.hasOwn(raw.data()!, 'ownerUid'), false);
  await assertFails(getDocFromServer(doc(first.db, 'operationalHelpPrivate', created.id)));
  await assertFails(getDocFromServer(doc(other.db, 'operationalHelpPrivate', created.id)));

  const attempts = await Promise.allSettled([first.repo.claimHelp('v1', created.id), second.repo.claimHelp('v2', created.id)]);
  assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
  const [winner, winnerUid, loser, loserUid] = attempts[0].status === 'fulfilled'
    ? [first, 'v1', second, 'v2'] as const
    : [second, 'v2', first, 'v1'] as const;
  assert.deepEqual(await loser.repo.listVolunteerHelp(loserUid), []);
  await assertFails(getDocFromServer(doc(loser.db, 'operationalHelpPrivate', created.id)));
  assert.equal((await winner.repo.getCoordination(winnerUid, created.id)).note, 'Please knock.');
  await resident.repo.sendCoordination('resident', created.id, 'I am available.');
  await winner.repo.sendCoordination(winnerUid, created.id, 'See you at ten.');
  assert.equal((await winner.repo.getCoordination(winnerUid, created.id)).residentMessage, 'I am available.');
  assert.equal((await resident.repo.getCoordination('resident', created.id)).volunteerMessage, 'See you at ten.');
  const winnerDetails = await getDocFromServer(doc(winner.db, 'operationalHelpPrivate', created.id));
  assert.equal(Object.hasOwn(winnerDetails.data()!, 'ownerUid'), false);
  await assertFails(updateDoc(doc(winner.db, 'operationalHelpPrivate', created.id), {
    residentMessage: 'Invalid author', residentMessageAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(resident.db, 'operationalHelpPrivate', created.id), {
    volunteerMessage: 'Invalid author', volunteerMessageAt: serverTimestamp(),
  }));
  await winner.repo.completeHelp(winnerUid, created.id);
  await winner.repo.completeHelp(winnerUid, created.id);
  await assert.rejects(resident.repo.cancelHelp('resident', created.id), { code: 'UNAVAILABLE' });
  await assertFails(getDocFromServer(doc(winner.db, 'operationalHelpPrivate', created.id)));
  assert.equal((await resident.repo.listResidentHelp('resident'))[0].status, 'completed');
});

test('owner role changes, cancellation and grant revocation close access to private coordination', async () => {
  const resident = client('resident');
  const volunteer = client('volunteer');
  const created = await resident.repo.createHelp('resident', input('request-2'));
  await assert.rejects(resident.repo.createHelp('resident', { ...input('request-2'), note: 'Different request' }), { code: 'CONFLICT' });
  await assert.rejects(resident.repo.createHelp('resident', { ...input('invalid-date'), date: '2026-02-30' }), { code: 'INVALID_INPUT' });
  await seed('volunteerRoles/resident', {});
  await assert.rejects(resident.repo.claimHelp('resident', created.id), { code: 'UNAVAILABLE' });
  await assert.rejects(resident.repo.listResidentHelp('resident'), { code: 'ACCESS_DENIED' });
  await seed('volunteerRoles/volunteer', {});
  await volunteer.repo.claimHelp('volunteer', created.id);
  assert.equal((await volunteer.repo.getCoordination('volunteer', created.id)).note, input('request-2').note);

  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), 'volunteerRoles/resident'));
    await deleteDoc(doc(context.firestore(), 'volunteerRoles/volunteer'));
  });
  await assert.rejects(volunteer.repo.getCoordination('volunteer', created.id), { code: 'ACCESS_DENIED' });
  await assert.rejects(volunteer.repo.completeHelp('volunteer', created.id), { code: 'ACCESS_DENIED' });
  await resident.repo.cancelHelp('resident', created.id);
  await resident.repo.cancelHelp('resident', created.id);
  await seed('volunteerRoles/volunteer', {});
  assert.equal((await volunteer.repo.listVolunteerHelp('volunteer'))[0].status, 'cancelled');
  await assert.rejects(volunteer.repo.getCoordination('volunteer', created.id), { code: 'ACCESS_DENIED' });
  await assertFails(updateDoc(doc(resident.db, 'operationalHelpPrivate', created.id), {
    residentMessage: 'Too late', residentMessageAt: serverTimestamp(),
  }));
});

test('help cannot publish stale dates or standalone ownership and private records', async () => {
  const resident = client('resident');
  const boundary = new Date('2026-12-31T19:00:00.000Z');
  assert.equal(getOperationalDates(boundary)[0], '2027-01-01');
  assert.equal(getOperationalDates(boundary).at(-1), '2027-01-31');
  assert.equal(isOperationalSlotAvailable('2027-01-01', '10-12', new Date('2027-01-01T04:59:59.999Z')), true);
  assert.equal(isOperationalSlotAvailable('2027-01-01', '10-12', new Date('2027-01-01T05:00:00.000Z')), false);
  await assert.rejects(resident.repo.createHelp('resident', { ...input('past'), date: '2020-01-01' }), { code: 'UNAVAILABLE' });
  await assertFails(setDoc(doc(resident.db, 'users/resident/operationalHelpLinks/disconnected'), {
    createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(resident.db, 'operationalHelpPrivate/disconnected'), {
    note: '', residentMessage: '', volunteerMessage: '', residentMessageAt: null, volunteerMessageAt: null,
  }));
});

test('trusted publication, fresh capacity, cancellation history and re-enrollment', async () => {
  const date = new Date(Date.now() + 86_400_000);
  const title = { ru: 'Meeting', kz: 'Meeting' };
  const meeting = { title, description: title, place: title, startsAt: date, status: 'open', capacity: 1, enrolledCount: 0, published: true };
  const first = client('resident-a');
  const second = client('resident-b');
  const anonymous = environment.unauthenticatedContext().firestore() as unknown as Firestore;
  const guest = createOperationsRepository(anonymous);
  assert.deepEqual(await guest.listMeetings(), []);
  await assertFails(setDoc(doc(first.db, 'operationalMeetings', 'meeting-a'), meeting));
  await seed('operationalMeetings/meeting-a', meeting);
  await seed('operationalMeetings/unpublished', { ...meeting, published: false });
  const catalog = await guest.listMeetings();
  assert.deepEqual(catalog.map(({ id }) => id), ['meeting-a']);
  const reviewed = catalog[0];
  await assertFails(updateDoc(doc(first.db, 'operationalMeetings', 'meeting-a'), { enrolledCount: 1 }));

  const attempts = await Promise.allSettled([
    first.repo.enrollMeeting('resident-a', 'meeting-a', 'enrollment-a', reviewed),
    second.repo.enrollMeeting('resident-b', 'meeting-a', 'enrollment-b', reviewed),
  ]);
  assert.equal(attempts.filter(({ status }) => status === 'fulfilled').length, 1);
  const [winner, uid, id] = attempts[0].status === 'fulfilled'
    ? [first, 'resident-a', 'enrollment-a'] as const
    : [second, 'resident-b', 'enrollment-b'] as const;
  await winner.repo.enrollMeeting(uid, 'meeting-a', id, reviewed);
  assert.equal((await guest.listMeetings())[0].enrolledCount, 1);
  assert.equal((await winner.repo.listEnrollments(uid)).length, 1);
  const updated = { ...meeting, enrolledCount: 1, title: { ru: 'Updated', kz: 'Updated' }, status: 'cancelled' };
  await seed('operationalMeetings/meeting-a', updated);
  await winner.repo.cancelEnrollment(uid, 'meeting-a', id);
  assert.equal((await guest.listMeetings())[0].enrolledCount, 0);
  assert.deepEqual((await winner.repo.listEnrollments(uid))[0].title, title);
  assert.equal((await winner.repo.listEnrollments(uid))[0].status, 'cancelled');
  await seed('operationalMeetings/meeting-a', { ...updated, enrolledCount: 0, status: 'open' });
  await assert.rejects(winner.repo.enrollMeeting(uid, 'meeting-a', 'enrollment-retry', reviewed), { code: 'CONFLICT' });
  assert.equal((await guest.listMeetings())[0].enrolledCount, 0);
  await winner.repo.enrollMeeting(uid, 'meeting-a', 'enrollment-retry', (await guest.listMeetings())[0]);
  assert.equal((await winner.repo.listEnrollments(uid)).length, 2);
});

test('registration survives unpublication and attendee cancellation still opens a seat', async () => {
  const title = { ru: 'Meeting', kz: 'Meeting' };
  const meeting = {
    title, description: title, place: title, startsAt: new Date(Date.now() + 86_400_000),
    status: 'open', capacity: 2, enrolledCount: 0, published: true,
  };
  const attendee = client('attendee');
  const other = client('other');
  await seed('operationalMeetings/unpublished-later', meeting);
  const [reviewed] = await attendee.repo.listMeetings();
  await attendee.repo.enrollMeeting('attendee', 'unpublished-later', 'attendee-one', reviewed);
  await assert.rejects(attendee.repo.enrollMeeting('attendee', 'unpublished-later', 'attendee-two', reviewed), { code: 'ALREADY_ENROLLED' });
  await seed('operationalMeetings/unpublished-later', { ...meeting, enrolledCount: 1, published: false });
  assert.deepEqual(await other.repo.listMeetings(), []);
  await assertFails(getDocFromServer(doc(other.db, 'operationalMeetings/unpublished-later')));
  await assertFails(getDocFromServer(doc(attendee.db, 'operationalMeetings/unpublished-later')));
  await assertFails(getDocFromServer(doc(other.db, 'users/attendee/operationalEnrollments/attendee-one')));
  await attendee.repo.cancelEnrollment('attendee', 'unpublished-later', 'attendee-one');
  await attendee.repo.cancelEnrollment('attendee', 'unpublished-later', 'attendee-one');
  assert.equal((await attendee.repo.listEnrollments('attendee'))[0].status, 'cancelled');
  await environment.withSecurityRulesDisabled(async (context) => {
    const state = await getDocFromServer(doc(context.firestore(), 'operationalMeetings/unpublished-later'));
    assert.equal(state.data()?.enrolledCount, 0);
  });
  await seed('operationalMeetings/unpublished-later', meeting);
  await attendee.repo.enrollMeeting('attendee', 'unpublished-later', 'attendee-deleted', reviewed);
  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), 'operationalMeetings/unpublished-later'));
  });
  await attendee.repo.cancelEnrollment('attendee', 'unpublished-later', 'attendee-deleted');
  const removed = (await attendee.repo.listEnrollments('attendee')).find(({ id }) => id === 'attendee-deleted');
  assert.equal(removed?.status, 'cancelled');
});
